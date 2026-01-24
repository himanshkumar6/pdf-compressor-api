import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import { exec } from "child_process";

const app = express();

/* -------------------- CORS (BROWSER SAFE) -------------------- */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    exposedHeaders: ["X-Compressed-Size-KB"],
  })
);

/* -------------------- KEEP CONNECTION ALIVE -------------------- */
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

/* -------------------- HEALTH CHECK -------------------- */
app.get("/", (req, res) => {
  res.send("PDF Compress API is running 🚀");
});

/* -------------------- PROFILE SELECTOR -------------------- */
function getProfile(size) {
  if (size === "200") return "/screen";
  if (size === "300") return "/ebook";
  if (size === "500") return "/printer";
  return "/ebook";
}

/* -------------------- COMPRESS ROUTE -------------------- */
app.post("/compress", upload.single("pdf"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF uploaded" });
    }

    const profile = getProfile(req.body.size);
    const inputPath = req.file.path;
    const outputPath = `compressed/compressed-${Date.now()}.pdf`;

    const command = `
      gs -sDEVICE=pdfwrite \
      -dCompatibilityLevel=1.4 \
      -dPDFSETTINGS=${profile} \
      -dNOPAUSE -dQUIET -dBATCH \
      -sOutputFile=${outputPath} ${inputPath}
    `;

    exec(command, { timeout: 60000 }, (error) => {
      if (error) {
        console.error("Ghostscript error:", error);
        cleanup(inputPath, outputPath);
        return res.status(500).json({ error: "Compression failed" });
      }

      // calculate compressed size
      const stats = fs.statSync(outputPath);
      const sizeKB = Math.round(stats.size / 1024);

      // IMPORTANT: expose size to frontend
      res.setHeader("X-Compressed-Size-KB", sizeKB);

      res.download(outputPath, "compressed.pdf", () => {
        cleanup(inputPath, outputPath);
      });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------- CLEANUP HELPER -------------------- */
function cleanup(input, output) {
  fs.unlink(input, () => { });
  fs.unlink(output, () => { });
}

/* -------------------- PORT -------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
