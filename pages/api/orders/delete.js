import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import AWS from "aws-sdk";

// تنظیمات اتصال به باکت آروان کلود
const s3 = new AWS.S3({
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

  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ message: "شناسه سفارش ارسال نشده است." });
  }
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "شناسه نامعتبر است." });
  }

  try {
    const client = await clientPromise;
    const db = client.db("robotsaz");

    // پیدا کردن سفارش برای گرفتن URL فایل‌ها
    const order = await db.collection("orders").findOne({ _id: new ObjectId(id) });
    if (!order) {
      return res.status(404).json({ message: "سفارشی با این آیدی یافت نشد." });
    }

    // حذف فایل‌ها از باکت
    if (order.files && order.files.length > 0) {
      const deletePromises = order.files.map((fileUrl) => {
        const fileKey = fileUrl.split("arvanstorage.ir/")[1]; // مسیر فایل
        const params = {
          Bucket: "robotsaz-uploads", // نام باکت شما
          Key: fileKey,
        };
        return s3.deleteObject(params).promise();
      });

      await Promise.all(deletePromises);
    }

    // حذف سفارش از دیتابیس
    const result = await db.collection("orders").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 1) {
      return res.status(200).json({ message: "سفارش و فایل‌های آن حذف شدند." });
    } else {
      return res.status(500).json({ message: "حذف سفارش ناموفق بود." });
    }
  } catch (err) {
    console.error("خطا در حذف سفارش:", err);
    return res.status(500).json({ message: "خطای سرور." });
  }
}
