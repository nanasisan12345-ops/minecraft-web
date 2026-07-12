const FACE_DEFS = [
  { n: [ 1,  0,  0], m: 0, v: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]], uv: [0,0, 0,1, 1,1, 1,0] },
  { n: [-1,  0,  0], m: 1, v: [[0,0,0], [0,0,1], [0,1,1], [0,1,0]], uv: [0,0, 1,0, 1,1, 0,1] },
  { n: [ 0,  1,  0], m: 2, v: [[0,1,0], [0,1,1], [1,1,1], [1,1,0]], uv: [0,0, 0,1, 1,1, 1,0] },
  { n: [ 0, -1,  0], m: 3, v: [[0,0,0], [1,0,0], [1,0,1], [0,0,1]], uv: [0,0, 1,0, 1,1, 0,1] },
  { n: [ 0,  0,  1], m: 4, v: [[0,0,1], [1,0,1], [1,1,1], [0,1,1]], uv: [0,0, 1,0, 1,1, 0,1] },
  { n: [ 0,  0, -1], m: 5, v: [[0,0,0], [0,1,0], [1,1,0], [1,0,0]], uv: [0,0, 0,1, 1,1, 1,0] },
];

const GRASS = 0, DIRT = 1, STONE = 2, SAND = 5, WATER = 9, SNOW = 10;
const COAL_ORE = 11, IRON_ORE = 12, GOLD_ORE = 13, DIAMOND_ORE = 14, LAVA = 24;
const SEA = 8, SNOW_LINE = 30, ROCK_LINE = 23;
const SPAWN_GROUND_Y = 12, SPAWN_FLAT_R = 28, SPAWN_CLEAR_R = 38;

let WORLD_SEED = 1;
let CHUNK_SIZE = 24, CHUNK_Y_MIN = -64, CHUNK_Y_MAX = 319;
let typeCount = 0;
let transparent = [];
let groupCounts = [];
let blockModels = [];
let lightLevels = [];
let explicitBlocks = new Map();
let explicitAir = new Set();
let explicitEdits = new Map();
let blockedColumns = new Set();
let columnYBounds = new Map();
let HEIGHT_CACHE = new Map();
let RAW_HEIGHT_CACHE = new Map();
let _fuji = null;

const perm = new Uint8Array(512);
const BIOMES = {
  plains: { id: 'plains', base: 4, height: 27, ridge: 4 },
  forest: { id: 'forest', base: 5, height: 30, ridge: 5 },
  desert: { id: 'desert', base: 5, height: 14, ridge: 2 },
  highlands: { id: 'highlands', base: 7, height: 18, ridge: 4 },
  snowfield: { id: 'snowfield', base: 9, height: 18, ridge: 3 },
  swamp: { id: 'swamp', base: 3, height: 8, ridge: 1 },
  jungle: { id: 'jungle', base: 5, height: 26, ridge: 5 },
  volcano: { id: 'volcano', base: 11, height: 33, ridge: 8 },
};

const xyzKey = (x, y, z) => `${x},${y},${z}`;
const xzKey = (x, z) => `${x},${z}`;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const distFromSpawn = (x, z) => Math.hypot(x, z);
const inSpawnClearing = (x, z, r = SPAWN_CLEAR_R) => distFromSpawn(x, z) <= r;

function smoothstep(x, min, max) {
  const t = clamp((x - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function initPerm(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed;
  const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}

const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
function grad(h, x, y) {
  const u = (h & 1) ? -x : x, v = (h & 2) ? -y : y;
  return u + v;
}
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
  for (let i = 0; i < oct; i++) {
    sum += amp * perlin2(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= 2;
  }
  return sum / norm;
}
function fbm3(x, y, z, oct, gain) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * perlin3(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= gain;
    freq *= 2;
  }
  return sum / norm;
}

function hash2(x, z) {
  const h = Math.sin(x * 127.1 + z * 311.7 + WORLD_SEED * 0.0137) * 43758.5453;
  return h - Math.floor(h);
}

function biomeAt(x, z) {
  if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 10)) return BIOMES.plains;
  const seedA = WORLD_SEED * 0.017, seedB = WORLD_SEED * 0.011;
  const heat = (fbm(x * 0.018 + 180 + seedA, z * 0.018 - 80 - seedB, 3, 0.5) + 1) / 2;
  const wet = (fbm(x * 0.021 - 420 - seedB, z * 0.021 + 260 + seedA, 3, 0.5) + 1) / 2;
  const rough = (fbm(x * 0.026 + 900 + seedB, z * 0.026 - 650 + seedA, 2, 0.55) + 1) / 2;
  const cell = 96;
  const bx = Math.floor((x + (WORLD_SEED % 997)) / cell), bz = Math.floor((z - (WORLD_SEED % 577)) / cell);
  const region = hash2(bx * 9.7 + 2.3, bz * 8.1 - 4.2);
  if (region < 0.06 && rough > 0.52) return BIOMES.volcano;
  if (region < 0.13 && heat < 0.56) return BIOMES.snowfield;
  if (region < 0.28 && heat > 0.45) return BIOMES.desert;
  if (region < 0.42) return BIOMES.forest;
  if (region < 0.55) return BIOMES.highlands;
  if (heat > 0.6 && wet > 0.6) return BIOMES.jungle;
  if (wet > 0.66 && rough < 0.45 && heat > 0.42) return BIOMES.swamp;
  if (heat < 0.34) return BIOMES.snowfield;
  if (heat > 0.56 && wet < 0.52) return BIOMES.desert;
  if (rough > 0.60) return BIOMES.highlands;
  if (wet > 0.50) return BIOMES.forest;
  return BIOMES.plains;
}

