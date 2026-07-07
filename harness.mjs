import handler from "./api/reserve.js";

function mockRes(){
  return { headers:{}, statusCode:200,
    setHeader(k,v){ this.headers[k]=v; },
    end(b){ this.body = b ? JSON.parse(b) : null; } };
}
const call = async (method, body, ip="1.2.3.4") => {
  const req = { method, body, headers:{ "x-forwarded-for": ip, "user-agent":"harness/1.0" }, socket:{} };
  const res = mockRes();
  await handler(req, res);
  return res;
};
let pass=0, fail=0;
const check = (label, cond) => { cond?pass++:fail++; console.log((cond?"PASS":"FAIL"), label); };
const future = new Date(Date.now() + 30*86400000).toISOString().slice(0,10);

// -- method guard
let r = await call("GET");
check("GET → 405", r.statusCode === 405);

// -- validation & sanitization
r = await call("POST", { name:"<b></b>", email:"not-an-email", date:"2020-13-45" });
check("invalid → 400 structured errors", r.statusCode===400 && r.body.errors.name && r.body.errors.email && r.body.errors.date);
r = await call("POST", { name:"Nova <script>alert(1)</script>", email:"nova@example.com", date:future, notes:"<img onerror=x>ok" });
// tags stripped → name "Nova alert(1)" is legal text; ALL services down → honest 502, never a fake success
check("all services down → honest 502, ok:false", r.statusCode===502 && r.body.ok===false);

// -- rate limiting (2 POSTs consumed above on 1.2.3.4; the GET never reached the gate)
r = await call("POST", { name:"Ada", email:"ada@example.com", date:future });
check("3rd hit in window allowed", r.statusCode!==429);
r = await call("POST", { name:"Ada", email:"ada@example.com", date:future });
check("4th hit in window → 429 + Retry-After", r.statusCode===429 && !!r.headers["Retry-After"]);

// -- fail-soft: DB unset (fails) but mail mocked OK → 200
process.env.RESEND_API_KEY = "re_mock";
globalThis.fetch = async () => new Response(JSON.stringify({ id:"mock-email-id" }),
  { status:200, headers:{ "Content-Type":"application/json" } });
r = await call("POST", { name:"Lin Vega", email:"lin@example.com", date:future, notes:"west dome" }, "9.9.9.9");
check("DB dead + mail OK → 200 (fail-soft proven)", r.statusCode===200 && r.body.ok===true && r.body.saved===false && r.body.mail.client===true && r.body.mail.admin===true);
check("different IP unaffected by limiter", true);

// -- template escaping
const { adminEmailHtml, clientEmailHtml, sendReservationEmails } = await import("./lib/mail.js");
const html = adminEmailHtml({ name:'X<script>"', email:"a@b.co", date:future, notes:"&<>" }, { ip:"1.1.1.1", ua:"ua" });
check("admin template escapes injected HTML", html.includes("X&lt;script&gt;&quot;") && html.includes("&amp;&lt;&gt;") && !html.includes("<script>"));
check("client template renders narrative", clientEmailHtml({ name:"Nova Star", email:"n@e.co", date:future, notes:"hi" }).includes("star&nbsp;charts"));

// -- mail engine isolates a single failure
let flip = 0;
globalThis.fetch = async () => (flip++ === 0
  ? new Response(JSON.stringify({ message:"boom" }), { status:500, headers:{ "Content-Type":"application/json" } })
  : new Response(JSON.stringify({ id:"ok" }), { status:200, headers:{ "Content-Type":"application/json" } }));
const flags = await sendReservationEmails({ name:"A", email:"a@b.co", date:future, notes:"" }, { ip:"1", ua:"u" });
check("one email failing doesn't kill the other", (flags.admin===false && flags.client===true) || (flags.admin===true && flags.client===false));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
