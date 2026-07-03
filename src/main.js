// ============================================================
// Shelf Sort — Full game with page state machine
// Loading → Home → Game → Pause → Result
// ============================================================

import "./styles.css";
import { GOODS, itemSize, loadShelf, getSprite } from "./data.js";
import lvls from "./data/levels.json";

const $ = document.querySelector("#game");
const C = $.getContext("2d");
const [W, H] = [$.width, $.height];

// ── Save system ─────────────────────────────────────────────
const SAVE_KEY = "shelfSort_progress";
function loadProgress() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d && typeof d.level === "number") return d; } catch {}
  return { level: 0, completed: [] };
}
function saveProgress() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ level: progress.level, completed: progress.completed }));
}
let progress = loadProgress();

// ── URL debug param ─────────────────────────────────────────
const urlLv = new URLSearchParams(location.search).get("level");
const DEBUG_LV = urlLv !== null ? Number(urlLv) : -1;

// ── Page state ──────────────────────────────────────────────
let page = "loading"; // loading | home | play | paused | won | lost
let loadPct = 0;
let loadDone = false;

// ── Sprites ─────────────────────────────────────────────────
let PROD = {}, SHLF = {};
async function loadSprites() {
  try { const m = await import("./generated/manifest.json"); PROD = m.items || {}; SHLF = m.shelves || {}; } catch {}
}

// ── Game state ──────────────────────────────────────────────
const LV = lvls.levels;
let li = 0; // current level index
let lv, sd, sdr, cells = [], held = null, ptr = { x: 0, y: 0 };
let st = "play", msg = "", t0 = 0, tPause = 0, pAt = 0;
let score = 0, coins = 0, sold = 0, combo = 0, cLife = 0;
let moves = 0, used = 0, vipOk = false, undoS = null, uLeft = 1;
let stars = 0, rwUsed = false, intro = 1, sf = 0, sfC = "#fff", shake = 0;
let parts = [], pops = [], pid = null;

// ── Hit rects ───────────────────────────────────────────────
const BTN = {
  pause: [618, 58, 46, 46],
  homeStart: [214, 660, 322, 72],
  homeContinue: [214, 760, 322, 56],
  result: [224, 650, 302, 72],
  cont: [224, 560, 302, 72],
  pResume: [224, 500, 302, 72],
  pRestart: [224, 590, 302, 72],
  pHome: [224, 680, 302, 72],
};

// ── Init level ──────────────────────────────────────────────
async function initLevel() {
  lv = LV[li];
  sd = await loadShelf(lv.skin);
  const p = lv.pos; sdr = { x: p.x, y: p.y, w: p.w, h: p.h };
  cells = lv.cells.map((s, i) => ({
    id: i, col: s.col, row: s.row,
    lanes: [0, 1, 2].map(li => {
      const raw = (s.lanes || [])[li] || [];
      return raw.map((t, d) => ({ id: `${i}-${li}-${d}-${t}`, type: t, emerge: d === raw.length - 1 ? 1 : 0 }));
    }),
    lock: s.lock || 0, sealed: [...(s.sealed || [])], closed: false, closing: 0,
    flash: 0, warn: 0, shake: 0,
  }));
}

function reset() {
  held = null; pid = null; t0 = performance.now(); tPause = 0; pAt = 0;
  score = 0; coins = 0; sold = 0; combo = 0; cLife = 0;
  moves = lv.maxMoves || 99; used = 0; vipOk = !lv.vip;
  undoS = null; uLeft = 1; stars = 0; rwUsed = false;
  st = "play"; msg = lv.tutorial || lv.goal; parts = []; pops = []; shake = 0; sf = 0; intro = 1;
}

function startLevel(idx) {
  li = idx;
  if (!progress.completed) progress.completed = [];
  initLevel().then(() => { reset(); page = "play"; });
}

// ── Serialize ───────────────────────────────────────────────
function snap() { return JSON.stringify({ cells: cells.map(c => ({ lanes: c.lanes.map(l => l.map(it => ({ type: it.type, emerge: it.emerge }))), lock: c.lock, sealed: [...c.sealed], closed: c.closed, closing: c.closing })), moves, used, sold, score, coins, combo, cLife, vipOk }); }
function restore(s) { const d = JSON.parse(s); cells = d.cells.map((c, i) => ({ id: i, col: cells[i]?.col || 0, row: cells[i]?.row || 0, lanes: c.lanes.map((l, li) => l.map((it, depth) => ({ id: `${i}-${li}-${depth}-${it.type}`, type: it.type, emerge: it.emerge }))), lock: c.lock, sealed: [...c.sealed], closed: c.closed, closing: c.closing, flash: 0, warn: 0, shake: 0 })); moves = d.moves; used = d.used; sold = d.sold; score = d.score; coins = d.coins; combo = d.combo; cLife = d.cLife; vipOk = d.vipOk; }