function terrainProfileAt(x, z, biome) {
  const seedA = WORLD_SEED * 0.00037;
  const wx = x + fbm(x * 0.008 + 91 + seedA, z * 0.008 - 37, 3, 0.5) * 18;
  const wz = z + fbm(x * 0.008 - 53, z * 0.008 + 119 - seedA, 3, 0.5) * 18;
  const continent = (fbm(wx * 0.0048 + 11, wz * 0.0048 - 17, 5, 0.52) + 1) / 2;
  const rolling = (fbm(wx * 0.018 + 140, wz * 0.018 - 80, 4, 0.5) + 1) / 2;
  const rough = fbm(wx * 0.042 - 320, wz * 0.042 + 210, 3, 0.54);
  const ridge = Math.pow(1 - Math.abs(fbm(wx * 0.022 + 600, wz * 0.022 - 440, 4, 0.5)), 2.15);
  const detail = fbm(wx * 0.095 + 12, wz * 0.095 - 34, 2, 0.55);
  return { continent, rolling, rough, ridge, detail };
}

function terrainHeightRaw(x, z) {
  const biome = biomeAt(x, z);
  const p = terrainProfileAt(x, z, biome);
  const broad = Math.pow(clamp(p.continent, 0, 1), biome.id === 'desert' ? 2.4 : 1.55);
  const rolling = Math.pow(clamp(p.rolling, 0, 1), 1.2);
  let natural = biome.base + broad * (biome.height * 0.72) + rolling * (biome.height * 0.28);
  natural += p.rough * biome.ridge * 0.85;
  natural += p.detail * (biome.id === 'desert' ? 0.9 : 1.6);
  if (biome.id === 'desert') {
    natural = SEA + 1 + broad * 11 + p.detail * 1.1;
  } else if (biome.id === 'forest') {
    natural += p.rough * 2.2;
  } else if (biome.id === 'highlands') {
    natural += p.ridge * 4 + Math.max(0, p.rough) * 2;
  } else if (biome.id === 'snowfield') {
    natural += p.ridge * 3 - 1.5;
  } else if (biome.id === 'swamp') {
    natural = SEA + (broad * 3 + p.detail * 0.9);
  } else if (biome.id === 'jungle') {
    natural += p.rough * 2.5 + p.ridge * 2;
  } else if (biome.id === 'volcano') {
    natural += p.ridge * 8 + Math.max(0, p.rough) * 3;
  } else {
    natural += p.ridge * 4.5;
  }
  natural = clamp(natural, 3, 32);
  const d = distFromSpawn(x, z);
  if (d <= SPAWN_FLAT_R) return SPAWN_GROUND_Y;
  if (d < SPAWN_CLEAR_R) {
    const t = smoothstep((d - SPAWN_FLAT_R) / (SPAWN_CLEAR_R - SPAWN_FLAT_R), 0, 1);
    return lerp(SPAWN_GROUND_Y, natural, t);
  }
  return natural;
}

function terrainHeightRawCached(x, z) {
  const id = xzKey(x, z);
  const cached = RAW_HEIGHT_CACHE.get(id);
  if (cached !== undefined) return cached;
  const h = terrainHeightRaw(x, z);
  RAW_HEIGHT_CACHE.set(id, h);
  if (RAW_HEIGHT_CACHE.size > 110000) RAW_HEIGHT_CACHE.clear();
  return h;
}

function fujiCenter() {
  if (_fuji) return _fuji;
  const ang = hash2(7.77, 3.33) * Math.PI * 2;
  const dist = 168;
  _fuji = { x: Math.round(Math.cos(ang) * dist), z: Math.round(Math.sin(ang) * dist), R: 92, peak: 58 };
  return _fuji;
}
function inFuji(x, z) {
  const f = fujiCenter();
  return Math.hypot(x - f.x, z - f.z) < f.R;
}
function landmarkHeightAt(x, z) {
  const f = fujiCenter();
  const dx = x - f.x, dz = z - f.z;
  const d = Math.hypot(dx, dz);
  if (d >= f.R) return 0;
  const t = d / f.R;
  let cone = f.peak * Math.pow(1 - t, 1.32);
  const ang = Math.atan2(dz, dx);
  cone += (1 - t) * (Math.sin(ang * 8) * 0.5 + 0.5) * 2.0 * ((fbm(x * 0.06, z * 0.06, 2, 0.5) + 1) / 2);
  let y = SPAWN_GROUND_Y + cone;
  if (t < 0.14) y -= ((0.14 - t) / 0.14) * 16;
  return Math.round(y);
}

function heightAt(x, z) {
  const id = xzKey(x, z);
  const cached = HEIGHT_CACHE.get(id);
  if (cached !== undefined) return cached;
  let h = terrainHeightRawCached(x, z);
  h = Math.round(clamp(h, 3, 32));
  const lm = landmarkHeightAt(x, z);
  if (lm > h) h = Math.min(lm, CHUNK_Y_MAX - 4);
  HEIGHT_CACHE.set(id, h);
  if (HEIGHT_CACHE.size > 90000) HEIGHT_CACHE.clear();
  return h;
}

function topTypeAt(x, z, h) {
  const biome = biomeAt(x, z);
  if (inSpawnClearing(x, z, SPAWN_FLAT_R)) return GRASS;
  if (inFuji(x, z)) {
    const f = fujiCenter();
    if (h >= SPAWN_GROUND_Y + f.peak * 0.66) return SNOW;
    if (h >= SPAWN_GROUND_Y + f.peak * 0.30) return STONE;
    return GRASS;
  }
  if (h <= SEA + 1) return SAND;
  if (biome.id === 'snowfield' || h >= SNOW_LINE) return SNOW;
  if (biome.id === 'desert') return SAND;
  if (biome.id === 'volcano') return STONE;
  const slope = Math.max(
    Math.abs(h - heightAt(x + 1, z)),
    Math.abs(h - heightAt(x - 1, z)),
    Math.abs(h - heightAt(x, z + 1)),
    Math.abs(h - heightAt(x, z - 1))
  );
  if (slope >= 3 || h >= ROCK_LINE) return STONE;
  return GRASS;
}

function blockedColumnAt(x, z) {
  return blockedColumns.has(xzKey(x, z));
}

