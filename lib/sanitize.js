// lib/sanitize.js — input hygiene, zero dependencies
export const stripTags = v =>
  String(v ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const escapeHtml = s =>
  s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

export function validateReservation(body){
  const src = body && typeof body === "object" ? body : {};
  const errors = {};
  const name = stripTags(src.name);
  const email = stripTags(src.email).toLowerCase();
  const date = stripTags(src.date);
  const notes = stripTags(src.notes).slice(0, 1000);

  if (name.length < 2 || name.length > 80)
    errors.name = "Name must be 2–80 characters.";
  if (email.length > 254 || !EMAIL_RE.test(email))
    errors.email = "A valid email is required.";
  if (!DATE_RE.test(date)) {
    errors.date = "Date must be YYYY-MM-DD.";
  } else {
    const t = Date.parse(date + "T00:00:00Z");
    const today = Math.floor(Date.now() / DAY) * DAY;
    if (Number.isNaN(t) || +date.slice(8) !== new Date(t).getUTCDate())
      errors.date = "That date does not exist.";
    else if (t < today) errors.date = "Voyages launch in the future — pick an upcoming date.";
    else if (t > today + 540 * DAY) errors.date = "We book at most 18 months ahead.";
  }
  if (Object.keys(errors).length) return { errors };
  return { data: { name, email, date, notes } };
}
