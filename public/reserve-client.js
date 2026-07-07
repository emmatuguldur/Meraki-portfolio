// public/reserve-client.js — drop-in form interceptor for POST /api/reserve
// Markup contract: <form data-reserve> with inputs named name/email/date/notes,
// a <button type="submit">, and a [data-status] element for live feedback.
export function bindReservationForm(form, endpoint = "/api/reserve"){
  const status = form.querySelector("[data-status]");
  const button = form.querySelector('button[type="submit"]');
  const idle = button.textContent;
  const say = (msg, tone) => {
    status.textContent = msg;
    status.dataset.tone = tone;               // style hooks: ok | err | info
  };
  const setInvalid = errors => {
    for (const el of form.elements)
      if (el.name){
        if (errors && errors[el.name]) el.setAttribute("aria-invalid", "true");
        else el.removeAttribute("aria-invalid");
      }
  };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    setInvalid(null);
    button.disabled = true;
    button.textContent = "Transmitting…";
    say("Signal leaving the atmosphere…", "info");
    try {
      const payload = Object.fromEntries(new FormData(form));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));

      if (res.status === 400 && data.errors){
        setInvalid(data.errors);
        say(Object.values(data.errors)[0], "err");
      } else if (res.status === 429){
        say(data.error || "Too many transmissions — give the relay a few minutes.", "err");
      } else if (res.ok && data.ok){
        form.reset();
        say("✦ Signal received. A navigator will reply within one Earth rotation — check your inbox.", "ok");
      } else {
        say(data.error || "Mission control glitched — please try again.", "err");
      }
    } catch {
      say("Could not reach mission control. Check your connection (or deploy the /api backend).", "err");
    } finally {
      button.disabled = false;
      button.textContent = idle;
    }
  });
}

// Auto-bind:
for (const f of document.querySelectorAll("form[data-reserve]"))
  bindReservationForm(f, f.dataset.endpoint || "/api/reserve");