function pondFeatureAt(x, z, h) {
  if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 18) || blockedColumnAt(x, z)) return null;
  const biome = biomeAt(x, z);
  if (biome.id === 'highlands' || biome.id === 'snowfield' || h <= SEA + 1 || h >= 26) return null;
  const cell = 48;
  const cx0 = Math.floor(x / cell), cz0 = Math.floor(z / cell);
  for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) for (let cz = cz0 - 1; cz <= cz0 + 1; cz++) {
    const chance = hash2(cx * 12.3 + 0.7, cz * 17.9 - 1.4);
    const limit = biome.id === 'desert' ? 0.07 : biome.id === 'swamp' ? 0.34 : biome.id === 'forest' ? 0.20 : 0.16;
    if (chance > limit) continue;
    const px = cx * cell + 9 + (hash2(cx * 23.1 + 5.2, cz * 29.7 - 2.1) * (cell - 18) | 0);
    const pz = cz * cell + 9 + (hash2(cx * 31.4 - 4.4, cz * 11.6 + 8.3) * (cell - 18) | 0);
    if (distFromSpawn(px, pz) < SPAWN_CLEAR_R + 24) continue;
    const rx = 5 + (hash2(cx * 7.1 + 2.6, cz * 5.9 - 3.2) * 5 | 0);
    const rz = 4 + (hash2(cx * 9.7 - 6.1, cz * 8.2 + 1.8) * 5 | 0);
    const edgeNoise = fbm(x * 0.21 + cx * 3.1, z * 0.21 - cz * 2.7, 2, 0.55) * 0.16;
    const d = Math.hypot((x - px) / rx, (z - pz) / rz) + edgeNoise;
    if (d > 1) continue;
    const level = Math.max(SEA + 1, Math.min(heightAt(px, pz) - 1, h));
    return { level, deep: d < 0.58 ? 2 : 1, shore: d > 0.76 };
  }
  return null;
}

function streamFeatureAt(x, z, h) {
  if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 16) || blockedColumnAt(x, z)) return null;
  const biome = biomeAt(x, z);
  if (biome.id === 'desert' || biome.id === 'highlands' || h <= SEA + 1 || h >= 24) return null;
  const path = Math.abs(fbm(x * 0.026 + WORLD_SEED * 0.003, z * 0.026 - 240, 3, 0.52));
  const flow = fbm(x * 0.010 - 120, z * 0.010 + WORLD_SEED * 0.004, 2, 0.5);
  if (path > 0.052 || flow < -0.12) return null;
  const slope = Math.max(Math.abs(h - heightAt(x + 1, z)), Math.abs(h - heightAt(x - 1, z)), Math.abs(h - heightAt(x, z + 1)), Math.abs(h - heightAt(x, z - 1)));
  if (slope > 2) return null;
  return { level: h, deep: 1, shore: path > 0.036 };
}

function meanderBand(x, z, freq, warp, seedOff) {
  const wx = x + fbm(x * freq * 0.6 + 40 + seedOff, z * freq * 0.6 - 25, 2, 0.5) * warp;
  const wz = z + fbm(x * freq * 0.6 - 60, z * freq * 0.6 + 80 + seedOff, 2, 0.5) * warp;
  return Math.abs(fbm(wx * freq + seedOff + WORLD_SEED * 0.0021, wz * freq - 130, 3, 0.5));
}
function canyonAt(x, z) {
  if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 40)) return null;
  const region = (fbm(x * 0.0042 - 510 + WORLD_SEED * 0.0017, z * 0.0042 + 320, 2, 0.5) + 1) / 2;
  if (region < 0.72) return null;
  if (biomeAt(x, z).id === 'swamp') return null;
  const band = meanderBand(x, z, 0.011, 26, 333);
  if (band > 0.045) return null;
  if (blockedColumnAt(x, z)) return null;
  return { t: band / 0.045 };
}
function riverAt(x, z) {
  if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 22)) return null;
  if (biomeAt(x, z).id === 'desert') return null;
  const band = meanderBand(x, z, 0.0085, 30, 901);
  if (band > 0.03) return null;
  if (blockedColumnAt(x, z)) return null;
  return { t: band / 0.03 };
}
function valleyFlowLevel(x, z) {
  const broad = (fbm(x * 0.006 + 71 + WORLD_SEED * 0.001, z * 0.006 - 42, 3, 0.5) + 1) / 2;
  return SEA + 1 + Math.round(broad * 9);
}
function valleyAt(x, z, h) {
  if (h <= SEA + 2) return null;
  const c = canyonAt(x, z);
  if (c) {
    const lava = biomeAt(x, z).id === 'volcano';
    let level = Math.min(valleyFlowLevel(x, z), h - 5);
    if (level < SEA - 1) level = SEA - 1;
    if (h - level < 5) return null;
    let fallTop = null;
    if (c.t > 0.6 && c.t < 0.98 && hash2(Math.floor(x / 2) * 3.1 + 5, Math.floor(z / 2) * 2.7 - 4) < 0.1) fallTop = h - 1;
    return { level, deep: lava ? 1 : 2, fill: lava ? LAVA : WATER, bed: STONE, shore: false, fallTop };
  }
  const r = riverAt(x, z);
  if (r) {
    let level = Math.min(valleyFlowLevel(x, z), h - 1);
    if (level < SEA) level = SEA;
    if (level >= h) return null;
    return { level, deep: 2, fill: WATER, bed: SAND, shore: r.t > 0.78 };
  }
  return null;
}
function waterFeatureAt(x, z, h) {
  if (inFuji(x, z)) return null;
  return valleyAt(x, z, h) || pondFeatureAt(x, z, h) || streamFeatureAt(x, z, h);
}

