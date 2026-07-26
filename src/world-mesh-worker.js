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
const BEDROCK = 74, DEEPSLATE = 75, REDSTONE_ORE = 104, GRAVEL = 146; // 22-block-types.js の同名定数と一致させること
const SEA = 8, SNOW_LINE = 30, ROCK_LINE = 23;
const SPAWN_GROUND_Y = 12, SPAWN_FLAT_R = 28, SPAWN_CLEAR_R = 38;

let WORLD_SEED = 1;
let CHUNK_SIZE = 24, CHUNK_Y_MIN = -64, CHUNK_Y_MAX = 319;
let typeCount = 0;
let transparent = [];
let groupCounts = [];
let blockModels = [];
let lightLevels = [];
let liquidLevels = null; // "x,y,z" -> lv(0-7)。シム液体の可変水面高（C8）
let wireLevels = null;   // "x,y,z" -> 0-15。RSワイヤの信号強度（明度に反映、C15）
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

// 岩盤: Y=-64 は全マス、-63〜-60 は上に行くほど薄くなるハッシュ混在（本家1.18風）。破壊不可
function bedrockAt(x, y, z) {
  if (y <= CHUNK_Y_MIN) return true;
  const d = y - CHUNK_Y_MIN; // 1..4
  if (d > 4) return false;
  return hash2(x * 3.7 + y * 11.3, z * 5.1 - y * 7.7) < 1 - d * 0.2; // 80/60/40/20%
}
// 深層の基本石: y<0 は深層岩、y=0..8 は石との遷移帯（本家の深層岩帯）
function baseStoneAt(x, y, z) {
  if (y >= 8) return STONE;
  if (y < 0) return DEEPSLATE;
  return hash2(x * 2.3 - y * 3.1, z * 2.9 + y * 1.7) < (8 - y) / 9 ? DEEPSLATE : STONE;
}
function oreTypeAt(x, y, z, h) {
  if (bedrockAt(x, y, z)) return BEDROCK;
  if (y >= h - 4 || y <= CHUNK_Y_MIN + 1) return baseStoneAt(x, y, z);
  const speck = hash2(x * 3.17 + y * 0.91, z * 2.73 - y * 0.47);
  if (speck < 0.73) return baseStoneAt(x, y, z);
  const vein = fbm3(x * 0.075 + 40, y * 0.115 - 17, z * 0.075 + 90, 3, 0.56);
  const broad = fbm3(x * 0.030 - 220, y * 0.045 + 180, z * 0.030 + 60, 2, 0.55);
  const oreBand = vein + broad * 0.45;
  const deep = y <= -32 ? 0.080 : y <= -8 ? 0.060 : y <= 11 ? 0.035 : 0;
  if (y <= 13 && oreBand > 0.48 - deep && speck > 0.955 - deep) return DIAMOND_ORE;
  if (y <= 24 && oreBand > 0.40 - deep && speck > 0.915 - deep) return GOLD_ORE;
  if (y <= 15 && oreBand > 0.34 && speck > 0.875) return REDSTONE_ORE; // 本家準拠: y<16。32-world-window.js と完全同一に保つこと
  if (y <= 44 && oreBand > 0.30 && speck > 0.84) return IRON_ORE;
  // 砂利: 地中にまばらな塊（C14）。32-world-window.js と完全同一に保つこと
  if (oreBand > 0.26 && speck > 0.79 && speck < 0.815) return GRAVEL;
  if (y <= h - 5 && oreBand > 0.20 && speck > 0.75) return COAL_ORE;
  return baseStoneAt(x, y, z);
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
  // 洞窟がありうる列（caveRegion > -0.20。境界の滑らかさぶん -0.26 まで余裕を持つ）は
  // 最下層まで走査して深部の洞窟壁を欠けなく描画する。洞窟が生成されない列は
  // 従来どおり浅く打ち切って走査コストを抑える（32-world-window.js 側と同じ規則）
  const naturalMin = d.caveRegion > -0.26 ? CHUNK_Y_MIN : Math.max(CHUNK_Y_MIN, Math.min(h, SEA) - 24);
  const naturalMax = Math.min(CHUNK_Y_MAX, Math.max(h, SEA, wf && wf.fallTop != null ? wf.fallTop : h));
  const b = columnYBounds.get(xzKey(x, z));
  if (!b) return { min: naturalMin, max: naturalMax };
  return { min: Math.min(naturalMin, b.min), max: Math.max(naturalMax, b.max) };
}

