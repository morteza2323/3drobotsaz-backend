import clientPromise from "@/lib/mongodb";
import AWS from "aws-sdk";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

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

const deleteFromArvanByUrl = async (url) => {
  if (!url) return;
  const prefix = `${process.env.ARVAN_BUCKET_URL}/`;
  const key = url.startsWith(prefix) ? url.slice(prefix.length) : null;
  if (!key) return;
  try {
    await s3.deleteObject({ Bucket: process.env.ARVAN_BUCKET, Key: key }).promise();
  } catch (e) {
    console.warn("خطا در حذف فایل:", e?.message);
  }
};

export default async function handler(req, res) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "DELETE") return res.status(405).json({ message: "Method Not Allowed" });

  const { id } = req.query;
  if (!id) return res.status(400).json({ message: "شناسه محصول ارسال نشده است." });

  try {
    const client = await clientPromise;
    const db = client.db("robotsaz");

    const product = await db.collection("products").findOne({ id: parseInt(id, 10) });
    if (!product) return res.status(404).json({ message: "محصول یافت نشد." });

    await deleteFromArvanByUrl(product.image);
    await deleteFromArvanByUrl(product.video);

    await db.collection("products").deleteOne({ id: parseInt(id, 10) });
    return res.status(200).json({ message: "محصول با موفقیت حذف شد." });
  } catch (e) {
    console.error("خطا در حذف محصول:", e);
    return res.status(500).json({ message: "خطای داخلی سرور." });
  }
}
