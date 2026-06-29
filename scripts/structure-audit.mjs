// 構造物監査用レンダラ。32-world-window.js からビルダー関数を抽出し、
// put() で集めたブロックを front / iso の PNG に描く（依存ゼロ・Node 標準のみ）。
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

// 使い方: node scripts/structure-audit.mjs [repoRoot] <name>
//   例: node scripts/structure-audit.mjs . daibutsu  → .tmp/structure-audit/daibutsu-front.png / -iso.png
// 構造物ビルダーを 32-world-window.js から抽出し、front/iso の PNG を描く（依存ゼロ）。
// 出力先 .tmp/ は gitignore 済み。プレビューはバックグラウンドで生成が止まるため、これで目視検証する。
const ROOT = path.resolve(process.argv[2] || '.');
const OUT = path.resolve(ROOT, '.tmp/structure-audit');
fs.mkdirSync(OUT, { recursive: true });
const src = fs.readFileSync(path.join(ROOT, 'src/game/parts/32-world-window.js'), 'utf8');

// --- ブロック定数と色 ---
const NAMES = {
  GRASS:0,DIRT:1,STONE:2,LOG:3,LEAVES:4,SAND:5,PLANKS:6,BRICK:7,GLASS:8,WATER:9,SNOW:10,
  COAL_ORE:11,IRON_ORE:12,GOLD_ORE:13,DIAMOND_ORE:14,TORCH:15,CRAFTING_TABLE:16,FURNACE:17,
  GLOW_CRYSTAL:18,DRIPSTONE:19,STONE_BRICK:20,MOSSY_BRICK:21,CHEST:22,LANTERN:23,LAVA:24,
  CACTUS:25,OPEN_CHEST:26,VILLAGE_SIGN:27,VERMILION:28,PLASTER:29,ROOF_TILE:30,GOLD_BLOCK:31,COPPER_ROOF:32,
  BRONZE:33,BRONZE_DARK:34,
};
const COLOR = [0x6ab04c,0x8a5a2b,0x8b9094,0x6d4c1b,0x3f8a2e,0xe6da9c,0xb5824a,0xa83a2a,0xbfe9ff,0x3a78d8,
  0xf2f7ff,0x35383c,0xc78a55,0xe2b93c,0x55d9e8,0xffb23a,0xb5824a,0x757a7d,0x6df7ff,0x8b8172,
  0x868b8f,0x6f8a5a,0xc79a52,0xffc25a,0xff6a1a,0x4f8f3a,0x9a7038,0xb5824a,0xcf3b1e,0xeae3d2,0x44525c,0xe6c23a,0x4a9e86,
  0x6f8472,0x47554b];

// --- ビルダー/ヘルパー関数を抽出 ---
function extractFunctions(text) {
  const re = /\n  function (\w+)\s*\(/g;
  const SKIP = new Set(['heightAt']); // 実行時依存(HEIGHT_CACHE等)はスタブを使う
  let m, out = [];
  while ((m = re.exec(text))) {
    if (SKIP.has(m[1])) continue;
    const start = m.index + 1; // skip leading \n
    let i = text.indexOf('{', m.index);
    let depth = 0, end = -1;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end > 0) out.push(text.slice(start, end + 1));
  }
  return out;
}
const fnSrc = extractFunctions(src).join('\n');

// 大仏の取り込みデータ（パーツ19）を読み込んで daibutsuVoxels を供給する。
let DAIBUTSU_DIMS = [0, 0, 0], daibutsuVoxels = () => [];
try {
  const d = fs.readFileSync(path.join(ROOT, 'src/game/parts/19-daibutsu-data.js'), 'utf8');
  const dims = d.match(/DAIBUTSU_DIMS = \[(\d+), (\d+), (\d+)\]/);
  const b64 = d.match(/DAIBUTSU_B64 = "([^"]+)"/);
  if (dims && b64) {
    DAIBUTSU_DIMS = [+dims[1], +dims[2], +dims[3]];
    const [W, H, Dd] = DAIBUTSU_DIMS;
    const bin = Buffer.from(b64[1], 'base64');
    const out = []; let bi = 0;
    for (let y = 0; y < H; y++) for (let z = 0; z < Dd; z++) for (let x = 0; x < W; x++) {
      if (bin[bi >> 3] & (1 << (bi & 7))) out.push([x, y, z]);
      bi++;
    }
    daibutsuVoxels = () => out;
  }
} catch (e) {}

