import formidable from "formidable";
import fs from "fs";
import path from "path";
import clientPromise from "@/lib/mongodb";
import dotenv from "dotenv";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
dotenv.config({ path: ".env.local" });

export const config = {
  api: {
    bodyParser: false,
  },
};

// تنظیم کلاینت S3 آروان
const s3 = new AWS.S3({
  endpoint: process.env.ARVAN_ENDPOINT,
  accessKeyId: process.env.ARVAN_ACCESS_KEY,
  secretAccessKey: process.env.ARVAN_SECRET_KEY,
  region: "ir-thr-at1",
  signatureVersion: "v4",
});

// حذف فایل قبلی از آروان
const deleteFromArvan = async (key) => {
  if (!key) return;
  try {
    await s3
      .deleteObject({
        Bucket: process.env.ARVAN_BUCKET,
        Key: key,
      })
      .promise();
  } catch (error) {
    console.warn("خطا در حذف فایل قبلی از آروان:", error.message);
  }
};

// آپلود فایل جدید در آروان
const uploadToArvan = async (file, folder, id) => {
  const ext = path.extname(file.originalFilename || file.newFilename);
  const key = `${folder}/product-${id}-${uuidv4()}${ext}`;
  const fileContent = fs.readFileSync(file.filepath);

  await s3
    .putObject({
      Bucket: process.env.ARVAN_BUCKET,
      Key: key,
      Body: fileContent,
      ContentType: file.mimetype,
      ACL: "public-read",
    })
    .promise();

  return `${process.env.ARVAN_BUCKET_URL}/${key}`;
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  const form = formidable({
    maxFileSize: 20 * 1024 * 1024,
    keepExtensions: true,
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

    try {
      const client = await clientPromise;
      const db = client.db("robotsaz");

      // گرفتن محصول فعلی برای حذف فایل‌های قبلی
      const existingProduct = await db.collection("products").findOne({ id });
      if (!existingProduct)
        return res.status(404).json({ message: "محصول یافت نشد." });

      let imageUrl = existingProduct.image;
      let videoUrl = existingProduct.video;

      // اگر تصویر جدید ارسال شده، قبلی رو حذف و جدید رو آپلود کن
      if (files.image?.[0]) {
        const oldImageKey = imageUrl?.split("/").slice(-2).join("/");
        await deleteFromArvan(oldImageKey);
        imageUrl = await uploadToArvan(files.image[0], "products", id);
      }

      // اگر ویدیو جدید ارسال شده، قبلی رو حذف و جدید رو آپلود کن
      if (files.video?.[0]) {
        const oldVideoKey = videoUrl?.split("/").slice(-2).join("/");
        await deleteFromArvan(oldVideoKey);
        videoUrl = await uploadToArvan(files.video[0], "products", id);
      }

      const updateFields = {
        title,
        description,
        longDescription,
        image: imageUrl,
        video: videoUrl,
      };

      await db.collection("products").updateOne({ id }, { $set: updateFields });

      return res
        .status(200)
        .json({ message: "محصول با موفقیت ویرایش شد." });
    } catch (error) {
      console.error("خطا در ویرایش محصول:", error);
      return res.status(500).json({ message: "خطای سرور" });
    }
  });
}