function isCaveAt(x, y, z, h, regionHint = null) {
  if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 8)) return false;
  if (h <= SEA + 2 || y < CHUNK_Y_MIN + 4 || y > h - 4) return false;
  if (y <= CHUNK_Y_MIN + 2) return false;
  const deep = y < 0 ? 0.07 : 0;
  const region = regionHint == null ? fbm(x * 0.012 + 1200, z * 0.012 - 300, 2, 0.5) : regionHint;
  if (region <= -0.20) return false;
  const coarse = hash2(Math.floor(x / 4) * 9.17 + y * 0.19, Math.floor(z / 4) * 7.31 - y * 0.23);
  if (y < -8 && coarse < 0.18) return false;
  const gate = hash2(Math.floor(x / 3) * 5.11 + Math.floor(y / 2) * 0.37, Math.floor(z / 3) * 6.23 - Math.floor(y / 2) * 0.41);
  if (gate < (y < -8 ? 0.30 : 0.18)) return false;
  const tunnel = fbm(x * 0.055 + y * 0.030 + 400, z * 0.055 - y * 0.026 - 220, 3, 0.52);
  const chamber = fbm(x * 0.030 - 900, z * 0.030 + y * 0.050 + 140, 2, 0.55);
  return region > -0.20 && tunnel > 0.48 - deep && chamber > -0.24 - deep;
}

function caveMouthAt(x, z, h) {
  if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 12) || h <= SEA + 5) return false;
  const seam = Math.abs(fbm(x * 0.026 + 730, z * 0.026 - 710, 2, 0.5));
  return seam < 0.026 && hash2(Math.floor(x / 6), Math.floor(z / 6)) > 0.58;
}

function oreTypeAt(x, y, z, h) {
  if (y >= h - 4 || y <= CHUNK_Y_MIN + 1) return STONE;
  const speck = hash2(x * 3.17 + y * 0.91, z * 2.73 - y * 0.47);
  if (speck < 0.73) return STONE;
  const vein = fbm3(x * 0.075 + 40, y * 0.115 - 17, z * 0.075 + 90, 3, 0.56);
  const broad = fbm3(x * 0.030 - 220, y * 0.045 + 180, z * 0.030 + 60, 2, 0.55);
  const oreBand = vein + broad * 0.45;
  const deep = y <= -32 ? 0.080 : y <= -8 ? 0.060 : y <= 11 ? 0.035 : 0;
  if (y <= 13 && oreBand > 0.48 - deep && speck > 0.955 - deep) return DIAMOND_ORE;
  if (y <= 24 && oreBand > 0.40 - deep && speck > 0.915 - deep) return GOLD_ORE;
  if (y <= 44 && oreBand > 0.30 && speck > 0.84) return IRON_ORE;
  if (y <= h - 5 && oreBand > 0.20 && speck > 0.75) return COAL_ORE;
  return STONE;
}

// 列（x,z）ごとに一度だけ計算する高価な情報。terrainBlockAt が Y ごとに
// waterFeatureAt/biomeAt/heightAt を呼び直していたのを解消するためのキャッシュ。
let COL_CACHE = new Map();
function columnDesc(x, z) {
  const id = xzKey(x, z);
  let d = COL_CACHE.get(id);
  if (d !== undefined) return d;
  const h = heightAt(x, z);
  const biome = biomeAt(x, z);
  const top = topTypeAt(x, z, h);
  const fuji = inFuji(x, z);
  const waterFeature = fuji ? null : waterFeatureAt(x, z, h);
  const lavaCap = biome.id === 'volcano' && h >= 27 && hash2(x * 1.3 + 4.1, z * 1.7 - 2.3) < 0.5;
  let mouth = false, caveRegion = -1;
  if (!fuji) {
    mouth = caveMouthAt(x, z, h);
    caveRegion = h > SEA + 2 ? fbm(x * 0.012 + 1200, z * 0.012 - 300, 2, 0.5) : -1;
  }
  d = { h, top, fuji, waterFeature, lavaCap, mouth, caveRegion };
  COL_CACHE.set(id, d);
  return d;
}

// terrainBlockAt と同じ結果を返すが、列情報 d を受け取り Y ごとの再計算を避ける。
function terrainBlockAtCol(x, y, z, d) {
  if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return undefined;
  const h = d.h, top = d.top, waterFeature = d.waterFeature;
  const bedType = waterFeature ? (waterFeature.bed || SAND) : SAND;
  const fillType = waterFeature ? (waterFeature.fill || WATER) : WATER;
  if (waterFeature) {
    if (y >= waterFeature.level - waterFeature.deep && y <= waterFeature.level - 1) return bedType;
    if (y === waterFeature.level || (waterFeature.fallTop != null && y > waterFeature.level && y <= waterFeature.fallTop)) return fillType;
    if (y > waterFeature.level && y <= Math.max(h + 1, waterFeature.level)) return undefined;
  }
  if (y > h) return y <= SEA ? WATER : undefined;
  if (y === h) return waterFeature && waterFeature.shore ? SAND : d.lavaCap ? LAVA : top;
  if (!d.fuji) {
    if ((d.mouth && y >= h - 4) || (d.caveRegion > -0.20 && isCaveAt(x, y, z, h, d.caveRegion))) return undefined;
  }
  if (top === SAND && y >= h - 4) return SAND;
  if ((top === GRASS || top === SNOW) && y >= h - 3) return DIRT;
  return oreTypeAt(x, y, z, h);
}

function terrainBlockAt(x, y, z) {
  return terrainBlockAtCol(x, y, z, columnDesc(x, z));
}

function blockAt(x, y, z) {
  const id = xyzKey(x, y, z);
  const edit = explicitEdits.get(id);
  if (edit < 0) return undefined;
  if (edit != null && edit >= 0) return edit;
  const t = explicitBlocks.get(id);
  if (t !== undefined) return t;
  if (explicitAir.has(id)) return undefined;
  return terrainBlockAtCol(x, y, z, columnDesc(x, z));
}