// ── Helpers ─────────────────────────────────────────────────
const inR = (p, x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const sh = (h, a) => { let r = parseInt(h.slice(1, 3), 16) + a, g = parseInt(h.slice(3, 5), 16) + a, b = parseInt(h.slice(5, 7), 16) + a; return `rgb(${cl(r, 0, 255)},${cl(g, 0, 255)},${cl(b, 0, 255)})`; };
function tm(now) { if (!lv.timeLimit) return 9999; const e = (now - t0 - tPause) / 1000; if (st === "paused" && pAt) return Math.max(0, Math.ceil(lv.timeLimit - (pAt - t0 - tPause) / 1000)); return Math.max(0, Math.ceil(lv.timeLimit - e)); }
function fmt(t) { const m = Math.floor(t / 60), s = String(t % 60).padStart(2, "0"); return `${String(m).padStart(2, "0")}:${s}`; }
function left() { return cells.filter(c => !c.closed && c.lanes.some(l => l.length > 0)).length; }
function done() { return cells.every(c => c.closed || c.lanes.every(l => l.length === 0)); }
function stars3() { const [s3, s2] = lv.star || [1, Math.ceil(lv.maxMoves * .4)]; return moves >= s3 ? 3 : moves >= s2 ? 2 : 1; }
function hint() { const l = left(); if (lv.vip && !vipOk) return `VIP: sell ${GOODS[lv.vip].label} first.`; if (l) return `${l} shelf${l > 1 ? "es" : ""} left.`; return "Out of moves."; }
function fronts(c) { return c.lanes.map(l => l[l.length - 1]).filter(Boolean); }
function ctr(c) { const r = cellR(c.id); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

// ── Cell positioning ────────────────────────────────────────
function cellR(i) {
  const c = cells[i]; if (!c || !sd || !sdr) return { x: 0, y: 0, w: 100, h: 80, floorY: 0 };
  const m = sd.cells.find(m => m.col === c.col && m.row === c.row);
  if (!m) return { x: 0, y: 0, w: 100, h: 80, floorY: 0 };
  const sx = sdr.w / sd.masterSize[0], sy = sdr.h / sd.masterSize[1];
  const x = sdr.x + m.x * sx, y = sdr.y + m.y * sy, w = m.w * sx, h = m.h * sy;
  const sk = c.shake ? Math.sin(c.shake * 28) * 4 * c.shake : 0;
  return { x: x + sk, y, w, h, floorY: sdr.y + m.floorY * sy, laneXs: m.laneXs, itemScale: m.itemScale || 1, shadowScale: m.shadowScale || 1 };
}

function itemPos(i, li) {
  const c = cells[i], r = cellR(i);
  const lane = c.lanes[li]; const type = (lane && lane.length) ? lane[lane.length - 1].type : "milk";
  const sz = itemSize(type, 1);
  let lx;
  if (r.laneXs && r.laneXs[li] != null) {
    const sx = sdr.w / sd.masterSize[0];
    lx = sdr.x + r.laneXs[li] * sx;
  } else {
    lx = r.x + r.w / 3 * (li + 0.5);
  }
  const maxH = r.h * 0.72, maxW = r.w / 3 * 0.85;
  const sc = Math.max(0.58, Math.min(1.3, maxH / sz.h, maxW / sz.w)) * (r.itemScale || 1);
  const size = itemSize(type, sc);
  return { x: lx, y: r.floorY - size.h * 0.50, scale: sc, floorY: r.floorY, w: size.w, h: size.h };
}

// ── Hit testing ─────────────────────────────────────────────
function hitCell(p) { for (let i = cells.length - 1; i >= 0; i--) { const r = cellR(i); if (inR(p, r.x, r.y, r.w, r.h)) return cells[i]; } return null; }
function hitLane(c, p) { const r = cellR(c.id); const rel = cl((p.x - r.x) / r.w, 0, .999); return Math.floor(rel * 3); }
function hitItem(p) { for (let i = cells.length - 1; i >= 0; i--) { const c = cells[i]; for (let li = 2; li >= 0; li--) { const l = c.lanes[li]; if (!l.length) continue; const pos = itemPos(i, li); const s = itemSize(l[l.length - 1].type, pos.scale); if (Math.abs(p.x - pos.x) < s.w * .6 && Math.abs(p.y - pos.y) < s.h * .6) return { cell: c, lane: li, x: pos.x, y: pos.y }; } } return null; }

// ── Drop logic ──────────────────────────────────────────────
function canDrop(c, li) { return c && !c.closed && c.lock <= 0 && li >= 0 && !c.sealed.includes(li) && c.lanes[li].length === 0 && c.id !== held.from; }
function drop(c, li, it) { it.emerge = 1; c.lanes[li].push(it); }
function ret(c, it) { c.lanes[it.fromLane].push(it.item); }

// ── Shelf check & clear ─────────────────────────────────────
function check(c) {
  const fs = fronts(c); if (fs.length !== 3) return;
  const [a, b, Ct] = fs.map(it => it.type); if (a !== b || b !== Ct) { c.warn = 1; msg = "Mixed row."; return; }
  if (c.lanes.some(l => l.length > 1)) { c.warn = 1; msg = "Back stock blocks sale."; return; }
  if (lv.vip && !vipOk && a !== lv.vip) { c.warn = 1; msg = `VIP: sell ${GOODS[lv.vip].label} first.`; return; }
  if (lv.vip && a === lv.vip) vipOk = true;
  c.closed = true; c.closing = .01; sold++; combo = Math.min(9, combo + 1); cLife = 1;
  const g = 100 + combo * 40, cg = 8 + combo * 2; score += g; coins += cg;
  const cc = ctr(c); burst(cc.x, cc.y, GOODS[a].a, 34 + combo * 4);
  sf = 1; sfC = GOODS[a].a;
  pops.push({ x: cc.x, y: cc.y - 30, text: combo > 1 ? `COMBO x${combo}` : "SOLD!", life: 1 });
  pops.push({ x: cc.x, y: cc.y + 8, text: `+${cg}`, life: .9 });
  shake = Math.max(shake, 3 + combo); msg = `${GOODS[a].label} sold!`;
  unlock(); unseal();
  if (done()) {
    st = "won"; stars = stars3(); msg = stars >= 3 ? "Perfect!" : "Clear!";
    page = "won";
    if (!progress.completed.includes(li)) { progress.completed.push(li); }
    if (li >= progress.level) { progress.level = li + 1; }
    saveProgress();
  }
}
function unlock() { for (const c of cells) if (c.lock > 0 && sold >= c.lock) { c.lock = 0; c.flash = 1; msg = "Lock broken!"; burst(ctr(c).x, ctr(c).y, "#65dbff", 18); } }
function unseal() { if (sold <= 0) return; let any = false; for (const c of cells) if (c.sealed.length) { c.sealed = []; c.flash = 1; any = true; } if (any) msg = "Seals broken!"; }

// ── Tools ──────────────────────────────────────────────────
function tools() {
  return [
    { id: "undo", x: 78, y: 1148, w: 134, h: 100, label: uLeft > 0 ? `UNDO ${uLeft}` : "UNDO", ok: uLeft > 0 && !!undoS },
    { id: "boost", x: 308, y: 1148, w: 134, h: 100, label: rwUsed ? "BOOST" : "+2", ok: !rwUsed && st === "play" },
    { id: "restart", x: 538, y: 1148, w: 134, h: 100, label: "RESTART", ok: true },
  ];
}
function hitTool(p) { return tools().find(t => inR(p, t.x, t.y, t.w, t.h)); }
function useTool(t) {
  if (!t.ok) { msg = "N/A."; return; }
  if (t.id === "undo") { if (!undoS) { msg = "Nothing."; return; } restore(undoS); undoS = null; uLeft--; msg = "Undone."; return; }
  if (t.id === "restart") { reset(); return; }
  if (t.id === "boost") { rwUsed = true; moves += 2; msg = "+2 moves!"; sf = 1; sfC = "#eebf63"; pops.push({ x: W / 2, y: 1110, text: "+2 MOVES", life: 1 }); }
}

// ── Effects ─────────────────────────────────────────────────
function burst(x, y, color, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.4, size: 3 + Math.random() * 5, color: Math.random() > .35 ? color : "#fff7ba", life: 1 }); } }

