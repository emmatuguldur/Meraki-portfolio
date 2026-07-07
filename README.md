# Meraki Voyage — Reservation Backend

Serverless `POST /api/reserve` for the Meraki Voyage frontend.
Validation → sanitization → sliding-window rate limit (3/IP/10min) →
Supabase write (fail-soft) → dual Resend emails (admin alert + cosmic client confirmation).

## Deploy (Vercel)
1. `vercel` from this directory (the `api/` folder becomes the endpoint).
2. Set env vars from `.env.example` in the Vercel dashboard.
3. Run `schema.sql` in Supabase SQL editor.
4. Serve `meraki-voyage.html` from the same project (or set `RESERVE_ENDPOINT`
   in the HTML and `ALLOWED_ORIGIN` here for cross-origin).

## Local dev
- `npm install`
- `node serve.mjs` → http://localhost:8123 serves the site + live API
  (Resend calls are shimmed to succeed; DB skipped unless env is set).
- `node harness.mjs` → 10 behavioral tests (validation, XSS strip, 429,
  fail-soft, template escaping, isolated email failure).

## Response contract
- `200 {ok:true, saved, id, mail:{admin,client}}`
- `400 {ok:false, errors:{field:message}}`
- `413 | 405 | 429 (Retry-After) | 502 {ok:false, error}`

## Notes
- Rate limiter is per warm instance; swap `lib/ratelimit.js` for Upstash Redis
  for multi-instance guarantees (same `allow(ip)` interface).
- The frontend interceptor lives in `public/reserve-client.js` and is also
  inlined in the site's Contact panel.
