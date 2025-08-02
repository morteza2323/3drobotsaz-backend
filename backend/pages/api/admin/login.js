import clientPromise from "@/lib/mongodb";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { username, password } = req.body;

  try {
    const client = await clientPromise;
    const db = client.db("robotsaz");
    const admin = await db.collection("admin").findOne({ username, password });

    if (!admin) {
      return res.status(401).json({ success: false, message: "نام کاربری یا رمز عبور اشتباه است" });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("خطا در لاگین ادمین:", err);
    res.status(500).json({ success: false, message: "خطای سرور" });
  }
}