// --- サンドボックス実行 ---
function buildStructure(name, plan, box) {
  const blocks = new Map();
  const put = (x, y, z, t) => { if (t != null) blocks.set(`${x},${y},${z}`, t); };
  const air = (x, y, z) => { blocks.delete(`${x},${y},${z}`); };
  const heightAt = () => box.base - 1; // 平地扱い（base 未満の埋めは発生しない）
  const ctx = { ...NAMES, put, air, heightAt, Math, plan, box, DAIBUTSU_DIMS, daibutsuVoxels };
  const argNames = Object.keys(ctx);
  const body = `${fnSrc}\n; return ${name}(plan, box.base, box.minX, box.maxX, box.minZ, box.maxZ, put, air);`;
  const fn = new Function(...argNames, body);
  fn(...argNames.map(k => ctx[k]));
  return blocks;
}

// --- PNG エンコーダ（true color, filter 0） ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(W, H, rgb) {
  const raw = Buffer.alloc(H * (W * 3 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
class Canvas {
  constructor(w, h, bg = 0xeef2f4) {
    this.w = w; this.h = h; this.buf = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) { this.buf[i*3]=bg>>16&255; this.buf[i*3+1]=bg>>8&255; this.buf[i*3+2]=bg&255; }
  }
  px(x, y, c) {
    x|=0; y|=0; if (x<0||y<0||x>=this.w||y>=this.h) return;
    const i=(y*this.w+x)*3; this.buf[i]=c>>16&255; this.buf[i+1]=c>>8&255; this.buf[i+2]=c&255;
  }
  rect(x, y, w, h, c) { for (let j=0;j<h;j++) for (let i=0;i<w;i++) this.px(x+i,y+j,c); }
  // 四角形(平行四辺形)塗り: 4頂点をスキャンライン
  poly(pts, c) {
    let minY=1e9,maxY=-1e9; for(const p of pts){minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
    for(let y=Math.floor(minY);y<=Math.ceil(maxY);y++){
      let xs=[];
      for(let i=0;i<pts.length;i++){
        const a=pts[i],b=pts[(i+1)%pts.length];
        if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)){
          xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));
        }
      }
      xs.sort((p,q)=>p-q);
      for(let k=0;k+1<xs.length;k+=2) for(let x=Math.floor(xs[k]);x<=Math.ceil(xs[k+1]);x++) this.px(x,y,c);
    }
  }
}
const shade=(c,f)=>{const r=Math.min(255,(c>>16&255)*f)|0,g=Math.min(255,(c>>8&255)*f)|0,b=Math.min(255,(c&255)*f)|0;return r<<16|g<<8|b;};

function bounds(blocks) {
  let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9,mnz=1e9,mxz=-1e9;
  for (const k of blocks.keys()) { const [x,y,z]=k.split(',').map(Number);
    mnx=Math.min(mnx,x);mxx=Math.max(mxx,x);mny=Math.min(mny,y);mxy=Math.max(mxy,y);mnz=Math.min(mnz,z);mxz=Math.max(mxz,z);}
  return {mnx,mxx,mny,mxy,mnz,mxz};
}

// 正面投影: -Z を奥に見る。近い(小さい)z が手前。X→右, Y→上。
function renderFront(blocks, name) {
  const b=bounds(blocks); const S=14, pad=24;
  const W=(b.mxx-b.mnx+1)*S+pad*2, H=(b.mxy-b.mny+1)*S+pad*2+18;
  const cv=new Canvas(W,H);
  const order=[...blocks.keys()].map(k=>{const [x,y,z]=k.split(',').map(Number);return {x,y,z,t:blocks.get(k)};});
  order.sort((a,bb)=>bb.z-a.z); // 奥(大きいz)から描く
  const zr=Math.max(1,b.mxz-b.mnz);
  for(const o of order){
    const sx=pad+(o.x-b.mnx)*S, sy=pad+(b.mxy-o.y)*S;
    const f=0.78+0.22*(1-(o.z-b.mnz)/zr); // 手前ほど明るい
    cv.rect(sx,sy,S,S,shade(COLOR[o.t],f));
    cv.rect(sx,sy,S,1,shade(COLOR[o.t],f*0.7)); cv.rect(sx,sy,1,S,shade(COLOR[o.t],f*0.7));
  }
  fs.writeFileSync(path.join(OUT,`${name}-front.png`),encodePNG(W,H,cv.buf));
  return {W,H};
}