function columnYRange(x, z) {
  const d = columnDesc(x, z);
  const h = d.h, wf = d.waterFeature;
  const naturalMin = Math.max(CHUNK_Y_MIN, Math.min(h, SEA) - 24);
  const naturalMax = Math.min(CHUNK_Y_MAX, Math.max(h, SEA, wf && wf.fallTop != null ? wf.fallTop : h));
  const b = columnYBounds.get(xzKey(x, z));
  if (!b) return { min: naturalMin, max: naturalMax };
  return { min: Math.min(naturalMin, b.min), max: Math.max(naturalMax, b.max) };
}

// 列ごとにブロック種を1回だけ計算して密な配列に詰める（0=空気, それ以外=種+1）。
// メッシュ本体の走査も隣接面のオクルージョン判定も、この配列から読むだけになる。
let STACK_CACHE = new Map();
function columnStack(x, z) {
  const id = xzKey(x, z);
  let s = STACK_CACHE.get(id);
  if (s !== undefined) return s;
  const yr = columnYRange(x, z);
  const y0 = Math.max(CHUNK_Y_MIN, yr.min - 1);
  const y1 = Math.min(CHUNK_Y_MAX, yr.max + 1);
  const d = columnDesc(x, z);
  const n = Math.max(0, y1 - y0 + 1);
  const arr = new Int32Array(n);
  for (let y = y0; y <= y1; y++) {
    const idk = xyzKey(x, y, z);
    let t;
    const edit = explicitEdits.get(idk);
    if (edit < 0) t = undefined;
    else if (edit != null && edit >= 0) t = edit;
    else {
      const eb = explicitBlocks.get(idk);
      if (eb !== undefined) t = eb;
      else if (explicitAir.has(idk)) t = undefined;
      else t = terrainBlockAtCol(x, y, z, d);
    }
    arr[y - y0] = t === undefined ? 0 : t + 1;
  }
  s = { y0, y1, arr };
  STACK_CACHE.set(id, s);
  return s;
}
function blockAtStack(x, y, z) {
  const s = columnStack(x, z);
  if (y >= s.y0 && y <= s.y1) {
    const v = s.arr[y - s.y0];
    return v === 0 ? undefined : v - 1;
  }
  // 事前計算した縦範囲の外（隣接列の端で稀に起きる）は元ロジックで正確に求める
  const idk = xyzKey(x, y, z);
  const edit = explicitEdits.get(idk);
  if (edit < 0) return undefined;
  if (edit != null && edit >= 0) return edit;
  const eb = explicitBlocks.get(idk);
  if (eb !== undefined) return eb;
  if (explicitAir.has(idk)) return undefined;
  return terrainBlockAtCol(x, y, z, columnDesc(x, z));
}

/* ==== ライトエンジン: skylight/blocklight を BFS で解き、面ごとに頂点カラーへ焼く ====
   - skylight: 列ごとに空から降ろした直射(15)を種にして、段差・洞窟入口へ横 BFS で減衰伝播
   - blocklight: 松明/ランタン/溶岩など lightLevels>0 のセルを種にして全方向 BFS
   - 光量→輝度は本家近似 0.8^(15-L)。ブロックライトは暖色に寄せる
   - 対象チャンクの外周 LIGHT_PAD ブロックまで解く（松明の半径14に対する近似。境界の
     わずかな継ぎ目は隣接チャンクの再メッシュで埋まる） */
const LIGHT_PAD = 6;
const BRIGHT = new Float32Array(16);
for (let i = 0; i <= 15; i++) BRIGHT[i] = Math.pow(0.8, 15 - i);
let LGT = null; // { x0, z0, w, cols: [{ y0, top, f15, sky:Uint8Array, blk:Uint8Array }] }

// stack 値（0=空気, それ以外=種+1）で「光を完全に遮るか」。フルキューブの不透過ブロックのみ遮る。
// ガラス/水/作物/ドア/フェンス等（transparent または model 持ち）は透過。
function lightOpaqueVal(v) {
  return v !== 0 && !transparent[v - 1] && !blockModels[v - 1];
}
// 1ステップの減衰。水/溶岩の中は +1 余分に減る
function lightCostVal(v) {
  if (v === 0) return 1;
  const t = v - 1;
  return (t === WATER || t === LAVA) ? 2 : 1;
}
// 列の占有アクセサ。メッシュ対象（チャンク±1）は正確なスタック、外周パディング列は
// 「高さ場＋海＋明示ブロック(edits/world/air)の上書き」による近似で済ませる。
// 地形ノイズ（waterFeature/洞窟）を外周まで正確に解くとビルドが3倍以上遅くなるため。
// 近似の影響は「チャンク境界の外の洞窟口/川からの光」がわずかにずれる程度で、
// そのセル自体は隣のチャンクが自分のビルドで正確に照らす。
function lightOverlayVal(x, y, z) {
  const idk = xyzKey(x, y, z);
  const edit = explicitEdits.get(idk);
  if (edit < 0) return 0;
  if (edit != null && edit >= 0) return edit + 1;
  const eb = explicitBlocks.get(idk);
  if (eb !== undefined) return eb + 1;
  if (explicitAir.has(idk)) return 0;
  return -1; // 上書きなし
}
function lightColValAt(c, x, y, z) {
  if (c.exact) {
    const s = c.stack;
    if (y > s.y1) return 0;
    if (y >= s.y0) return s.arr[y - s.y0];
    return STONE + 1;
  }
  if (c.ov) {
    const v = lightOverlayVal(x, y, z);
    if (v >= 0) return v;
  }
  if (y <= c.h) return STONE + 1;
  if (y <= SEA) return WATER + 1;
  return 0;
}
function inLightDomain(x, z) {
  return LGT && x >= LGT.x0 && x < LGT.x0 + LGT.w && z >= LGT.z0 && z < LGT.z0 + LGT.w;
}
function getLight(ch, x, y, z) {
  if (!inLightDomain(x, z)) {
    if (ch !== 0) return 0;
    return y > heightAt(x, z) ? 15 : 0;   // 域外は高さだけで近似（面サンプルには使われない）
  }
  const c = LGT.cols[(x - LGT.x0) * LGT.w + (z - LGT.z0)];
  if (y > c.top) return ch === 0 ? 15 : 0;
  if (y < c.y0) return 0;
  return (ch === 0 ? c.sky : c.blk)[y - c.y0];
}

