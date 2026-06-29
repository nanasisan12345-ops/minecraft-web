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
    copperRoof: makeTex((g, S) => {                        // 緑青の銅瓦（天守の屋根）
      noise(g, S, 0x4a9e86, 0.9, 1.08); const r = S / 8;
      for (let row = 0; row * r < S; row++) { const y = row * r; g.fillStyle = tint(0x2f7a64, 0.92); g.fillRect(0, y, S, 1); }
      for (let x = 0; x < S; x += S / 8) { g.fillStyle = tint(0x3a8a72, 0.95); g.fillRect(x, 0, 1, S); }
      dots(g, S, 0x7fd0b8, 0.04, 1.05);
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
    torch: makeTex((g, S) => {
      noise(g, S, 0x5a361a, 0.85, 1.08);
      g.fillStyle = '#3a2412'; g.fillRect(10, 12, 12, 20);
      g.fillStyle = '#8a5525'; g.fillRect(13, 12, 6, 20);
      g.fillStyle = '#ffdb55'; g.fillRect(8, 4, 16, 10);
      g.fillStyle = '#ff8a22'; g.fillRect(11, 7, 10, 9);
      g.fillStyle = '#fff2a3'; g.fillRect(13, 3, 6, 7);
    }),
    crafting: makeTex((g, S) => {
      noise(g, S, 0xb5824a, 0.9, 1.08);
      g.fillStyle = tint(0x5a361a, 0.9); g.fillRect(0, 7, S, 2); g.fillRect(0, 16, S, 2); g.fillRect(7, 0, 2, S); g.fillRect(16, 0, 2, S);
      g.fillStyle = '#d7a66a'; g.fillRect(3, 3, 7, 4); g.fillRect(20, 4, 7, 4); g.fillRect(5, 22, 8, 4);
      g.fillStyle = '#6d4c1b'; g.fillRect(21, 19, 3, 8); g.fillRect(18, 22, 9, 3);
    }),
    furnace: makeTex((g, S) => {
      noise(g, S, 0x757a7d, 0.78, 1.08);
      g.fillStyle = '#44484a'; g.fillRect(6, 7, 20, 13);
      g.fillStyle = '#1d2022'; g.fillRect(8, 9, 16, 9);
      g.fillStyle = '#ff8a22'; g.fillRect(10, 13, 12, 4);
      g.fillStyle = '#ffd15a'; g.fillRect(13, 11, 6, 6);
      g.fillStyle = '#3f4448'; g.fillRect(4, 24, 24, 3);
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
  };
  TX.lava.wrapS = TX.lava.wrapT = THREE.RepeatWrapping;
  TX.cactus.userData.normalMap = normalFromCanvas(TX.cactus.image, 2.2);
  TX.water.wrapS = TX.water.wrapT = THREE.RepeatWrapping;
  for (const k of ['dirt', 'grassTop', 'grassSide', 'stone', 'snow', 'bark', 'logTop', 'leaves', 'sand', 'planks', 'brick', 'coalOre', 'ironOre', 'goldOre', 'diamondOre', 'crafting', 'furnace', 'dripstone', 'stoneBrick', 'mossyBrick', 'chest', 'villageSign'])
    TX[k].userData.normalMap = normalFromCanvas(TX[k].image, 2.2);
