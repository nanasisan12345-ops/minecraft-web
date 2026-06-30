// 汎用: vanilla .nbt 構造を取り込み、各 Minecraft ブロックを我々のパレットへ対応づけ、
// 任意倍率で縮小・内部を中空化して、byte/セル(0=空気, 値=ourId+1)の base64 を書き出す。
// 使い方: node scripts/import-structure.mjs <file.nbt> <outDir> <name> [scale=1] [thresh=0.3]
import fs from 'fs';
import { loadStructure } from './nbt-structure.mjs';

// 我々のブロック定数（22-block-types.js と一致）
const B = { GRASS:0,DIRT:1,STONE:2,LOG:3,LEAVES:4,SAND:5,PLANKS:6,BRICK:7,GLASS:8,WATER:9,SNOW:10,
  STONE_BRICK:20,MOSSY_BRICK:21,CHEST:22,LANTERN:23,LAVA:24,VERMILION:28,PLASTER:29,ROOF_TILE:30,GOLD_BLOCK:31,COPPER_ROOF:32,BRONZE:33 };

// Minecraft ブロック名 → 我々のブロックid（-1=置かない）
export function mapBlock(raw) {
  const n = raw.replace('minecraft:', '');
  if (/air|structure_void|jigsaw|barrier|^light$|^cave_air|^void_air/.test(n)) return -1;
  if (/crimson|warped_|nether_brick|red_nether/.test(n)) return B.VERMILION;     // 朱（赤い木・煉瓦）
  if (/deepslate.*(tile|brick)|deepslate_tile|polished_blackstone_brick/.test(n)) return B.ROOF_TILE; // 瓦（暗い屋根）
  if (/quartz|calcite|white_(concrete|terracotta|wool|glazed)|smooth_stone$/.test(n)) return B.PLASTER; // 白漆喰
  if (/mossy/.test(n)) return B.MOSSY_BRICK;
  if (/(stone_brick|chiseled_stone|stone_tile)/.test(n)) return B.STONE_BRICK;
  if (/leaves/.test(n)) return B.LEAVES;
  if (/glass/.test(n)) return B.GLASS;
  if (/water|kelp|seagrass|lily/.test(n)) return B.WATER;
  if (/lava|magma/.test(n)) return B.LAVA;
  if (/gold/.test(n)) return B.GOLD_BLOCK;
  if (/lantern|torch|campfire|sea_lantern|glowstone|shroomlight|lit_|beacon/.test(n)) return B.LANTERN;
  if (/chest/.test(n)) return B.CHEST;
  if (/hay/.test(n)) return B.SAND;
  if (/sand/.test(n)) return B.SAND;
  if (/snow/.test(n)) return B.SNOW;
  if (/(log|stem|stripped_|_wood$|bamboo_block)/.test(n)) return B.LOG;            // 幹＝丸太
  if (/(planks|_slab|_stairs|fence|trapdoor|_door|_sign|barrel|bookshelf|crafting|lectern|scaffold|ladder|composter|banner|wool|carpet|bed)/.test(n)) return B.PLANKS;
  if (/grass_block/.test(n)) return B.GRASS;
  if (/(dirt|path|farmland|podzol|mud|clay|coarse|rooted|moss_block|gravel)/.test(n)) return B.DIRT;
  if (/(cobble|andesite|diorite|granite|smooth_basalt|basalt|tuff|blackstone|deepslate|stone)/.test(n)) return B.STONE;
  return B.STONE; // 不明なソリッドは石として残す
}

