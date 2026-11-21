// Shared storage and date helpers for both pages.
const STORE_KEY = "staffLeave.v1";

const Store = {
  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return Store.seed();
  },
  seed() {
    return window.SEED_LEAVES.map((r, i) => ({ ...r, uid: "s" + i }));
  },
  save(rows) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(rows)); } catch (e) {}
  },
  reset() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    return Store.seed();
  },
  isCustom() {
    try { return !!localStorage.getItem(STORE_KEY); } catch (e) { return false; }
  }
};

const uid = () => "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---- Dates (all handled as local dates, ISO strings YYYY-MM-DD) ----
const pad = n => String(n).padStart(2, "0");
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const validISO = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(fromISO(s));
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
const leaveDays = r => (validISO(r.from) && validISO(r.to) && r.to >= r.from) ? daysBetween(r.from, r.to) + 1 : null;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = s => { if (!validISO(s)) return "—"; const d = fromISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

// Parse whatever a spreadsheet throws at us: Date objects, Excel serials,
// ISO strings, dd/mm/yyyy, mm/dd/yyyy, "5 Jan 2026". Returns {y,m,d} candidates.
function dateCandidates(v) {
  if (v == null || v === "") return [];
  if (v instanceof Date && !isNaN(v)) return [{ y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() }];
  if (typeof v === "number" && v > 20000 && v < 80000) { // Excel serial
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return [{ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }];
  }
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return [{ y: +m[1], m: +m[2], d: +m[3] }];
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/))) {
    let y = +m[3]; if (y < 100) y += 2000;
    const a = +m[1], b = +m[2];
    const out = [];
    if (a <= 31 && b <= 12) out.push({ y, m: b, d: a });   // dd/mm (house default)
    if (a <= 12 && b <= 31 && a !== b) out.push({ y, m: a, d: b }); // mm/dd
    return out;
  }
  const t = new Date(s);
  if (!isNaN(t)) return [{ y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }];
  return [];
}

const candISO = c => {
  const d = new Date(c.y, c.m - 1, c.d);
  return (d.getMonth() === c.m - 1 && d.getDate() === c.d) ? toISO(d) : null;
};

// Pick the from/to pair that makes sense: valid dates, to >= from, shortest sane span.
// Also repairs year typos (2016, 1026) using the other date's year.
function smartRange(fromRaw, toRaw) {
  const F = dateCandidates(fromRaw), T = dateCandidates(toRaw);
  const fixYear = (c, ref) => (ref && (c.y < 2000 || Math.abs(c.y - ref.y) > 1)) ? { ...c, y: ref.y } : c;
  let best = null;
  for (const f of F) for (const t0 of T) {
    for (const t of [t0, fixYear(t0, f), { ...fixYear(t0, f), y: f.y + 1 }]) {
      const a = candISO(f), b = candISO(t);
      if (!a || !b || b < a) continue;
      const span = daysBetween(a, b);
      if (span > 180) continue;
      const score = span + (F.indexOf(f) + T.indexOf(t0)) * 0.5; // prefer dd/mm on ties
      if (!best || score < best.score) best = { from: a, to: b, score };
    }
  }
  if (best) return { from: best.from, to: best.to };
  return { from: F[0] ? candISO(F[0]) || "" : "", to: "" };
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Theme toggle shared by both pages
function initTheme() {
  const btn = document.getElementById("themeBtn");
  let saved = null;
  try { saved = localStorage.getItem("staffLeave.theme"); } catch (e) {}
  if (saved) document.documentElement.dataset.theme = saved;
  if (!btn) return;
  btn.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("staffLeave.theme", next); } catch (e) {}
  });
}