// ── Pointer ─────────────────────────────────────────────────
function gp(e) { const r = $.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; }
$.addEventListener("pointerdown", e => {
  const p = gp(e); ptr = p; if (held) return;

  // ── Home page clicks ──
  if (page === "home") {
    if (inR(p, ...BTN.homeStart)) {
      // Start from level 0 (Lv.1) or first uncompleted
      let startLv = 0;
      if (DEBUG_LV >= 0) startLv = Math.min(DEBUG_LV, LV.length - 1);
      else startLv = progress.completed.includes(0) ? Math.min(progress.level, LV.length - 1) : 0;
      startLevel(startLv);
    }
    return;
  }

  // ── Paused ──
  if (page === "paused") {
    if (inR(p, ...BTN.pResume)) { tPause += performance.now() - pAt; pAt = 0; page = "play"; }
    else if (inR(p, ...BTN.pRestart)) { reset(); page = "play"; }
    else if (inR(p, ...BTN.pHome)) { page = "home"; }
    return;
  }

  // ── Result ──
  if (page === "won" || page === "lost") {
    // Continue (lost only)
    if (page === "lost" && !rwUsed && inR(p, ...BTN.cont)) {
      rwUsed = true; moves += 3; page = "play"; st = "play"; msg = "+3 moves.";
      sf = 1; sfC = "#9bdc7c"; pops.push({ x: W / 2, y: 560, text: "+3 MOVES", life: 1 });
      return;
    }
    // Next level / retry
    if (inR(p, ...BTN.result)) {
      if (page === "won" && li < LV.length - 1) { startLevel(li + 1); }
      else if (page === "won") { page = "home"; }
      else { reset(); page = "play"; }
    }
    // Home button (below result)
    if (inR(p, 224, 740, 302, 72)) { page = "home"; }
    return;
  }

  // ── Play ──
  if (inR(p, ...BTN.pause)) { page = "paused"; pAt = performance.now(); return; }
  const t = hitTool(p); if (t) { useTool(t); return; }
  const h = hitItem(p); if (!h) return;
  if (h.cell.closed || h.cell.lock > 0) { h.cell.warn = 1; h.cell.shake = 1; msg = h.cell.lock > 0 ? `Locked: sell ${h.cell.lock} more.` : "Sold."; return; }
  if (h.cell.sealed.includes(h.lane)) { h.cell.warn = 1; h.cell.shake = 1; msg = "Sealed!"; return; }
  const it = h.cell.lanes[h.lane].pop();
  if (h.cell.lanes[h.lane].length > 0) { const rv = h.cell.lanes[h.lane][h.cell.lanes[h.lane].length - 1]; if (rv) rv.emerge = .01; }
  held = { item: it, from: h.cell.id, fromLane: h.lane, vx: p.x, vy: p.y - 42, angle: 0, lift: 0, t: 0 };
  h.cell.flash = 1; pid = e.pointerId; $.setPointerCapture(e.pointerId);
});
$.addEventListener("pointermove", e => { if (pid !== null && e.pointerId !== pid) return; ptr = gp(e); });
$.addEventListener("pointerup", e => {
  if (pid !== null && e.pointerId !== pid) return; ptr = gp(e); if (!held) return;
  const tgt = hitCell(ptr), tl = tgt ? hitLane(tgt, ptr) : -1, fr = cells[held.from];
  if (tgt && canDrop(tgt, tl)) { undoS = snap(); drop(tgt, tl, held.item); tgt.flash = 1; moves = Math.max(0, moves - 1); used++; msg = `Moved ${GOODS[held.item.type].label}.`; check(tgt); unlock(); unseal(); if (page === "play" && moves <= 0 && !done()) { page = "lost"; st = "lost"; msg = hint(); } }
  else { ret(fr, held); msg = tgt?.lock ? "Locked." : tgt && tl >= 0 && tgt.sealed.includes(tl) ? "Sealed." : tgt && tl >= 0 && tgt.lanes[tl].length > 0 ? "Occupied." : "Drop into open lane."; if (tgt) { tgt.warn = 1; tgt.shake = 1; } }
  held = null; pid = null; try { $.releasePointerCapture(e.pointerId); } catch { }
});

// ── Update ──────────────────────────────────────────────────
function upd(now) {
  if (page === "paused") return;
  intro *= .965; sf *= .86;
  if (page === "play" && lv.timeLimit > 0 && tm(now) <= 0) { page = "lost"; st = "lost"; msg = "Time's up!"; }
  for (const c of cells) { c.flash *= .88; c.warn *= .84; c.shake *= .78; if (c.closing > 0 && c.closing < 1) c.closing = Math.min(1, c.closing + .08); }
  if (held) { held.t += .05; held.lift = Math.min(1, held.t * 4); held.vx += (ptr.x - held.vx) * .55; held.vy += (ptr.y - 42 - held.vy) * .55; held.angle = cl((ptr.x - held.vx) * .01, -.12, .12); }
  if (cLife > 0) cLife *= .975; else combo = 0;
  shake *= .84;
  parts = parts.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + .09, life: p.life * .93 })).filter(p => p.life > .04);
  pops = pops.map(p => ({ ...p, y: p.y - 1.5, life: p.life * .94 })).filter(p => p.life > .05);
}

// ═══════════════════════════════════════════════════════════
//  RENDER — Page router
// ═══════════════════════════════════════════════════════════
function draw(now) {
  upd(now); C.clearRect(0, 0, W, H);
  if (page === "loading") { drawLoading(); if (loadDone) { page = "home"; } }
  else if (page === "home") { bg(); drawHome(now); }
  else if (page === "play" || page === "won" || page === "lost" || page === "paused") {
    bg(); hud(now); C.save();
    if (shake > .2) C.translate(Math.sin(now * 2.8) * shake, Math.cos(now * 2.1) * shake * .6);
    shelfBack(); allRows(); shelfFront(); overlays(); C.restore();
    heldIt(); partsFn(); flashFn(); botBar(); tip();
    lvIntro();
    if (page === "won" || page === "lost") drawResult();
    if (page === "paused") drawPauseOvr();
  }
  requestAnimationFrame(draw);
}

// ── Loading page ────────────────────────────────────────────
function drawLoading() {
  if (!loadDone) {
    loadPct = Math.min(100, loadPct + 2);
    if (loadPct >= 100) loadDone = true;
  }
  C.fillStyle = "#2c241c"; C.fillRect(0, 0, W, H);
  const glow = C.createRadialGradient(W / 2, H / 2 - 40, 20, W / 2, H / 2 - 40, 400);
  glow.addColorStop(0, "rgba(255,220,160,.35)"); glow.addColorStop(1, "rgba(255,220,160,0)");
  C.fillStyle = glow; C.fillRect(0, 0, W, H);
  // Logo text
  C.fillStyle = "#f5e6cc"; C.strokeStyle = "rgba(140,90,40,.5)"; C.lineWidth = 5;
  C.font = "900 52px 'Trebuchet MS',sans-serif"; C.textAlign = "center";
  C.strokeText("SHELF SORT", W / 2, H / 2 - 60); C.fillText("SHELF SORT", W / 2, H / 2 - 60);
  C.fillStyle = "rgba(200,170,130,.8)"; C.font = "800 18px 'Trebuchet MS',sans-serif";
  C.fillText("Goods Matching Puzzle", W / 2, H / 2 - 16);
  // Loading bar
  const bx = W / 2 - 160, by = H / 2 + 40, bw = 320, bh = 12;
  rrect(bx, by, bw, bh, 6, "rgba(255,255,255,.12)", "rgba(255,255,255,.3)", 1);
  rrect(bx + 2, by + 2, Math.max(4, (bw - 4) * loadPct / 100), bh - 4, 4, "#d4a560");
  C.fillStyle = "rgba(200,170,130,.6)"; C.font = "800 13px 'Trebuchet MS',sans-serif"; C.textAlign = "center";
  C.fillText(`Loading ${Math.floor(loadPct)}%`, W / 2, by + 32);
}

