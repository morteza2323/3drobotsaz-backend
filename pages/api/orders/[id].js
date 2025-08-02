import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*"); // یا فقط http://localhost:5173
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

  const { id } = req.query;

  try {
    const client = await clientPromise;
    const db = client.db("robotsaz");
    const order = await db.collection("orders").findOne({ _id: new ObjectId(id) });

    if (!order) return res.status(404).json({ message: "سفارش پیدا نشد." });

    return res.status(200).json({ order });
  } catch (err) {
    console.error("خطا:", err);
    return res.status(500).json({ message: "خطایی در سرور رخ داد." });
  }
}