const NBT = process.argv[2], OUT = process.argv[3], NAME = process.argv[4];
const SCALE = Math.max(1, Math.floor(+(process.argv[5] || 1)));
const THRESH = +(process.argv[6] || 0.3);
const s = loadStructure(NBT);
let [SX, SY, SZ] = s.size;
// 原寸グリッド（our id を格納, 255=空気）
const AIR = 255;
let grid = new Uint8Array(SX * SY * SZ).fill(AIR);
let idx = (x, y, z) => (y * SZ + z) * SX + x;
const mapped = s.palette.map(mapBlock);
for (const [x, y, z, st] of s.blocks) {
  if (x < 0 || y < 0 || z < 0 || x >= SX || y >= SY || z >= SZ) continue;
  const id = mapped[st]; if (id >= 0) grid[idx(x, y, z)] = id;
}
// 縮小（各ブロックで最頻の非空気idを採用）
if (SCALE > 1) {
  const nx = Math.ceil(SX / SCALE), ny = Math.ceil(SY / SCALE), nz = Math.ceil(SZ / SCALE);
  const need = Math.max(1, Math.round(THRESH * SCALE * SCALE * SCALE));
  const ng = new Uint8Array(nx * ny * nz).fill(AIR);
  const nidx = (x, y, z) => (y * nz + z) * nx + x;
  for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const tally = {}; let c = 0;
    for (let dy = 0; dy < SCALE; dy++) for (let dz = 0; dz < SCALE; dz++) for (let dx = 0; dx < SCALE; dx++) {
      const sx = x*SCALE+dx, sy = y*SCALE+dy, sz = z*SCALE+dz;
      if (sx<SX&&sy<SY&&sz<SZ) { const v = grid[idx(sx,sy,sz)]; if (v!==AIR){ tally[v]=(tally[v]||0)+1; c++; } }
    }
    if (c >= need) { let best=-1,bc=-1; for(const k in tally) if(tally[k]>bc){bc=tally[k];best=+k;} ng[nidx(x,y,z)]=best; }
  }
  grid = ng; SX=nx; SY=ny; SZ=nz; idx=nidx;
}
// 中空化（6近傍すべて非空気のセルを落とす）＋トリム
const keep = new Uint8Array(SX*SY*SZ).fill(AIR);
let mnx=SX,mxx=-1,mny=SY,mxy=-1,mnz=SZ,mxz=-1, cnt=0;
for(let y=0;y<SY;y++)for(let z=0;z<SZ;z++)for(let x=0;x<SX;x++){
  const v=grid[idx(x,y,z)]; if(v===AIR) continue;
  const enclosed = x>0&&x<SX-1&&y>0&&y<SY-1&&z>0&&z<SZ-1 &&
    grid[idx(x-1,y,z)]!==AIR&&grid[idx(x+1,y,z)]!==AIR&&grid[idx(x,y-1,z)]!==AIR&&grid[idx(x,y+1,z)]!==AIR&&grid[idx(x,y,z-1)]!==AIR&&grid[idx(x,y,z+1)]!==AIR;
  if(enclosed) continue;
  keep[idx(x,y,z)]=v; cnt++;
  mnx=Math.min(mnx,x);mxx=Math.max(mxx,x);mny=Math.min(mny,y);mxy=Math.max(mxy,y);mnz=Math.min(mnz,z);mxz=Math.max(mxz,z);
}
const W=mxx-mnx+1, H=mxy-mny+1, D=mxz-mnz+1;
console.log(`${NAME}: src ${s.size.join('x')} -> ${W}x${H}x${D}  surface=${cnt}`);

// byte/セル（value = ourId+1, 0=空気）→ base64
const cells = new Uint8Array(W*H*D);
let bi=0;
for(let y=0;y<H;y++)for(let z=0;z<D;z++)for(let x=0;x<W;x++){
  const v=keep[idx(x+mnx,y+mny,z+mnz)];
  cells[bi++] = (v===AIR)?0:(v+1);
}
const b64 = Buffer.from(cells).toString('base64');
console.log(`  bytes ${cells.length} base64 ${b64.length}`);

// viz 用 JSON（our id → 色）
const COLOR=[0x6ab04c,0x8a5a2b,0x8b9094,0x6d4c1b,0x3f8a2e,0xe6da9c,0xb5824a,0xa83a2a,0xbfe9ff,0x3a78d8,0xf2f7ff,0,0,0,0,0,0,0,0,0,0x868b8f,0x6f8a5a,0xc79a52,0xffc25a,0xff6a1a,0x4f8f3a,0,0,0xcf3b1e,0xeae3d2,0x44525c,0xe6c23a,0x4a9e86,0x6f8472];
const vb=[]; for(let y=0;y<H;y++)for(let z=0;z<D;z++)for(let x=0;x<W;x++){const v=cells[(y*D+z)*W+x]; if(v) vb.push([x,y,z,v-1]);}
fs.writeFileSync(`${OUT}/${NAME}-struct.json`, JSON.stringify({size:[W,H,D], color:vb.map(b=>COLOR[b[3]]||0xaaaaaa), blocks:vb}));
fs.writeFileSync(`${OUT}/${NAME}.regdata`, `${W} ${H} ${D}\n${b64}\n`);
