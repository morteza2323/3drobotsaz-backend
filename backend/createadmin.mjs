// createAdmin.js
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.local" });

const url = process.env.MONGODB_URL;
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

console.log(url , username , password);

if (!url || !username || !password) {
  console.log(url , username , password);
  console.error("❌ لطفاً متغیرهای .env را کامل وارد کنید.");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(url);

  try {
    await client.connect();
    const db = client.db("robotsaz");
    const admins = db.collection("admin");

    const existing = await admins.findOne({ username });

    if (existing) {
      console.log("⚠️ ادمینی با این نام کاربری قبلاً ثبت شده است.");
    } else {
      await admins.insertOne({
        username,
        password,
        createdAt: new Date(),
      });
      console.log("✅ ادمین با موفقیت اضافه شد.");
    }
  } catch (err) {
    console.error("❌ خطا در اتصال یا درج:", err);
  } finally {
    await client.close();
  }
}

main();
