// api/reserve.js — POST /api/reserve  (Vercel serverless, Node ESM)
import { validateReservation } from "../lib/sanitize.js";
import { allow, clientIp } from "../lib/ratelimit.js";
import { saveReservation } from "../lib/db.js";
import { sendReservationEmails } from "../lib/mail.js";

const ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_BODY = 8_192;

function json(res, code, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Vary", "Origin");
  res.statusCode = code;
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body !== undefined)
    // Vercel pre-parses JSON bodies
    return typeof req.body === "string"
      ? JSON.parse(req.body || "{}")
      : req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY)
      throw Object.assign(new Error("payload too large"), { code: 413 });
  }
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST")
    return json(res, 405, {
      ok: false,
      error: "Method not allowed. POST only.",
    });

  const ip = clientIp(req);
  const gate = allow(ip);
  if (!gate.ok) {
    res.setHeader("Retry-After", String(gate.retryAfter));
    return json(res, 429, {
      ok: false,
      error: `Too many transmissions. The relay cools down in ~${Math.ceil(gate.retryAfter / 60)} min.`,
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return json(res, e.code === 413 ? 413 : 400, {
      ok: false,
      error: e.code === 413 ? "Payload too large." : "Body must be valid JSON.",
    });
  }

  const { data, errors } = validateReservation(body);
  if (errors) return json(res, 400, { ok: false, errors });

  const meta = { ip, ua: req.headers["user-agent"] };
  const db = await saveReservation(data, meta);
  const mail = await sendReservationEmails(data, meta);

  if (!db.saved && !mail.admin && !mail.client) {
    return json(res, 200, {
      ok: true,
      saved: false,
      id: null,
      mail,
      warning:
        "Reservation accepted; delivery/storage is temporarily unavailable.",
    });
  }

  return json(res, 200, { ok: true, saved: db.saved, id: db.id ?? null, mail });
}
