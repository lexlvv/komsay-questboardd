const bcrypt = require("bcryptjs");
const { sql, sign, verify } = require("./_lib");
const COOKIE = "kq";
const bucket = () => sql`case when total_points>=300 then '300+ points' when total_points>=200 then '200 - 299 points' when total_points>=100 then '100 - 199 points' when total_points>=50 then '50 - 99 points' else 'Below 50 points' end`;

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://x");
  const route = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const q = url.searchParams, b = req.body || {};
  const send = (c, d) => res.status(c).json(d);
  const setCookie = (v, age) => res.setHeader("Set-Cookie", `${COOKIE}=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`);
  try {
    // ---------- public ----------
    if (route === "leaderboard") {
      const s = "%" + (q.get("q") || "").trim() + "%";
      const rows = await sql`select name,total_points,date_joined from participants where is_active and name ilike ${s} order by total_points desc,id`;
      const [t] = await sql`select count(*)::int n,coalesce(sum(total_points),0)::int pts from participants where is_active`;
      const [u] = await sql`select max(awarded_at) at from point_transactions`;
      return send(200, { rows, total: t.n, points: t.pts, top: (await sql`select name,total_points from participants where is_active order by total_points desc,id limit 1`)[0] || null, updated: u.at });
    }
    if (route === "login" && req.method === "POST") {
      const [a] = await sql`select id,email,password_hash from admins where email=${String(b.email || "").trim()}`;
      if (!a || !bcrypt.compareSync(String(b.password || ""), a.password_hash.replace(/^\$2y\$/, "$2a$"))) return send(401, { error: "Invalid email or password." });
      setCookie(sign({ id: a.id, email: a.email, exp: Date.now() + 8 * 3600e3 }), 8 * 3600);
      return send(200, { email: a.email });
    }
    if (route === "logout") { setCookie("", 0); return send(200, { ok: 1 }); }

    // ---------- admin only ----------
    const m = (req.headers.cookie || "").match(new RegExp(COOKIE + "=([^;]+)"));
    const me = verify(m && m[1]);
    if (!me) return send(401, { error: "Unauthorized" });

    if (route === "me") return send(200, { email: me.email });

    if (route === "dashboard") {
      const [s] = await sql`select count(*)::int n,coalesce(sum(total_points),0)::int pts,count(*) filter (where date_trunc('month',date_joined)=date_trunc('month',now()))::int new_m from participants where is_active`;
      const top = await sql`select name,email,date_joined,total_points from participants where is_active order by total_points desc,id limit 5`;
      const days = await sql`select to_char(awarded_at::date,'Mon FMDD') label,awarded_at::date day,sum(points)::int pts from point_transactions where points>0 and awarded_at>=date_trunc('month',now()) group by 2,1 order by 2`;
      return send(200, { ...s, top, days });
    }

    if (route === "participants" && req.method === "GET") {
      const s = "%" + (q.get("q") || "").trim() + "%", page = Math.max(1, +q.get("page") || 1);
      const rows = await sql`select *,count(*) over()::int total from participants where is_active and (name ilike ${s} or email ilike ${s}) order by date_joined desc,id desc limit 7 offset ${(page - 1) * 7}`;
      return send(200, { rows, total: rows[0] ? rows[0].total : 0 });
    }
    if (route === "participants" && req.method === "POST") {
      const name = String(b.name || "").trim(), email = String(b.email || "").trim().toLowerCase();
      if (!name || !email) return send(400, { error: "Name and email are required." });
      try { await sql`insert into participants (name,email) values (${name},${email})`; }
      catch (e) { return send(409, { error: "Email already exists." }); }
      return send(200, { ok: 1 });
    }
    if (route === "points" && req.method === "POST") {
      const id = +b.participant_id, pts = Math.floor(+b.points), deduct = b.mode === "deduct", reason = String(b.reason || "").trim().slice(0, 255);
      if (!id || !(pts > 0)) return send(400, { error: "Enter a valid number of points." });
      const delta = deduct ? -pts : pts;
      const ok = await sql.begin(async (tx) => {
        const [p] = await tx`select total_points from participants where id=${id} for update`;
        if (!p || (deduct && pts > p.total_points)) return false;
        await tx`insert into point_transactions (participant_id,points,reason,created_by) values (${id},${delta},${reason},${me.email})`;
        await tx`update participants set total_points=total_points+${delta} where id=${id}`;
        return true;
      });
      return ok ? send(200, { ok: 1 }) : send(409, { error: "Participant doesn't have enough points for that deduction." });
    }

    if (route === "reports") {
      const [s] = await sql`select count(*)::int n,coalesce(sum(total_points),0)::int pts,coalesce(max(total_points),0)::int hi from participants where is_active`;
      const top = await sql`select name,email,total_points,date_joined from participants where is_active order by total_points desc,id limit 5`;
      const dist = await sql`select ${bucket()} bucket,count(*)::int n from participants where is_active group by 1`;
      const monthly = await sql`select to_char(date_trunc('month',awarded_at),'Mon YYYY') label,sum(points)::int pts from point_transactions where points>0 group by date_trunc('month',awarded_at) order by date_trunc('month',awarded_at)`;
      return send(200, { ...s, top, dist, monthly });
    }

    if (route === "history") {
      const t = q.get("type") || "all", s = "%" + (q.get("q") || "").trim() + "%", page = Math.max(1, +q.get("page") || 1);
      const want = t === "participants" ? "participant" : t === "points" ? "points" : "";
      const rows = await sql`select *,count(*) over()::int total from (
        select 'participant' event_type,id ref_id,name,email,null::int points,null::text note,date_joined::timestamptz happened_at from participants
        union all
        select 'points',pt.id,p.name,p.email,pt.points,pt.reason,pt.awarded_at from point_transactions pt join participants p on p.id=pt.participant_id
      ) h where name ilike ${s} and (${want}='' or event_type=${want}) order by happened_at desc,ref_id desc limit 20 offset ${(page - 1) * 20}`;
      const [x] = await sql`select (select count(*) from participants)::int n,(select count(*) from point_transactions)::int ev,(select coalesce(sum(points) filter (where points>0),0) from point_transactions)::int aw,(select abs(coalesce(sum(points) filter (where points<0),0)) from point_transactions)::int de`;
      return send(200, { rows, total: rows[0] ? rows[0].total : 0, ...x });
    }
    return send(404, { error: "Not found" });
  } catch (e) {
    console.error(e);
    return send(500, { error: "Server error" });
  }
};
