// pages/api/products/editproduct.js
import formidable from "formidable";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import clientPromise from "@/lib/mongodb";
import { v4 as uuidv4 } from "uuid";

// AWS SDK v3
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

dotenv.config({ path: ".env.local" });

export const config = { api: { bodyParser: false } };

// S3 (Arvan) client
const s3 = new S3Client({
  region: "ir-thr-at1",
  endpoint: process.env.ARVAN_ENDPOINT, // مثلا: https://s3.ir-thr-at1.arvanstorage.ir
  credentials: {
    accessKeyId: process.env.ARVAN_ACCESS_KEY,
    secretAccessKey: process.env.ARVAN_SECRET_KEY,
  },
  forcePathStyle: true,
});

// CORS helper
function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// URL -> Key
function urlToKey(url) {
  if (!url) return null;
  const base = (process.env.ARVAN_BUCKET_URL || "").replace(/\/+$/, "") + "/";
  return url.startsWith(base) ? url.slice(base.length) : null;
}

// حذف فایل از آروان
async function deleteFromArvan(url) {
  const Key = urlToKey(url);
  if (!Key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.ARVAN_BUCKET, Key }));
  } catch (e) {
    console.warn("حذف فایل از آروان ناموفق:", e?.message);
  }
}

// آپلود تصویر به آروان
async function uploadImageToArvan(file, id) {
  const ext = path.extname(file.originalFilename || file.newFilename || "");
  const Key = `products/product-${id}-${uuidv4()}${ext}`;
  const Body = await fs.promises.readFile(file.filepath);

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.ARVAN_BUCKET,
      Key,
      Body,
      ACL: "public-read",
      ContentType: file.mimetype || undefined,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  const base = (process.env.ARVAN_BUCKET_URL || "").replace(/\/+$/, "");
  return `${base}/${Key}`;
}

export default async function handler(req, res) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  // فقط اجازه‌ی آپلود تصویر را بده؛ ویدیو باید لینک باشد (videoUrl)
  const form = formidable({
    keepExtensions: true,
    maxFileSize: 20 * 1024 * 1024, // فقط برای عکس
    filter: (part) => {
      // فیلدهای غیر فایل همیشه مجازند
      if (!part.mimetype) return true;
      // فقط فایل تصویر بپذیر
      if (part.name === "image" && part.mimetype.startsWith("image/")) return true;
      // هر فایل دیگری (مثل video) رد شود
      return false;
    },
  });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ message: "خطا در دریافت فایل‌ها" });

    const id = parseInt(fields.id?.[0], 10);
    const title = (fields.title?.[0] || "").trim();
    const description = (fields.description?.[0] || "").trim();
    const longDescription = (fields.longDescription?.[0] || "").trim();

    // انگلیسی (اختیاری)
    const titleEn = (fields.titleEn?.[0] ?? "").trim();
    const descriptionEn = (fields.descriptionEn?.[0] ?? "").trim();
    const longDescriptionEn = (fields.longDescriptionEn?.[0] ?? "").trim();

    // لینک ویدیو که از فرانت می‌آید (آپلود مستقیم)
    const videoUrlFromFront = (fields.videoUrl?.[0] || "").trim();

    if (!id || !title || !description) {
      return res.status(400).json({ message: "فیلدهای ضروری پر نشده‌اند." });
    }

    try {
      const client = await clientPromise;
      const db = client.db("robotsaz");

      const existing = await db.collection("products").findOne({ id });
      if (!existing) return res.status(404).json({ message: "محصول یافت نشد." });

      let imageUrl = existing.image;
      let videoUrl = existing.video;

      // اگر تصویر جدید آمده، قبلی را پاک و جدید را آپلود کن
      if (files.image?.[0]) {
        if (existing.image) await deleteFromArvan(existing.image);
        imageUrl = await uploadImageToArvan(files.image[0], id);
      }

      // ویدیو: دیگر فایل قبول نداریم؛ اگر videoUrl جدید آمد، بعد از به‌روزرسانی DB، قدیمی را حذف می‌کنیم
      const newVideoUrl = videoUrlFromFront || null;

      const $set = {
        title,
        description,
        longDescription,
        image: imageUrl,
        // اگر لینک جدید داریم ست می‌کنیم وگرنه دست نمی‌زنیم
        ...(newVideoUrl ? { video: newVideoUrl } : {}),
      };

      if (titleEn) $set.titleEn = titleEn;
      if (descriptionEn) $set.descriptionEn = descriptionEn;
      if (longDescriptionEn) $set.longDescriptionEn = longDescriptionEn;

      await db.collection("products").updateOne({ id }, { $set });

      // اگر لینک ویدیو عوض شد، بعد از به‌روزرسانی قدیمی را حذف کن
      if (newVideoUrl && existing.video && existing.video !== newVideoUrl) {
        await deleteFromArvan(existing.video);
      }

      return res.status(200).json({ message: "محصول با موفقیت ویرایش شد." });
    } catch (e) {
      console.error("خطا در ویرایش محصول:", e);
      return res.status(500).json({ message: "خطای سرور" });
    }
  });
}
