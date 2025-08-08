import formidable from "formidable";
import fs from "fs";
import path from "path";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { getNextId } from "@/lib/getnextid";
import clientPromise from "@/lib/mongodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// جلوگیری از پارس پیش‌فرض بدنه
export const config = {
  api: {
    bodyParser: false,
  },
};

// تنظیم S3 برای ابر آروان
const s3 = new AWS.S3({
  endpoint: process.env.ARVAN_ENDPOINT,
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

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  const form = formidable({
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    filter: (part) =>
      part.mimetype?.startsWith("image/") || part.mimetype?.startsWith("video/"),
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("خطا در آپلود:", err);
      return res.status(500).json({ message: "خطا در پردازش فایل‌ها" });
    }

    // فیلدهای فارسی
    const title = fields.title?.[0] || "";
    const shortDescription = fields.shortDescription?.[0] || "";
    const fullDescription = fields.fullDescription?.[0] || "";

    // فیلدهای انگلیسی (حتی اگر نیان، مقدار خالی می‌گیرن)
    const titleEn = fields.titleEn?.[0] || "";
    const descriptionEn = fields.descriptionEn?.[0] || "";
    const longDescriptionEn = fields.longDescriptionEn?.[0] || "";

    if (!title || !shortDescription || !files.image) {
      return res.status(400).json({ message: "فیلدهای اجباری پر نشده‌اند." });
    }

    try {
      const client = await clientPromise;
      const db = client.db("robotsaz");
      const id = await getNextId("productId");

      // تابع آپلود به آروان
      const uploadToArvan = async (file) => {
        const fileExt = path.extname(file.originalFilename || "");
        const fileName = `products/product-${id}-${uuidv4()}${fileExt}`;
        const fileContent = fs.readFileSync(file.filepath);

        await s3
          .putObject({
            Bucket: process.env.ARVAN_BUCKET,
            Key: fileName,
            Body: fileContent,
            ACL: "public-read",
          })
          .promise();

        return `${process.env.ARVAN_BUCKET_URL}/${fileName}`;
      };

      const imageUrl = await uploadToArvan(files.image[0]);
      const videoUrl = files.video ? await uploadToArvan(files.video[0]) : "";

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
    } catch (err) {
      console.error("خطا در ذخیره محصول:", err);
      return res.status(500).json({ message: "خطا در سرور" });
    }
  });
}
