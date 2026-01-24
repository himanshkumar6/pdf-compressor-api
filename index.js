import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import { exec } from "child_process";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    exposedHeaders: ["X-Compressed-Size-KB"],
  })
);

// ensure folders
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("compressed")) fs.mkdirSync("compressed");

// multer
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

app.get("/", (req, res) => {
  res.send("PDF Compress API is running 🚀");
});

// helper: choose GS profile
function getProfile(size) {
  if (size === "200") return "/screen";
  if (size === "300") return "/ebook";
  if (size === "500") return "/printer";
  return "/ebook"; // default
}

app.post("/compress", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF uploaded" });
  }

  const targetSize = req.body.size; // 200 | 300 | 500
  const profile = getProfile(targetSize);

  const inputPath = req.file.path;
  const outputPath = `compressed/compressed-${Date.now()}.pdf`;

  const command = `
    gs -sDEVICE=pdfwrite \
    -dCompatibilityLevel=1.4 \
    -dPDFSETTINGS=${profile} \
    -dNOPAUSE -dQUIET -dBATCH \
    -sOutputFile=${outputPath} ${inputPath}
  `;

  exec(command, (error) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Compression failed" });
    }

    // send result
    res.download(outputPath, "compressed.pdf", () => {
      fs.unlink(inputPath, () => { });
      fs.unlink(outputPath, () => { });
    });
  });
});

// Railway compatible port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