// ── Home page ───────────────────────────────────────────────
function drawHome(now) {
  const bob = Math.sin(now / 420) * 6;
  // Title
  C.fillStyle = "#fff"; C.strokeStyle = "rgba(114,48,32,.55)"; C.lineWidth = 6;
  C.font = "900 56px 'Trebuchet MS',sans-serif"; C.textAlign = "center";
  C.strokeText("SHELF SORT", W / 2, 200 + bob); C.fillText("SHELF SORT", W / 2, 200 + bob);
  C.fillStyle = "#8b6b4a"; C.font = "900 20px 'Trebuchet MS',sans-serif";
  C.fillText("Match goods. Clear shelves.", W / 2, 248);

  // Level progress badge
  const curLv = DEBUG_LV >= 0 ? DEBUG_LV + 1 : Math.min(progress.level + 1, LV.length);
  C.fillStyle = "#fff"; C.font = "900 22px 'Trebuchet MS',sans-serif";
  C.fillText(`Current: Level ${Math.min(curLv, LV.length)} / ${LV.length}`, W / 2, 310);

  // Star progress dots
  for (let i = 0; i < LV.length; i++) {
    const dotX = W / 2 - (LV.length - 1) * 18 + i * 36;
    const done = progress.completed.includes(i);
    circle(dotX, 350, 10, done ? "#efd48a" : "rgba(200,180,150,.3)", done ? "#a88747" : "rgba(150,130,110,.4)", 1.5);
    C.fillStyle = done ? "#6b4d2a" : "rgba(150,130,110,.6)";
    C.font = "800 11px 'Trebuchet MS',sans-serif"; C.textAlign = "center";
    C.fillText(String(i + 1), dotX, 354);
  }

  // Start button
  const g = C.createLinearGradient(BTN.homeStart[0], BTN.homeStart[1], BTN.homeStart[0], BTN.homeStart[1] + BTN.homeStart[3]);
  g.addColorStop(0, "#6ee442"); g.addColorStop(1, "#21b934");
  rrect(...BTN.homeStart, 28, g, "#fff", 3);
  C.fillStyle = "#fff"; C.strokeStyle = "rgba(28,105,34,.5)"; C.lineWidth = 4;
  C.font = "900 32px 'Trebuchet MS',sans-serif";
  C.strokeText("PLAY", W / 2, BTN.homeStart[1] + 47); C.fillText("PLAY", W / 2, BTN.homeStart[1] + 47);

  // Continue text
  const contLv = DEBUG_LV >= 0 ? DEBUG_LV : progress.level;
  C.fillStyle = "rgba(140,110,70,.7)"; C.font = "800 16px 'Trebuchet MS',sans-serif";
  C.fillText(`Continue from Level ${Math.min(contLv + 1, LV.length)}`, W / 2, BTN.homeStart[1] - 16);

  // About text at bottom
  C.fillStyle = "rgba(140,110,70,.5)"; C.font = "800 14px 'Trebuchet MS',sans-serif";
  C.fillText("Shelf Sort — Casual Matching Puzzle", W / 2, 870);
}

// ── Background ──────────────────────────────────────────────
function bg() {
  const w = C.createLinearGradient(0, 0, 0, H); w.addColorStop(0, "#f2ddc2"); w.addColorStop(1, "#e3be92"); C.fillStyle = w; C.fillRect(0, 0, W, H);
  const g = C.createRadialGradient(W * .48, 330, 20, W * .48, 430, 560); g.addColorStop(0, "rgba(255,250,237,.46)"); g.addColorStop(1, "rgba(255,255,255,0)"); C.fillStyle = g; C.fillRect(0, 0, W, H * .72);
  const ft = 1118, fl = C.createLinearGradient(0, ft, 0, H); fl.addColorStop(0, "#d9a071"); fl.addColorStop(1, "#a85e41"); C.fillStyle = fl; C.fillRect(0, ft, W, H - ft);
  C.strokeStyle = "rgba(255,222,188,.14)"; C.lineWidth = 2; for (let y = ft + 42; y < H; y += 54) { C.beginPath(); C.moveTo(0, y); C.lineTo(W, y - 8); C.stroke(); }
}

// ── HUD ─────────────────────────────────────────────────────
function hud(now) {
  const t = C.createLinearGradient(0, 0, 0, 146); t.addColorStop(0, "#b86645"); t.addColorStop(1, "#a94f38"); C.fillStyle = t; C.fillRect(0, 0, W, 146);
  C.fillStyle = "rgba(117,45,32,.16)"; C.fillRect(0, 128, W, 18);
  badge(22, 58, 110, 52, `Lv. ${lv.lv}`, "#a53d4c");
  badge(160, 58, 140, 52, lv.timeLimit > 0 ? fmt(tm(now)) : "--:--", "#f1bd5c");
  C.save(); C.translate(378, 84); drawStar(0, 0, 16, "#ffd33f", "#a45b25"); C.restore();
  badge(418, 58, 96, 52, String(moves), moves <= 2 ? "#b04446" : "#a53d4c");
  const px = 618, py = 58;
  rrect(px, py, 46, 46, 10, "#17b8e5", "#087aa5", 2.5); C.fillStyle = "#fff";
  rrect(px + 14, py + 10, 6, 26, 3, "#fff"); rrect(px + 26, py + 10, 6, 26, 3, "#fff");
  const tot = cells.filter(c => !c.lanes.every(l => l.length === 0)).length, prog = tot ? sold / tot : 0;
  rrect(160, 120, 430, 22, 11, "#3a1f18", "rgba(255,204,172,.14)", 1.5);
  rrect(167, 125, Math.max(26, 416 * prog), 12, 6, "#39d22f", "rgba(255,255,255,.25)", 1);
  C.fillStyle = "#fff"; C.font = "900 16px 'Trebuchet MS',sans-serif"; C.textAlign = "center";
  C.fillText(combo > 1 ? `x${combo}` : `${sold}/${tot}`, W / 2, 138);
}
function badge(x, y, w, h, txt, clr) {
  const g = C.createLinearGradient(x, y, x, y + h); g.addColorStop(0, sh(clr, 35)); g.addColorStop(.5, clr); g.addColorStop(1, sh(clr, -22));
  rrect(x, y, w, h, 14, g, "rgba(91,35,32,.38)", 2.5); C.fillStyle = "#fff"; C.strokeStyle = "rgba(80,31,29,.52)"; C.lineWidth = 4;
  C.font = `900 ${txt.length > 5 ? 28 : 32}px 'Trebuchet MS',sans-serif`; C.textAlign = "center"; C.strokeText(txt, x + w / 2, y + h / 2 + 11); C.fillText(txt, x + w / 2, y + h / 2 + 11);
}