// 列ごとにブロック種を1回だけ計算して密な配列に詰める（0=空気, それ以外=種+1）。
// メッシュ本体の走査も隣接面のオクルージョン判定も、この配列から読むだけになる。
// 深層（従来の走査下限より下）のソリッドは UNRESOLVED を置き、種類の確定（鉱石ノイズ等）を
// 「面が見えるセル」だけに遅延する。UNRESOLVED は透過表・モデル表の範囲外なので、
// オクルージョン/ライト計算では自然に不透明ソリッドとして扱われる。
const UNRESOLVED = 0x7fff;
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
  const b = columnYBounds.get(id);
  const deepCut = Math.min(d.h, SEA) - 24; // ここより下が「深層」
  for (let y = y0; y <= y1; y++) {
    let t;
    if (y < deepCut && (!b || y < b.min || y > b.max)) {
      // 深層かつ明示ブロックの範囲外: 洞窟（空気）かどうかだけ確定する
      const cave = !d.fuji && d.caveRegion > -0.20 && isCaveAt(x, y, z, d.h, d.caveRegion);
      arr[y - y0] = cave ? 0 : UNRESOLVED;
      continue;
    }
    const idk = xyzKey(x, y, z);
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

/* ==== スムースライティング + AO（本家式。キューブ面のみ。モデルパーツは自セルのフラット） ====
   面の4頂点それぞれについて、空気側セル層の「頂点を共有する4セル」（自セル+側面2+角1）の光を平均し、
   側面/角の遮蔽数から AO 段階(0-3)を出して係数を掛ける。side1&&side2 のとき角は見えないので除外し AO=3。 */
const AO_MUL = [1.0, 0.8, 0.65, 0.5];
let SAMPLE_CACHE = null; // ビルド内のセルサンプルメモ（同じセルを最大12頂点が参照する）
// 戻り値はパック整数: sky(0-15) | blk<<4 | opaque<<8（Mapへのオブジェクト格納を避けて高速化）
function cellSample(x, y, z) {
  const w = LGT.w;
  const ix = x - LGT.x0, iz = z - LGT.z0;
  if (ix < 0 || ix >= w || iz < 0 || iz >= w || y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) {
    return y > heightAt(x, z) ? 15 : 0; // 域外は高さだけで近似（チャンク端の頂点のみ到達）
  }
  const key = (ix * w + iz) * 400 + (y - CHUNK_Y_MIN);
  let pk = SAMPLE_CACHE.get(key);
  if (pk !== undefined) return pk;
  const c = LGT.cols[ix * w + iz];
  let s, b;
  if (y > c.top) { s = 15; b = 0; }
  else if (y < c.y0) { s = 0; b = 0; }
  else { const i = y - c.y0; s = c.sky[i]; b = c.blk[i]; }
  pk = s | (b << 4) | (lightOpaqueVal(lightColValAt(c, x, y, z)) ? 256 : 0);
  SAMPLE_CACHE.set(key, pk);
  return pk;
}
function vertexLightAO(ax, ay, az, dx1, dy1, dz1, dx2, dy2, dz2, out, oi) {
  const p0 = cellSample(ax, ay, az);
  const p1 = cellSample(ax + dx1, ay + dy1, az + dz1);
  const p2 = cellSample(ax + dx2, ay + dy2, az + dz2);
  const o1 = p1 & 256, o2 = p2 & 256;
  let s = BRIGHT[p0 & 15], b = BRIGHT[(p0 >> 4) & 15], n = 1, ao;
  if (o1 && o2) {
    ao = 3; // 両側面が塞がっていると角は見えない
  } else {
    const p3 = cellSample(ax + dx1 + dx2, ay + dy1 + dy2, az + dz1 + dz2);
    const o3 = p3 & 256;
    ao = (o1 ? 1 : 0) + (o2 ? 1 : 0) + (o3 ? 1 : 0);
    if (!o3) { s += BRIGHT[p3 & 15]; b += BRIGHT[(p3 >> 4) & 15]; n++; }
  }
  if (!o1) { s += BRIGHT[p1 & 15]; b += BRIGHT[(p1 >> 4) & 15]; n++; }
  if (!o2) { s += BRIGHT[p2 & 15]; b += BRIGHT[(p2 >> 4) & 15]; n++; }
  const m = AO_MUL[ao] / n;
  out[oi] = s * m;
  out[oi + 1] = b * m;
}
// 面ごと・頂点ごとの接線方向オフセット [dx1,dy1,dz1,dx2,dy2,dz2] を事前計算（頂点単位の配列生成を避ける）
const FACE_CORNERS = FACE_DEFS.map(fd => {
  const nAxis = fd.n[0] !== 0 ? 0 : fd.n[1] !== 0 ? 1 : 2;
  const t = [0, 1, 2].filter(a => a !== nAxis);
  return fd.v.map(p => {
    const d1 = [0, 0, 0], d2 = [0, 0, 0];
    d1[t[0]] = p[t[0]] === 1 ? 1 : -1;
    d2[t[1]] = p[t[1]] === 1 ? 1 : -1;
    return [d1[0], d1[1], d1[2], d2[0], d2[1], d2[2]];
  });
});
const SB8 = new Float64Array(8); // addBlockFaceToState 用の頂点光スクラッチ

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
// sb: 長さ2=[s,b]（4頂点共通のフラット、モデルパーツ用） / 長さ8=頂点ごと（スムースライティング）。
// flip=true で四角形の対角分割を反転（AO異方性のチェッカーボード対策）
function addQuadToState(state, verts, normal, uvCoords, mat = 0, sb = FULL_LIGHT, flip = false) {
  const group = state.positions.length === 1 ? 0 : Math.max(0, Math.min(state.positions.length - 1, mat | 0));
  const pos = state.positions[group], norm = state.normals[group], uv = state.uvs[group], idx = state.indices[group];
  const lig = state.lights[group];
  const base = pos.length / 3;
  const perVertex = sb.length === 8;
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i];
    pos.push(p[0], p[1], p[2]);
    norm.push(normal[0], normal[1], normal[2]);
    if (perVertex) lig.push(sb[i * 2], sb[i * 2 + 1]);
    else lig.push(sb[0], sb[1]);
  }
  uv.push(...uvCoords);
  if (flip) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
  else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function addBlockFaceToState(state, x, y, z, f, topY = 1) {
  const fd = FACE_DEFS[f], corners = FACE_CORNERS[f];
  const ax = x + fd.n[0], ay = y + fd.n[1], az = z + fd.n[2];
  for (let i = 0; i < 4; i++) {
    const c = corners[i];
    vertexLightAO(ax, ay, az, c[0], c[1], c[2], c[3], c[4], c[5], SB8, i * 2);
  }
  // 明暗差が小さい対角で三角形を分割する
  const t0 = SB8[0] + SB8[1], t1 = SB8[2] + SB8[3], t2 = SB8[4] + SB8[5], t3 = SB8[6] + SB8[7];
  const flip = Math.abs(t0 - t2) > Math.abs(t1 - t3);
  addQuadToState(state, fd.v.map(p => [x + p[0], y + (p[1] === 1 ? topY : p[1]), z + p[2]]), fd.n, fd.uv, fd.m, SB8, flip);
}

