import { v4 as uuidv4 } from "uuid";
import clientPromise from "@/lib/mongodb";
import dotenv from "dotenv";
import aws from "aws-sdk";

dotenv.config({ path: ".env.local" });

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb", // افزایش سایز فایل در صورت نیاز
    },
  },
};

// تنظیم AWS SDK برای آروان
const s3 = new aws.S3({
  endpoint: "https://s3.ir-thr-at1.arvanstorage.ir",
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
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name, phone, description, files } = req.body;

  if (!name || !phone || !description) {
    return res.status(400).json({ message: "لطفاً تمام فیلدها را پر کنید." });
  }

  try {
    const fileUrls = [];

    for (let base64 of files) {
      const matches = base64.match(/^data:(.+);base64,(.+)$/);
      if (!matches || matches.length !== 3) continue;

      const mimeType = matches[1];
      const ext = mimeType.split("/")[1];
      const data = matches[2];
      const buffer = Buffer.from(data, "base64");

      const fileName = `${uuidv4()}.${ext}`;
      const uploadParams = {
        Bucket: "robotsaz-uploads", // نام باکت آروان
        Key: fileName,
        Body: buffer,
        ContentType: mimeType,
        ACL: "public-read",
      };

      const uploadResult = await s3.upload(uploadParams).promise();
      fileUrls.push(uploadResult.Location); // آدرس عمومی فایل
    }

    const client = await clientPromise;
    const db = client.db("robotsaz");
    const collection = db.collection("orders");

    const order = {
      name,
      phone,
      description,
      files: fileUrls,
      createdAt: new Date(),
    };

    await collection.insertOne(order);

    return res.status(200).json({ message: "سفارش با موفقیت ذخیره شد." });
  } catch (error) {
    console.error("خطا در ذخیره سفارش:", error);
    return res.status(500).json({ message: "خطا در سرور" });
  }
}
