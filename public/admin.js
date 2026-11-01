const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n || 0).toLocaleString();
const dt = (x) => new Date(x).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const tm = (x) => new Date(x).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const av = (n) => `<div class="av">${esc(n.slice(0, 2).toUpperCase())}</div>`;
const medal = (i) => ["🥇", "🥈", "🥉"][i] || `<span class="em">#${i + 1}</span>`;
let chart, flash = "", st = { page: 1, q: "", hq: "", type: "all", hp: 1 };

async function api(path, body) {
  const r = await fetch("/api/" + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "login") { showLogin(); throw new Error("auth"); }
  if (!r.ok) throw new Error(j.error || "Something went wrong.");
  return j;
}
function showLogin() { $("#app").classList.add("hide"); $("#login").classList.remove("hide"); }
function chartOf(id, cfg) { if (chart) chart.destroy(); chart = new Chart($(id), cfg); }
const note = () => { const f = flash; flash = ""; return f; };
const msg = (t, ok) => { flash = `<div class="flash ${ok ? "ok" : "err"}">${esc(t)}</div>`; };

function modal(title, fields, submit) {
  const o = document.createElement("div");
  o.className = "ov";
  o.innerHTML = `<form class="modal"><h3>${title}</h3>${fields}<div class="err flash hide" style="margin-top:12px"></div><div class="acts"><button type="button" class="btn">Cancel</button><button class="btn p">Save</button></div></form>`;
  document.body.append(o);
  const close = () => o.remove();
  o.onclick = (e) => { if (e.target === o) close(); };
  o.querySelector("button[type=button]").onclick = close;
  o.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    try { await submit(Object.fromEntries(new FormData(e.target))); close(); route(); }
    catch (er) { const x = o.querySelector(".err"); x.textContent = er.message; x.classList.remove("hide"); }
  };
}
const pager = (page, total, per, fn) => `<div class="pg"><span>Showing ${total ? (page - 1) * per + 1 : 0}-${Math.min(page * per, total)} of ${fmt(total)}</span><span><button class="btn s" ${page <= 1 ? "disabled" : ""} onclick="${fn}(${page - 1})">‹ Prev</button> <button class="btn s" ${page * per >= total ? "disabled" : ""} onclick="${fn}(${page + 1})">Next ›</button></span></div>`;
const tile = (v, l) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`;

const views = {
  async dashboard() {
    const d = await api("dashboard");
    $("#view").innerHTML = `${note()}<div class="head"><div><h1>Dashboard</h1><div class="sub">Welcome back! Here's what's happening in KOMSAY QUESTBOARD.</div></div><button class="btn p" onclick="addParticipant()">+ Add Participant</button></div>
    <div class="tiles">${tile(fmt(d.n), "Total participants")}${tile(fmt(d.new_m), "New this month")}${tile(fmt(d.pts), "Total points awarded")}${tile(d.n ? (d.pts / d.n).toFixed(2) : 0, "Average points")}</div>
    <div class="two"><div class="card"><h3 style="margin-bottom:12px">Top Participants</h3><table><tbody>${d.top.map((p, i) => `<tr><td>${medal(i)}</td><td><div class="who">${av(p.name)}<div>${esc(p.name)}<div class="em">${esc(p.email)}</div></div></div></td><td class="pts">${fmt(p.total_points)} ⭐</td></tr>`).join("") || '<tr><td class="em">No participants yet.</td></tr>'}</tbody></table></div>
    <div class="card"><h3>Points Overview <span class="badge">This month</span></h3><canvas id="c" height="160"></canvas></div></div>`;
    chartOf("#c", { type: "line", data: { labels: d.days.map((x) => x.label), datasets: [{ data: d.days.map((x) => x.pts), borderColor: "#6c47ff", backgroundColor: "rgba(108,71,255,.12)", fill: true, tension: 0.4 }] }, options: { plugins: { legend: { display: false } } } });
  },
  async participants() {
    const d = await api(`participants?page=${st.page}&q=${encodeURIComponent(st.q)}`);
    $("#view").innerHTML = `${note()}<div class="head"><div><h1>Participants</h1><div class="sub">Manage students and their points.</div></div><div><button class="btn" onclick="window.open('/?print=1')">Print Rankings</button> <button class="btn p" onclick="addParticipant()">+ Add Participant</button></div></div>
    <div class="card"><div class="tools"><input id="sq" type="search" placeholder="Search participant…" value="${esc(st.q)}"></div><div style="overflow-x:auto"><table><thead><tr><th>#</th><th>Participant</th><th>Joined</th><th>Points</th><th>Actions</th></tr></thead><tbody>
    ${d.rows.map((p, i) => `<tr><td class="em">${(st.page - 1) * 7 + i + 1}</td><td><div class="who">${av(p.name)}<div>${esc(p.name)}<div class="em">${esc(p.email)}</div></div></div></td><td class="em">${dt(p.date_joined)}</td><td class="pts">${fmt(p.total_points)} ⭐</td>
    <td><button class="btn p s" onclick="pts(${p.id},'add')">+ Add</button> <button class="btn s" onclick="pts(${p.id},'deduct')">− Deduct</button></td></tr>`).join("") || '<tr><td colspan="5" class="em" style="text-align:center;padding:28px">No participants found.</td></tr>'}</tbody></table></div>${pager(st.page, d.total, 7, "goP")}</div>`;
    let t; $("#sq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value; st.page = 1; views.participants().then(() => { const i = $("#sq"); i.focus(); i.setSelectionRange(99, 99); }); }, 350); };
  },
  async reports() {
    const d = await api("reports");
    $("#view").innerHTML = `<div class="head"><div><h1>Reports</h1><div class="sub">Participant analytics and statistics</div></div><button class="btn p" onclick="print()">Export Report</button></div>
    <div class="tiles">${tile(fmt(d.n), "Total participants")}${tile(fmt(d.pts), "Total points")}${tile(d.n ? (d.pts / d.n).toFixed(2) : 0, "Average points")}${tile(fmt(d.hi), "Highest points")}</div>
    <div class="two"><div class="card"><h3>Points Distribution</h3><canvas id="c1" height="200"></canvas></div><div class="card"><h3 style="margin-bottom:8px">Top Participants</h3><table><tbody>${d.top.map((p, i) => `<tr><td>${medal(i)}</td><td><div class="who">${av(p.name)}<div>${esc(p.name)}<div class="em">${esc(p.email)} · Joined ${dt(p.date_joined)}</div></div></div></td><td><span class="badge">⭐ ${fmt(p.total_points)}</span></td></tr>`).join("")}</tbody></table></div></div>
    <div class="card"><h3>Monthly Trend</h3><canvas id="c2" height="90"></canvas></div>`;
    chartOf("#c1", { type: "doughnut", data: { labels: d.dist.map((x) => x.bucket), datasets: [{ data: d.dist.map((x) => x.n), backgroundColor: ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"], borderWidth: 0 }] }, options: { plugins: { legend: { position: "bottom" } } } });
    new Chart($("#c2"), { type: "bar", data: { labels: d.monthly.map((x) => x.label), datasets: [{ data: d.monthly.map((x) => x.pts), backgroundColor: "#6366f1", borderRadius: 8 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
  },
  async history() {
    const d = await api(`history?type=${st.type}&q=${encodeURIComponent(st.hq)}&page=${st.hp}`);
    const tabs = [["all", "All Activity"], ["participants", "👤 Participants"], ["points", "⭐ Points"]];
    $("#view").innerHTML = `<div class="head"><div><h1>History</h1><div class="sub">A full log of registrations and point transactions.</div></div></div>
    <div class="tiles">${tile(fmt(d.n), "Participants ever")}${tile(fmt(d.ev), "Point events")}${tile(fmt(d.aw), "Points awarded")}${tile(fmt(d.de), "Points deducted")}</div>
    <div class="card"><div class="tools"><span>${tabs.map(([k, l]) => `<button class="btn s ${st.type === k ? "p" : ""}" onclick="hType('${k}')">${l}</button>`).join(" ")}</span><input id="hs" type="search" placeholder="Search by name…" value="${esc(st.hq)}"></div>
    <div style="overflow-x:auto"><table><thead><tr><th>Type</th><th>Participant</th><th>Detail</th><th>Date &amp; time</th></tr></thead><tbody>${d.rows.map((r) => `<tr><td>${r.event_type === "participant" ? '<span class="badge">👤 Joined</span>' : r.points >= 0 ? '<span class="badge g">⭐ Awarded</span>' : '<span class="badge r">➖ Deducted</span>'}</td>
    <td><div class="who">${av(r.name)}<div>${esc(r.name)}<div class="em">${esc(r.email)}</div></div></div></td>
    <td>${r.event_type === "participant" ? '<span class="em">New participant registered</span>' : `<span class="pts" style="color:${r.points >= 0 ? "#16a34a" : "#dc2626"}">${r.points >= 0 ? "+" : ""}${fmt(r.points)} pts</span><div class="em">${esc(r.note || "")}</div>`}</td>
    <td class="em" style="white-space:nowrap">${dt(r.happened_at)}<br>${tm(r.happened_at)}</td></tr>`).join("") || '<tr><td colspan="4" class="em" style="text-align:center;padding:28px">No history records found.</td></tr>'}</tbody></table></div>${pager(st.hp, d.total, 20, "goH")}</div>`;
    let t; $("#hs").onchange = (e) => { st.hq = e.target.value; st.hp = 1; views.history(); };
  },
};
window.goP = (p) => { st.page = p; route(); };
window.goH = (p) => { st.hp = p; route(); };
window.hType = (t) => { st.type = t; st.hp = 1; route(); };
window.addParticipant = () => modal("Add Participant", '<label>Full Name</label><input name="name" required><label>Email Address</label><input type="email" name="email" required>', async (v) => { await api("participants", v); msg("Participant added.", true); });
window.pts = (id, mode) => modal(mode === "add" ? "Add Points" : "Deduct Points", `<input type="hidden" name="participant_id" value="${id}"><input type="hidden" name="mode" value="${mode}"><label>Points</label><input type="number" name="points" min="1" step="1" required><label>Reason (optional)</label><input name="reason" maxlength="255">`, async (v) => { await api("points", v); msg(mode === "add" ? "Points awarded." : "Points deducted.", true); });

async function route() {
  const name = location.hash.slice(1) || "dashboard";
  document.querySelectorAll(".side a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + name));
  try { await (views[name] || views.dashboard)(); } catch (e) { if (e.message !== "auth") $("#view").innerHTML = `<div class="flash err">${esc(e.message)}</div>`; }
}
$("#lf").onsubmit = async (e) => {
  e.preventDefault();
  try { await api("login", Object.fromEntries(new FormData(e.target))); $("#login").classList.add("hide"); $("#app").classList.remove("hide"); route(); }
  catch (er) { const x = $("#lerr"); x.textContent = er.message; x.classList.remove("hide"); }
};
$("#out").onclick = async (e) => { e.preventDefault(); await api("logout", {}); showLogin(); };
window.addEventListener("hashchange", route);
api("me").then(() => { $("#app").classList.remove("hide"); route(); }).catch(showLogin);
