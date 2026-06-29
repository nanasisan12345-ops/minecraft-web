// vanilla .nbt structure 読み込み（gzip + NBT バイナリ）。
// 使い方: node scripts/nbt-structure.mjs <file.nbt> [outJson]
//   → {size:[x,y,z], palette:[name...], blocks:[[x,y,z,stateIdx]...]} を返す/書き出す。
import fs from 'fs'; import zlib from 'zlib';

export function parseNBT(buf) {
  let p = 0;
  const u8 = () => buf[p++];
  const i16 = () => { const v = buf.readInt16BE(p); p += 2; return v; };
  const i32 = () => { const v = buf.readInt32BE(p); p += 4; return v; };
  const i64 = () => { const v = buf.readBigInt64BE(p); p += 8; return v; };
  const f32 = () => { const v = buf.readFloatBE(p); p += 4; return v; };
  const f64 = () => { const v = buf.readDoubleBE(p); p += 8; return v; };
  const str = () => { const n = buf.readUInt16BE(p); p += 2; const s = buf.toString('utf8', p, p + n); p += n; return s; };
  function payload(type) {
    switch (type) {
      case 1: return (buf.readInt8(p++));
      case 2: return i16();
      case 3: return i32();
      case 4: return i64();
      case 5: return f32();
      case 6: return f64();
      case 7: { const n = i32(); const a = buf.subarray(p, p + n); p += n; return a; }
      case 8: return str();
      case 9: { const et = u8(); const n = i32(); const a = []; for (let i = 0; i < n; i++) a.push(payload(et)); return a; }
      case 10: { const o = {}; for (;;) { const t = u8(); if (t === 0) break; const name = str(); o[name] = payload(t); } return o; }
      case 11: { const n = i32(); const a = new Array(n); for (let i = 0; i < n; i++) a[i] = i32(); return a; }
      case 12: { const n = i32(); const a = new Array(n); for (let i = 0; i < n; i++) a[i] = i64(); return a; }
      default: throw new Error('bad tag ' + type + ' @' + p);
    }
  }
  const rootType = u8(); str(); // root name
  return payload(rootType);
}

export function loadStructure(file) {
  let buf = fs.readFileSync(file);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  const root = parseNBT(buf);
  const size = (root.size || []).map(Number);
  const palette = (root.palette || []).map(e => e.Name);
  const paletteProps = (root.palette || []).map(e => e.Properties || null);
  const blocks = (root.blocks || []).map(b => [b.pos[0], b.pos[1], b.pos[2], b.state]);
  return { size, palette, paletteProps, blocks };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const s = loadStructure(process.argv[2]);
  console.log('size', s.size.join('x'), 'blocks', s.blocks.length, 'palette', s.palette.length);
  // palette usage counts
  const cnt = new Array(s.palette.length).fill(0);
  for (const b of s.blocks) cnt[b[3]]++;
  s.palette.map((n, i) => [n, cnt[i]]).sort((a, b) => b[1] - a[1]).slice(0, 40)
    .forEach(([n, c]) => console.log(String(c).padStart(7), n));
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({ size: s.size, palette: s.palette, blocks: s.blocks }));
}
