import formidable from "formidable";
import fs from "fs";
import path from "path";
import AWS from "aws-sdk";
import clientPromise from "@/lib/mongodb";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
dotenv.config({ path: ".env.local" });

export const config = { api: { bodyParser: false } };

const s3 = new AWS.S3({
  endpoint: process.env.ARVAN_ENDPOINT,
  accessKeyId: process.env.ARVAN_ACCESS_KEY,
  secretAccessKey: process.env.ARVAN_SECRET_KEY,
  region: "ir-thr-at1",
  signatureVersion: "v4",
});

function allowCORS(res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const deleteFromArvan = async (url) => {
  if (!url) return;
  // تبدیل URL به key
  const prefix = `${process.env.ARVAN_BUCKET_URL}/`;
  const key = url.startsWith(prefix) ? url.slice(prefix.length) : null;
  if (!key) return;
  try {
    await s3.deleteObject({ Bucket: process.env.ARVAN_BUCKET, Key: key }).promise();
  } catch (e) {
    console.warn("حذف فایل از آروان ناموفق:", e?.message);
  }
};

const uploadToArvan = async (file, id) => {
  const ext = path.extname(file.originalFilename || file.newFilename || "");
  const key = `products/product-${id}-${uuidv4()}${ext}`;
  const body = fs.readFileSync(file.filepath);
  await s3.putObject({
    Bucket: process.env.ARVAN_BUCKET,
    Key: key,
    Body: body,
    ACL: "public-read",
    ContentType: file.mimetype || undefined,
    CacheControl: "public, max-age=31536000, immutable",
  }).promise();
  return `${process.env.ARVAN_BUCKET_URL}/${key}`;
};

export default async function handler(req, res) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const form = formidable({
    keepExtensions: true,
    maxFileSize: 20 * 1024 * 1024,
    filter: (part) => part.mimetype?.startsWith("image/") || part.mimetype?.startsWith("video/"),
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

      if (files.image?.[0]) {
        await deleteFromArvan(existing.image);
        imageUrl = await uploadToArvan(files.image[0], id);
      }
      if (files.video?.[0]) {
        await deleteFromArvan(existing.video);
        videoUrl = await uploadToArvan(files.video[0], id);
      }

      const $set = {
        title,
        description,
        longDescription,
        image: imageUrl,
        video: videoUrl,
      };

      // فقط اگر چیزی برای انگلیسی ارسال شده، ست کن (برای جلوگیری از overwrite با خالی)
      if (titleEn) $set.titleEn = titleEn;
      if (descriptionEn) $set.descriptionEn = descriptionEn;
      if (longDescriptionEn) $set.longDescriptionEn = longDescriptionEn;

      await db.collection("products").updateOne({ id }, { $set });

      return res.status(200).json({ message: "محصول با موفقیت ویرایش شد." });
    } catch (e) {
      console.error("خطا در ویرایش محصول:", e);
      return res.status(500).json({ message: "خطای سرور" });
    }
  });
}
