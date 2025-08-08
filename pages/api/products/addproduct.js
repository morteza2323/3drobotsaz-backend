import formidable from "formidable";
import fs from "fs";
import path from "path";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { getNextId } from "@/lib/getnextid";
import clientPromise from "@/lib/mongodb";
import dotenv from "dotenv";
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

export default async function handler(req, res) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const form = formidable({
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
    filter: (part) => part.mimetype?.startsWith("image/") || part.mimetype?.startsWith("video/"),
  });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ message: "خطا در پردازش فایل‌ها" });

    const title = (fields.title?.[0] || "").trim();
    const description = (fields.shortDescription?.[0] || "").trim();
    const longDescription = (fields.fullDescription?.[0] || "").trim();

    if (!title || !description || !files.image?.[0]) {
      return res.status(400).json({ message: "فیلدهای اجباری پر نشده‌اند." });
    }

    try {
      const client = await clientPromise;
      const db = client.db("robotsaz");
      const id = await getNextId("productId");

      const uploadToArvan = async (file) => {
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

      const image = await uploadToArvan(files.image[0]);
      const video = files.video?.[0] ? await uploadToArvan(files.video[0]) : "";

      const newProduct = {
        id,
        // فارسی
        title,
        description,
        longDescription,
        // انگلیسی (ابتدا خالی)
        titleEn: "",
        descriptionEn: "",
        longDescriptionEn: "",
        // فایل‌ها
        image,
        video,
        createdAt: new Date(),
      };

      await db.collection("products").insertOne(newProduct);
      return res.status(200).json({ message: "محصول با موفقیت اضافه شد.", product: newProduct });
    } catch (e) {
      console.error("خطا در ذخیره محصول:", e);
      return res.status(500).json({ message: "خطا در سرور" });
    }
  });
}
