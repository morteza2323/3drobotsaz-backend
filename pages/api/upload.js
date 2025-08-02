import { S3 } from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import clientPromise from "@/lib/mongodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const s3 = new S3({
  endpoint: "https://s3.ir-thr-at1.arvanstorage.com",
  accessKeyId: process.env.ARVAN_ACCESS_KEY,
  secretAccessKey: process.env.ARVAN_SECRET_KEY,
  region: "ir-thr-at1",
  signatureVersion: "v4",
});

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { name, phone, description, files } = req.body;

  if (!name || !phone || !description || !files) {
    return res.status(400).json({ message: "تمام فیلدها الزامی است." });
  }

  try {
    const uploadedUrls = [];

    for (let base64 of files) {
      const matches = base64.match(/^data:(.+);base64,(.+)$/);
      if (!matches || matches.length !== 3) continue;

      const contentType = matches[1];
      const fileExt = contentType.split("/")[1];
      const buffer = Buffer.from(matches[2], "base64");

      const fileName = `${uuidv4()}.${fileExt}`;

      const params = {
        Bucket: process.env.ARVAN_BUCKET, // مثل: "robotsaz-uploads"
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read",
      };

      const uploadResult = await s3.upload(params).promise();
      uploadedUrls.push(uploadResult.Location);
    }

    // ذخیره در دیتابیس
    const client = await clientPromise;
    const db = client.db("robotsaz");
    const collection = db.collection("orders");

    await collection.insertOne({
      name,
      phone,
      description,
      files: uploadedUrls,
      createdAt: new Date(),
    });

    res.status(200).json({ message: "سفارش با موفقیت ثبت شد." });
  } catch (err) {
    console.error("خطا:", err);
    res.status(500).json({ message: "خطا در سرور" });
  }
}
