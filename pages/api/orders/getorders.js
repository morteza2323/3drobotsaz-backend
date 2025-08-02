import clientPromise from "@/lib/mongodb";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*"); // یا فقط 'https://3drobotsaz.com'
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

  try {
    const client = await clientPromise;
    const db = client.db("robotsaz");
    const orders = await db.collection("orders").find().sort({ createdAt: -1 }).toArray();

    res.status(200).json(orders);
  } catch (error) {
    console.error("خطا در دریافت سفارش‌ها:", error);
    res.status(500).json({ message: "خطا در سرور" });
  }
}