// アイソメトリック。top/right/front の3面を描く。
function renderIso(blocks, name) {
  const b=bounds(blocks);
  const w2=11,h2=6,vh=11, pad=40;
  const toScreen=(x,y,z)=>[ (x-z)*w2, (x+z)*h2 - y*vh ];
  // 画面範囲算出
  let mnX=1e9,mxX=-1e9,mnY=1e9,mxY=-1e9;
  for(let x=b.mnx;x<=b.mxx+1;x++)for(let z=b.mnz;z<=b.mxz+1;z++)for(let y=b.mny;y<=b.mxy+1;y++){
    const[sx,sy]=toScreen(x,y,z);mnX=Math.min(mnX,sx);mxX=Math.max(mxX,sx);mnY=Math.min(mnY,sy);mxY=Math.max(mxY,sy);}
  const W=(mxX-mnX)+pad*2, H=(mxY-mnY)+pad*2+18;
  const cv=new Canvas(Math.ceil(W),Math.ceil(H));
  const ox=pad-mnX, oy=pad-mnY;
  const sc=(x,y,z)=>{const[a,bb]=toScreen(x,y,z);return [a+ox,bb+oy];};
  const list=[...blocks.keys()].map(k=>{const[x,y,z]=k.split(',').map(Number);return{x,y,z,t:blocks.get(k)};});
  list.sort((a,bb)=>(a.x+a.z)-(bb.x+bb.z)||a.y-bb.y||a.x-bb.x);
  for(const o of list){
    const c=COLOR[o.t];
    const v=(dx,dy,dz)=>sc(o.x+dx,o.y+dy,o.z+dz);
    cv.poly([v(0,1,0),v(1,1,0),v(1,1,1),v(0,1,1)],shade(c,1.0));   // top
    cv.poly([v(1,0,0),v(1,1,0),v(1,1,1),v(1,0,1)],shade(c,0.78));  // right (+x)
    cv.poly([v(0,1,1),v(1,1,1),v(1,0,1),v(0,0,1)],shade(c,0.60));  // front (+z)
  }
  fs.writeFileSync(path.join(OUT,`${name}-iso.png`),encodePNG(cv.w,cv.h,cv.buf));
  return {W:cv.w,H:cv.h};
}

// --- 各構造物のプラン ---
const PLANS = {
  torii:       {fn:'addTorii',       plan:{dir:'x'}, half:7, baseY:0},
  waterTorii:  {fn:'addWaterTorii',  plan:{dir:'x',w:15,d:11}, half:7, baseY:1},
  pagoda:      {fn:'addPagoda',      plan:{}, half:7, baseY:0},
  teahouse:    {fn:'addTeahouse',    plan:{}, half:5, baseY:1},
  castle:      {fn:'addCastle',      plan:{}, half:7, baseY:0},
  daibutsu:    {fn:'addGiantDaibutsu',plan:{w:75,d:43}, half:38, baseY:0},
  riceTerrace: {fn:'addRiceTerrace', plan:{dir:'x'}, half:9, baseY:0},
  tokyoTower:  {fn:'addTokyoTower',  plan:{}, half:6, baseY:0},
};

const which = process.argv[3] || 'torii';
const conf = PLANS[which];
if (!conf) { console.error('unknown', which, 'choices:', Object.keys(PLANS).join(',')); process.exit(1); }
const half = conf.half, base = conf.baseY;
const plan = { x:0, z:0, w:conf.plan.w||half*2+1, d:conf.plan.d||half*2+1, ...conf.plan };
const box = { base, minX:-half, maxX:half, minZ:-half, maxZ:half };
const blocks = buildStructure(conf.fn, plan, box);
const counts = {};
for (const t of blocks.values()) counts[t]=(counts[t]||0)+1;
const fr = renderFront(blocks, which);
const is = renderIso(blocks, which);
console.log(`${which}: ${blocks.size} blocks, front ${fr.W}x${fr.H}, iso ${is.W}x${is.H}`);
console.log('types:', Object.entries(counts).map(([t,n])=>`${t}:${n}`).join(' '));
