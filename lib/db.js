// lib/db.js — Supabase persistence, fail-soft: a dead database never blocks the emails.
let client = null, warned = false;

async function supabase(){
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key){
    if (!warned){ console.error("[db] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY unset — skipping persistence"); warned = true; }
    return null;
  }
  if (!client){
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/** @returns {Promise<{saved:boolean, id?:string}>} */
export async function saveReservation(data, meta){
  try {
    const db = await supabase();
    if (!db) return { saved: false };
    const { data: rows, error } = await db
      .from("reservations")
      .insert({ ...data, ip: meta.ip, user_agent: meta.ua?.slice(0, 300) ?? null })
      .select("id")
      .single();
    if (error) throw error;
    return { saved: true, id: rows.id };
  } catch (err) {
    console.error("[db] reservation write failed:", err?.message || err);
    return { saved: false };                    // continue → emails still go out
  }
}
