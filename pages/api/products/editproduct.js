import formidable from "formidable";
import fs from "fs";
import path from "path";
import clientPromise from "@/lib/mongodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*"); // یا فقط http://localhost:5173
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  const uploadDir = path.join(process.cwd(), "/public/uploads");
  fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 20 * 1024 * 1024,
    filter: (part) =>
      part.mimetype?.startsWith("image/") ||
      part.mimetype?.startsWith("video/"),
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("خطا در دریافت فایل‌ها:", err);
      return res.status(500).json({ message: "خطا در دریافت فایل‌ها" });
    }

    const id = parseInt(fields.id?.[0], 10);
    const title = fields.title?.[0] || "";
    const description = fields.description?.[0] || "";
    const longDescription = fields.longDescription?.[0] || "";

    if (!id || !title || !description) {
      return res.status(400).json({ message: "فیلدهای ضروری پر نشده‌اند." });
    }

    const imageFile = files.image?.[0];
    const videoFile = files.video?.[0];

    const BACKEND_URL = process.env.BACKEND_URL;

    const imagePath = imageFile
      ? `${BACKEND_URL}/uploads/${imageFile.newFilename}`
      : null;
    const videoPath = videoFile
      ? `${BACKEND_URL}/uploads/${videoFile.newFilename}`
      : null;

    try {
      const client = await clientPromise;
      const db = client.db("robotsaz");

      const updateFields = {
        title,
        description,
        longDescription,
      };
      if (imagePath) updateFields.image = imagePath;
      if (videoPath) updateFields.video = videoPath;

      const result = await db
        .collection("products")
        .updateOne({ id }, { $set: updateFields });

      if (result.modifiedCount === 0) {
        return res
          .status(404)
          .json({
            message: "لطفا مقادیر هر کدام از فیلد های مورد تمایل را تغییر دهید",
          });
      }

      return res.status(200).json({ message: "محصول با موفقیت ویرایش شد." });
    } catch (error) {
      console.error("خطا در ویرایش محصول:", error);
      return res.status(500).json({ message: "خطای سرور" });
    }
  });
}
