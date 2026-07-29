  /* ============== テクスチャ生成（32x32 ドット絵） ============== */
  const TEX_S = 32;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function tint(hex, f) {
    const r = Math.min(255, ((hex >> 16) & 255) * f) | 0;
    const g = Math.min(255, ((hex >> 8) & 255) * f) | 0;
    const b = Math.min(255, (hex & 255) * f) | 0;
    return `rgb(${r},${g},${b})`;
  }
  function makeTex(draw) {
    const S = TEX_S, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    draw(g, S);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapNearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function noise(g, S, hex, lo, hi) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { g.fillStyle = tint(hex, rnd(lo, hi)); g.fillRect(x, y, 1, 1); }
  }
  function dots(g, S, hex, dens, f) {
    const n = Math.round(S * S * dens);
    for (let i = 0; i < n; i++) { g.fillStyle = tint(hex, f); g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 1, 1); }
  }
  // ドアの下地: 縦板 + ヒンジ側(画像左)の縦框 + 外縁。top=上半分（外縁を上端に描く）
  function doorBase(g, S, top) {
    noise(g, S, 0xa8743d, 0.9, 1.06);
    g.fillStyle = tint(0x8a5f2a, 0.80);
    for (const x of [13, 22]) g.fillRect(x, 0, 1, S);
    g.fillStyle = tint(0x5a361a, 1.0); g.fillRect(6, 0, 1, S);
    g.fillStyle = 'rgba(255,228,175,0.12)'; g.fillRect(7, 0, 1, S);
    g.fillStyle = tint(0x5a361a, 0.85);
    g.fillRect(0, 0, 1, S); g.fillRect(S - 1, 0, 1, S);
    if (top) g.fillRect(0, 0, S, 1); else g.fillRect(0, S - 1, S, 1);
  }
  // 上面テクスチャを方位ごとに回す（turns = 時計回りの90度単位）。ベッドの枕の向きなどに使う
  function rotTex(src, turns) {
    const S = src.image.width, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.translate(S / 2, S / 2); g.rotate(turns * Math.PI / 2); g.translate(-S / 2, -S / 2);
    g.drawImage(src.image, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapNearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  // ヒンジ左右で扉の絵柄が鏡像になる（取っ手がヒンジの反対側に来る）
  function mirrorTex(src) {
    const S = src.image.width, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.translate(S, 0); g.scale(-1, 1); g.drawImage(src.image, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapNearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function oreTex(oreHex, sparkleHex = oreHex) {
    return makeTex((g, S) => {
      noise(g, S, 0x7d8388, 0.82, 1.06);
      dots(g, S, 0x5f666b, 0.06, 0.82);
      const clusters = [[6, 7], [20, 6], [11, 18], [24, 22], [5, 25]];
      for (const [cx, cy] of clusters) {
        g.fillStyle = tint(oreHex, rnd(0.86, 1.12));
        g.fillRect(cx, cy, 4, 3);
        g.fillRect(cx + 1, cy - 1, 2, 5);
        g.fillStyle = tint(sparkleHex, 1.18);
        g.fillRect(cx + 1, cy, 1, 1);
      }
    });
  }
  // 明度差から法線マップを生成し、表面の凹凸を光で表現する
  function normalFromCanvas(canvas, strength) {
    const S = canvas.width, src = canvas.getContext('2d').getImageData(0, 0, S, S).data;
    const lum = (x, y) => { const i = ((((y % S) + S) % S) * S + (((x % S) + S) % S)) * 4; return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255; };
    const out = document.createElement('canvas'); out.width = out.height = S;
    const og = out.getContext('2d'), img = og.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let nx = (lum(x - 1, y) - lum(x + 1, y)) * strength, ny = (lum(x, y - 1) - lum(x, y + 1)) * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const i = (y * S + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(out); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const TX = {
    dirt: makeTex((g, S) => { noise(g, S, 0x8a5a2b, 0.78, 1.12); dots(g, S, 0x5f4020, 0.06, 0.7); for (let i = 0; i < 5; i++) { g.fillStyle = tint(0x9aa0a4, rnd(0.8, 1)); g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 2, 2); } }),
    grassTop: makeTex((g, S) => { noise(g, S, 0x6ab04c, 0.8, 1.14); dots(g, S, 0x4f8f38, 0.05, 0.85); dots(g, S, 0x83c95f, 0.04, 1.1); }),
    grassSide: makeTex((g, S) => {
      noise(g, S, 0x8a5a2b, 0.78, 1.12);
      const base = (S * 0.28) | 0;
      for (let x = 0; x < S; x++) { const h = base + (Math.random() * (S * 0.18) | 0); for (let y = 0; y < h; y++) { g.fillStyle = tint(0x6ab04c, rnd(0.8, 1.14)); g.fillRect(x, y, 1, 1); } }
    }),
    stone: makeTex((g, S) => {
      noise(g, S, 0x8b9094, 0.86, 1.08); dots(g, S, 0x6f757a, 0.06, 0.85); dots(g, S, 0xa8adb2, 0.03, 1.05);
      g.strokeStyle = 'rgba(70,74,78,0.7)'; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { g.beginPath(); let px = Math.random() * S, py = Math.random() * S; g.moveTo(px, py); for (let s = 0; s < 4; s++) { px += rnd(-6, 6); py += rnd(-6, 6); g.lineTo(px, py); } g.stroke(); }
    }),
    snow: makeTex((g, S) => { noise(g, S, 0xf2f7ff, 0.94, 1.0); dots(g, S, 0xdfeaf8, 0.05, 0.97); for (let i = 0; i < 6; i++) { g.fillStyle = '#ffffff'; g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 2, 2); } }),
    bark: makeTex((g, S) => {
      for (let x = 0; x < S; x++) { const c = rnd(0.78, 1.12); for (let y = 0; y < S; y++) { g.fillStyle = tint(0x6d4c1b, c * rnd(0.95, 1.06)); g.fillRect(x, y, 1, 1); } }
      for (let i = 0; i < 6; i++) { const x = Math.random() * S | 0; for (let y = 0; y < S; y++) { g.fillStyle = tint(0x4f3712, rnd(0.85, 1)); g.fillRect(x, y, 1, 1); } }
    }),
    logTop: makeTex((g, S) => { noise(g, S, 0xb5894e, 0.92, 1.05); const c = S / 2; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x - c + 0.5, y - c + 0.5) | 0; if (d % 3 === 0) { g.fillStyle = tint(0x6d4c1b, 0.82); g.fillRect(x, y, 1, 1); } } }),
    leaves: makeTex((g, S) => { noise(g, S, 0x3f8a2e, 0.64, 1.22); dots(g, S, 0x2c5e20, 0.1, 0.8); dots(g, S, 0x5fb04a, 0.05, 1.15); }),
    sand: makeTex((g, S) => { noise(g, S, 0xe6da9c, 0.93, 1.05); dots(g, S, 0xcdbf83, 0.05, 0.9); g.fillStyle = 'rgba(255,255,255,0.16)'; for (let y = 4; y < S; y += 7) g.fillRect(0, y + (Math.random() * 2 | 0), S, 1); }),
    planks: makeTex((g, S) => {
      noise(g, S, 0xb5824a, 0.93, 1.05); const step = S / 4;
      for (let y = 0; y < S; y += step) { g.fillStyle = tint(0x6d4c1b, 0.72); g.fillRect(0, y, S, 1); }
      for (let row = 0; row * step < S; row++) { const y = row * step, sx = (row % 2) ? S / 2 : 0; g.fillStyle = tint(0x6d4c1b, 0.78); g.fillRect(sx, y, 1, step); }
    }),
    // ドアは1ブロック=1枚扉。上下でつながって見えるよう、合わせ目側には外縁を描かない。
    // ヒンジは画像左端の縦框。取っ手は反対側の端・扉全体の中央高さ（=下半分の上部）。
    doorBottom: makeTex((g, S) => {
      doorBase(g, S, false);
      g.fillStyle = tint(0x2e2312, 1.0); g.fillRect(25, 4, 3, 7);
      g.fillStyle = '#cfae5e'; g.fillRect(25, 5, 2, 5);
      g.fillStyle = '#f2dc9a'; g.fillRect(25, 5, 1, 2);
    }),
    doorTop: makeTex((g, S) => {
      doorBase(g, S, true);
      const x0 = 10, y0 = 5, x1 = 29, y1 = 18, bw = 2;
      g.fillStyle = tint(0x5a361a, 1.0); g.fillRect(x0, y0, x1 - x0, y1 - y0);
      const gw = ((x1 - x0) - bw * 3) / 2, gh = ((y1 - y0) - bw * 3) / 2;
      for (const [px, py] of [[x0 + bw, y0 + bw], [x0 + bw * 2 + gw, y0 + bw], [x0 + bw, y0 + bw * 2 + gh], [x0 + bw * 2 + gw, y0 + bw * 2 + gh]]) {
        g.clearRect(px, py, gw, gh);
        g.fillStyle = 'rgba(176,226,255,0.42)'; g.fillRect(px, py, gw, gh);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(px, py, gw, 1);
      }
    }),
    // 厚み3/16の側面に貼る帯。本家はテクスチャ左端3pxのスライスなので無地の板目にする
    doorEdge: makeTex((g, S) => {
      noise(g, S, 0xa8743d, 0.88, 1.04);
      g.fillStyle = tint(0x5a361a, 0.85); g.fillRect(0, 0, 1, S); g.fillRect(S - 1, 0, 1, S);
    }),
    trapdoor: makeTex((g, S) => {
      noise(g, S, 0xa8743d, 0.88, 1.08);
      g.fillStyle = tint(0x5a361a, 0.9);
      g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3); g.fillRect(0, 0, 3, S); g.fillRect(S - 3, 0, 3, S);
      g.fillRect(S / 2 - 1, 3, 2, S - 6); g.fillRect(3, S / 2 - 1, S - 6, 2);
      g.clearRect(7, 7, 6, 6); g.clearRect(19, 7, 6, 6); g.clearRect(7, 19, 6, 6); g.clearRect(19, 19, 6, 6);
      g.fillStyle = 'rgba(180,232,255,0.30)';
      g.fillRect(7, 7, 6, 6); g.fillRect(19, 7, 6, 6); g.fillRect(7, 19, 6, 6); g.fillRect(19, 19, 6, 6);
      g.fillStyle = 'rgba(255,220,150,0.16)'; g.fillRect(4, 4, S - 8, 1);
    }),
    brick: makeTex((g, S) => {
      noise(g, S, 0xa83a2a, 0.9, 1.08); g.fillStyle = '#cdbfa8'; const r = S / 4;
      for (let row = 0; row * r < S; row++) {
        const y = row * r; g.fillRect(0, y, S, 2);
        const off = (row % 2) ? S / 2 : 0;
        for (let x = off; x < S; x += S / 2) g.fillRect(x, y, 2, r);
      }
    }),
    vermilion: makeTex((g, S) => {                         // 朱塗りの木（鳥居用）
      noise(g, S, 0xcf3b1e, 0.95, 1.06);
      for (let x = 0; x < S; x += S / 4) { g.fillStyle = tint(0x9c2810, 0.95); g.fillRect(x, 0, 1, S); }
      g.fillStyle = 'rgba(255,150,110,0.16)'; g.fillRect(2, 0, 2, S);
    }),
    plaster: makeTex((g, S) => {                           // 白漆喰（城壁・民家）
      noise(g, S, 0xeae3d2, 0.97, 1.03);
      dots(g, S, 0xcfc6b0, 0.04, 0.95);
    }),
    roofTile: makeTex((g, S) => {                          // いぶし瓦（屋根）
      noise(g, S, 0x44525c, 0.9, 1.08); const r = S / 8;
      for (let row = 0; row * r < S; row++) { const y = row * r; g.fillStyle = tint(0x222c33, 0.9); g.fillRect(0, y, S, 1); }
      for (let x = 0; x < S; x += S / 8) { g.fillStyle = tint(0x2b353d, 0.92); g.fillRect(x, 0, 1, S); }
      g.fillStyle = 'rgba(150,180,200,0.10)'; for (let row = 0; row * r < S; row++) g.fillRect(0, row * r + 1, S, 1);
    }),
    goldBlock: makeTex((g, S) => {                         // 金（鯱・相輪）
      noise(g, S, 0xe6c23a, 0.92, 1.08);
      g.fillStyle = 'rgba(255,245,180,0.35)'; g.fillRect(0, 0, S, 2); g.fillRect(0, 0, 2, S);
      dots(g, S, 0xfff0a0, 0.05, 1.1);
    }),
    ironBlock: makeTex((g, S) => {                         // 磨いた鉄ブロック
      noise(g, S, 0xd0d5da, 0.94, 1.06);
      g.fillStyle = 'rgba(255,255,255,0.42)'; g.fillRect(0, 0, S, 2); g.fillRect(0, 0, 2, S);
      g.fillStyle = 'rgba(120,128,136,0.5)'; g.fillRect(0, S - 2, S, 2); g.fillRect(S - 2, 0, 2, S);
      dots(g, S, 0xf1f4f7, 0.03, 1.1);
    }),
    diamondBlock: makeTex((g, S) => {                      // 磨いたダイヤブロック（宝石の粒）
      noise(g, S, 0x66d8e6, 0.9, 1.08);
      g.fillStyle = 'rgba(232,255,255,0.42)'; g.fillRect(0, 0, S, 2); g.fillRect(0, 0, 2, S);
      g.fillStyle = 'rgba(40,120,140,0.42)'; g.fillRect(0, S - 2, S, 2); g.fillRect(S - 2, 0, 2, S);
      for (const [cx, cy] of [[8, 9], [21, 7], [13, 20], [24, 23], [6, 24]]) {
        g.fillStyle = tint(0x9af0fb, 1.1); g.fillRect(cx, cy, 3, 3);
        g.fillStyle = '#ffffff'; g.fillRect(cx + 1, cy + 1, 1, 1);
      }
    }),
    coalBlock: makeTex((g, S) => {                         // 石炭ブロック
      noise(g, S, 0x2a2c30, 0.78, 1.22);
      dots(g, S, 0x141518, 0.12, 0.85);
      dots(g, S, 0x4a4d52, 0.04, 1.1);
      g.fillStyle = 'rgba(96,102,110,0.22)'; g.fillRect(0, 0, S, 1); g.fillRect(0, 0, 1, S);
    }),
    copperRoof: makeTex((g, S) => {                        // 緑青の銅瓦（天守の屋根）
      noise(g, S, 0x4a9e86, 0.9, 1.08); const r = S / 8;
      for (let row = 0; row * r < S; row++) { const y = row * r; g.fillStyle = tint(0x2f7a64, 0.92); g.fillRect(0, y, S, 1); }
      for (let x = 0; x < S; x += S / 8) { g.fillStyle = tint(0x3a8a72, 0.95); g.fillRect(x, 0, 1, S); }
      dots(g, S, 0x7fd0b8, 0.04, 1.05);
    }),
    bronze: makeTex((g, S) => {                            // 緑青の青銅（大仏の像体）
      noise(g, S, 0x6f8472, 0.86, 1.08);
      dots(g, S, 0x52685a, 0.10, 0.85);                     // 暗い鋳肌の斑
      dots(g, S, 0x8fb39c, 0.05, 1.12);                     // 緑青のハイライト
      g.fillStyle = 'rgba(40,54,46,0.22)'; g.fillRect(0, S - 3, S, 3);
    }),
    bronzeDark: makeTex((g, S) => {                        // 青銅の陰・面相（目鼻口・衣の襞）
      noise(g, S, 0x47554b, 0.85, 1.08);
      dots(g, S, 0x2f3a32, 0.10, 0.8);
    }),
    tatami: makeTex((g, S) => {                             // 畳。井草の細い縞＋濃い畳縁。
      noise(g, S, 0x9aa96a, 0.92, 1.07);
      for (let x = 0; x < S; x += 2) { g.fillStyle = tint(0x6f7c45, x % 4 === 0 ? 0.95 : 1.05); g.fillRect(x, 0, 1, S); }
      g.fillStyle = tint(0x42533c, 0.9); g.fillRect(0, 0, 3, S); g.fillRect(S - 3, 0, 3, S);
      g.fillStyle = 'rgba(230,225,170,0.24)'; g.fillRect(4, 3, S - 8, 1); g.fillRect(4, S - 4, S - 8, 1);
    }),
    shoji: makeTex((g, S) => {                              // 障子紙＋木格子。
      noise(g, S, 0xf3ead2, 0.98, 1.02);
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, 0, S, S);
      g.fillStyle = tint(0x9b6b3c, 0.92);
      g.fillRect(0, 0, S, 2); g.fillRect(0, S - 2, S, 2); g.fillRect(0, 0, 2, S); g.fillRect(S - 2, 0, 2, S);
      for (let x = 8; x < S; x += 8) g.fillRect(x, 0, 1, S);
      for (let y = 8; y < S; y += 8) g.fillRect(0, y, S, 1);
    }),
    noren: makeTex((g, S) => {                              // 暖簾。藍染め布の縦割れ。
      noise(g, S, 0x284669, 0.9, 1.08);
      g.fillStyle = tint(0x172a42, 0.9); g.fillRect(0, 0, S, 3);
      g.fillStyle = 'rgba(230,240,255,0.20)'; g.fillRect(5, 7, 5, 2); g.fillRect(20, 7, 5, 2);
      g.fillStyle = 'rgba(10,20,36,0.55)'; g.fillRect(S / 2 - 1, 4, 2, S - 4);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(3, 3, 1, S - 5); g.fillRect(18, 3, 1, S - 5);
    }),
    paperLantern: makeTex((g, S) => {                       // 赤い提灯。会場用ランタンより和風の紙灯り。
      noise(g, S, 0xc4382a, 0.9, 1.05);
      g.fillStyle = tint(0x7a1c16, 0.95); g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3);
      g.fillStyle = 'rgba(255,230,160,0.68)'; g.fillRect(8, 7, S - 16, S - 14);
      g.fillStyle = 'rgba(255,120,80,0.38)'; for (let y = 6; y < S - 4; y += 5) g.fillRect(4, y, S - 8, 1);
      g.fillStyle = 'rgba(255,245,200,0.42)'; g.fillRect(S / 2 - 2, 9, 4, S - 18);
    }),
    glass: makeTex((g, S) => {
      g.clearRect(0, 0, S, S); g.fillStyle = 'rgba(180,232,255,0.2)'; g.fillRect(0, 0, S, S);
      g.fillStyle = 'rgba(225,247,255,0.85)'; g.fillRect(0, 0, S, 2); g.fillRect(0, S - 2, S, 2); g.fillRect(0, 0, 2, S); g.fillRect(S - 2, 0, 2, S);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(6, 4, 2, 12); g.fillRect(8, 4, 2, 6);
    }),
    water: makeTex((g, S) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { g.fillStyle = `rgba(${44 + (Math.random() * 18 | 0)},${118 + (Math.random() * 18 | 0)},${210},0.8)`; g.fillRect(x, y, 1, 1); } g.fillStyle = 'rgba(255,255,255,0.12)'; for (let y = 3; y < S; y += 6) g.fillRect(0, y, S, 1); }),
    coalOre: oreTex(0x2b2f33, 0x4a4f55),
    ironOre: oreTex(0xc78a55, 0xf1bd7d),
    goldOre: oreTex(0xe2b93c, 0xffdf66),
    diamondOre: oreTex(0x55d9e8, 0x9dffff),
    // 松明は箱そのものが本家の形（2/16角 × 10/16高）なので、テクスチャは全幅を使って
    // 下2/3が棒・上1/3が炎になるように描く（以前は絵の中に細い松明を描いていて塊に見えていた）
    torch: makeTex((g, S) => {
      noise(g, S, 0x6d4c1b, 0.86, 1.06);
      g.fillStyle = '#4a2f14'; g.fillRect(0, 0, 3, S); g.fillRect(S - 3, 0, 3, S);
      g.fillStyle = 'rgba(255,225,170,0.10)'; g.fillRect(11, 11, 4, S - 11);
      g.fillStyle = '#ff8a22'; g.fillRect(0, 0, S, 11);
      g.fillStyle = '#ffdb55'; g.fillRect(2, 0, S - 4, 8);
      g.fillStyle = '#fff2a3'; g.fillRect(6, 0, S - 12, 5);
    }),
    torchFlame: makeTex((g, S) => {                          // 松明の上面（炎の芯）
      g.fillStyle = '#ffdb55'; g.fillRect(0, 0, S, S);
      g.fillStyle = '#fff2a3'; g.fillRect(4, 4, S - 8, S - 8);
    }),
    crafting: makeTex((g, S) => {
      noise(g, S, 0xb5824a, 0.9, 1.08);
      g.fillStyle = tint(0x5a361a, 0.9); g.fillRect(0, 7, S, 2); g.fillRect(0, 16, S, 2); g.fillRect(7, 0, 2, S); g.fillRect(16, 0, 2, S);
      g.fillStyle = '#d7a66a'; g.fillRect(3, 3, 7, 4); g.fillRect(20, 4, 7, 4); g.fillRect(5, 22, 8, 4);
      g.fillStyle = '#6d4c1b'; g.fillRect(21, 19, 3, 8); g.fillRect(18, 22, 9, 3);
    }),
    // 作業台の天板。本家同様3x3のクラフトグリッド（側面の道具柄とは別）
    craftingTop: makeTex((g, S) => {
      noise(g, S, 0xb5824a, 0.9, 1.08);
      g.fillStyle = tint(0x5a361a, 0.9);
      g.fillRect(0, 0, S, 2); g.fillRect(0, S - 2, S, 2); g.fillRect(0, 0, 2, S); g.fillRect(S - 2, 0, 2, S);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const x = 3 + i * 9, y = 3 + j * 9;
        g.fillStyle = tint(0x8a5f2a, 0.72); g.fillRect(x, y, 8, 8);
        g.fillStyle = tint(0xd7a66a, 0.95); g.fillRect(x + 1, y + 1, 6, 6);
      }
    }),
    furnace: makeTex((g, S) => {
      noise(g, S, 0x757a7d, 0.78, 1.08);
      g.fillStyle = tint(0x4a4e52, 0.9); g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3); g.fillRect(0, 0, 3, S); g.fillRect(S - 3, 0, 3, S);
      g.fillStyle = '#34383b'; g.fillRect(6, 7, 20, 13);
      g.fillStyle = '#16191b'; g.fillRect(8, 9, 16, 9);
      g.fillStyle = '#2d3134'; g.fillRect(10, 22, 12, 4);
      g.fillStyle = '#596066'; g.fillRect(12, 11, 8, 4);
    }),
    furnaceSide: makeTex((g, S) => {
      noise(g, S, 0x73787c, 0.82, 1.08);
      g.fillStyle = tint(0x4a4e52, 0.88); g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3); g.fillRect(0, 0, 3, S); g.fillRect(S - 3, 0, 3, S);
      dots(g, S, 0x4c5256, 0.08, 0.86);
      g.fillStyle = 'rgba(230,235,238,0.16)'; g.fillRect(4, 4, S - 8, 1);
    }),
    furnaceTop: makeTex((g, S) => {
      noise(g, S, 0x777c80, 0.8, 1.08);
      g.fillStyle = tint(0x4a4e52, 0.9); g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3); g.fillRect(0, 0, 3, S); g.fillRect(S - 3, 0, 3, S);
      g.fillStyle = '#555b60'; g.fillRect(8, 8, S - 16, S - 16);
      dots(g, S, 0x303438, 0.06, 0.9);
    }),
    furnaceFront: makeTex((g, S) => {
      noise(g, S, 0x757a7d, 0.78, 1.08);
      g.fillStyle = tint(0x4a4e52, 0.9); g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3); g.fillRect(0, 0, 3, S); g.fillRect(S - 3, 0, 3, S);
      g.fillStyle = '#34383b'; g.fillRect(6, 7, 20, 13);
      g.fillStyle = '#16191b'; g.fillRect(8, 9, 16, 9);
      g.fillStyle = '#2d3134'; g.fillRect(10, 22, 12, 4);
      g.fillStyle = '#596066'; g.fillRect(12, 11, 8, 4);
    }),
    glowCrystal: makeTex((g, S) => {
      noise(g, S, 0x1f4150, 0.72, 1.05);
      for (let i = 0; i < 7; i++) {
        const x = 6 + (Math.random() * 18 | 0), y = 5 + (Math.random() * 20 | 0);
        g.fillStyle = '#6df7ff'; g.fillRect(x, y, 4, 8);
        g.fillStyle = '#d8ffff'; g.fillRect(x + 1, y, 1, 5);
        g.fillStyle = 'rgba(84,220,255,0.55)'; g.fillRect(x - 1, y + 2, 6, 7);
      }
      dots(g, S, 0x9dffff, 0.045, 1.2);
    }),
    dripstone: makeTex((g, S) => {
      noise(g, S, 0x8b8172, 0.78, 1.08);
      g.fillStyle = tint(0x5f574d, 0.88);
      for (let x = 3; x < S; x += 7) {
        const h = 10 + (Math.random() * 15 | 0);
        for (let y = 0; y < h; y++) g.fillRect(x + (y / 7 | 0), y, Math.max(1, 5 - (y / 5 | 0)), 1);
      }
      dots(g, S, 0xc7b79e, 0.035, 1.05);
    }),
    stoneBrick: makeTex((g, S) => {
      noise(g, S, 0x868b8f, 0.86, 1.06);
      g.fillStyle = 'rgba(56,60,64,0.9)'; const r = S / 4;
      for (let row = 0; row * r < S; row++) {
        const y = row * r; g.fillRect(0, y, S, 2);
        const off = (row % 2) ? S / 2 : 0;
        for (let x = off; x < S; x += S / 2) g.fillRect(x, y, 2, r);
      }
      dots(g, S, 0x6f757a, 0.05, 0.85); dots(g, S, 0xaab0b5, 0.025, 1.06);
    }),
    mossyBrick: makeTex((g, S) => {
      noise(g, S, 0x80878a, 0.82, 1.04);
      g.fillStyle = 'rgba(50,56,54,0.9)'; const r = S / 4;
      for (let row = 0; row * r < S; row++) {
        const y = row * r; g.fillRect(0, y, S, 2);
        const off = (row % 2) ? S / 2 : 0;
        for (let x = off; x < S; x += S / 2) g.fillRect(x, y, 2, r);
      }
      dots(g, S, 0x4f7a3a, 0.13, 0.92); dots(g, S, 0x6fae4a, 0.06, 1.08); dots(g, S, 0x375724, 0.05, 0.8);
    }),
    chest: makeTex((g, S) => {
      noise(g, S, 0x8a5a2b, 0.82, 1.08);
      g.fillStyle = tint(0x5a361a, 0.92);
      g.fillRect(3, 0, 2, S); g.fillRect(S - 5, 0, 2, S);
      g.fillStyle = '#3a2412'; g.fillRect(0, 10, S, 1);
      g.fillStyle = tint(0x5a361a, 0.9); g.fillRect(0, 5, S, 1); g.fillRect(0, 15, S, 1);
      g.fillStyle = '#e0bd52'; g.fillRect(S / 2 - 3, 8, 6, 6);
      g.fillStyle = '#8a6a1a'; g.fillRect(S / 2 - 1, 11, 2, 3);
      dots(g, S, 0x6d4c1b, 0.05, 0.75);
    }),
    // チェスト上面/底面。錠前は正面だけなので、蓋の面には金具の縦帯だけを側面と揃えて描く
    chestTop: makeTex((g, S) => {
      noise(g, S, 0x8a5a2b, 0.82, 1.08);
      g.fillStyle = tint(0x5a361a, 0.92);
      g.fillRect(3, 0, 2, S); g.fillRect(S - 5, 0, 2, S);
      g.fillStyle = tint(0x5a361a, 0.9);
      g.fillRect(0, 0, S, 1); g.fillRect(0, S - 1, S, 1); g.fillRect(0, 0, 1, S); g.fillRect(S - 1, 0, 1, S);
      dots(g, S, 0x6d4c1b, 0.05, 0.75);
    }),
    gravel: makeTex((g, S) => {                              // 砂利。丸い小石が混ざった土色
      noise(g, S, 0x8b8377, 0.78, 1.12);
      dots(g, S, 0x5f5a51, 0.10, 0.8);
      dots(g, S, 0xb8b1a4, 0.07, 1.05);
      for (const [cx, cy] of [[5, 6], [19, 4], [11, 17], [24, 21], [4, 25], [27, 12]]) {
        g.fillStyle = tint(0x6f6a60, 1.0); g.fillRect(cx, cy, 3, 3);
        g.fillStyle = tint(0xa9a294, 1.05); g.fillRect(cx, cy, 2, 2);
      }
    }),
    bookshelf: makeTex((g, S) => {                           // 本棚の側面。板枠に本が並ぶ
      noise(g, S, 0xb5824a, 0.9, 1.06);
      g.fillStyle = tint(0x5a361a, 0.9); g.fillRect(0, 0, S, 4); g.fillRect(0, S - 4, S, 4);
      g.fillStyle = '#2b1c0e'; g.fillRect(0, 14, S, 4);
      const cols = ['#b03030', '#3a6fb0', '#c8a23a', '#4a8a44', '#8a4ab0', '#c46a2a'];
      for (let row = 0; row < 2; row++) {
        let x = 1;
        while (x < S - 2) {
          const w = 2 + (Math.random() * 2 | 0);
          g.fillStyle = cols[(Math.random() * cols.length) | 0];
          g.fillRect(x, row === 0 ? 5 : 19, w, 8);
          x += w + 1;
        }
      }
    }),
    enchantTable: makeTex((g, S) => {                        // 黒曜石台に赤い布。側面
      noise(g, S, 0x241a2e, 0.85, 1.1);
      g.fillStyle = '#8e1d24'; g.fillRect(0, 0, S, 9);
      g.fillStyle = '#c22b33'; g.fillRect(0, 2, S, 4);
      dots(g, S, 0x6a4fa0, 0.05, 1.2);
      g.fillStyle = tint(0x0f0a16, 1.0); g.fillRect(0, 9, S, 2); g.fillRect(0, S - 2, S, 2);
    }),
    enchantTableTop: makeTex((g, S) => {                     // 開いた本
      noise(g, S, 0x241a2e, 0.85, 1.05);
      g.fillStyle = '#e8e0cc'; g.fillRect(5, 8, 10, 16); g.fillRect(17, 8, 10, 16);
      g.fillStyle = '#8e1d24'; g.fillRect(15, 7, 2, 18);
      g.fillStyle = 'rgba(140,110,60,0.5)'; for (let y = 11; y < 22; y += 3) { g.fillRect(7, y, 6, 1); g.fillRect(19, y, 6, 1); }
    }),
    anvil: makeTex((g, S) => {                               // 鉄の金床
      noise(g, S, 0x3f4348, 0.82, 1.1);
      g.fillStyle = tint(0x24272a, 1.0); g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3);
      g.fillStyle = tint(0x5a6066, 1.05); g.fillRect(3, 5, S - 6, 5);
      dots(g, S, 0x2b2f33, 0.06, 0.9);
    }),
    lantern: makeTex((g, S) => {
      g.fillStyle = '#191610'; g.fillRect(0, 0, S, S);
      g.fillStyle = '#3a342a'; g.fillRect(4, 2, S - 8, 4); g.fillRect(4, S - 6, S - 8, 4);
      g.fillStyle = '#ffd98a'; g.fillRect(7, 7, S - 14, S - 14);
      g.fillStyle = '#ffb43a'; g.fillRect(10, 10, S - 20, S - 20);
      g.fillStyle = '#fff3c2'; g.fillRect(S / 2 - 2, 12, 4, 7);
      g.fillStyle = '#54483a'; g.fillRect(S / 2 - 1, 0, 2, 4);
      g.fillStyle = 'rgba(30,26,18,0.85)'; for (let y = 8; y < S - 6; y += 6) g.fillRect(6, y, S - 12, 1);
    }),
    lava: makeTex((g, S) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { g.fillStyle = `rgb(${200 + (Math.random() * 50 | 0)},${66 + (Math.random() * 54 | 0)},${10 + (Math.random() * 14 | 0)})`; g.fillRect(x, y, 1, 1); }
      g.fillStyle = 'rgba(58,18,4,0.55)'; for (let i = 0; i < 9; i++) g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 3 + (Math.random() * 3 | 0), 2);
      g.fillStyle = '#ffd24a'; for (let i = 0; i < 8; i++) g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 2, 2);
      g.fillStyle = '#fff0a0'; for (let i = 0; i < 4; i++) g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 1, 1);
    }),
    cactus: makeTex((g, S) => {
      noise(g, S, 0x4f8f3a, 0.82, 1.06);
      g.fillStyle = tint(0x2c5e28, 0.92); g.fillRect(0, 0, 2, S); g.fillRect(S - 2, 0, 2, S);
      g.fillStyle = tint(0x6fbf4a, 1.05); g.fillRect(4, 0, 2, S);
      g.fillStyle = '#dfe9a0'; for (let y = 3; y < S; y += 6) { g.fillRect(7, y, 1, 1); g.fillRect(S - 8, y + 3, 1, 1); }
      dots(g, S, 0x244a1f, 0.05, 0.8);
    }),
    chestOpen: makeTex((g, S) => {
      noise(g, S, 0x8a5a2b, 0.82, 1.08);
      g.fillStyle = tint(0x5a361a, 0.92); g.fillRect(3, 0, 2, S); g.fillRect(S - 5, 0, 2, S);
      g.fillStyle = '#241407'; g.fillRect(2, 2, S - 4, 7); // 開いた内部の影
      g.fillStyle = '#120a04'; g.fillRect(4, 3, S - 8, 4);
      g.fillStyle = tint(0x5a361a, 0.9); g.fillRect(0, 13, S, 1);
      g.fillStyle = '#e0bd52'; g.fillRect(S / 2 - 3, 16, 6, 4);
      dots(g, S, 0x6d4c1b, 0.05, 0.75);
    }),
    villageSign: makeTex((g, S) => {
      noise(g, S, 0xb5824a, 0.92, 1.08);
      g.fillStyle = tint(0x5a361a, 0.85);
      g.fillRect(0, 4, S, 2); g.fillRect(0, S - 6, S, 2);
      g.fillRect(3, 0, 2, S); g.fillRect(S - 5, 0, 2, S);
      g.fillStyle = '#f0d39a';
      g.fillRect(7, 8, 18, 2); g.fillRect(6, 14, 20, 2); g.fillRect(9, 20, 14, 2);
      g.fillStyle = '#3a2412';
      g.fillRect(8, 9, 16, 1); g.fillRect(7, 15, 18, 1); g.fillRect(10, 21, 12, 1);
      dots(g, S, 0x6d4c1b, 0.04, 0.76);
    }),
    obsidian: makeTex((g, S) => {
      noise(g, S, 0x161020, 0.85, 1.12);
      dots(g, S, 0x0c0812, 0.10, 0.8);
      dots(g, S, 0x3a2a55, 0.05, 1.15);
      for (let i = 0; i < 5; i++) { g.fillStyle = tint(0x5a3f7e, rnd(0.9, 1.2)); g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 2, 1); }
    }),
    ladder: makeTex((g, S) => {
      // 背景は透明のまま。左右の縦レール＋横桟だけを木の色で描く（隙間から向こうが透ける）
      const rail = (rx) => {
        for (let y = 0; y < S; y++) { g.fillStyle = tint(0x7a5624, rnd(0.85, 1.12)); g.fillRect(rx, y, 4, 1); }
        g.fillStyle = 'rgba(58,36,18,0.85)'; g.fillRect(rx, 0, 1, S); g.fillRect(rx + 3, 0, 1, S);
      };
      rail(4); rail(24);
      for (let ry = 5; ry < S; ry += 8) {
        for (let x = 4; x < 28; x++) { g.fillStyle = tint(0x8a6a2f, rnd(0.9, 1.1)); g.fillRect(x, ry, 1, 3); }
        g.fillStyle = 'rgba(58,36,18,0.8)'; g.fillRect(4, ry + 2, 24, 1);
      }
    }),
    cobble: makeTex((g, S) => {                              // 丸石。ゴロゴロした玉石の敷き詰め。
      noise(g, S, 0x74797d, 0.8, 1.05);
      const stones = [[2, 2, 9, 8], [13, 1, 9, 9], [24, 3, 7, 8], [1, 12, 8, 9], [11, 12, 10, 8], [23, 13, 8, 8], [3, 22, 9, 8], [14, 22, 8, 8], [24, 23, 7, 7]];
      for (const [x, y, w, h] of stones) {
        g.fillStyle = tint(0x84898d, rnd(0.82, 1.06)); g.fillRect(x, y, w, h);
        g.fillStyle = tint(0xa2a7ab, rnd(0.95, 1.1)); g.fillRect(x + 1, y + 1, Math.max(1, w - 3), 2);
        g.fillStyle = tint(0x4f545a, 0.9); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
      }
      dots(g, S, 0x3f4449, 0.05, 0.8);
    }),
    bedTop: makeTex((g, S) => {                              // ベッド上面。白い枕＋赤い毛布。
      noise(g, S, 0xb03030, 0.9, 1.06);
      g.fillStyle = tint(0xf2f0e6, 1.0); g.fillRect(2, 2, S - 4, 9);          // 枕
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(2, 10, S - 4, 1);
      g.fillStyle = tint(0x8c1f1f, 0.95); g.fillRect(0, 12, S, 2);            // 毛布の折り返し
      g.fillStyle = 'rgba(255,255,255,0.14)'; for (let y = 17; y < S - 2; y += 5) g.fillRect(3, y, S - 6, 1);
      g.fillStyle = tint(0x6d4c1b, 0.9); g.fillRect(0, S - 2, S, 2);
    }),
    // 2ブロックのベッド。上面は「枕元が画像の上」で描き、方位ごとに rotTex で回す
    bedHeadTop: makeTex((g, S) => {                          // 枕元。木枠＋白い枕＋赤い毛布。
      noise(g, S, 0xb03030, 0.9, 1.06);
      g.fillStyle = tint(0x6d4c1b, 0.9); g.fillRect(0, 0, S, 2);              // headboard 側の木枠
      g.fillStyle = tint(0xf2f0e6, 1.0); g.fillRect(2, 3, S - 4, 11);         // 枕
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(2, 13, S - 4, 1);
      g.fillStyle = tint(0x8c1f1f, 0.95); g.fillRect(0, 15, S, 2);            // 毛布の折り返し
      g.fillStyle = 'rgba(255,255,255,0.14)'; for (let y = 20; y < S; y += 5) g.fillRect(3, y, S - 6, 1);
    }),
    bedFootTop: makeTex((g, S) => {                          // 足元。赤い毛布＋足側の木枠。
      noise(g, S, 0xb03030, 0.9, 1.06);
      g.fillStyle = 'rgba(255,255,255,0.14)'; for (let y = 2; y < S - 4; y += 5) g.fillRect(3, y, S - 6, 1);
      g.fillStyle = tint(0x8c1f1f, 0.95); g.fillRect(0, S - 6, S, 2);
      g.fillStyle = tint(0x6d4c1b, 0.9); g.fillRect(0, S - 3, S, 3);          // 足側の木枠
    }),
    bedSideFoot: makeTex((g, S) => {                         // 足元の側面。木枠＋赤い毛布のみ。
      noise(g, S, 0x8a5a35, 0.9, 1.06);
      g.fillStyle = tint(0xb03030, 1.0); g.fillRect(0, 4, S, 12);
      g.fillStyle = tint(0x6d4c1b, 0.85); g.fillRect(0, 16, S, 3);
      g.fillStyle = tint(0x5a3d1a, 0.9); g.fillRect(0, S - 4, 4, 4); g.fillRect(S - 4, S - 4, 4, 4);
    }),
    bedSideHead: makeTex((g, S) => {                         // 枕元の側面。枕の白が画像左端に出る。
      noise(g, S, 0x8a5a35, 0.9, 1.06);
      g.fillStyle = tint(0xb03030, 1.0); g.fillRect(0, 4, S, 12);
      g.fillStyle = tint(0xf2f0e6, 1.0); g.fillRect(0, 4, 9, 12);
      g.fillStyle = tint(0x6d4c1b, 0.85); g.fillRect(0, 16, S, 3);
      g.fillStyle = tint(0x5a3d1a, 0.9); g.fillRect(0, S - 4, 4, 4); g.fillRect(S - 4, S - 4, 4, 4);
    }),
    bedSide: makeTex((g, S) => {                             // ベッド側面。木枠＋赤い毛布。
      noise(g, S, 0x8a5a35, 0.9, 1.06);
      g.fillStyle = tint(0xb03030, 1.0); g.fillRect(0, 4, S, 12);
      g.fillStyle = tint(0xf2f0e6, 1.0); g.fillRect(0, 4, 8, 12);
      g.fillStyle = tint(0x6d4c1b, 0.85); g.fillRect(0, 16, S, 3);
      g.fillStyle = tint(0x5a3d1a, 0.9); g.fillRect(0, S - 4, 4, 4); g.fillRect(S - 4, S - 4, 4, 4);
    }),
    farmland: makeTex((g, S) => {                            // 耕地。湿った土＋畝の溝。
      noise(g, S, 0x6b4423, 0.72, 1.0);
      for (let y = 2; y < S; y += 6) { g.fillStyle = 'rgba(26,15,7,0.55)'; g.fillRect(0, y, S, 2); }
      dots(g, S, 0x8a5a2b, 0.04, 1.1);
      dots(g, S, 0x3a240f, 0.05, 0.8);
    }),
    wheatYoung: makeTex((g, S) => {                          // 小麦の苗。若い緑の茎。
      g.clearRect(0, 0, S, S);
      for (let i = 0; i < 10; i++) {
        const x = 2 + i * 3, h = 9 + (Math.random() * 8 | 0);
        g.fillStyle = tint(0x55a83c, rnd(0.8, 1.15));
        g.fillRect(x, S - h, 2, h);
        g.fillStyle = tint(0x77c455, rnd(0.9, 1.1));
        g.fillRect(x, S - h, 2, 2);
      }
    }),
    wheatRipe: makeTex((g, S) => {                           // 実った小麦。金色の穂。
      g.clearRect(0, 0, S, S);
      for (let i = 0; i < 10; i++) {
        const x = 2 + i * 3, h = 15 + (Math.random() * 9 | 0);
        g.fillStyle = tint(0xd8b84a, rnd(0.85, 1.1));
        g.fillRect(x, S - h, 2, h);
        g.fillStyle = tint(0xe6cc5e, rnd(0.9, 1.12));
        g.fillRect(x - 1, S - h - 4, 4, 5);
      }
    }),
    furnaceLit: makeTex((g, S) => {                          // 点火中のかまど。口から炎。
      noise(g, S, 0x757a7d, 0.86, 1.06);
      g.fillStyle = tint(0x4a4e52, 0.9); g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3); g.fillRect(0, 0, 3, S); g.fillRect(S - 3, 0, 3, S);
      g.fillStyle = '#33363a'; g.fillRect(6, 13, 20, 13);
      g.fillStyle = '#ff8a22'; g.fillRect(8, 15, 16, 9);
      g.fillStyle = '#ffd34a'; g.fillRect(10, 17, 12, 6);
      g.fillStyle = '#fff2a3'; g.fillRect(13, 18, 6, 4);
    }),
    tntSide: makeTex((g, S) => {                             // TNT側面。赤い火薬帯＋白い"TNT"帯。
      noise(g, S, 0xc0392b, 0.9, 1.06);
      g.fillStyle = '#efe9dc'; g.fillRect(0, 11, S, 10);
      g.fillStyle = '#2c2c2c'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('TNT', S / 2, 16);
      g.fillStyle = tint(0x8a231a, 0.9); g.fillRect(0, 0, S, 2); g.fillRect(0, S - 2, S, 2);
      dots(g, S, 0x000000, 0.03, 0.4);
    }),
    tntTop: makeTex((g, S) => {                              // TNT上面。導火線の束。
      noise(g, S, 0xb33327, 0.9, 1.05);
      g.fillStyle = '#5a4a2a'; for (let i = 0; i < 6; i++) g.fillRect(4 + i * 4, 4, 2, S - 8);
      g.fillStyle = '#3a3a3a'; g.fillRect(S / 2 - 3, S / 2 - 3, 6, 6);
    }),
    sapling: makeTex((g, S) => {                             // 苗木。細い茶の茎＋小さな緑の葉。
      g.clearRect(0, 0, S, S);
      g.fillStyle = '#6d4c1b'; g.fillRect(S / 2 - 1, S / 2, 2, S / 2 - 2);
      g.fillStyle = tint(0x3f8a2e, 1.0); g.fillRect(S / 2 - 5, S / 2 - 6, 10, 9);
      g.fillStyle = tint(0x5fb04a, 1.1); g.fillRect(S / 2 - 3, S / 2 - 5, 6, 4);
      g.fillStyle = tint(0x2c5e20, 0.9); g.fillRect(S / 2 - 5, S / 2 + 1, 10, 2);
    }),
    bedrock: makeTex((g, S) => {                             // 岩盤。ほぼ黒の粗い岩。
      noise(g, S, 0x3a3d40, 0.55, 1.0); dots(g, S, 0x17181a, 0.16, 0.7); dots(g, S, 0x5c6065, 0.05, 1.15);
      g.strokeStyle = 'rgba(12,13,14,0.8)'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { g.beginPath(); let px = Math.random() * S, py = Math.random() * S; g.moveTo(px, py); for (let s = 0; s < 3; s++) { px += rnd(-8, 8); py += rnd(-8, 8); g.lineTo(px, py); } g.stroke(); }
    }),
    deepslate: makeTex((g, S) => {                           // 深層岩。石より暗いグレー＋縦筋。
      noise(g, S, 0x4c4f55, 0.8, 1.06); dots(g, S, 0x35383d, 0.08, 0.8); dots(g, S, 0x63666c, 0.03, 1.1);
      g.strokeStyle = 'rgba(40,42,46,0.75)'; g.lineWidth = 1;
      for (let x = 3; x < S; x += 6) { g.beginPath(); g.moveTo(x + rnd(-1, 1), 0); g.lineTo(x + rnd(-2, 2), S); g.stroke(); }
    }),
    redstoneOre: makeTex((g, S) => {                         // レッドストーン鉱石。石に赤い結晶粒。
      noise(g, S, 0x757a7d, 0.86, 1.06);
      const spots = [[4, 5], [14, 3], [23, 7], [6, 15], [17, 13], [25, 17], [4, 24], [13, 23], [22, 25]];
      for (const [x, y] of spots) {
        g.fillStyle = tint(0xd8281e, rnd(0.85, 1.1)); g.fillRect(x, y, 4, 4);
        g.fillStyle = tint(0xff5a4a, rnd(0.95, 1.15)); g.fillRect(x + 1, y + 1, 2, 2);
      }
      dots(g, S, 0x4f545a, 0.05, 0.8);
    }),
    redstoneWire: makeTex((g, S) => {                        // ダスト。赤い粉の筋（背景透明）。
      g.clearRect(0, 0, S, S);
      g.fillStyle = tint(0xc02218, 1.0); g.fillRect(0, S / 2 - 3, S, 6); g.fillRect(S / 2 - 3, 0, 6, S);
      g.fillStyle = tint(0xe83a28, 1.05); g.fillRect(0, S / 2 - 1, S, 2); g.fillRect(S / 2 - 1, 0, 2, S);
      for (let i = 0; i < 20; i++) { g.fillStyle = tint(0x8a1810, rnd(0.8, 1.2)); g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 1, 1); }
    }),
    redstoneTorchOn: makeTex((g, S) => {                     // RSトーチ(点灯)。赤く光る先端。
      noise(g, S, 0x5a361a, 0.85, 1.08);
      g.fillStyle = '#3a2412'; g.fillRect(10, 12, 12, 20);
      g.fillStyle = '#8a5525'; g.fillRect(13, 12, 6, 20);
      g.fillStyle = '#ff4a3a'; g.fillRect(8, 4, 16, 10);
      g.fillStyle = '#ff8a7a'; g.fillRect(11, 6, 10, 6);
      g.fillStyle = '#ffd2c8'; g.fillRect(13, 4, 6, 5);
    }),
    redstoneTorchOff: makeTex((g, S) => {                    // RSトーチ(消灯)。暗い赤の先端。
      noise(g, S, 0x5a361a, 0.85, 1.08);
      g.fillStyle = '#3a2412'; g.fillRect(10, 12, 12, 20);
      g.fillStyle = '#8a5525'; g.fillRect(13, 12, 6, 20);
      g.fillStyle = '#5a1410'; g.fillRect(8, 4, 16, 10);
      g.fillStyle = '#7a241a'; g.fillRect(11, 6, 10, 6);
    }),
    lever: makeTex((g, S) => {                               // レバー。丸石台座＋木の棒。
      noise(g, S, 0x74797d, 0.8, 1.02);
      g.fillStyle = tint(0x4f545a, 0.9); g.fillRect(6, 20, 20, 8);
      g.fillStyle = tint(0x84898d, 1.0); g.fillRect(8, 22, 16, 4);
      g.fillStyle = '#8a5525'; g.fillRect(14, 4, 4, 18);
      g.fillStyle = '#5a361a'; g.fillRect(14, 4, 1, 18);
      g.fillStyle = '#d8281e'; g.fillRect(13, 2, 6, 4);
    }),
    redstoneLamp: makeTex((g, S) => {                        // ランプ(消灯)。暗い琥珀色＋格子。
      noise(g, S, 0x5a4020, 0.8, 1.05);
      g.fillStyle = tint(0x3a2a12, 0.9);
      g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3); g.fillRect(0, 0, 3, S); g.fillRect(S - 3, 0, 3, S);
      g.fillRect(0, S / 2 - 1, S, 2); g.fillRect(S / 2 - 1, 0, 2, S);
      dots(g, S, 0x7a5a2a, 0.06, 1.1);
    }),
    redstoneLampOn: makeTex((g, S) => {                      // ランプ(点灯)。明るい金色の光。
      noise(g, S, 0xe8a83a, 0.95, 1.08);
      g.fillStyle = tint(0x8a5a1a, 0.9);
      g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3); g.fillRect(0, 0, 3, S); g.fillRect(S - 3, 0, 3, S);
      g.fillRect(0, S / 2 - 1, S, 2); g.fillRect(S / 2 - 1, 0, 2, S);
      g.fillStyle = 'rgba(255,242,180,0.85)'; g.fillRect(5, 5, 10, 10); g.fillRect(19, 19, 8, 8);
      dots(g, S, 0xfff2a3, 0.08, 1.15);
    }),
  };
  TX.doorBottomM = mirrorTex(TX.doorBottom);
  TX.doorTopM = mirrorTex(TX.doorTop);
  TX.lava.wrapS = TX.lava.wrapT = THREE.RepeatWrapping;
  TX.cactus.userData.normalMap = normalFromCanvas(TX.cactus.image, 2.2);
  TX.water.wrapS = TX.water.wrapT = THREE.RepeatWrapping;
  // 水面のさざ波: 波の干渉を描いたグレースケールから法線マップを起こす。
  // 水テクスチャ本体（ノイズ＋横線）から起こすとザラつくだけなので専用の元絵を使い、
  // 本体とは別の速度で offset を流して反射だけを揺らす（82-weather-and-loop.js）。
  TX.water.userData.normalMap = normalFromCanvas(makeTex((g, S) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = Math.sin((x / S) * Math.PI * 4) * 0.5
        + Math.sin((y / S) * Math.PI * 6 + x * 0.35) * 0.32
        + Math.sin(((x + y) / S) * Math.PI * 3) * 0.28;
      const c = Math.max(0, Math.min(255, Math.round(128 + v * 58)));
      g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(x, y, 1, 1);
    }
  }).image, 1.6);
  for (const k of ['dirt', 'grassTop', 'grassSide', 'stone', 'snow', 'bark', 'logTop', 'leaves', 'sand', 'planks', 'doorBottom', 'doorTop', 'doorBottomM', 'doorTopM', 'doorEdge', 'trapdoor', 'brick', 'coalOre', 'ironOre', 'goldOre', 'diamondOre', 'crafting', 'furnace', 'furnaceSide', 'furnaceTop', 'furnaceFront', 'dripstone', 'stoneBrick', 'mossyBrick', 'chest', 'chestTop', 'craftingTop', 'torch', 'gravel', 'bookshelf', 'enchantTable', 'enchantTableTop', 'anvil', 'villageSign', 'tatami', 'shoji', 'noren', 'paperLantern', 'cobble', 'bedTop', 'bedSide', 'bedHeadTop', 'bedFootTop', 'bedSideHead', 'bedSideFoot', 'farmland', 'furnaceLit', 'tntSide', 'tntTop', 'ironBlock', 'diamondBlock', 'coalBlock', 'bedrock', 'deepslate', 'redstoneOre', 'redstoneLamp', 'redstoneLampOn'])
    TX[k].userData.normalMap = normalFromCanvas(TX[k].image, 2.2);