// ── Shelf ──────────────────────────────────────────────────
function shelfShadow() {
  if (!sdr) return; const g = C.createRadialGradient(sdr.x + sdr.w / 2, sdr.y + sdr.h + 30, 20, sdr.x + sdr.w / 2, sdr.y + sdr.h + 30, 300);
  g.addColorStop(0, "rgba(90,52,30,.2)"); g.addColorStop(1, "rgba(90,52,30,0)"); C.fillStyle = g; C.beginPath(); C.ellipse(sdr.x + sdr.w / 2, sdr.y + sdr.h + 30, sdr.w * .48, 36, 0, 0, Math.PI * 2); C.fill();
}
function shelfBack() {
  shelfShadow(); if (!sdr || !sd) return;
  const img = getSprite(SHLF[lv.skin]);
  if (img) { C.save(); C.shadowColor = "rgba(93,54,30,.2)"; C.shadowBlur = 14; C.shadowOffsetY = 6; C.drawImage(img, sdr.x, sdr.y, sdr.w, sdr.h); C.restore(); return; }
  procShelf();
}
function procShelf() {
  const b = 8;
  const bk = C.createLinearGradient(sdr.x, sdr.y, sdr.x, sdr.y + sdr.h); bk.addColorStop(0, "#efc07b"); bk.addColorStop(.24, "#c98345"); bk.addColorStop(1, "#7e4a2a");
  rrect(sdr.x, sdr.y, sdr.w, sdr.h, 5, bk, "rgba(92,50,27,.4)", 2);
  for (const c of sd.cells) { const sx = sdr.w / sd.masterSize[0], sy = sdr.h / sd.masterSize[1], cx = sdr.x + c.x * sx + 4, cy = sdr.y + c.y * sy + 4, cw = c.w * sx - 8, ch = c.h * sy - 10; const g = C.createLinearGradient(cx, cy, cx, cy + ch); g.addColorStop(0, "#f7ddaa"); g.addColorStop(.5, "#e4b276"); g.addColorStop(1, "#c17a3d"); rrect(cx, cy, cw, ch, 2, g); C.fillStyle = "rgba(80,40,20,.06)"; C.fillRect(cx, cy, cw, 3); }
  const wg = (x1, y1, w1, h1) => { const g = C.createLinearGradient(x1, y1, x1, y1 + h1); g.addColorStop(0, "#f0bd78"); g.addColorStop(.55, "#b66f3b"); g.addColorStop(1, "#7f4c2c"); rrect(x1, y1, w1, h1, 3, g, "rgba(82,45,25,.4)", 1.2); };
  wg(sdr.x, sdr.y, sdr.w, b); wg(sdr.x, sdr.y, b, sdr.h); wg(sdr.x + sdr.w - b, sdr.y, b, sdr.h); wg(sdr.x, sdr.y + sdr.h - b, sdr.w, b);
}
function shelfFront() { }

// ── Cells by row ────────────────────────────────────────────
function allRows() {
  const rows = [...new Set(cells.map(c => c.row))].sort((a, b) => a - b);
  for (const r of rows) {
    const rowCells = cells.filter(c => c.row === r).sort((a, b) => a.col - b.col);
    for (const c of rowCells) {
      const i = cells.indexOf(c);
      for (let li = 0; li < c.lanes.length; li++) { const l = c.lanes[li]; if (!l.length) continue; const pos = itemPos(i, li); if (c.closed) continue; const sz = itemSize(l[l.length - 1].type, pos.scale); drawShadow(pos.x, pos.floorY + 2, sz, pos.scale, 0.2); }
      drawCell(c, i);
    }
  }
}

function drawCell(c, i) {
  const r = cellR(i);
  if (!c.closed && c.lock <= 0) drawHints(c, i);
  if (c.flash > .03) rrect(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 10, `rgba(255,236,190,${c.flash * .15})`);
  if (c.warn > .03) rrect(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 10, `rgba(192,76,54,${c.warn * .14})`, "#bb5f47", 2);
  const ca = c.closed ? .3 : 1;
  for (let li = 0; li < c.lanes.length; li++) { const l = c.lanes[li]; for (let d = 0; d < l.length - 1; d++) { const pos = itemPos(i, li); C.save(); C.globalAlpha = ca * .25; drawItem(l[d].type, pos.x, pos.y - 10 - d * 5, pos.scale * .82, 1, true); C.restore(); } }
  for (let li = 0; li < c.lanes.length; li++) { const l = c.lanes[li]; if (!l.length) continue; const it = l[l.length - 1]; const pos = itemPos(i, li); const al = ca * (it.emerge || 1); if (al > .01) drawItem(it.type, pos.x, pos.y, pos.scale, al); }
  if (!c.closed) { C.save(); C.globalAlpha = .16; const sg = C.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h); sg.addColorStop(0, "rgba(255,255,255,.18)"); sg.addColorStop(.3, "rgba(255,255,255,0)"); sg.addColorStop(1, "rgba(255,255,255,.08)"); rrect(r.x + 8, r.y + 8, r.w - 16, r.h - 28, 6, sg); C.restore(); }
}
function drawHints(c, i) {
  const tl = held ? hitLane(c, ptr) : -1;
  for (let li = 0; li < 3; li++) {
    const pos = itemPos(i, li); const sz = itemSize("milk", pos.scale); const sx = pos.x - sz.w * .48, sy = pos.y - sz.h * .54, sw = sz.w * .96, sh = sz.h * .88;
    const sld = c.sealed.includes(li), emp = c.lanes[li].length === 0 && !sld, hot = held && tl === li && canDrop(c, li);
    if (sld) { rrect(sx, sy, sw, sh, 10, "rgba(116,70,62,.16)", "rgba(205,150,126,.32)", 1.5); C.fillStyle = "#d5b3a3"; C.font = "900 10px 'Trebuchet MS',sans-serif"; C.textAlign = "center"; C.fillText("X", pos.x, pos.y - 2); }
    else if (hot) { rrect(sx, sy, sw, sh, 10, "rgba(88,210,66,.22)", "rgba(255,255,255,.55)", 2); }
    else if (emp) { rrect(sx + 10, sy + 16, sw - 20, sh - 24, 10, "rgba(125,75,38,.03)", "rgba(255,244,218,.09)", 1); }
  }
}

// ── Overlays ────────────────────────────────────────────────
function overlays() {
  for (let i = 0; i < cells.length; i++) { const c = cells[i], r = cellR(i); if (c.lock > 0) drawLock(c, r); if (c.closed) drawSold(c, r); }
}
function drawLock(c, r) {
  C.save(); C.globalAlpha = .62;
  rrect(r.x + 4, r.y + 4, r.w - 8, r.h - 10, 14, "rgba(40,50,60,.25)", "rgba(160,175,190,.28)", 1.5);
  const cx = r.x + r.w / 2, by = r.y + 14;
  C.fillStyle = "rgba(30,40,50,.7)"; C.beginPath(); C.arc(cx, by + 6, 8, 0, Math.PI * 2); C.fill();
  C.fillStyle = "rgba(30,40,50,.8)"; C.fillRect(cx - 4, by - 4, 8, 5);
  C.strokeStyle = "rgba(220,200,140,.9)"; C.lineWidth = 2.5; C.lineCap = "round";
  C.beginPath(); C.moveTo(cx - 6, by - 3); C.lineTo(cx - 6, by - 10); C.quadraticCurveTo(cx - 6, by - 16, cx, by - 16); C.quadraticCurveTo(cx + 6, by - 16, cx + 6, by - 10); C.lineTo(cx + 6, by - 3); C.stroke();
  C.fillStyle = "#fff"; C.font = "900 14px 'Trebuchet MS'"; C.textAlign = "center"; C.fillText(String(c.lock), cx, by + 10); C.restore();
}
function drawSold(c, r) {
  const t = c.closing || 1; C.save(); C.globalAlpha = Math.min(1, t * 1.1);
  rrect(r.x + 8, r.y + 8, r.w - 16, r.h - 28, 14, "rgba(241,245,247,.7)", "rgba(198,208,214,.5)", 1.5);
  C.translate(r.x + r.w / 2, r.y + r.h / 2 - 4); C.rotate(-.06); rrect(-72, -18, 144, 36, 14, "#fff", "#82919a", 1.5); C.fillStyle = "#5f6f78"; C.font = "900 18px 'Trebuchet MS'"; C.textAlign = "center"; C.fillText("CLEARED", 0, 6); C.restore();
}

