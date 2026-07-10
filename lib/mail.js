// lib/mail.js — dual transactional engine on Resend. Both sends run in parallel;
// each failure is isolated, logged, and reported in the API response flags.
import { escapeHtml as esc } from "./sanitize.js";

const BRAND = {
  bg: "#0A0F22",
  deep: "#04060E",
  panel: "#10162E",
  edge: "#27325A",
  gold: "#E9B44C",
  bright: "#FFD98A",
  ink: "#EAEDF7",
  muted: "#97A0BF",
};

const shell = (
  inner,
) => `<!doctype html><html><body style="margin:0;padding:0;background:${BRAND.deep};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.deep};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0"
  style="max-width:560px;width:100%;background:${BRAND.bg};border:1px solid ${BRAND.edge};border-radius:14px;overflow:hidden;font-family:'Avenir Next',Avenir,'Segoe UI',Helvetica,Arial,sans-serif;">
${inner}
<tr><td style="padding:20px 36px 30px;border-top:1px solid ${BRAND.edge};">
  <p style="margin:0;font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:${BRAND.muted};">
    Meraki — a creative galaxy &nbsp;✦&nbsp; sent with soul</p>
</td></tr>
</table></td></tr></table></body></html>`;

const row = (k, v) => `<tr>
  <td style="padding:9px 0;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:${BRAND.gold};vertical-align:top;width:120px;">${k}</td>
  <td style="padding:9px 0;font-size:14px;line-height:1.6;color:${BRAND.ink};">${v}</td></tr>`;

export function adminEmailHtml(r, meta) {
  return shell(`
<tr><td style="padding:34px 36px 6px;">
  <p style="margin:0 0 6px;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:${BRAND.gold};">Inbound signal · new reservation</p>
  <h1 style="margin:0;font-family:Didot,'Bodoni MT',Georgia,serif;font-weight:400;font-size:26px;color:${BRAND.ink};">${esc(r.name)} wants to fly</h1>
</td></tr>
<tr><td style="padding:14px 36px 26px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.edge};">
    ${row("Client", esc(r.name))}
    ${row("Email", `<a href="mailto:${esc(r.email)}" style="color:${BRAND.bright};text-decoration:none;">${esc(r.email)}</a>`)}
    ${row("Requested date", esc(r.date))}
    ${row("Mission notes", r.notes ? esc(r.notes) : `<span style="color:${BRAND.muted};">—</span>`)}
    ${row("Origin", `<span style="color:${BRAND.muted};font-size:12px;">${esc(meta.ip)} · ${esc(meta.ua || "unknown client")}</span>`)}
  </table>
</td></tr>`);
}

export function clientEmailHtml(r) {
  return shell(`
<tr><td align="center" style="padding:42px 36px 8px;">
  <div style="font-size:26px;line-height:1;color:${BRAND.gold};">✦</div>
  <p style="margin:14px 0 6px;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:${BRAND.gold};">Transmission received</p>
  <h1 style="margin:0;font-family:Didot,'Bodoni MT',Georgia,serif;font-weight:400;font-size:28px;color:${BRAND.ink};">Your voyage is on our star&nbsp;charts</h1>
</td></tr>
<tr><td style="padding:18px 44px 8px;">
  <p style="margin:0;font-size:15px;line-height:1.8;color:${BRAND.muted};">
    ${esc(r.name.split(" ")[0])}, somewhere in our galaxy a new orbit just lit up.
    We've logged your request for <span style="color:${BRAND.bright};">${esc(r.date)}</span>
    and a human navigator — not an autopilot — will reply within one Earth rotation
    to chart the mission with you.</p>
</td></tr>
${
  r.notes
    ? `<tr><td style="padding:16px 44px 4px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:${BRAND.panel};border:1px solid ${BRAND.edge};border-radius:10px;">
    <tr><td style="padding:16px 18px;">
      <p style="margin:0 0 4px;font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:${BRAND.gold};">Your mission notes</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:${BRAND.ink};">${esc(r.notes)}</p>
    </td></tr></table></td></tr>`
    : ""
}
<tr><td align="center" style="padding:26px 44px 34px;">
  <p style="margin:0;font-size:12px;letter-spacing:.14em;color:${BRAND.muted};">
    Until then, keep the heart in sight. &nbsp;<span style="color:${BRAND.gold};">— Meraki</span></p>
</td></tr>`);
}

function normalizeFromEmail(value) {
  const fallback = "Meraki <onboarding@resend.dev>";
  if (!value) return fallback;
  const trimmed = String(value).trim();
  if (
    /gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|live\.com/i.test(trimmed)
  )
    return fallback;
  return trimmed;
}

async function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[mail] RESEND_API_KEY unset — skipping email");
    return null;
  }
  const { Resend } = await import("resend");
  return new Resend(key);
}

/** @returns {Promise<{admin:boolean, client:boolean}>} */
export async function sendReservationEmails(r, meta) {
  const rs = await resend();
  if (!rs) return { admin: false, client: false };
  const from = normalizeFromEmail(process.env.FROM_EMAIL);
  const admin = process.env.ADMIN_EMAIL || "merakiagencymn@gmail.com";
  const jobs = [
    rs.emails.send({
      from,
      to: admin,
      reply_to: r.email,
      subject: `✦ New voyage request — ${r.name} · ${r.date}`,
      html: adminEmailHtml(r, meta),
    }),
    rs.emails.send({
      from,
      to: r.email,
      subject: "✦ Your Meraki voyage is on our star charts",
      html: clientEmailHtml(r),
    }),
  ];
  const [a, c] = await Promise.allSettled(jobs);
  for (const [label, res] of [
    ["admin", a],
    ["client", c],
  ])
    if (res.status === "rejected" || res.value?.error)
      console.error(
        `[mail] ${label} send failed:`,
        res.reason?.message || res.value?.error,
      );
  return {
    admin: a.status === "fulfilled" && !a.value?.error,
    client: c.status === "fulfilled" && !c.value?.error,
  };
}
