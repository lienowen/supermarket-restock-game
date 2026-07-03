// ============================================================
// Data layer
// ============================================================

export const GOODS = {
  milk:     { label:"Milk",     kind:"carton", a:"#4db8ff", b:"#ffffff" },
  ketchup:  { label:"Ketchup",  kind:"sauce",  a:"#e74335", b:"#fff2de" },
  popsicle: { label:"Popsicle", kind:"pop",    a:"#ffe26c", b:"#623017" },
  cola:     { label:"Cola",     kind:"can",    a:"#2aa7ee", b:"#ffffff" },
  orange:   { label:"Orange",   kind:"bottle", a:"#f28b28", b:"#5a4ed8" },
  teddy:    { label:"Teddy",    kind:"toy",    a:"#9a6a33", b:"#4f3017" },
  water:    { label:"Water",    kind:"water",  a:"#7fd8f5", b:"#3f8fd8" },
  bread:    { label:"Bread",    kind:"bread",  a:"#6b4427", b:"#2d1c13" },
  jam:      { label:"Jam",      kind:"jar",    a:"#e93b3d", b:"#fff0d2" },
  donut:    { label:"Donut",    kind:"donut",  a:"#f47fb0", b:"#6b3d24" },
};

const KS = { carton:[56,96], sauce:[58,82], pop:[54,90], can:[54,82], bottle:[54,92], toy:[74,74], water:[56,92], bread:[64,56], jar:[60,76], donut:[74,62] };
const SS = { carton:[0.7,0.45], sauce:[0.75,0.48], pop:[0.65,0.42], can:[0.68,0.44], bottle:[0.7,0.45], toy:[1.0,0.55], water:[0.72,0.46], bread:[1.0,0.55], jar:[0.85,0.5], donut:[1.0,0.55] };

export function itemSize(type, sc=1) { const k=GOODS[type]?.kind||"jar"; const s=KS[k]||[64,82]; return {w:s[0]*sc, h:s[1]*sc}; }
export function shadowScale(type) { const k=GOODS[type]?.kind||"jar"; return SS[k]||[0.8,0.48]; }

const shelfCache = new Map();
export async function loadShelf(id) {
  if (shelfCache.has(id)) return shelfCache.get(id);
  const r=await fetch(`/game/shelf-${id}.json`); const d=await r.json(); shelfCache.set(id,d); return d;
}

const scache = new Map();
export function getSprite(src) { if(!src)return null; let r=scache.get(src); if(!r){r={img:new Image,ready:false};r.img.src=src;scache.set(src,r);} if(!r.ready&&r.img.complete&&r.img.naturalWidth>0)r.ready=true; return r.ready?r.img:null; }