// ── Item drawing ────────────────────────────────────────────
function drawItem(type, x, y, sc, al = 1, ns = false) {
  const g = GOODS[type]; C.save(); C.globalAlpha = al; const s = sc;
  if (!ns) { const sz = itemSize(type, s); softS(x, y + sz.h * .38, sz.w * .92, 10 * s, .18 * al); }
  if (!drawPhoto(type, x, y, s)) {
    if (g.kind === "carton") drawCarton(x, y, s, g); if (g.kind === "sauce") drawSauce(x, y, s, g); if (g.kind === "pop") drawPop(x, y, s, g);
    if (g.kind === "can") drawCan(x, y, s, g); if (g.kind === "bottle") drawBottle(x, y, s, g); if (g.kind === "toy") drawTeddy(x, y, s, g);
    if (g.kind === "water") drawWater(x, y, s, g); if (g.kind === "bread") drawBread(x, y, s, g); if (g.kind === "jar") drawJar(x, y, s, g); if (g.kind === "donut") drawDonut(x, y, s, g);
  } C.restore();
}
function drawPhoto(type, x, y, s) { const sp = getSprite(PROD[type]); if (!sp) return false; const b = itemSize(type, s), f = Math.min(b.w / sp.width, b.h / sp.height), w = sp.width * f, h = sp.height * f; C.drawImage(sp, x - w / 2, y + b.h * .50 - h, w, h); return true; }

// ── Shadows ─────────────────────────────────────────────────
function drawShadow(x, fy, sz, sc, al) { const sw = sz.w * .40, sh = 6 * sc; const g = C.createRadialGradient(x, fy, 0, x, fy, sw); g.addColorStop(0, `rgba(20,12,6,${al})`); g.addColorStop(1, "rgba(20,12,6,0)"); C.fillStyle = g; C.beginPath(); C.ellipse(x, fy, sw, sh, 0, 0, Math.PI * 2); C.fill(); }
function softS(x, y, w, h, al) { const g = C.createRadialGradient(x, y, 1, x, y, w / 2); g.addColorStop(0, `rgba(75,43,24,${al})`); g.addColorStop(1, "rgba(75,43,24,0)"); C.fillStyle = g; C.beginPath(); C.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); C.fill(); }

// ── Held item ───────────────────────────────────────────────
function heldIt() { if (!held) return; C.save(); C.translate(held.vx, held.vy); C.rotate(held.angle); const sc = 1.18 + held.lift * .08; const sz = itemSize(held.item.type, sc); const sa = (1 - held.lift * .75) * .18; if (sa > .01) drawShadow(0, sz.h * .50, sz, sc, sa); C.filter = "drop-shadow(0 14px 8px rgba(60,70,80,.18))"; drawItem(held.item.type, 0, -held.lift * 10, sc, 1); C.restore(); }

// ── Particles ───────────────────────────────────────────────
function partsFn() { for (const p of parts) { C.save(); C.globalAlpha = p.life; C.fillStyle = p.color; C.beginPath(); C.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); C.fill(); C.restore(); } for (const p of pops) { C.save(); C.globalAlpha = p.life; C.fillStyle = "#fff"; C.strokeStyle = "rgba(84,96,104,.45)"; C.lineWidth = 3; C.font = "900 24px 'Trebuchet MS'"; C.textAlign = "center"; C.strokeText(p.text, p.x, p.y); C.fillText(p.text, p.x, p.y); C.restore(); } }
function flashFn() { if (sf <= .02) return; C.save(); C.globalAlpha = sf * .18; const g = C.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 600); g.addColorStop(0, sfC); g.addColorStop(1, "rgba(255,255,255,0)"); C.fillStyle = g; C.fillRect(0, 0, W, H); C.restore(); }

// ── Bottom bar ──────────────────────────────────────────────
function botBar() {
  const b = C.createLinearGradient(0, 1118, 0, H); b.addColorStop(0, "#dba071"); b.addColorStop(1, "#a6553a"); C.fillStyle = b; C.fillRect(0, 1118, W, H - 1118); C.fillStyle = "rgba(255,236,202,.42)"; C.fillRect(0, 1118, W, 4);
  for (const t of tools()) { const f = t.ok ? "#fff0c8" : "#a9b4c8", stk = t.ok ? "#b36034" : "#657085"; rrect(t.x, t.y, t.w, t.h, 18, f, stk, 2.5); const i = C.createLinearGradient(t.x, t.y + 6, t.x, t.y + t.h - 6); i.addColorStop(0, "rgba(255,255,255,.38)"); i.addColorStop(1, "rgba(146,76,42,.05)"); rrect(t.x + 6, t.y + 6, t.w - 12, t.h - 12, 12, i);
    C.fillStyle = t.ok ? "#6b3d25" : "#6f7b91"; C.font = "900 18px 'Trebuchet MS'"; C.textAlign = "center"; C.fillText(t.label, t.x + t.w / 2, t.y + 72);
    C.save(); C.translate(t.x + t.w / 2, t.y + 34); C.scale(1.1, 1.1);
    if (t.id === "undo") { C.strokeStyle = "#c45a20"; C.lineWidth = 7; C.lineCap = "round"; C.beginPath(); C.arc(0, 0, 18, Math.PI * .2, Math.PI * 1.35); C.stroke(); C.beginPath(); C.moveTo(-14, -8); C.lineTo(-22, -1); C.lineTo(-12, 4); C.closePath(); C.fillStyle = "#c45a20"; C.fill(); }
    if (t.id === "boost") { C.fillStyle = "#d89b35"; C.strokeStyle = "#9f6b1d"; C.lineWidth = 2; C.beginPath(); C.moveTo(0, -22); C.lineTo(14, -3); C.lineTo(5, -3); C.lineTo(11, 20); C.lineTo(-12, -7); C.lineTo(-3, -7); C.closePath(); C.fill(); C.stroke(); }
    if (t.id === "restart") { C.strokeStyle = "#2d7a45"; C.lineWidth = 7; C.lineCap = "round"; C.beginPath(); C.arc(0, 0, 18, Math.PI * .9, Math.PI * 2.2); C.stroke(); C.beginPath(); C.moveTo(14, -6); C.lineTo(23, 1); C.lineTo(12, 8); C.closePath(); C.fillStyle = "#2d7a45"; C.fill(); }
    C.restore();
  }
}

// ── Status / overlays ───────────────────────────────────────
function tip() { if (!msg || page !== "play") return; rrect(70, 1084, W - 140, 28, 14, "rgba(45,36,29,.55)", "rgba(255,235,198,.14)", 1); C.fillStyle = "rgba(245,232,205,.78)"; C.font = "800 12px 'Trebuchet MS',sans-serif"; C.textAlign = "center"; C.fillText(msg, W / 2, 1103, W - 180); }
function lvIntro() { if (page !== "play" || intro <= .04) return; const a = Math.min(1, intro * 1.8), y = 180 - (1 - intro) * 20; C.save(); C.globalAlpha = a; rrect(74, y, W - 148, 100, 22, "rgba(255,253,246,.9)", "rgba(255,255,255,.78)", 2); C.fillStyle = "#8b6b3f"; C.font = "900 14px 'Trebuchet MS',sans-serif"; C.textAlign = "center"; C.fillText(`SHIFT 1 · LEVEL ${lv.lv}`, W / 2, y + 26); C.fillStyle = "#3e342b"; C.font = "900 26px 'Trebuchet MS',sans-serif"; C.fillText(lv.title.toUpperCase(), W / 2, y + 56); C.fillStyle = "rgba(63,55,47,.62)"; C.font = "800 13px 'Trebuchet MS',sans-serif"; C.fillText(lv.goal, W / 2, y + 80, W - 190); C.restore(); }

