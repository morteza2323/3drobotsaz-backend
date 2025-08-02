import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import clientPromise from "@/lib/mongodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb", // افزایش سایز فایل در صورت نیاز
    },
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*"); // یا فقط 'https://3drobotsaz.com'
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
    // تبدیل base64 به فایل و ذخیره
    const fileUrls = [];

    for (let base64 of files) {
      const matches = base64.match(/^data:(.+);base64,(.+)$/);
      if (!matches || matches.length !== 3) continue;

      const ext = matches[1].split("/")[1];
      const data = matches[2];
      const buffer = Buffer.from(data, "base64");

      const fileName = `${uuidv4()}.${ext}`;
      const uploadDir = path.join(
        "/home/x3drobotsazcom/domains/3drobotsaz.com/public_html/uploads"
      );

      // ساخت مسیر اگر وجود نداشت
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, buffer);

      const fileUrl = `${process.env.BACKEND_URL}/uploads/${fileName}`;
      fileUrls.push(fileUrl);
    }

    // ذخیره در دیتابیس
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
