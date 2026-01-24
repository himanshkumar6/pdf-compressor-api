import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

app.post("/compress", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    message: "PDF received",
    file: req.file.originalname,
  });
});

app.get("/", (req, res) => {
  res.send("PDF Compress API is running 🚀");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