// 列のスカイライト直射を種として敷き、blocklight 光源もキューに積む。
// f15 = 直射15が届いている一番低い y（横伝播が必要な範囲の判定に使う）
function seedLightColumn(x, z, bq, exact) {
  let c;
  if (exact) {
    const s = columnStack(x, z);
    const d = columnDesc(x, z);
    const top = Math.min(CHUNK_Y_MAX + 1, Math.max(s.y1, d.h + 16)); // 面より上を横断する光の通り道ぶん余裕
    c = { exact: true, stack: s, h: d.h, y0: s.y0, top };
  } else {
    const h = heightAt(x, z);
    const b = columnYBounds.get(xzKey(x, z));
    const ov = !!b;
    const y0 = Math.max(CHUNK_Y_MIN, Math.min(b ? b.min - 1 : h, h - 2));
    const top = Math.min(CHUNK_Y_MAX + 1, Math.max(Math.max(h, SEA), b ? b.max + 1 : h) + 16);
    c = { exact: false, ov, h, y0, top };
  }
  const n = c.top - c.y0 + 1;
  const sky = new Uint8Array(n), blk = new Uint8Array(n);
  let cur = 15, f15 = c.top + 1;
  for (let y = c.top; y >= c.y0; y--) {
    const i = y - c.y0;
    const v = lightColValAt(c, x, y, z);
    if (v !== 0) {
      const lv = lightLevels[v - 1] | 0;
      if (lv > 0) { blk[i] = lv; bq.push(x, y, z, lv); }
      if (lightOpaqueVal(v)) { cur = 0; sky[i] = 0; continue; }
      const t = v - 1;
      if (t === WATER || t === LAVA) cur = Math.max(0, cur - 1); // 水中は1ブロックごとに-1
      else if (cur < 15) cur = Math.max(0, cur - 1);             // 直射(15)が崩れた後は下降でも-1
    } else if (cur < 15) {
      cur = Math.max(0, cur - 1);
    }
    if (cur === 15) f15 = y;
    sky[i] = cur;
  }
  c.f15 = f15;
  c.sky = sky;
  c.blk = blk;
  return c;
}

function propagateLight(ch, q) {
  for (let qi = 0; qi < q.length; qi += 4) {
    const x = q[qi], y = q[qi + 1], z = q[qi + 2], l = q[qi + 3];
    if (getLight(ch, x, y, z) !== l) continue; // より明るい値で上書き済み
    spreadLight(ch, q, x + 1, y, z, l);
    spreadLight(ch, q, x - 1, y, z, l);
    spreadLight(ch, q, x, y + 1, z, l);
    spreadLight(ch, q, x, y - 1, z, l);
    spreadLight(ch, q, x, y, z + 1, l);
    spreadLight(ch, q, x, y, z - 1, l);
  }
}
function spreadLight(ch, q, x, y, z, l) {
  if (!inLightDomain(x, z)) return;
  const c = LGT.cols[(x - LGT.x0) * LGT.w + (z - LGT.z0)];
  if (y < c.y0 || y > c.top) return;
  const v = lightColValAt(c, x, y, z);
  if (lightOpaqueVal(v)) return;
  const nl = l - lightCostVal(v);
  if (nl <= 0) return;
  const arr = ch === 0 ? c.sky : c.blk;
  const i = y - c.y0;
  if (arr[i] >= nl) return;
  arr[i] = nl;
  q.push(x, y, z, nl);
}

function computeLighting(cx, cz) {
  const x0 = cx * CHUNK_SIZE - LIGHT_PAD, z0 = cz * CHUNK_SIZE - LIGHT_PAD;
  const w = CHUNK_SIZE + LIGHT_PAD * 2;
  // メッシュが実際にサンプルする チャンク±1 は正確な地形スタック、その外の
  // パディング列は近似（コメント参照）で光だけ通す
  const ex0 = cx * CHUNK_SIZE - 1, ex1 = cx * CHUNK_SIZE + CHUNK_SIZE;
  const ez0 = cz * CHUNK_SIZE - 1, ez1 = cz * CHUNK_SIZE + CHUNK_SIZE;
  LGT = { x0, z0, w, cols: new Array(w * w) };
  const bq = [];
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + w; z++) {
    const exact = x >= ex0 && x <= ex1 && z >= ez0 && z <= ez1;
    LGT.cols[(x - x0) * w + (z - z0)] = seedLightColumn(x, z, bq, exact);
  }
  // skylight の横伝播が必要なセルだけ種に積む。
  // (a) 直射15のセルは「隣の列の f15 が自分より高い」高さ帯だけが境界（平地では何も積まれない）
  // (b) 直射が崩れた後の 2..14 のセル（水中・洞窟の入り口下など）は数が少ないので個別に判定
  const sq = [];
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + w; z++) {
    const c = LGT.cols[(x - x0) * w + (z - z0)];
    const nf = (nx, nz) => {
      if (nx < x0 || nx >= x0 + w || nz < z0 || nz >= z0 + w) return c.f15; // 域外は同高扱い＝境界にしない
      return LGT.cols[(nx - x0) * w + (nz - z0)].f15;
    };
    const maxNeighborF15 = Math.max(nf(x + 1, z), nf(x - 1, z), nf(x, z + 1), nf(x, z - 1));
    const upTo = Math.min(c.top, maxNeighborF15 - 1);
    for (let y = c.f15; y <= upTo; y++) {
      if (c.sky[y - c.y0] === 15) sq.push(x, y, z, 15);
    }
    // f15 より下の減衰帯（水中/庇の下）: 直下・水平の暗い隣へだけ種を積む
    for (let y = Math.min(c.f15 - 1, c.top); y >= c.y0; y--) {
      const s = c.sky[y - c.y0];
      if (s < 2) continue;
      if (getLight(0, x + 1, y, z) < s - 1 || getLight(0, x - 1, y, z) < s - 1 ||
          getLight(0, x, y, z + 1) < s - 1 || getLight(0, x, y, z - 1) < s - 1 ||
          getLight(0, x, y - 1, z) < s - 1) sq.push(x, y, z, s);
    }
  }
  propagateLight(0, sq);
  propagateLight(1, bq);
}

