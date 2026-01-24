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
  limits: { fileSize: 10 * 1024 * 1024 },
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

/* -------------------- GS OPTIONS -------------------- */
function getGSOptions(targetKB) {
  if (targetKB <= 200) return { profile: "/screen", dpi: 72 };
  if (targetKB <= 300) return { profile: "/ebook", dpi: 96 };
  return { profile: "/printer", dpi: 150 };
}

/* -------------------- COMPRESS -------------------- */
app.post("/compress", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF uploaded" });
  }

  const TARGET_KB = parseInt(req.body.size, 10);
  const { profile, dpi } = getGSOptions(TARGET_KB);

  const inputPath = req.file.path;
  const outputPath = `compressed/compressed-${Date.now()}.pdf`;

  const cmd = `
gs -sDEVICE=pdfwrite \
-dCompatibilityLevel=1.4 \
-dPDFSETTINGS=${profile} \
-dDownsampleColorImages=true \
-dDownsampleGrayImages=true \
-dDownsampleMonoImages=true \
-dColorImageResolution=${dpi} \
-dGrayImageResolution=${dpi} \
-dMonoImageResolution=${dpi} \
-dNOPAUSE -dQUIET -dBATCH \
-sOutputFile=${outputPath} ${inputPath}
`;

  exec(cmd, { timeout: 60000 }, (err) => {
    if (err) {
      console.error("Ghostscript error:", err);
      cleanup(inputPath, outputPath);
      return res.status(500).json({ error: "Compression failed" });
    }

    const sizeKB = Math.round(fs.statSync(outputPath).size / 1024);
    res.setHeader("X-Compressed-Size-KB", sizeKB);

    res.download(outputPath, "compressed.pdf", () => {
      cleanup(inputPath, outputPath);
    });
  });
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