// ── Pause overlay ───────────────────────────────────────────
function drawPauseOvr() {
  C.fillStyle = "rgba(40,35,28,.55)"; C.fillRect(0, 0, W, H);
  rrect(110, 420, 530, 340, 26, "rgba(252,253,253,.94)", "rgba(255,255,255,.85)", 2);
  C.fillStyle = "#3a4a54"; C.font = "900 34px 'Trebuchet MS',sans-serif"; C.textAlign = "center"; C.fillText("PAUSED", W / 2, 476);
  // Resume
  rrect(...BTN.pResume, 24, "#8fae9c", "#fff", 2); C.fillStyle = "#fff"; C.font = "900 22px 'Trebuchet MS',sans-serif"; C.fillText("RESUME", W / 2, BTN.pResume[1] + 44);
  // Restart
  rrect(...BTN.pRestart, 24, "#b39284", "#fff", 2); C.fillText("RESTART", W / 2, BTN.pRestart[1] + 44);
  // Home
  rrect(...BTN.pHome, 24, "#8ba7c4", "#fff", 2); C.fillText("HOME", W / 2, BTN.pHome[1] + 44);
}

// ── Result screen ───────────────────────────────────────────
function drawResult() {
  C.fillStyle = "rgba(30,20,15,.52)"; C.fillRect(0, 0, W, H);
  const g = C.createRadialGradient(W / 2, 380, 40, W / 2, 420, 500); g.addColorStop(0, "rgba(255,220,180,.3)"); g.addColorStop(1, "rgba(255,220,180,0)"); C.fillStyle = g; C.fillRect(0, 0, W, H);
  const win = page === "won", py = (win || rwUsed) ? 290 : 360, ph = (win || rwUsed) ? 370 : 300;
  const pb = C.createLinearGradient(0, py, 0, py + ph); pb.addColorStop(0, "#fdf6e8"); pb.addColorStop(.5, "#f5e6cc"); pb.addColorStop(1, "#e8d5b0"); rrect(94, py, 562, ph, 28, pb, "rgba(180,140,100,.5)", 3);
  const ig = C.createRadialGradient(W / 2, py + 40, 10, W / 2, py + ph / 2, 350); ig.addColorStop(0, "rgba(255,252,240,.45)"); ig.addColorStop(1, "rgba(255,252,240,0)"); C.fillStyle = ig; rrect(100, py + 6, 550, ph - 12, 24, ig);
  for (let i = 0; i < 3; i++) { const on = win ? i < stars : i < 1; drawStar(W / 2 - 70 + i * 70, py + 50, 22, on ? "#efd48a" : "#d8d6cf", on ? "#a88747" : "#b9b8b2"); }
  C.fillStyle = "#5a3e2b"; C.font = "900 32px 'Trebuchet MS',sans-serif"; C.textAlign = "center"; C.fillText(win ? "LEVEL COMPLETE" : "TRY AGAIN", W / 2, py + 104);
  if (win) {
    rewRow(W / 2, py + 146, "COINS", `+${coins}`, "#c99b4f"); rewRow(W / 2, py + 190, "SCORE", String(score), "#88a071");
    C.fillStyle = "#7a5e45"; C.font = "900 16px 'Trebuchet MS',sans-serif"; C.fillText(`Moves left: ${moves}`, W / 2, py + 230);
  } else {
    C.fillStyle = "#7a5e45"; C.font = "800 15px 'Trebuchet MS',sans-serif"; C.fillText(hint(), W / 2, py + 144, 440);
    C.fillText(`${sold} cleared · ${used} moves`, W / 2, py + 184);
    if (!rwUsed) { rrect(...BTN.cont, 24, "#e8b84c", "#fff", 2); C.fillStyle = "#fff"; C.font = "900 20px 'Trebuchet MS',sans-serif"; C.fillText("+3 MOVES", W / 2, BTN.cont[1] + 44); }
  }
  // Next / Retry button
  rrect(...BTN.result, 24, win ? "#8fae9c" : "#b39284", "#fff", 2); C.fillStyle = "#fff"; C.font = "900 22px 'Trebuchet MS',sans-serif";
  C.fillText(win ? (li < LV.length - 1 ? "NEXT LEVEL" : "FINISH") : "RETRY", W / 2, BTN.result[1] + 44);
  // Home button
  rrect(224, 740, 302, 56, 20, "rgba(200,180,160,.6)", "rgba(255,255,255,.5)", 2);
  C.fillStyle = "#5a4a35"; C.font = "900 18px 'Trebuchet MS',sans-serif"; C.fillText("HOME", W / 2, 775);
}
function rewRow(x, y, lb, vl, clr) { rrect(x - 140, y - 18, 280, 30, 14, "rgba(235,229,216,.35)"); circ(x - 100, y - 3, 10, clr, "rgba(87,72,52,.2)", 1.5); C.fillStyle = "#6a5d4e"; C.font = "900 13px 'Trebuchet MS',sans-serif"; C.textAlign = "left"; C.fillText(lb, x - 78, y + 1); C.fillStyle = "#3f4c53"; C.textAlign = "right"; C.fillText(vl, x + 112, y + 1); }

