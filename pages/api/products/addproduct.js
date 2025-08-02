import formidable from "formidable";
import fs from "fs";
import { getNextId } from "@/lib/getnextid";
import clientPromise from "@/lib/mongodb";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import AWS from "aws-sdk";
import path from "path";

dotenv.config({ path: ".env.local" });

// غیرفعال‌سازی پارس بدنه پیش‌فرض
export const config = {
  api: {
    bodyParser: false,
  },
};

// تنظیم اتصال به آروان‌کلود (S3 Compatible)
const s3 = new AWS.S3({
  endpoint: process.env.ARVAN_ENDPOINT, // مثل: "https://s3.ir-thr-at1.arvanstorage.ir"
  accessKeyId: process.env.ARVAN_ACCESS_KEY,
  secretAccessKey: process.env.ARVAN_SECRET_KEY,
  region: "ir-thr-at1",
  signatureVersion: "v4",
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const form = formidable({
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
    filter: (part) =>
      part.mimetype?.startsWith("image/") || part.mimetype?.startsWith("video/"),
  });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ message: "خطا در پردازش فایل‌ها" });

    const title = fields.title?.[0] || "";
    const shortDescription = fields.shortDescription?.[0] || "";
    const fullDescription = fields.fullDescription?.[0] || "";

    if (!title || !shortDescription || !files.image) {
      return res.status(400).json({ message: "فیلدهای اجباری پر نشده‌اند." });
    }

    try {
      const client = await clientPromise;
      const db = client.db("robotsaz");
      const id = await getNextId("productId");

      // تابع آپلود به آروان‌کلود
      const uploadToArvan = async (file, type) => {
        const fileExt = path.extname(file.originalFilename || "");
        const fileKey = `products/product-${id}-${uuidv4()}${fileExt}`;
        const fileContent = fs.readFileSync(file.filepath);

        await s3
          .putObject({
            Bucket: process.env.ARVAN_BUCKET_NAME,
            Key: fileKey,
            Body: fileContent,
            ACL: "public-read",
          })
          .promise();

        return `${process.env.ARVAN_BUCKET_URL}/${fileKey}`;
      };

      const imageUrl = await uploadToArvan(files.image[0], "image");
      const videoUrl = files.video?.[0]
        ? await uploadToArvan(files.video[0], "video")
        : "";

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

      return res.status(200).json({
        message: "محصول با موفقیت اضافه شد.",
        product: newProduct,
      });
    } catch (err) {
      console.error("خطا در ذخیره محصول:", err);
      return res.status(500).json({ message: "خطای سرور" });
    }
  });
}
