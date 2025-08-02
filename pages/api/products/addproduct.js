import formidable from "formidable";
import fs from "fs";
import path from "path";
import { getNextId } from "@/lib/getnextid";
import clientPromise from "@/lib/mongodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// غیرفعال‌سازی پارس بدنه پیش‌فرض
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
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const uploadDir = path.join(process.cwd(), "/public/uploads");
  fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 5MB
    filter: (part) =>
      part.mimetype?.startsWith("image/") ||
      part.mimetype?.startsWith("video/"),
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("خطا در آپلود:", err);
      return res.status(500).json({ message: "خطا در پردازش فایل‌ها" });
    }

    const title = fields.title?.[0] || "";
    const shortDescription = fields.shortDescription?.[0] || "";
    const fullDescription = fields.fullDescription?.[0] || "";

    // اعتبارسنجی فیلدهای ضروری
    if (!title || !shortDescription || !files.image) {
      return res.status(400).json({ message: "فیلدهای اجباری پر نشده‌اند." });
    }
    const backendUrl = process.env.BACKEND_URL;
    const imagePath = files.image[0]?.newFilename || "";
    const videoPath = files.video?.[0]?.newFilename || "";

    const imageUrl = `${backendUrl}/uploads/${imagePath}`;
    const videoUrl = videoPath ? `${backendUrl}/uploads/${videoPath}` : "";

    try {
      const client = await clientPromise;
      const db = client.db("robotsaz");
      const id = await getNextId("productId");

      const newProduct = {
        id,
        title,
        description: shortDescription,
        longDescription: fullDescription,
        image: imageUrl,
        video: videoUrl,
        createdAt: new Date(),
      };

      await db.collection("products").insertOne(newProduct);

      return res
        .status(200)
        .json({ message: "محصول با موفقیت اضافه شد.", product: newProduct });
    } catch (err) {
      console.error("خطا در ذخیره محصول:", err);
      return res.status(500).json({ message: "خطایی در سرور رخ داد." });
    }
  });
}
