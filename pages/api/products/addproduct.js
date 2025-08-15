// pages/api/products/addproduct.js
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getNextId } from "@/lib/getnextid";
import clientPromise from "@/lib/mongodb";
import dotenv from "dotenv";

// AWS SDK v3
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config({ path: ".env.local" });

// جلوگیری از پارس پیش‌فرض بدنه
export const config = { api: { bodyParser: false } };

// S3 (Arvan) Client
const s3 = new S3Client({
  region: "ir-thr-at1",
  endpoint: process.env.ARVAN_ENDPOINT, // مثل https://s3.ir-thr-at1.arvanstorage.com
  credentials: {
    accessKeyId: process.env.ARVAN_ACCESS_KEY,
    secretAccessKey: process.env.ARVAN_SECRET_KEY,
  },
  forcePathStyle: true,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const form = formidable({
    keepExtensions: true,
    maxFileSize: 15 * 1024 * 1024, // فقط برای عکس (قابل تغییر)
    filter: (part) => part.mimetype?.startsWith("image/") || part.name === "videoUrl",
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("خطا در دریافت فایل‌ها:", err);
      return res.status(500).json({ message: "خطا در پردازش فایل‌ها" });
    }

    // فیلدهای فارسی
    const title = (fields.title?.[0] || "").trim();
    const shortDescription = (fields.shortDescription?.[0] || "").trim();
    const fullDescription = (fields.fullDescription?.[0] || "").trim();

    // فیلدهای انگلیسی (اختیاری)
    const titleEn = (fields.titleEn?.[0] || "").trim();
    const descriptionEn = (fields.descriptionEn?.[0] || "").trim();
    const longDescriptionEn = (fields.longDescriptionEn?.[0] || "").trim();

    // لینک ویدیو که از فرانت می‌آد (آپلود مستقیم به آروان)
    const videoUrlFromFront = (fields.videoUrl?.[0] || "").trim();

    if (!title || !shortDescription || !files.image?.[0]) {
      return res.status(400).json({ message: "فیلدهای اجباری پر نشده‌اند." });
    }

    try {
      const client = await clientPromise;
      const db = client.db("robotsaz");
      const id = await getNextId("productId");

      // آپلود عکس به آروان (v3)
      const uploadImageToArvan = async (file) => {
        const ext = path.extname(file.originalFilename || "");
        const key = `products/product-${id}-${uuidv4()}${ext}`;
        const body = await fs.promises.readFile(file.filepath);

        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.ARVAN_BUCKET,
            Key: key,
            Body: body,
            ACL: "public-read",
            ContentType: file.mimetype || undefined,
            CacheControl: "public, max-age=31536000, immutable",
          })
        );

        const base = (process.env.ARVAN_BUCKET_URL || "").replace(/\/+$/, "");
        return `${base}/${key}`;
      };

      const imageUrl = await uploadImageToArvan(files.image[0]);

      // ویدیو را دیگر در بک‌اند آپلود نمی‌کنیم؛ فقط لینک ذخیره می‌شود
      const videoUrl = videoUrlFromFront || "";

      const newProduct = {
        id,
        title,
        description: shortDescription,
        longDescription: fullDescription,
        titleEn,
        descriptionEn,
        longDescriptionEn,
        image: imageUrl,
        video: videoUrl,
        createdAt: new Date(),
      };

      await db.collection("products").insertOne(newProduct);

      return res.status(200).json({
        message: "محصول با موفقیت اضافه شد.",
        product: newProduct,
      });
    } catch (e) {
      console.error("خطا در ذخیره محصول:", e);
      return res.status(500).json({ message: "خطای سرور" });
    }
  });
}
