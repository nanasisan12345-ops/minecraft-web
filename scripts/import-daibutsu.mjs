// Sengoku の buddah3.nbt を取り込み、石系→青銅にリマップ、内部を中空化して
// 表面ボクセルだけを残し、ランタイム用の占有ビットマスク(base64)とビューア用JSONを書き出す。
// 使い方: node scripts/import-daibutsu.mjs <buddah3.nbt> <outDir>
import fs from 'fs';
import { loadStructure } from './nbt-structure.mjs';

const NBT = process.argv[2], OUT = process.argv[3];
const s = loadStructure(NBT);
const [SX, SY, SZ] = s.size;
const isAir = (name) => /air|jigsaw|structure_void|barrier/.test(name);
// 占有グリッド
const grid = new Uint8Array(SX * SY * SZ);
const idx = (x, y, z) => (y * SZ + z) * SX + x;
for (const [x, y, z, st] of s.blocks) {
  if (x < 0 || y < 0 || z < 0 || x >= SX || y >= SY || z >= SZ) continue;
  if (!isAir(s.palette[st])) grid[idx(x, y, z)] = 1;
}
let solid = 0; for (const v of grid) solid += v;

// 中空化: 6近傍すべてが solid のセルは内部 → 落とす
const surf = new Uint8Array(SX * SY * SZ);
let surfCount = 0;
for (let y = 0; y < SY; y++) for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
  if (!grid[idx(x, y, z)]) continue;
  const inside = x > 0 && x < SX - 1 && y > 0 && y < SY - 1 && z > 0 && z < SZ - 1 &&
    grid[idx(x-1,y,z)] && grid[idx(x+1,y,z)] && grid[idx(x,y-1,z)] && grid[idx(x,y+1,z)] && grid[idx(x,y,z-1)] && grid[idx(x,y,z+1)];
  if (!inside) { surf[idx(x, y, z)] = 1; surfCount++; }
}

// バウンディングボックスにトリム
let mnx=SX,mxx=-1,mny=SY,mxy=-1,mnz=SZ,mxz=-1;
for (let y=0;y<SY;y++)for(let z=0;z<SZ;z++)for(let x=0;x<SX;x++) if(surf[idx(x,y,z)]){
  mnx=Math.min(mnx,x);mxx=Math.max(mxx,x);mny=Math.min(mny,y);mxy=Math.max(mxy,y);mnz=Math.min(mnz,z);mxz=Math.max(mxz,z);
}
const W=mxx-mnx+1, Hh=mxy-mny+1, D=mxz-mnz+1;
console.log('size', `${SX}x${SY}x${SZ}`, 'solid', solid, 'surface', surfCount, 'bbox', `${W}x${Hh}x${D}`);

// ビューア用 JSON（青銅色で描く）
const vox=[]; for(let y=mny;y<=mxy;y++)for(let z=mnz;z<=mxz;z++)for(let x=mnx;x<=mxx;x++) if(surf[idx(x,y,z)]) vox.push([x-mnx,y-mny,z-mnz]);
fs.writeFileSync(`${OUT}/daibutsu-import.json`, JSON.stringify({ size:[W,Hh,D], palette:['minecraft:bronze'], blocks: vox.map(([x,y,z])=>[x,y,z,0]) }));

// ランタイム用ビットマスク（W*H*D bits, x fastest then z then y）→ base64
const bits = new Uint8Array(Math.ceil(W*Hh*D/8));
let bi=0;
for(let y=0;y<Hh;y++)for(let z=0;z<D;z++)for(let x=0;x<W;x++){
  if(surf[idx(x+mnx,y+mny,z+mnz)]) bits[bi>>3] |= (1<<(bi&7));
  bi++;
}
const b64 = Buffer.from(bits).toString('base64');
console.log('bitmask bytes', bits.length, 'base64 len', b64.length);
fs.writeFileSync(`${OUT}/daibutsu-data.txt`, `${W} ${Hh} ${D}\n${b64}\n`);
