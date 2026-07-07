// lib/ratelimit.js — sliding window, 3 hits / 10 min per IP.
// In-memory per warm serverless instance: correct within an instance, resets on cold start.
// For multi-instance production guarantees, swap the Map for Upstash Redis with the same interface.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 3;
const MAX_TRACKED_IPS = 5000;
const hits = new Map(); // ip -> number[] (timestamps)

export function allow(ip){
  const now = Date.now();
  const fresh = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (fresh.length >= LIMIT){
    hits.set(ip, fresh);
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - fresh[0])) / 1000) };
  }
  fresh.push(now);
  hits.set(ip, fresh);
  if (hits.size > MAX_TRACKED_IPS){            // cheap memory bound
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
      if (hits.size <= MAX_TRACKED_IPS) break;
    }
  }
  return { ok: true };
}

export const clientIp = req =>
  (req.headers["x-forwarded-for"]?.split(",")[0] ||
   req.socket?.remoteAddress || "unknown").trim();
