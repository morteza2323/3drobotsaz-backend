import Cors from "cors";

// فقط اجازه به فرانت روی پورت 5173 بده
const cors = Cors({
  origin: "http://localhost:5173",
  methods: ["POST", "GET", "HEAD","OPTIONS"],
});

// تابعی برای اجرای میدلور
export function runMiddleware(req, res, fn) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default cors;
