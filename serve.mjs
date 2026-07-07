import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import handler from "./api/reserve.js";

const here = dirname(fileURLToPath(import.meta.url));

// success-path shim: intercept only the Resend API call
process.env.RESEND_API_KEY = "re_e2e";
const realFetch = globalThis.fetch;
globalThis.fetch = (url, opts) =>
  String(url).includes("api.resend.com")
    ? Promise.resolve(
        new Response(JSON.stringify({ id: "e2e-mail" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
    : realFetch(url, opts);

const htmlPath = existsSync(join(here, "..", "index.html"))
  ? join(here, "..", "index.html")
  : join(here, "..", "meraki-voyage.html");
const html = readFileSync(htmlPath);
http
  .createServer((req, res) => {
    if (req.url.startsWith("/api/reserve")) return handler(req, res);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  })
  .listen(8123, () => console.log("up"));
