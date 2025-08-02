import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });


const url = process.env.MONGODB_URL;
const options = {};

let client;
let clientPromise;
console.log("MONGODB_URL is:", process.env.MONGODB_URL);

if (!process.env.MONGODB_URL) {
  throw new Error("Please add your MongoDB URL to .env.local");
}

if (process.env.NODE_ENV === "development") {
  // در حالت توسعه، از کش در حافظه استفاده می‌کنیم تا اتصال مجدد ایجاد نشود
  if (!global._mongoClientPromise) {
    client = new MongoClient(url, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // در حالت production مستقیم وصل می‌شویم
  client = new MongoClient(url, options);
  clientPromise = client.connect();
}

export default clientPromise;