function addBoxPartToState(state, x, y, z, part, rgb) {
  const b = part && part.box;
  if (!b || b.length < 6) return false;
  const x0 = x + b[0], y0 = y + b[1], z0 = z + b[2];
  const x1 = x + b[3], y1 = y + b[4], z1 = z + b[5];
  if (x1 <= x0 || y1 <= y0 || z1 <= z0) return false;
  // UVは面ごと（FACE_DEFS[f].uv）を使う（34-mesh-rebuild.js と同じ規則）。
  // 1種類のUVを全面に使い回すと面1(-x)と面4(+z)でu,vが入れ替わり絵柄が90度回る
  const uvCoords = part.uv || null;
  const faces = [
    [[x1,y0,z0], [x1,y1,z0], [x1,y1,z1], [x1,y0,z1]],
    [[x0,y0,z0], [x0,y0,z1], [x0,y1,z1], [x0,y1,z0]],
    [[x0,y1,z0], [x0,y1,z1], [x1,y1,z1], [x1,y1,z0]],
    [[x0,y0,z0], [x1,y0,z0], [x1,y0,z1], [x0,y0,z1]],
    [[x0,y0,z1], [x1,y0,z1], [x1,y1,z1], [x0,y1,z1]],
    [[x0,y0,z0], [x0,y1,z0], [x1,y1,z0], [x1,y0,z0]],
  ];
  // part.rot: ブロックローカルの origin まわりに1軸だけ回す（34-mesh-rebuild.js と同じ規則）
  const norms = applyPartRotation(part, faces, x, y, z);
  for (let f = 0; f < FACE_DEFS.length; f++) {
    const fd = FACE_DEFS[f];
    addQuadToState(state, faces[f], norms ? norms[f] : fd.n, uvCoords || fd.uv, part.mat ?? fd.m, rgb);
  }
  return true;
}
// faces を破壊的に回し、回転後の面法線を返す（回転が無ければ null）
function applyPartRotation(part, faces, x, y, z) {
  const rot = part && part.rot;
  if (!rot) return null;
  const c = Math.cos(rot.angle), s = Math.sin(rot.angle);
  const ox = x + rot.origin[0], oy = y + rot.origin[1], oz = z + rot.origin[2];
  const rv = rot.axis === 'z' ? (a, b, d) => [a * c - b * s, a * s + b * c, d]
    : rot.axis === 'x' ? (a, b, d) => [a, b * c - d * s, b * s + d * c]
      : (a, b, d) => [a * c + d * s, b, -a * s + d * c];
  for (let f = 0; f < faces.length; f++) {
    faces[f] = faces[f].map(p => {
      const r = rv(p[0] - ox, p[1] - oy, p[2] - oz);
      return [ox + r[0], oy + r[1], oz + r[2]];
    });
  }
  return FACE_DEFS.map(fd => rv(fd.n[0], fd.n[1], fd.n[2]));
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
  let rgb = sampleFaceLight(x, y, z);
  // RSワイヤは信号強度で赤の明度を変える（blockライトチャンネルを持ち上げると暖色に光って見える）
  const wl = wireLevels ? wireLevels.get(x + ',' + y + ',' + z) : undefined;
  if (wl !== undefined) rgb = [rgb[0] * 0.5, Math.max(rgb[1], 0.10 + 0.90 * (wl / 15))];
  let added = false;
  for (const part of model) {
    if (part.kind === 'cross') added = addCrossPartToState(state, x, y, z, part, rgb) || added;
    else added = addBoxPartToState(state, x, y, z, part, rgb) || added;
  }
  if (added) state.blocks++;
}

