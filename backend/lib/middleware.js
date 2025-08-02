import Cors from "cors";

// فقط اجازه به فرانت روی پورت 5173 بده
const cors = Cors({
  origin: "http://localhost:5173",
  methods: ["POST", "GET", "HEAD","OPTIONS"],
});

// تابعی برای اجرای میدلور
export function runMiddleware(req, res, fn) {
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
