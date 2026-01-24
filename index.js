import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import { exec } from "child_process";

const app = express();

/* -------------------- CORS -------------------- */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    exposedHeaders: ["X-Compressed-Size-KB"],
  })
);

/* -------------------- KEEP ALIVE -------------------- */
app.use((req, res, next) => {
  res.setHeader("Connection", "keep-alive");
  next();
});

/* -------------------- FOLDERS -------------------- */
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("compressed")) fs.mkdirSync("compressed");

/* -------------------- MULTER -------------------- */
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files allowed"));
    }
    cb(null, true);
  },
});

/* -------------------- HEALTH -------------------- */
app.get("/", (req, res) => {
  res.send("PDF Compress API is running 🚀");
});

/* -------------------- COMPRESS ROUTE -------------------- */
app.post("/compress", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF uploaded" });
  }

  const TARGET_KB = parseInt(req.body.size, 10);
  const inputPath = req.file.path;
  const outputPath = `compressed/compressed-${Date.now()}.pdf`;

  // Compression levels (soft → aggressive)
  const profiles = ["/printer", "/ebook", "/screen"];

  // Decide starting profile
  let index = 1; // default ebook
  if (TARGET_KB <= 200) index = 2;
  else if (TARGET_KB <= 300) index = 1;
  else index = 0;

  function compress(profile, callback) {
    const cmd = `
      gs -sDEVICE=pdfwrite \
      -dCompatibilityLevel=1.4 \
      -dPDFSETTINGS=${profile} \
      -dNOPAUSE -dQUIET -dBATCH \
      -sOutputFile=${outputPath} ${inputPath}
    `;
    exec(cmd, { timeout: 60000 }, callback);
  }

  function tryCompress() {
    const profile = profiles[index];

    compress(profile, (err) => {
      if (err) {
        console.error("Ghostscript error:", err);
        cleanup(inputPath, outputPath);
        return res.status(500).json({ error: "Compression failed" });
      }

      const sizeKB = Math.round(fs.statSync(outputPath).size / 1024);

      // ✅ SUCCESS: under target OR max aggressive reached
      if (sizeKB <= TARGET_KB || index === profiles.length - 1) {
        res.setHeader("X-Compressed-Size-KB", sizeKB);
        return res.download(outputPath, "compressed.pdf", () => {
          cleanup(inputPath, outputPath);
        });
      }

      // 🔁 Retry with more aggressive compression
      index++;
      tryCompress();
    });
  }

  tryCompress();
});

/* -------------------- CLEANUP -------------------- */
function cleanup(input, output) {
  fs.unlink(input, () => { });
  fs.unlink(output, () => { });
}

/* -------------------- PORT -------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