// 面が接する空気側セルの光 → 頂点属性 [空チャンネル輝度, ブロック光チャンネル輝度]。
// 暖色化と max 合成はシェーダー側（24-instanced-meshes.js の applyChunkLightShader）で行う
function sampleFaceLight(x, y, z) {
  return [BRIGHT[getLight(0, x, y, z)], BRIGHT[getLight(1, x, y, z)]];
}

function occludes(x, y, z, self) {
  const nt = blockAtStack(x, y, z);
  if (nt === undefined) return false;
  if (!transparent[nt]) return true;
  return nt === self;
}
function faceVisible(x, y, z, t, f) {
  const n = FACE_DEFS[f].n;
  return !occludes(x + n[0], y + n[1], z + n[2], t);
}

function makeMeshBuildState() {
  return Array.from({ length: typeCount }, (_, i) => {
    const groupCount = groupCounts[i] || 1;
    return {
      positions: Array.from({ length: groupCount }, () => []),
      normals: Array.from({ length: groupCount }, () => []),
      uvs: Array.from({ length: groupCount }, () => []),
      lights: Array.from({ length: groupCount }, () => []),
      indices: Array.from({ length: groupCount }, () => []),
      blocks: 0,
    };
  });
}

const FULL_LIGHT = [1, 0];
function addQuadToState(state, verts, normal, uvCoords, mat = 0, sb = FULL_LIGHT) {
  const group = state.positions.length === 1 ? 0 : Math.max(0, Math.min(state.positions.length - 1, mat | 0));
  const pos = state.positions[group], norm = state.normals[group], uv = state.uvs[group], idx = state.indices[group];
  const lig = state.lights[group];
  const base = pos.length / 3;
  for (const p of verts) {
    pos.push(p[0], p[1], p[2]);
    norm.push(normal[0], normal[1], normal[2]);
    lig.push(sb[0], sb[1]);
  }
  uv.push(...uvCoords);
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function addBlockFaceToState(state, x, y, z, f) {
  const fd = FACE_DEFS[f];
  const rgb = sampleFaceLight(x + fd.n[0], y + fd.n[1], z + fd.n[2]);
  addQuadToState(state, fd.v.map(p => [x + p[0], y + p[1], z + p[2]]), fd.n, fd.uv, fd.m, rgb);
}

function addBoxPartToState(state, x, y, z, part, rgb) {
  const b = part && part.box;
  if (!b || b.length < 6) return false;
  const x0 = x + b[0], y0 = y + b[1], z0 = z + b[2];
  const x1 = x + b[3], y1 = y + b[4], z1 = z + b[5];
  if (x1 <= x0 || y1 <= y0 || z1 <= z0) return false;
  const uvCoords = part.uv || FACE_DEFS[0].uv;
  const faces = [
    [[x1,y0,z0], [x1,y1,z0], [x1,y1,z1], [x1,y0,z1]],
    [[x0,y0,z0], [x0,y0,z1], [x0,y1,z1], [x0,y1,z0]],
    [[x0,y1,z0], [x0,y1,z1], [x1,y1,z1], [x1,y1,z0]],
    [[x0,y0,z0], [x1,y0,z0], [x1,y0,z1], [x0,y0,z1]],
    [[x0,y0,z1], [x1,y0,z1], [x1,y1,z1], [x0,y1,z1]],
    [[x0,y0,z0], [x0,y1,z0], [x1,y1,z0], [x1,y0,z0]],
  ];
  for (let f = 0; f < FACE_DEFS.length; f++) {
    const fd = FACE_DEFS[f];
    addQuadToState(state, faces[f], fd.n, uvCoords, part.mat ?? fd.m, rgb);
  }
  return true;
}

function addCrossPartToState(state, x, y, z, part, rgb) {
  const r = part.r ?? 0.5;
  const y0 = y + (part.y0 ?? 0);
  const y1 = y + (part.y1 ?? 1);
  const cx = x + 0.5, cz = z + 0.5;
  const uvCoords = part.uv || FACE_DEFS[0].uv;
  const m = part.mat ?? 0;
  const d = Math.SQRT1_2;
  addQuadToState(state, [[cx - r,y0,cz - r], [cx - r,y1,cz - r], [cx + r,y1,cz + r], [cx + r,y0,cz + r]], [-d, 0, d], uvCoords, m, rgb);
  addQuadToState(state, [[cx - r,y0,cz + r], [cx - r,y1,cz + r], [cx + r,y1,cz - r], [cx + r,y0,cz - r]], [d, 0, d], uvCoords, m, rgb);
  return true;
}

function addModelToState(state, x, y, z, model) {
  // モデルパーツ（松明/ドア/フェンス等）は自セルの光でフラットに照らす
  const rgb = sampleFaceLight(x, y, z);
  let added = false;
  for (const part of model) {
    if (part.kind === 'cross') added = addCrossPartToState(state, x, y, z, part, rgb) || added;
    else added = addBoxPartToState(state, x, y, z, part, rgb) || added;
  }
  if (added) state.blocks++;
}

function addBlockToState(build, x, y, z, t) {
  const state = build[t];
  if (!state) return;
  const model = blockModels[t];
  if (model) {
    addModelToState(state, x, y, z, model);
    return;
  }
  let added = false;
  for (let f = 0; f < FACE_DEFS.length; f++) {
    if (!faceVisible(x, y, z, t, f)) continue;
    addBlockFaceToState(state, x, y, z, f);
    added = true;
  }
  if (added) state.blocks++;
}

function buildChunkState(cx, cz) {
  COL_CACHE = new Map();
  STACK_CACHE = new Map();
  computeLighting(cx, cz);
  const build = makeMeshBuildState();
  const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
  const x1 = x0 + CHUNK_SIZE - 1, z1 = z0 + CHUNK_SIZE - 1;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const s = columnStack(x, z);
    const y0 = s.y0, arr = s.arr;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (v === 0) continue;
      addBlockToState(build, x, y0 + i, z, v - 1);
    }
  }
  return build;
}

