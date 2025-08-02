import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import clientPromise from "@/lib/mongodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const spacesEndpoint = new AWS.Endpoint("s3.ir-thr-at1.arvanstorage.com");
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.ARVAN_ACCESS_KEY,
  secretAccessKey: process.env.ARVAN_SECRET_KEY,
  region: "ir-thr-at1",
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  const { name, phone, description, files } = req.body;
  if (!name || !phone || !description)
    return res.status(400).json({ message: "اطلاعات ناقص است" });

  try {
    const client = await clientPromise;
    const db = client.db("robotsaz");
    const collection = db.collection("orders");

    // اول، سفارش را بدون فایل‌ها ذخیره می‌کنیم تا orderId را بگیریم
    const result = await collection.insertOne({
      name,
      phone,
      description,
      files: [],
      createdAt: new Date(),
    });

    const orderId = result.insertedId.toString();
    const fileUrls = [];

    for (let base64 of files) {
      const matches = base64.match(/^data:(.+);base64,(.+)$/);
      if (!matches || matches.length !== 3) continue;

      const ext = matches[1].split("/")[1];
      const data = Buffer.from(matches[2], "base64");
      const fileName = `orders/order-${orderId}-${uuidv4()}.${ext}`;

      const uploadParams = {
        Bucket: "robotsaz-uploads",
        Key: fileName,
        Body: data,
        ACL: "public-read",
        ContentType: matches[1],
      };

      await s3.upload(uploadParams).promise();
      const fileUrl = `https://robotsaz-uploads.s3.ir-thr-at1.arvanstorage.ir/${fileName}`;
      fileUrls.push(fileUrl);
    }

    // به‌روزرسانی سفارش با URL فایل‌ها
    await collection.updateOne(
      { _id: result.insertedId },
      { $set: { files: fileUrls } }
    );

    return res.status(200).json({ message: "سفارش با موفقیت ذخیره شد." });
  } catch (error) {
    console.error("خطا در ذخیره سفارش:", error);
    return res.status(500).json({ message: "خطا در سرور" });
  }
}
