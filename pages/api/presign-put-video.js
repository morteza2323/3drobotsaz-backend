// pages/api/presign-put-video.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const s3 = new S3Client({
  region: "ir-thr-at1",
  endpoint: process.env.ARVAN_ENDPOINT,
  credentials: {
    accessKeyId: process.env.ARVAN_ACCESS_KEY,
    secretAccessKey: process.env.ARVAN_SECRET_KEY,
  },
  forcePathStyle: true,
});

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://3drobotsaz.com",
  "https://www.3drobotsaz.com",
  "https://api.3drobotsaz.com",
];

function setCORS(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://3drobotsaz.com");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
}

export default async function handler(req, res) {
  setCORS(req, res);
  if (req.method === "OPTIONS") return res.status(200).end(); // مهم برای preflight

  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  try {
    const { fileName, mime } = req.body || {};
    if (!fileName || !mime) return res.status(400).json({ message: "fileName و mime لازم است." });

    const ext = path.extname(fileName) || "";
    const key = `products/unassigned/${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.ARVAN_BUCKET,
      Key: key,
      ContentType: mime,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 120 });
    const base = (process.env.ARVAN_BUCKET_URL || "").replace(/\/+$/, "");
    const publicUrl = `${base}/${key}`;

    return res.status(200).json({
      url,
      key,
      publicUrl,
      headers: {
        "Content-Type": mime,
        "x-amz-acl": "public-read",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("presign-put error:", e);
    return res.status(500).json({ message: "Server Error" });
  }
}
