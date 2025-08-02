// pages/api/products/deleteproduct.js

import clientPromise from "@/lib/mongodb";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*"); // یا فقط http://localhost:5173
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ message: "شناسه محصول ارسال نشده است." });
  }

  try {
    const client = await clientPromise;
    const db = client.db("robotsaz");

    const result = await db
      .collection("products")
      .deleteOne({ id: parseInt(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "محصول یافت نشد." });
    }

    return res.status(200).json({ message: "محصول با موفقیت حذف شد." });
  } catch (error) {
    console.error("خطا در حذف محصول:", error);
    return res.status(500).json({ message: "خطای داخلی سرور." });
  }
}
