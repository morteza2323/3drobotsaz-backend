import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*"); // یا فقط 'https://3drobotsaz.com'
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

    const result = await db.collection("orders").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 1) {
      return res.status(200).json({ message: "سفارش با موفقیت حذف شد." });
    } else {
      return res.status(404).json({ message: "سفارش یافت نشد." });
    }
  } catch (err) {
    console.error("خطا در حذف سفارش:", err);
    return res.status(500).json({ message: "خطای سرور." });
  }
}
