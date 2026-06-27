  /* ============== Perlinノイズ ============== */
  function loadWorldSeed() {
    try {
      const saved = localStorage.getItem('mc_world_seed');
      if (saved && Number.isFinite(+saved)) return +saved;
      const next = Math.floor(Math.random() * 2147483646) + 1;
      localStorage.setItem('mc_world_seed', String(next));
      return next;
    } catch (e) {
      return Math.floor(Math.random() * 2147483646) + 1;
    }
  }
  const WORLD_SEED = loadWorldSeed();
  function setWorldSeed(next) {
    const n = Math.max(1, Math.min(2147483646, Math.floor(+next || 1)));
    localStorage.setItem('mc_world_seed', String(n));
    location.reload();
  }
  const perm = new Uint8Array(512);
  (() => {
    const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i;
    let s = WORLD_SEED; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  })();
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  function grad(h, x, y) { const u = (h & 1) ? -x : x, v = (h & 2) ? -y : y; return u + v; }
  function grad3(h, x, y, z) {
    const a = h & 15;
    const u = a < 8 ? x : y;
    const v = a < 4 ? y : (a === 12 || a === 14 ? x : z);
    return ((a & 1) ? -u : u) + ((a & 2) ? -v : v);
  }
  function perlin2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1], ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    return lerp(lerp(grad(aa, x, y), grad(ba, x - 1, y), u), lerp(grad(ab, x, y - 1), grad(bb, x - 1, y - 1), u), v);
  }
  function perlin3(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(
      lerp(
        lerp(grad3(perm[AA], x, y, z), grad3(perm[BA], x - 1, y, z), u),
        lerp(grad3(perm[AB], x, y - 1, z), grad3(perm[BB], x - 1, y - 1, z), u),
        v
      ),
      lerp(
        lerp(grad3(perm[AA + 1], x, y, z - 1), grad3(perm[BA + 1], x - 1, y, z - 1), u),
        lerp(grad3(perm[AB + 1], x, y - 1, z - 1), grad3(perm[BB + 1], x - 1, y - 1, z - 1), u),
        v
      ),
      w
    );
  }
  function fbm(x, y, oct, gain) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * perlin2(x * freq, y * freq); norm += amp; amp *= gain; freq *= 2; }
    return sum / norm;
  }
  function fbm3(x, y, z, oct, gain) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * perlin3(x * freq, y * freq, z * freq); norm += amp; amp *= gain; freq *= 2; }
    return sum / norm;
  }
