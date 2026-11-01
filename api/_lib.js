const postgres = require("postgres");
const crypto = require("crypto");
const sql = global.__sql || (global.__sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, prepare: false }));
const key = () => process.env.SESSION_SECRET || "";
const mac = (p) => crypto.createHmac("sha256", key()).update(p).digest("base64url");
const sign = (v) => { const p = Buffer.from(JSON.stringify(v)).toString("base64url"); return p + "." + mac(p); };
function verify(t) {
  if (!t || !key()) return null;
  const [p, s] = t.split(".");
  if (!p || !s) return null;
  const e = mac(p);
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
  const v = JSON.parse(Buffer.from(p, "base64url").toString());
  return v.exp > Date.now() ? v : null;
}
module.exports = { sql, sign, verify };