// ── Item shape drawers ──────────────────────────────────────
function drawCarton(x, y, s, g) { const w = 52 * s, h = 92 * s, bd = C.createLinearGradient(x - w / 2, y, x + w / 2, y); bd.addColorStop(0, "#6bc4ff"); bd.addColorStop(.18, "#dbf6ff"); bd.addColorStop(.52, "#fff"); bd.addColorStop(1, "#4aa4e8"); rrect(x - w / 2, y - h / 2 + 8 * s, w, h - 8 * s, 10 * s, bd, "#5c9fcb", 1.5); C.fillStyle = "#f9fdff"; C.beginPath(); C.moveTo(x - w / 2, y - h / 2 + 14 * s); C.lineTo(x, y - h / 2 - 2 * s); C.lineTo(x + w / 2, y - h / 2 + 14 * s); C.lineTo(x + w / 2, y - h / 2 + 28 * s); C.lineTo(x - w / 2, y - h / 2 + 28 * s); C.fill(); }
function drawSauce(x, y, s, g) { const w = 50 * s, h = 80 * s, bd = C.createLinearGradient(x - w / 2, y, x + w / 2, y); bd.addColorStop(0, "#a81e1a"); bd.addColorStop(.2, "#ff6b56"); bd.addColorStop(.55, "#ff4a38"); bd.addColorStop(1, "#8c1e1a"); rrect(x - w / 2, y - h / 2 + 10 * s, w, h - 10 * s, 16 * s, bd, "#8a2923", 1.5); rrect(x - 11 * s, y - h / 2 - 2 * s, 22 * s, 16 * s, 6 * s, "#f4ede3", "#ceb99f", 1); }
function drawPop(x, y, s, g) { const bd = C.createLinearGradient(x - 22 * s, y, x + 22 * s, y); bd.addColorStop(0, "#ffca54"); bd.addColorStop(.45, "#fff2a8"); bd.addColorStop(1, "#f39e3c"); rrect(x - 21 * s, y - 38 * s, 42 * s, 68 * s, 18 * s, bd, "#ce9644", 1.5); rrect(x - 6 * s, y + 28 * s, 12 * s, 22 * s, 5 * s, "#9f6a3c", "#805332", 1); }
function drawCan(x, y, s, g) { const bd = C.createLinearGradient(x - 24 * s, y, x + 24 * s, y); bd.addColorStop(0, "#6ec7ff"); bd.addColorStop(.18, "#effaff"); bd.addColorStop(.56, "#5bb5f2"); bd.addColorStop(1, "#2f7fac"); rrect(x - 24 * s, y - 35 * s, 48 * s, 70 * s, 12 * s, bd, "#679fbc", 1.5); ell(x, y - 34 * s, 22 * s, 7 * s, "#f7f7f7", "#adb9be", 1); }
function drawBottle(x, y, s, g) { rrect(x - 10 * s, y - 44 * s, 20 * s, 14 * s, 5 * s, "#654f39", "#402d20", 1); const bd = C.createLinearGradient(x - 20 * s, y, x + 20 * s, y); bd.addColorStop(0, "#ef8f31"); bd.addColorStop(.44, "#ffd38d"); bd.addColorStop(1, "#cc6f1e"); rrect(x - 20 * s, y - 30 * s, 40 * s, 76 * s, 16 * s, bd, "#b26a27", 1.5); }
function drawTeddy(x, y, s, g) { circ(x - 18 * s, y - 20 * s, 12 * s, "#c5925c", "#8d6039", 1.5); circ(x + 18 * s, y - 20 * s, 12 * s, "#c5925c", "#8d6039", 1.5); circ(x, y - 6 * s, 28 * s, "#c5925c", "#8d6039", 1.5); circ(x, y + 22 * s, 32 * s, "#bf8853", "#8a5d38", 1.5); circ(x - 8 * s, y - 10 * s, 2.5 * s, "#2e2118"); circ(x + 8 * s, y - 10 * s, 2.5 * s, "#2e2118"); ell(x, y + 1 * s, 9 * s, 6 * s, "#e7c29c"); }
function drawWater(x, y, s, g) { rrect(x - 15 * s, y - 44 * s, 30 * s, 12 * s, 5 * s, "#4d89d8", "#3368a6", 1); const bd = C.createLinearGradient(x - 22 * s, y, x + 22 * s, y); bd.addColorStop(0, "#93e1ff"); bd.addColorStop(.46, "#f1fdff"); bd.addColorStop(1, "#68b4e4"); rrect(x - 22 * s, y - 34 * s, 44 * s, 78 * s, 18 * s, bd, "#72aaca", 1.5); }
function drawBread(x, y, s, g) { C.save(); C.rotate(-.04); const lf = C.createLinearGradient(x - 24 * s, y, x + 24 * s, y); lf.addColorStop(0, "#9a6337"); lf.addColorStop(.5, "#cc8a57"); lf.addColorStop(1, "#7c4d2c"); ell(x, y, 24 * s, 38 * s, lf, "#6e4428", 1.5); C.restore(); }
function drawJar(x, y, s, g) { const bd = C.createLinearGradient(x - 24 * s, y, x + 24 * s, y); bd.addColorStop(0, "#f2e8d5"); bd.addColorStop(.5, "#fff8ee"); bd.addColorStop(1, "#e0cfa8"); rrect(x - 24 * s, y - 32 * s, 48 * s, 70 * s, 14 * s, bd, "#c4b18a", 1.5); rrect(x - 16 * s, y - 36 * s, 8 * s, 10 * s, 4 * s, g.a, "#8e6b4a", 1); }
function drawDonut(x, y, s, g) { const or = 28 * s; C.fillStyle = g.a; circ(x, y - 4 * s, or, g.a, "#a3506e", 1.8); circ(x, y - 4 * s, or * .42, "#fee7d8", "#d4a090", 1.5); C.fillStyle = g.b || "#f47fb0"; C.beginPath(); C.arc(x, y - 8 * s, or - 3 * s, Math.PI * .1, Math.PI * .9); C.fill(); C.fillStyle = "#fff"; for (let i = 0; i < 5; i++) { const a = -.8 + i * .4; C.fillRect(x + Math.cos(a) * 12 * s - 2 * s, y - 16 * s + Math.sin(a) * 10 * s - 1 * s, 4 * s, 2 * s); } }

// ── Primitives ──────────────────────────────────────────────
function drawStar(x, y, r, fl, sk) { C.save(); C.translate(x, y); C.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r : r * .45; C[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr); } C.closePath(); C.fillStyle = fl; if (sk) { C.strokeStyle = sk; C.lineWidth = Math.max(1, r * .1); C.stroke(); } C.fill(); C.restore(); }
function circ(x, y, r, fl, sk, lw = 1) { C.beginPath(); C.arc(x, y, r, 0, Math.PI * 2); C.fillStyle = fl; C.fill(); if (sk) { C.strokeStyle = sk; C.lineWidth = lw; C.stroke(); } }
function circle(x, y, r, fl, sk, lw = 1) { circ(x, y, r, fl, sk, lw); }
function ell(x, y, rx, ry, fl, sk, lw = 1) { C.beginPath(); C.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); C.fillStyle = fl; C.fill(); if (sk) { C.strokeStyle = sk; C.lineWidth = lw; C.stroke(); } }
function rrect(x, y, w, h, r, fl, sk, lw = 1) { const rr = Math.min(r, w / 2, h / 2); C.beginPath(); C.moveTo(x + rr, y); C.lineTo(x + w - rr, y); C.quadraticCurveTo(x + w, y, x + w, y + rr); C.lineTo(x + w, y + h - rr); C.quadraticCurveTo(x + w, y + h, x + w - rr, y + h); C.lineTo(x + rr, y + h); C.quadraticCurveTo(x, y + h, x, y + h - rr); C.lineTo(x, y + rr); C.quadraticCurveTo(x, y, x + rr, y); if (fl) { C.fillStyle = fl; C.fill(); } if (sk) { C.strokeStyle = sk; C.lineWidth = lw; C.stroke(); } }

// ── Boot ────────────────────────────────────────────────────
async function boot() {
  page = "loading";
  loadPct = 0; loadDone = false;

  // Determine starting level
  if (DEBUG_LV >= 0) {
    li = Math.min(DEBUG_LV, LV.length - 1);
  } else if (progress.level > 0 && progress.level < LV.length) {
    li = progress.level;
  } else {
    li = 0;
  }

  await loadSprites();
  // Pre-load first level shelf data
  lv = LV[li];
  sd = await loadShelf(lv.skin);

  // Force loading complete after assets are ready
  loadPct = 100;
  loadDone = true;

  // Ready — let the draw loop transition to home
  requestAnimationFrame(draw);
}
boot();