function packTypeState(state) {
  let positionCount = 0, normalCount = 0, uvCount = 0, lightCount = 0, indexCount = 0;
  for (let g = 0; g < state.positions.length; g++) {
    positionCount += state.positions[g].length;
    normalCount += state.normals[g].length;
    uvCount += state.uvs[g].length;
    lightCount += state.lights[g].length;
    indexCount += state.indices[g].length;
  }
  const positions = new Float32Array(positionCount);
  const normals = new Float32Array(normalCount);
  const uvs = new Float32Array(uvCount);
  const lights = new Float32Array(lightCount);
  const indices = new Uint32Array(indexCount);
  const groups = [];
  let po = 0, no = 0, uo = 0, lo = 0, io = 0, vertexOffset = 0;
  for (let g = 0; g < state.positions.length; g++) {
    const gp = state.positions[g];
    if (!gp.length) continue;
    const gn = state.normals[g], gu = state.uvs[g], gl = state.lights[g], gi = state.indices[g];
    positions.set(gp, po);
    normals.set(gn, no);
    uvs.set(gu, uo);
    lights.set(gl, lo);
    for (let i = 0; i < gi.length; i++) indices[io + i] = gi[i] + vertexOffset;
    groups.push({ start: io, count: gi.length, material: g });
    po += gp.length;
    no += gn.length;
    uo += gu.length;
    lo += gl.length;
    io += gi.length;
    vertexOffset += gp.length / 3;
  }
  return {
    positions: positions.buffer,
    normals: normals.buffer,
    uvs: uvs.buffer,
    lights: lights.buffer,
    indices: indices.buffer,
    groups,
    blocks: state.blocks,
  };
}

function packBuildState(build) {
  return { parts: build.map(packTypeState) };
}

function noteColumnY(x, y, z) {
  const id = xzKey(x, z);
  const b = columnYBounds.get(id);
  if (b) {
    if (y < b.min) b.min = y;
    if (y > b.max) b.max = y;
  } else {
    columnYBounds.set(id, { min: y, max: y });
  }
}

function loadPayload(payload) {
  WORLD_SEED = payload.seed || 1;
  CHUNK_SIZE = payload.chunkSize || 24;
  CHUNK_Y_MIN = payload.yMin ?? -64;
  CHUNK_Y_MAX = payload.yMax ?? 319;
  typeCount = payload.typeCount || 0;
  transparent = payload.transparent || [];
  groupCounts = payload.groupCounts || [];
  blockModels = payload.blockModels || [];
  lightLevels = payload.lightLevels || [];
  explicitBlocks = new Map();
  explicitAir = new Set();
  explicitEdits = new Map();
  blockedColumns = new Set();
  columnYBounds = new Map();
  HEIGHT_CACHE = new Map();
  RAW_HEIGHT_CACHE = new Map();
  _fuji = null;
  initPerm(WORLD_SEED);

  const blocks = payload.blocks || [];
  for (let i = 0; i < blocks.length; i += 4) {
    explicitBlocks.set(xyzKey(blocks[i], blocks[i + 1], blocks[i + 2]), blocks[i + 3]);
    noteColumnY(blocks[i], blocks[i + 1], blocks[i + 2]);
  }
  const airs = payload.airs || [];
  for (let i = 0; i < airs.length; i += 3) {
    explicitAir.add(xyzKey(airs[i], airs[i + 1], airs[i + 2]));
    noteColumnY(airs[i], airs[i + 1], airs[i + 2]);
  }
  const edits = payload.edits || [];
  for (let i = 0; i < edits.length; i += 4) {
    explicitEdits.set(xyzKey(edits[i], edits[i + 1], edits[i + 2]), edits[i + 3]);
    noteColumnY(edits[i], edits[i + 1], edits[i + 2]);
  }
  const blocked = payload.blockedColumns || [];
  for (let i = 0; i < blocked.length; i += 2) blockedColumns.add(xzKey(blocked[i], blocked[i + 1]));
}

self.onmessage = (ev) => {
  const msg = ev.data || {};
  try {
    const t0 = performance.now();
    loadPayload(msg.payload || {});
    const packed = packBuildState(buildChunkState(msg.payload.cx, msg.payload.cz));
    const ms = performance.now() - t0;
    let probeLight = null;
    const pr = msg.payload.probe;
    if (pr && Array.isArray(pr.cells)) {
      probeLight = { cx: msg.payload.cx, cz: msg.payload.cz, cells: [] };
      for (const [px, py, pz] of pr.cells) {
        if (!inLightDomain(px, pz)) { probeLight.cells.push(null); continue; }
        const c = LGT.cols[(px - LGT.x0) * LGT.w + (pz - LGT.z0)];
        probeLight.cells.push({
          p: [px, py, pz], exact: !!c.exact,
          sky: getLight(0, px, py, pz), blk: getLight(1, px, py, pz),
          val: lightColValAt(c, px, py, pz), f15: c.f15,
        });
      }
    }
    const transfers = [];
    for (const part of packed.parts) transfers.push(part.positions, part.normals, part.uvs, part.lights, part.indices);
    self.postMessage({ id: msg.id, packed, ms, probeLight }, transfers);
  } catch (err) {
    self.postMessage({ id: msg.id, error: err && err.message ? err.message : String(err) });
  }
};