// シム管理下の液体セル: レベルに応じて上面を (8-lv)/9 に下げて描く（上に同液体が乗る滝の柱は満杯）
function addLiquidBlockToState(state, x, y, z, t, lv) {
  const above = blockAtStack(x, y + 1, z);
  const topH = (above === t) ? 1 : Math.max(1 / 9, (8 - lv) / 9);
  let added = false;
  for (let f = 0; f < FACE_DEFS.length; f++) {
    if (f === 3 && y === CHUNK_Y_MIN) continue;
    if (f === 2) { if (above === t) continue; } // 上面: 高さが下がるので同液体が乗る時以外は常に描く
    else if (!faceVisible(x, y, z, t, f)) continue;
    addBlockFaceToState(state, x, y, z, f, topH);
    added = true;
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
  const liqLv = liquidLevels ? liquidLevels.get(x + ',' + y + ',' + z) : undefined;
  if (liqLv !== undefined) {
    addLiquidBlockToState(state, x, y, z, t, liqLv);
    return;
  }
  let added = false;
  for (let f = 0; f < FACE_DEFS.length; f++) {
    if (f === 3 && y === CHUNK_Y_MIN) continue; // ワールド最下面（岩盤の底）は描かない
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
  SAMPLE_CACHE = new Map();
  const build = makeMeshBuildState();
  const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
  const x1 = x0 + CHUNK_SIZE - 1, z1 = z0 + CHUNK_SIZE - 1;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const s = columnStack(x, z);
    const y0 = s.y0, arr = s.arr;
    for (let i = 0; i < arr.length; i++) {
      let v = arr[i];
      if (v === 0) continue;
      const y = y0 + i;
      if (v === UNRESOLVED) {
        // 深層の遅延ソリッド: どこかの面が見える場合だけ種類（鉱石/深層岩/岩盤）を確定する
        let vis = false;
        for (let f = 0; f < FACE_DEFS.length && !vis; f++) {
          if (f === 3 && y === CHUNK_Y_MIN) continue;
          vis = faceVisible(x, y, z, -1, f);
        }
        if (!vis) continue;
        v = oreTypeAt(x, y, z, columnDesc(x, z).h) + 1;
        arr[i] = v; // 確定値を書き戻す（以後の参照はこの値）
      }
      addBlockToState(build, x, y, z, v - 1);
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
  liquidLevels = new Map();
  const lc = payload.liquidCells || [];
  for (let i = 0; i < lc.length; i += 4) liquidLevels.set(lc[i] + ',' + lc[i + 1] + ',' + lc[i + 2], lc[i + 3]);
  wireLevels = new Map();
  const wc = payload.wireCells || [];
  for (let i = 0; i < wc.length; i += 4) wireLevels.set(wc[i] + ',' + wc[i + 1] + ',' + wc[i + 2], wc[i + 3]);
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

// 直近の computeLighting(=LGT) から、対象チャンク(16x16列)の焼き込み済み光値を取り出し、
// メインスレッドがモブ湧き判定に使えるコンパクトなグリッドにする。
// 各セル1バイト = (sky<<4 | blk)。y0..y1 は当チャンク列の光域の和集合。
function extractChunkLight(cx, cz) {
  const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
  let y0 = Infinity, y1 = -Infinity;
  for (let x = x0; x < x0 + CHUNK_SIZE; x++) for (let z = z0; z < z0 + CHUNK_SIZE; z++) {
    const c = LGT.cols[(x - LGT.x0) * LGT.w + (z - LGT.z0)];
    if (c.y0 < y0) y0 = c.y0;
    if (c.top > y1) y1 = c.top;
  }
  if (!isFinite(y0) || y1 < y0) { y0 = 0; y1 = 0; }
  const h = y1 - y0 + 1;
  const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * h);
  for (let y = y0; y <= y1; y++) {
    const yo = (y - y0) * (CHUNK_SIZE * CHUNK_SIZE);
    for (let x = x0; x < x0 + CHUNK_SIZE; x++) for (let z = z0; z < z0 + CHUNK_SIZE; z++) {
      const sky = getLight(0, x, y, z), blk = getLight(1, x, y, z);
      data[yo + (x - x0) * CHUNK_SIZE + (z - z0)] = ((sky > 15 ? 15 : sky) << 4) | (blk > 15 ? 15 : blk);
    }
  }
  return { x0, z0, y0, y1, data: data.buffer };
}

self.onmessage = (ev) => {
  const msg = ev.data || {};
  try {
    const t0 = performance.now();
    loadPayload(msg.payload || {});
    const packed = packBuildState(buildChunkState(msg.payload.cx, msg.payload.cz));
    packed.light = extractChunkLight(msg.payload.cx, msg.payload.cz);
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
    if (packed.light && packed.light.data) transfers.push(packed.light.data);
    self.postMessage({ id: msg.id, packed, ms, probeLight }, transfers);
  } catch (err) {
    self.postMessage({ id: msg.id, error: err && err.message ? err.message : String(err) });
  }
};
