import clientPromise from "@/lib/mongodb";

export default async function handler(req, res) {
  try {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    // کش سمت CDN/ورسل: 1 ساعت – و تا یک روز استیل‌-وایل-ریوالیدیت
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

    const client = await clientPromise;
    const db = client.db("robotsaz");

    // فقط فیلدهای لازم را بگیر
    const products = await db
      .collection("products")
      .find({}, { projection: { id: 1, createdAt: 1, updatedAt: 1 } })
      .toArray();

    const BASE = process.env.SITE_BASE_URL || "https://3drobotsaz.com";

    // صفحات ثابت سایت
    const staticUrls = [
      { loc: `${BASE}/`, changefreq: "weekly", priority: "1.0" },
      { loc: `${BASE}/products`, changefreq: "weekly", priority: "0.8" },
      { loc: `${BASE}/contact`, changefreq: "yearly", priority: "0.3" },
    ];

    // صفحات محصول – اگر اسلاگ داری، به‌جای id بذار
    const productUrls = (products || []).map((p) => {
      const last = (p.updatedAt || p.createdAt || new Date()).toISOString().slice(0, 10);
      return {
        loc: `${BASE}/product/${p.id}`,
        changefreq: "monthly",
        priority: "0.6",
        lastmod: last,
      };
    });

    const urls = [...staticUrls, ...productUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `<url>
  <loc>${u.loc}</loc>
  <changefreq>${u.changefreq}</changefreq>
  <priority>${u.priority}</priority>
  ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}
</url>`
  )
  .join("\n")}
</urlset>`;

    res.status(200).send(xml);
  } catch (e) {
    console.error("sitemap error:", e);
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><error>server</error>`);
  }
}
