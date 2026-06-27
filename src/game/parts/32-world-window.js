  /* ============== ワールド生成（バイオーム / 地下 / 構造物 / スライディング窓） ============== */
  const world = new Map();
  const edits = new Map();   // プレイヤー編集を永続化: "x,y,z" -> type | -1(空気)
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const isSolid = (x, y, z) => { const t = world.get(key(x, y, z)); return t !== undefined && TYPES[t].solid !== false; };
  function setBlock(x, y, z, type) { if (type == null) world.delete(key(x, y, z)); else world.set(key(x, y, z), type); }
  const EDITS_STORAGE_KEY = `mc_edits_${WORLD_SEED}`;
  function loadSavedEdits() {
    try {
      const raw = localStorage.getItem(EDITS_STORAGE_KEY); if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (const [k, v] of arr) if (typeof k === 'string' && Number.isFinite(+v)) edits.set(k, +v);
    } catch (e) {}
  }
  function saveEditsSoon() {
    clearTimeout(saveEditsSoon.t);
    saveEditsSoon.t = setTimeout(() => {
      try { localStorage.setItem(EDITS_STORAGE_KEY, JSON.stringify([...edits])); } catch (e) {}
    }, 180);
  }
  loadSavedEdits();

  const SEA = 8, SNOW_LINE = 30, ROCK_LINE = 23;
  const SPAWN_GROUND_Y = 12, SPAWN_FLAT_R = 28, SPAWN_CLEAR_R = 38;
  const distFromSpawn = (x, z) => Math.hypot(x, z);
  const inSpawnClearing = (x, z, r = SPAWN_CLEAR_R) => distFromSpawn(x, z) <= r;
  const HEIGHT_CACHE = new Map();
  const RAW_HEIGHT_CACHE = new Map();

  const BIOMES = {
    plains: { id: 'plains', label: '草原', base: 4, height: 27, ridge: 4, tree: 0.012, flower: 1.0 },
    forest: { id: 'forest', label: '森林', base: 5, height: 30, ridge: 5, tree: 0.045, flower: 0.8 },
    desert: { id: 'desert', label: '砂漠', base: 5, height: 14, ridge: 2, tree: 0.002, flower: 0.15 },
    highlands: { id: 'highlands', label: '高地', base: 7, height: 18, ridge: 4, tree: 0.010, flower: 0.45 },
    snowfield: { id: 'snowfield', label: '雪原', base: 9, height: 18, ridge: 3, tree: 0.006, flower: 0.08 },
    swamp: { id: 'swamp', label: '沼地', base: 3, height: 8, ridge: 1, tree: 0.03, flower: 0.3 },
    jungle: { id: 'jungle', label: 'ジャングル', base: 5, height: 26, ridge: 5, tree: 0.06, flower: 0.7 },
    volcano: { id: 'volcano', label: '火山', base: 11, height: 33, ridge: 8, tree: 0.004, flower: 0.05 },
  };

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
  function biomeLabelAt(x, z) { return biomeAt(x, z).label; }

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
    const broad = Math.pow(THREE.MathUtils.clamp(p.continent, 0, 1), biome.id === 'desert' ? 2.4 : 1.55);
    const rolling = Math.pow(THREE.MathUtils.clamp(p.rolling, 0, 1), 1.2);
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
      natural = SEA + (broad * 3 + p.detail * 0.9); // ほぼ平ら・水面付近
    } else if (biome.id === 'jungle') {
      natural += p.rough * 2.5 + p.ridge * 2;
    } else if (biome.id === 'volcano') {
      natural += p.ridge * 8 + Math.max(0, p.rough) * 3; // 高い山体
    } else {
      natural += p.ridge * 4.5;
    }
    natural = THREE.MathUtils.clamp(natural, 3, 32);
    const d = distFromSpawn(x, z);
    if (d <= SPAWN_FLAT_R) return SPAWN_GROUND_Y;
    if (d < SPAWN_CLEAR_R) {
      const t = THREE.MathUtils.smoothstep((d - SPAWN_FLAT_R) / (SPAWN_CLEAR_R - SPAWN_FLAT_R), 0, 1);
      return lerp(SPAWN_GROUND_Y, natural, t);
    }
    return natural;
  }

  function terrainHeightRawCached(x, z) {
    const id = `${x},${z}`;
    const cached = RAW_HEIGHT_CACHE.get(id);
    if (cached !== undefined) return cached;
    const h = terrainHeightRaw(x, z);
    RAW_HEIGHT_CACHE.set(id, h);
    if (RAW_HEIGHT_CACHE.size > 110000) RAW_HEIGHT_CACHE.clear();
    return h;
  }

  function heightAt(x, z) {
    const id = `${x},${z}`;
    const cached = HEIGHT_CACHE.get(id);
    if (cached !== undefined) return cached;
    let h = terrainHeightRawCached(x, z);
    h = Math.round(THREE.MathUtils.clamp(h, 3, 32));
    HEIGHT_CACHE.set(id, h);
    if (HEIGHT_CACHE.size > 90000) HEIGHT_CACHE.clear();
    return h;
  }

  function topTypeAt(x, z, h) {
    const biome = biomeAt(x, z);
    if (inSpawnClearing(x, z, SPAWN_FLAT_R)) return GRASS;
    if (h <= SEA + 1) return SAND;
    if (biome.id === 'snowfield' || h >= SNOW_LINE) return SNOW;
    if (biome.id === 'desert') return SAND;
    if (biome.id === 'volcano') return STONE;
    const slope = Math.max(Math.abs(h - heightAt(x + 1, z)), Math.abs(h - heightAt(x - 1, z)), Math.abs(h - heightAt(x, z + 1)), Math.abs(h - heightAt(x, z - 1)));
    if (slope >= 3 || h >= ROCK_LINE) return STONE;
    return GRASS;
  }

  const WIN_R = GAME_SETTINGS.renderDistance, PREGEN_R = Math.max(96, GAME_SETTINGS.renderDistance + 24), STEP = 8;
  const WORLD_JOB_MS = 2.0, PREGEN_JOB_MS = 3.2, JOB_RETARGET_STEP = 24, TREE_MARGIN = 3;
  function hash2(x, z) { const h = Math.sin(x * 127.1 + z * 311.7 + WORLD_SEED * 0.0137) * 43758.5453; return h - Math.floor(h); }
  function pondFeatureAt(x, z, h) {
    if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 18) || structureAffectsColumn(x, z, 2) || villageAffectsColumn(x, z, 2)) return null;
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
    if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 16) || structureAffectsColumn(x, z, 1) || villageAffectsColumn(x, z, 1)) return null;
    const biome = biomeAt(x, z);
    if (biome.id === 'desert' || biome.id === 'highlands' || h <= SEA + 1 || h >= 24) return null;
    const path = Math.abs(fbm(x * 0.026 + WORLD_SEED * 0.003, z * 0.026 - 240, 3, 0.52));
    const flow = fbm(x * 0.010 - 120, z * 0.010 + WORLD_SEED * 0.004, 2, 0.5);
    if (path > 0.052 || flow < -0.12) return null;
    const slope = Math.max(Math.abs(h - heightAt(x + 1, z)), Math.abs(h - heightAt(x - 1, z)), Math.abs(h - heightAt(x, z + 1)), Math.abs(h - heightAt(x, z - 1)));
    if (slope > 2) return null;
    return { level: h, deep: 1, shore: path > 0.036 };
  }

  // ---- 川・峡谷・滝（連続する水路と深い渓谷、壁に落ちる滝） ----
  // ridged な歪みノイズで「うねる帯」を作る。abs(fbm) が小さい所が川/峡谷の中心線。
  function meanderBand(x, z, freq, warp, seedOff) {
    const wx = x + fbm(x * freq * 0.6 + 40 + seedOff, z * freq * 0.6 - 25, 2, 0.5) * warp;
    const wz = z + fbm(x * freq * 0.6 - 60, z * freq * 0.6 + 80 + seedOff, 2, 0.5) * warp;
    return Math.abs(fbm(wx * freq + seedOff + WORLD_SEED * 0.0021, wz * freq - 130, 3, 0.5));
  }
  function canyonAt(x, z) {
    if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 40)) return null;
    const region = (fbm(x * 0.0042 - 510 + WORLD_SEED * 0.0017, z * 0.0042 + 320, 2, 0.5) + 1) / 2;
    if (region < 0.72) return null;             // 峡谷は一部の地域だけに出す
    if (biomeAt(x, z).id === 'swamp') return null;
    const band = meanderBand(x, z, 0.011, 26, 333);
    if (band > 0.045) return null;
    if (structureAffectsColumn(x, z, 2) || villageAffectsColumn(x, z, 2)) return null;
    return { t: band / 0.045 };                 // 0=中心 .. 1=縁
  }
  function riverAt(x, z) {
    if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 22)) return null;
    if (biomeAt(x, z).id === 'desert') return null;
    const band = meanderBand(x, z, 0.0085, 30, 901);
    if (band > 0.03) return null;
    if (structureAffectsColumn(x, z, 1) || villageAffectsColumn(x, z, 1)) return null;
    return { t: band / 0.03 };
  }
  // 緩やかに上下する滑らかな水面（低周波）。下流ほど自然に下がり連続して流れて見える。
  function valleyFlowLevel(x, z) {
    const broad = (fbm(x * 0.006 + 71 + WORLD_SEED * 0.001, z * 0.006 - 42, 3, 0.5) + 1) / 2;
    return SEA + 1 + Math.round(broad * 9); // 9..18
  }
  function valleyAt(x, z, h) {
    if (h <= SEA + 2) return null;
    const c = canyonAt(x, z);
    if (c) {
      const lava = biomeAt(x, z).id === 'volcano';
      let level = Math.min(valleyFlowLevel(x, z), h - 5);
      if (level < SEA - 1) level = SEA - 1;
      if (h - level < 5) return null;          // 渓谷と呼べる深さがない
      // 縁ぎわでまばらに滝（水/溶岩）を壁伝いに落とす
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
    return valleyAt(x, z, h) || pondFeatureAt(x, z, h) || streamFeatureAt(x, z, h);
  }

  function isTrunk(x, z) {
    const biome = biomeAt(x, z);
    const cell = biome.id === 'jungle' ? 4 : biome.id === 'forest' ? 5 : biome.id === 'plains' ? 7 : 9;
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    const ox = 1 + (hash2(cx * 11.31 + 0.2, cz * 17.17 - 0.4) * Math.max(1, cell - 2) | 0);
    const oz = 1 + (hash2(cx * 19.73 - 0.6, cz * 13.37 + 0.8) * Math.max(1, cell - 2) | 0);
    const density =
      biome.id === 'forest' ? 0.82 :
      biome.id === 'jungle' ? 0.78 :
      biome.id === 'plains' ? 0.18 :
      biome.id === 'highlands' ? 0.11 :
      biome.id === 'swamp' ? 0.16 :
      biome.id === 'snowfield' ? 0.07 :
      0.025;
    return x === cx * cell + ox && z === cz * cell + oz && hash2(cx * 5.7 + 8.3, cz * 9.2 - 2.1) < density;
  }

  function addRange(out, x0, x1, z0, z1) {
    if (x0 <= x1 && z0 <= z1) out.push({ x0, x1, z0, z1, x: x0, z: z0 });
  }

  function rangesOutsideRect(x0, x1, z0, z1, ox0, ox1, oz0, oz1) {
    const out = [];
    const ix0 = Math.max(x0, ox0), ix1 = Math.min(x1, ox1);
    const iz0 = Math.max(z0, oz0), iz1 = Math.min(z1, oz1);
    if (ix0 > ix1 || iz0 > iz1) {
      addRange(out, x0, x1, z0, z1);
      return out;
    }
    addRange(out, x0, ix0 - 1, z0, z1);
    addRange(out, ix1 + 1, x1, z0, z1);
    addRange(out, ix0, ix1, z0, iz0 - 1);
    addRange(out, ix0, ix1, iz1 + 1, z1);
    return out;
  }

  function sortRangesNear(ranges, x, z) {
    return ranges.sort((a, b) => {
      const acx = (a.x0 + a.x1) * 0.5, acz = (a.z0 + a.z1) * 0.5;
      const bcx = (b.x0 + b.x1) * 0.5, bcz = (b.z0 + b.z1) * 0.5;
      return (Math.abs(acx - x) + Math.abs(acz - z)) - (Math.abs(bcx - x) + Math.abs(bcz - z));
    });
  }

  function processRanges(ranges, state, end, fn) {
    while (state.i < ranges.length && performance.now() < end) {
      const r = ranges[state.i];
      fn(r.x, r.z);
      r.z++;
      if (r.z > r.z1) { r.z = r.z0; r.x++; }
      if (r.x > r.x1) state.i++;
    }
    return state.i >= ranges.length;
  }

  function isCaveAt(x, y, z, h) {
    if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 8)) return false;
    if (h <= SEA + 2 || y < 4 || y > h - 4) return false;
    const tunnel = fbm(x * 0.055 + y * 0.030 + 400, z * 0.055 - y * 0.026 - 220, 3, 0.52);
    const chamber = fbm(x * 0.030 - 900, z * 0.030 + y * 0.050 + 140, 2, 0.55);
    const region = fbm(x * 0.012 + 1200, z * 0.012 - 300, 2, 0.5);
    return region > -0.18 && tunnel > 0.48 && chamber > -0.24;
  }

  function caveMouthAt(x, z, h) {
    if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 12) || h <= SEA + 5) return false;
    const seam = Math.abs(fbm(x * 0.026 + 730, z * 0.026 - 710, 2, 0.5));
    return seam < 0.026 && hash2(Math.floor(x / 6), Math.floor(z / 6)) > 0.58;
  }

  function addCaveDetails(x, z, h, mouth) {
    let crystals = 0, stones = 0;
    if (mouth && hash2(x * 1.31 + 6.2, z * 1.73 - 3.4) > 0.82) {
      const y = h - 2;
      if (!world.has(key(x, y, z)) && world.has(key(x, y - 1, z))) world.set(key(x, y, z), GLOW_CRYSTAL);
    }
    for (let y = 5; y <= h - 5; y++) {
      if (world.has(key(x, y, z))) continue;
      const below = world.has(key(x, y - 1, z));
      const above = world.has(key(x, y + 1, z));
      if (below && crystals < 1) {
        const deepBias = y < 18 ? 0.05 : 0;
        const glow = hash2(x * 2.17 + y * 0.63, z * 2.41 - y * 0.39);
        if (glow > 0.972 - deepBias) {
          world.set(key(x, y, z), GLOW_CRYSTAL);
          crystals++;
          continue;
        }
      }
      if (above && stones < 2) {
        const drip = hash2(x * 2.83 - y * 0.51, z * 2.29 + y * 0.77);
        if (drip > 0.935) {
          world.set(key(x, y, z), DRIPSTONE);
          stones++;
        }
      }
    }
  }

  function oreTypeAt(x, y, z, h) {
    if (y >= h - 4 || y < 3) return STONE;
    const vein = fbm3(x * 0.075 + 40, y * 0.115 - 17, z * 0.075 + 90, 3, 0.56);
    const broad = fbm3(x * 0.030 - 220, y * 0.045 + 180, z * 0.030 + 60, 2, 0.55);
    const speck = hash2(x * 3.17 + y * 0.91, z * 2.73 - y * 0.47);
    const oreBand = vein + broad * 0.45;
    const deep = y <= 11 ? 0.035 : 0; // 深層ほど良い鉱石が出やすい
    if (y <= 13 && oreBand > 0.48 - deep && speck > 0.955 - deep) return DIAMOND_ORE;
    if (y <= 24 && oreBand > 0.40 - deep && speck > 0.915 - deep) return GOLD_ORE;
    if (y <= 44 && oreBand > 0.30 && speck > 0.84) return IRON_ORE;
    if (y <= h - 5 && oreBand > 0.20 && speck > 0.75) return COAL_ORE;
    return STONE;
  }

  const STRUCT_CELL = 38;
  function structurePlanForCell(cx, cz) {
    const chance = hash2(cx * 19.17 + 4.3, cz * 23.71 - 8.1);
    if (chance > 0.52) return null;
    const x = cx * STRUCT_CELL + 8 + (hash2(cx + 0.23, cz - 0.13) * (STRUCT_CELL - 16) | 0);
    const z = cz * STRUCT_CELL + 8 + (hash2(cx - 0.41, cz + 0.37) * (STRUCT_CELL - 16) | 0);
    if (distFromSpawn(x, z) < SPAWN_CLEAR_R + 34) return null;
    const biome = biomeAt(x, z);
    const modern = hash2(cx * 41.7 - 2.1, cz * 37.9 + 9.4);
    let type = 'cabin', dir = hash2(cx + 8.8, cz - 4.4) < 0.5 ? 'x' : 'z';
    if (modern < 0.72 && biome.id !== 'snowfield') {
      if (biome.id === 'desert') type = modern < 0.34 ? 'solar' : modern < 0.52 ? 'shop' : 'road';
      else if (biome.id === 'highlands') type = modern < 0.36 ? 'antenna' : modern < 0.52 ? 'shop' : 'road';
      else if (biome.id === 'forest') type = modern < 0.28 ? 'busStop' : modern < 0.48 ? 'shop' : 'road';
      else type = modern < 0.28 ? 'shop' : modern < 0.46 ? 'busStop' : 'road';
    } else if (biome.id === 'desert') type = 'temple';
    else if (biome.id === 'highlands' || chance < 0.055) type = chance < 0.035 ? 'tower' : 'ruin';
    else if (biome.id === 'snowfield') type = 'ruin';
    const size =
      type === 'road' ? (dir === 'x' ? [23, 5] : [5, 23]) :
      type === 'solar' ? [13, 9] :
      type === 'shop' ? [11, 9] :
      type === 'busStop' ? [9, 6] :
      type === 'antenna' ? [7, 7] :
      type === 'tower' ? [5, 5] :
      type === 'temple' ? [9, 9] :
      type === 'ruin' ? [8, 7] : [7, 6];
    return { x, z, type, w: size[0], d: size[1], dir };
  }

  function structureAffectsColumn(x, z, pad = 0) {
    const cx0 = Math.floor((x - pad) / STRUCT_CELL) - 1, cx1 = Math.floor((x + pad) / STRUCT_CELL) + 1;
    const cz0 = Math.floor((z - pad) / STRUCT_CELL) - 1, cz1 = Math.floor((z + pad) / STRUCT_CELL) + 1;
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const p = structurePlanForCell(cx, cz); if (!p) continue;
      const rx = Math.floor(p.w / 2) + pad + 1, rz = Math.floor(p.d / 2) + pad + 1;
      if (x >= p.x - rx && x <= p.x + rx && z >= p.z - rz && z <= p.z + rz) return true;
    }
    return false;
  }

  function collectStructurePlans(x0, x1, z0, z1) {
    const plans = [];
    const cx0 = Math.floor((x0 - STRUCT_CELL) / STRUCT_CELL), cx1 = Math.floor((x1 + STRUCT_CELL) / STRUCT_CELL);
    const cz0 = Math.floor((z0 - STRUCT_CELL) / STRUCT_CELL), cz1 = Math.floor((z1 + STRUCT_CELL) / STRUCT_CELL);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const p = structurePlanForCell(cx, cz); if (!p) continue;
      const rx = Math.floor(p.w / 2) + 2, rz = Math.floor(p.d / 2) + 2;
      if (p.x + rx < x0 || p.x - rx > x1 || p.z + rz < z0 || p.z - rz > z1) continue;
      plans.push(p);
    }
    return plans;
  }

  function structureBase(plan) {
    const minX = plan.x - Math.floor(plan.w / 2), maxX = minX + plan.w - 1;
    const minZ = plan.z - Math.floor(plan.d / 2), maxZ = minZ + plan.d - 1;
    let lo = 999, hi = -999;
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const h = heightAt(x, z);
      if (h <= SEA + 1) return null;
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    const limit = plan.type === 'tower' || plan.type === 'antenna' ? 4 : plan.type === 'ruin' ? 3 : 2;
    if (hi - lo > limit) return null;
    return hi + 1;
  }

  function addStreetLight(put, x, base, z) {
    for (let y = base + 1; y <= base + 4; y++) put(x, y, z, STONE);
    put(x, base + 5, z, GLASS);
    put(x + 1, base + 5, z, GLASS);
  }

  function addModernRoad(plan, base, minX, maxX, minZ, maxZ, put) {
    const alongX = plan.dir === 'x';
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const edge = x === minX || x === maxX || z === minZ || z === maxZ;
      const centerLine = alongX ? z === plan.z && Math.abs(x - plan.x) % 6 <= 1 : x === plan.x && Math.abs(z - plan.z) % 6 <= 1;
      put(x, base, z, edge ? BRICK : centerLine ? SNOW : STONE);
    }
    if (alongX) {
      addStreetLight(put, minX + 2, base, minZ - 1);
      addStreetLight(put, maxX - 2, base, maxZ + 1);
    } else {
      addStreetLight(put, minX - 1, base, minZ + 2);
      addStreetLight(put, maxX + 1, base, maxZ - 2);
    }
  }

  function addBusStop(plan, base, minX, maxX, minZ, maxZ, put, air) {
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) put(x, base, z, STONE);
    const backZ = maxZ;
    for (let x = minX + 1; x <= maxX - 1; x++) {
      put(x, base + 1, backZ, GLASS);
      put(x, base + 2, backZ, GLASS);
      put(x, base + 3, backZ, SNOW);
    }
    for (const x of [minX + 1, maxX - 1]) for (let y = base + 1; y <= base + 3; y++) put(x, y, minZ + 1, STONE);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) put(x, base + 4, z, SNOW);
    for (let x = plan.x - 1; x <= plan.x + 1; x++) put(x, base + 1, minZ + 2, STONE);
    air(plan.x, base + 2, minZ + 2);
    addModernRoad(plan, base, minX - 3, maxX + 3, minZ - 4, minZ - 1, put);
  }

  function addShop(plan, base, minX, maxX, minZ, maxZ, put, air) {
    for (let x = minX - 2; x <= maxX + 2; x++) for (let z = minZ - 5; z <= maxZ + 2; z++) put(x, base, z, STONE);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      put(x, base, z, STONE);
      const edge = x === minX || x === maxX || z === minZ || z === maxZ;
      if (!edge) continue;
      for (let y = base + 1; y <= base + 4; y++) {
        const frontGlass = z === minZ && y <= base + 3 && x > minX && x < maxX;
        const sideGlass = y === base + 2 && ((x === minX || x === maxX) ? z > minZ + 1 && z < maxZ - 1 : false);
        put(x, y, z, frontGlass || sideGlass ? GLASS : SNOW);
      }
    }
    for (let y = base + 1; y <= base + 2; y++) air(plan.x, y, minZ);
    for (let x = minX - 1; x <= maxX + 1; x++) for (let z = minZ - 1; z <= maxZ + 1; z++) put(x, base + 5, z, STONE);
    for (let x = minX - 1; x <= maxX + 1; x++) put(x, base + 6, minZ - 1, SNOW);
    for (let x = minX + 2; x <= maxX - 2; x++) put(x, base + 6, minZ - 2, GLASS);
    for (let x = minX - 1; x <= maxX + 1; x += 4) put(x, base + 1, minZ - 3, SNOW);
    addStreetLight(put, minX - 2, base, minZ - 4);
    addStreetLight(put, maxX + 2, base, minZ - 4);
    for (let x = minX - 1; x <= maxX + 1; x++) if ((x - minX) % 3 !== 0) put(x, base + 1, minZ - 5, SNOW);
  }

  function addSolarFarm(plan, base, minX, maxX, minZ, maxZ, put) {
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) put(x, base, z, SAND);
    for (let x = minX + 1; x <= maxX - 1; x += 3) for (let z = minZ + 1; z <= maxZ - 1; z += 3) {
      put(x, base + 1, z, STONE);
      put(x, base + 2, z, GLASS);
      put(x + 1, base + 2, z, GLASS);
      put(x, base + 2, z + 1, GLASS);
      put(x + 1, base + 2, z + 1, GLASS);
    }
    for (let x = minX; x <= maxX; x++) { put(x, base + 1, minZ, STONE); put(x, base + 1, maxZ, STONE); }
    for (let z = minZ; z <= maxZ; z++) { put(minX, base + 1, z, STONE); put(maxX, base + 1, z, STONE); }
  }

  function addAntenna(plan, base, minX, maxX, minZ, maxZ, put) {
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) put(x, base, z, STONE);
    for (let y = base + 1; y <= base + 14; y++) {
      put(plan.x, y, plan.z, STONE);
      if (y % 4 === 0) {
        put(plan.x + 1, y, plan.z, GLASS);
        put(plan.x - 1, y, plan.z, GLASS);
        put(plan.x, y, plan.z + 1, GLASS);
        put(plan.x, y, plan.z - 1, GLASS);
      }
    }
    for (let x = minX + 1; x <= maxX - 1; x++) for (let z = minZ + 1; z <= maxZ - 1; z++) if (x !== plan.x || z !== plan.z) put(x, base + 1, z, GLASS);
  }

  function addStructurePlan(plan, inWin) {
    const base = structureBase(plan); if (base == null) return;
    const minX = plan.x - Math.floor(plan.w / 2), maxX = minX + plan.w - 1;
    const minZ = plan.z - Math.floor(plan.d / 2), maxZ = minZ + plan.d - 1;
    const put = (x, y, z, type) => { if (inWin(x, z)) world.set(key(x, y, z), type); };
    const air = (x, y, z) => { if (inWin(x, z)) world.delete(key(x, y, z)); };
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const h = heightAt(x, z);
      for (let y = h + 1; y < base; y++) put(x, y, z, STONE);
      for (let y = base; y <= base + (plan.type === 'antenna' ? 15 : 8); y++) air(x, y, z);
    }
    if (plan.type === 'road') { addModernRoad(plan, base, minX, maxX, minZ, maxZ, put); return; }
    if (plan.type === 'busStop') { addBusStop(plan, base, minX, maxX, minZ, maxZ, put, air); return; }
    if (plan.type === 'shop') { addShop(plan, base, minX, maxX, minZ, maxZ, put, air); return; }
    if (plan.type === 'solar') { addSolarFarm(plan, base, minX, maxX, minZ, maxZ, put); return; }
    if (plan.type === 'antenna') { addAntenna(plan, base, minX, maxX, minZ, maxZ, put); return; }
    if (plan.type === 'tower') {
      for (let y = base; y <= base + 9; y++) for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
        const edge = x === minX || x === maxX || z === minZ || z === maxZ;
        if (y === base) put(x, y, z, STONE);
        else if (edge) put(x, y, z, (y % 4 === 2 && (x === plan.x || z === plan.z)) ? GLASS : STONE);
      }
      for (let x = minX - 1; x <= maxX + 1; x++) for (let z = minZ - 1; z <= maxZ + 1; z++) put(x, base + 10, z, BRICK);
      return;
    }
    if (plan.type === 'ruin') {
      for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
        put(x, base, z, STONE);
        const edge = x === minX || x === maxX || z === minZ || z === maxZ;
        if (!edge) continue;
        const wallH = 1 + (hash2(x * 2.1, z * 2.7) * 4 | 0);
        for (let y = base + 1; y <= base + wallH; y++) if (hash2(x + y * 3, z - y * 2) > 0.22) put(x, y, z, BRICK);
      }
      return;
    }
    const wall = plan.type === 'temple' ? SAND : PLANKS;
    const accent = plan.type === 'temple' ? BRICK : LOG;
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      put(x, base, z, plan.type === 'temple' ? SAND : PLANKS);
      const edge = x === minX || x === maxX || z === minZ || z === maxZ;
      if (!edge) continue;
      for (let y = base + 1; y <= base + 3; y++) {
        const window = y === base + 2 && ((x === minX || x === maxX) ? z === plan.z : x === plan.x);
        put(x, y, z, window ? GLASS : wall);
      }
    }
    for (let y = base + 1; y <= base + 2; y++) air(plan.x, y, minZ);
    put(plan.x, base + 3, minZ, accent);
    for (let x = minX - 1; x <= maxX + 1; x++) for (let z = minZ - 1; z <= maxZ + 1; z++) put(x, base + 4, z, wall);
    if (plan.type === 'temple') put(plan.x, base + 5, plan.z, BRICK);
  }

  function addStructuresInArea(x0, x1, z0, z1, plans = collectStructurePlans(x0, x1, z0, z1)) {
    const inWin = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
    for (const plan of plans) addStructurePlan(plan, inWin);
  }

  /* ---- 地下遺跡ダンジョン（石レンガの部屋＋宝箱＋地上への階段入口） ---- */
  const DUNGEON_CELL = 84, DUNGEON_REACH = 36;
  function dungeonPlanForCell(cx, cz) {
    const chance = hash2(cx * 27.31 - 5.7, cz * 31.17 + 3.9);
    if (chance > 0.16) return null;
    const x = cx * DUNGEON_CELL + 16 + (hash2(cx * 3.7 + 1.1, cz * 2.3 - 0.6) * (DUNGEON_CELL - 32) | 0);
    const z = cz * DUNGEON_CELL + 16 + (hash2(cx * 1.9 - 0.7, cz * 4.1 + 0.9) * (DUNGEON_CELL - 32) | 0);
    if (distFromSpawn(x, z) < SPAWN_CLEAR_R + 56) return null;
    const surf = heightAt(x, z);
    if (surf <= SEA + 3) return null;
    const w = 7 + (hash2(cx * 2.11 + 0.3, cz * 1.77 - 0.4) * 5 | 0);
    const d = 7 + (hash2(cx * 1.33 - 0.5, cz * 2.91 + 0.2) * 5 | 0);
    const ceilY = surf - 4 - (hash2(cx * 5.3 + 2.1, cz * 6.1 - 1.2) * 4 | 0);
    const floorY = ceilY - 5;
    if (floorY < 3) return null;
    const dir = hash2(cx + 6.6, cz - 7.7) < 0.5 ? 'x' : 'z';
    const sign = hash2(cx * 0.7 + 2.2, cz * 0.7 - 1.1) < 0.5 ? 1 : -1;
    return { x, z, w, d, floorY, ceilY, surf, dir, sign };
  }

  function nearestDungeon(px, pz) {
    let best = null;
    const cx0 = Math.floor((px - DUNGEON_REACH) / DUNGEON_CELL) - 3, cx1 = Math.floor((px + DUNGEON_REACH) / DUNGEON_CELL) + 3;
    const cz0 = Math.floor((pz - DUNGEON_REACH) / DUNGEON_CELL) - 3, cz1 = Math.floor((pz + DUNGEON_REACH) / DUNGEON_CELL) + 3;
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const p = dungeonPlanForCell(cx, cz); if (!p) continue;
      const dd = Math.hypot(p.x - px, p.z - pz);
      if (!best || dd < best.dd) best = { plan: p, dd };
    }
    return best;
  }

  function collectDungeonPlans(x0, x1, z0, z1) {
    const plans = [];
    const cx0 = Math.floor((x0 - DUNGEON_REACH) / DUNGEON_CELL), cx1 = Math.floor((x1 + DUNGEON_REACH) / DUNGEON_CELL);
    const cz0 = Math.floor((z0 - DUNGEON_REACH) / DUNGEON_CELL), cz1 = Math.floor((z1 + DUNGEON_REACH) / DUNGEON_CELL);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const p = dungeonPlanForCell(cx, cz); if (p) plans.push(p);
    }
    return plans;
  }

  function addDungeonEntranceMarker(ox, oz, gy, openCells, put) {
    const isOpen = (x, z) => openCells.some(c => c[0] === x && c[1] === z);
    for (let x = ox - 2; x <= ox + 2; x++) for (let z = oz - 2; z <= oz + 2; z++) {
      const ring = Math.max(Math.abs(x - ox), Math.abs(z - oz)) >= 2;
      if (!ring || isOpen(x, z)) continue;
      if (hash2(x * 1.7 + 0.4, z * 1.9 - 0.6) > 0.5) continue;
      const hh = 1 + (hash2(x * 2.1, z * 2.3) * 2 | 0);
      for (let y = 1; y <= hh; y++) put(x, gy + y, z, hash2(x + y, z - y) < 0.32 ? MOSSY_BRICK : STONE_BRICK);
    }
  }

  function addDungeonPlan(plan, inWin) {
    const { x: cx, z: cz, w, d, floorY, ceilY, dir, sign } = plan;
    const minX = cx - (w >> 1), maxX = minX + w - 1;
    const minZ = cz - (d >> 1), maxZ = minZ + d - 1;
    const put = (x, y, z, t) => { if (inWin(x, z)) world.set(key(x, y, z), t); };
    const air = (x, y, z) => { if (inWin(x, z)) world.delete(key(x, y, z)); };
    const brick = (x, y, z) => put(x, y, z, hash2(x * 1.7 + y * 0.9, z * 1.3 - y * 0.7) < 0.2 ? MOSSY_BRICK : STONE_BRICK);

    // 内部を空洞化
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) for (let y = floorY + 1; y < ceilY; y++) air(x, y, z);
    // 床と天井（外周1マス分まで張る）
    for (let x = minX - 1; x <= maxX + 1; x++) for (let z = minZ - 1; z <= maxZ + 1; z++) { brick(x, floorY, z); brick(x, ceilY, z); }
    // 壁
    for (let y = floorY + 1; y < ceilY; y++) {
      for (let x = minX - 1; x <= maxX + 1; x++) { brick(x, y, minZ - 1); brick(x, y, maxZ + 1); }
      for (let z = minZ; z <= maxZ; z++) { brick(minX - 1, y, z); brick(maxX + 1, y, z); }
    }
    // 四隅の柱とランタン
    const corners = [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ]];
    for (const [px, pz] of corners) {
      for (let y = floorY + 1; y < ceilY; y++) brick(px, y, pz);
      put(px, ceilY - 1, pz, LANTERN);
    }
    // 床に散る苔と鍾乳石、壁に露出した鉱石（雰囲気）
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      if (hash2(x * 4.1 + 7.3, z * 3.7 - 2.1) > 0.9) put(x, floorY, z, MOSSY_BRICK);
    }
    put(minX - 1, ceilY - 1, cz, hash2(minX * 2.1, cz * 2.3) < 0.5 ? COAL_ORE : IRON_ORE);
    put(maxX + 1, floorY + 1, cz, hash2(maxX * 1.9, cz * 2.7) < 0.4 ? IRON_ORE : COAL_ORE);
    // 宝箱（探索報酬）
    put(cx, floorY + 1, cz, CHEST);
    if (w >= 9 && d >= 9) put(cx + (dir === 'x' ? 1 : -1), floorY + 1, cz + (dir === 'x' ? -1 : 1), CHEST);

    // 地上への登り階段（1段ごとに1マス上がり外側へ進む）
    const stepX = dir === 'x' ? sign : 0, stepZ = dir === 'x' ? 0 : sign;
    const perpX = dir === 'x' ? 0 : 1, perpZ = dir === 'x' ? 1 : 0;
    let sx = dir === 'x' ? (sign > 0 ? maxX + 1 : minX - 1) : cx;
    let sz = dir === 'x' ? cz : (sign > 0 ? maxZ + 1 : minZ - 1);
    // 部屋側の壁に出入口を開ける
    for (let h = 1; h <= 3; h++) { air(sx, floorY + h, sz); air(sx + perpX, floorY + h, sz + perpZ); }
    let x = sx + stepX, z = sz + stepZ, y = floorY + 1;
    for (let i = 0; i < 42; i++) {
      const ground = heightAt(x, z);
      put(x, y - 1, z, STONE_BRICK);
      put(x + perpX, y - 1, z + perpZ, STONE_BRICK);
      for (let h = 0; h < 3; h++) { air(x, y + h, z); air(x + perpX, y + h, z + perpZ); }
      put(x - perpX, y - 1, z - perpZ, STONE_BRICK);
      put(x + perpX * 2, y - 1, z + perpZ * 2, STONE_BRICK);
      if (y >= ground) {
        const open = [[x, z], [x + perpX, z + perpZ]];
        for (let h = 0; h < 3; h++) { air(x, ground + h, z); air(x + perpX, ground + h, z + perpZ); }
        addDungeonEntranceMarker(x, z, ground, open, put);
        break;
      }
      x += stepX; z += stepZ; y += 1;
    }
  }

  /* ---- 地上の村クラスタ（井戸＋複数の家＋畑＋道＋ランタン街灯） ---- */
  const VILLAGE_CELL = 150, VILLAGE_RADIUS = 22;
  function villagePlanForCell(cx, cz) {
    const chance = hash2(cx * 13.71 + 2.9, cz * 17.33 - 6.1);
    if (chance > 0.10) return null;
    const x = cx * VILLAGE_CELL + 28 + (hash2(cx * 4.1 + 0.7, cz * 3.3 - 0.9) * (VILLAGE_CELL - 56) | 0);
    const z = cz * VILLAGE_CELL + 28 + (hash2(cx * 2.7 - 0.3, cz * 5.1 + 0.5) * (VILLAGE_CELL - 56) | 0);
    if (distFromSpawn(x, z) < SPAWN_CLEAR_R + 80) return null;
    const biome = biomeAt(x, z);
    if (biome.id !== 'plains' && biome.id !== 'forest') return null;
    const hc = heightAt(x, z);
    if (hc <= SEA + 2) return null;
    let lo = hc, hi = hc;
    for (let a = 0; a < 6; a++) {
      const sx = x + Math.round(Math.cos(a) * 12), sz = z + Math.round(Math.sin(a) * 12);
      const h = heightAt(sx, sz); lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    if (hi - lo > 4) return null;
    const base = hi + 1;
    const n = 5 + (hash2(cx * 7.7 + 1.1, cz * 9.3 - 0.4) * 3 | 0);
    const slots = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + (hash2(cx + i * 1.3, cz - i * 0.7) - 0.5) * 0.6;
      const rr = 10 + (hash2(cx * 1.1 + i * 2.1, cz * 1.9 - i * 1.3) * 5 | 0);
      const bx = x + Math.round(Math.cos(ang) * rr);
      const bz = z + Math.round(Math.sin(ang) * rr);
      const roll = hash2(cx * 3.1 + i * 2.2, cz * 2.3 - i * 1.7);
      const kind = i === 0 ? 'farm' : i === 1 ? 'blacksmith' : i === 2 ? 'market' : (roll < 0.24 ? 'farm' : 'house');
      slots.push({ bx, bz, kind, ang });
    }
    return { x, z, base, slots };
  }

  function nearestVillage(px, pz) {
    let best = null;
    const c0 = Math.floor((px - VILLAGE_CELL) / VILLAGE_CELL) - 1, c1 = Math.floor((px + VILLAGE_CELL) / VILLAGE_CELL) + 1;
    const d0 = Math.floor((pz - VILLAGE_CELL) / VILLAGE_CELL) - 1, d1 = Math.floor((pz + VILLAGE_CELL) / VILLAGE_CELL) + 1;
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const p = villagePlanForCell(cx, cz); if (!p) continue;
      const dd = Math.hypot(p.x - px, p.z - pz);
      if (!best || dd < best.dd) best = { plan: p, dd };
    }
    return best;
  }

  function villageAffectsColumn(x, z, pad = 0) {
    const c0 = Math.floor((x - VILLAGE_CELL) / VILLAGE_CELL), c1 = Math.floor((x + VILLAGE_CELL) / VILLAGE_CELL);
    const d0 = Math.floor((z - VILLAGE_CELL) / VILLAGE_CELL), d1 = Math.floor((z + VILLAGE_CELL) / VILLAGE_CELL);
    const R = VILLAGE_RADIUS + pad;
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const p = villagePlanForCell(cx, cz); if (!p) continue;
      if (Math.abs(x - p.x) <= R && Math.abs(z - p.z) <= R) return true;
    }
    return false;
  }

  function collectVillagePlans(x0, x1, z0, z1) {
    const plans = [];
    const c0 = Math.floor((x0 - VILLAGE_RADIUS) / VILLAGE_CELL), c1 = Math.floor((x1 + VILLAGE_RADIUS) / VILLAGE_CELL);
    const d0 = Math.floor((z0 - VILLAGE_RADIUS) / VILLAGE_CELL), d1 = Math.floor((z1 + VILLAGE_RADIUS) / VILLAGE_CELL);
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const p = villagePlanForCell(cx, cz); if (p) plans.push(p);
    }
    return plans;
  }

  function buildLamp(x, base, z, put, air) {
    put(x, base, z, STONE_BRICK);
    for (let y = base + 1; y <= base + 3; y++) { air(x, y, z); put(x, y, z, STONE_BRICK); }
    put(x, base + 4, z, LANTERN);
  }

  function buildWell(cx, cz, base, put, air) {
    for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) {
      const edge = x !== cx || z !== cz;
      put(x, base, z, STONE_BRICK);
      if (edge) put(x, base + 1, z, STONE_BRICK); else { air(x, base + 1, z); }
    }
    put(cx, base - 1, cz, WATER); put(cx, base, cz, WATER);
    put(cx, base - 2, cz, STONE_BRICK);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { put(cx + dx, base + 2, cz + dz, LOG); put(cx + dx, base + 3, cz + dz, LOG); }
    for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) put(x, base + 4, z, PLANKS);
    put(cx, base + 3, cz, LANTERN);
  }

  function buildHouse(bx, bz, base, dx, dz, put, air) {
    const w = hash2(bx * 1.3, bz * 1.7) < 0.5 ? 5 : 7, d = 6;
    const minX = bx - (w >> 1), maxX = minX + w - 1;
    const minZ = bz - (d >> 1), maxZ = minZ + d - 1;
    const accent = hash2(bx * 0.7, bz * 0.9) < 0.5 ? LOG : STONE_BRICK;
    const roof = hash2(bx * 1.9, bz * 2.3) < 0.5 ? BRICK : STONE_BRICK;
    for (let x = minX - 1; x <= maxX + 1; x++) for (let z = minZ - 1; z <= maxZ + 1; z++) {
      const g = heightAt(x, z);
      for (let y = g + 1; y < base; y++) put(x, y, z, DIRT);
      for (let y = base + 1; y <= base + 7; y++) air(x, y, z);
      if (x < minX || x > maxX || z < minZ || z > maxZ) put(x, base, z, GRASS);
    }
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) put(x, base, z, PLANKS);
    const doorX = Math.abs(dx) >= Math.abs(dz);
    const dWallX = doorX ? (dx < 0 ? minX : maxX) : null;
    const dWallZ = doorX ? null : (dz < 0 ? minZ : maxZ);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const edge = x === minX || x === maxX || z === minZ || z === maxZ;
      if (!edge) continue;
      const corner = (x === minX || x === maxX) && (z === minZ || z === maxZ);
      for (let y = base + 1; y <= base + 3; y++) {
        const window = y === base + 2 && !corner && ((x === minX || x === maxX) ? (z === bz) : (x === bx));
        put(x, y, z, corner ? accent : window ? GLASS : PLANKS);
      }
    }
    // 出入口（村の中心を向いた壁に2マスの開口）
    if (doorX) { for (let y = base + 1; y <= base + 2; y++) air(dWallX, y, bz); }
    else { for (let y = base + 1; y <= base + 2; y++) air(bx, y, dWallZ); }
    // 屋根
    for (let x = minX - 1; x <= maxX + 1; x++) for (let z = minZ - 1; z <= maxZ + 1; z++) put(x, base + 4, z, roof);
    for (let x = minX; x <= maxX; x++) put(x, base + 5, bz, accent);
    // 内装：明かりと、約45%の家に宝箱
    put(minX + 1, base + 3, minZ + 1, LANTERN);
    if (hash2(bx * 5.1 + 0.3, bz * 3.3 - 0.7) < 0.45) put(maxX - 1, base + 1, maxZ - 1, CHEST);
  }

  function buildFarm(bx, bz, base, put, air) {
    const r = 3;
    for (let x = bx - r; x <= bx + r; x++) for (let z = bz - r; z <= bz + r; z++) {
      const g = heightAt(x, z);
      for (let y = g + 1; y < base; y++) put(x, y, z, DIRT);
      for (let y = base + 1; y <= base + 4; y++) air(x, y, z);
      const edge = x === bx - r || x === bx + r || z === bz - r || z === bz + r;
      const channel = z === bz;
      if (edge && !channel) { put(x, base, z, DIRT); if ((x + z) % 2 === 0) put(x, base + 1, z, LOG); }
      else if (channel) { put(x, base, z, WATER); }
      else { put(x, base, z, DIRT); if (hash2(x * 2.7, z * 3.1) < 0.8) put(x, base + 1, z, LEAVES); }
    }
  }

  function buildPath(cx, cz, bx, bz, base, put, air) {
    let x = bx, z = bz, steps = 0;
    while ((x !== cx || z !== cz) && steps < 64) {
      put(x, base, z, STONE_BRICK);
      for (let y = base + 1; y <= base + 2; y++) air(x, y, z);
      if (Math.abs(cx - x) >= Math.abs(cz - z)) x += Math.sign(cx - x); else z += Math.sign(cz - z);
      steps++;
    }
  }

  function buildBlacksmith(bx, bz, base, dx, dz, put, air) {
    const w = 6, d = 6;
    const minX = bx - (w >> 1), maxX = minX + w - 1, minZ = bz - (d >> 1), maxZ = minZ + d - 1;
    for (let x = minX - 1; x <= maxX + 1; x++) for (let z = minZ - 1; z <= maxZ + 1; z++) {
      const g = heightAt(x, z);
      for (let y = g + 1; y < base; y++) put(x, y, z, STONE_BRICK);
      for (let y = base + 1; y <= base + 7; y++) air(x, y, z);
      if (x < minX || x > maxX || z < minZ || z > maxZ) put(x, base, z, STONE_BRICK);
    }
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) put(x, base, z, STONE_BRICK);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const edge = x === minX || x === maxX || z === minZ || z === maxZ; if (!edge) continue;
      const corner = (x === minX || x === maxX) && (z === minZ || z === maxZ);
      for (let y = base + 1; y <= base + 3; y++) {
        const window = y === base + 2 && !corner && ((x === minX || x === maxX) ? z === bz : x === bx);
        put(x, y, z, corner ? LOG : window ? GLASS : STONE_BRICK);
      }
    }
    const doorX = Math.abs(dx) >= Math.abs(dz);
    if (doorX) { const wx = dx < 0 ? minX : maxX; for (let y = base + 1; y <= base + 2; y++) air(wx, y, bz); }
    else { const wz = dz < 0 ? minZ : maxZ; for (let y = base + 1; y <= base + 2; y++) air(bx, y, wz); }
    for (let x = minX - 1; x <= maxX + 1; x++) for (let z = minZ - 1; z <= maxZ + 1; z++) put(x, base + 4, z, LOG);
    // 炉（かまど）と溶岩の火床（壁で囲って触れない）、金床、宝箱、ランタン
    put(minX + 1, base + 1, minZ + 1, FURNACE);
    put(maxX - 1, base + 1, minZ + 1, STONE_BRICK); put(maxX - 1, base + 2, minZ + 1, LAVA); put(maxX - 1, base + 3, minZ + 1, STONE_BRICK);
    put(bx, base + 1, maxZ - 1, LOG); put(bx, base + 2, maxZ - 1, STONE);
    put(minX + 1, base + 3, maxZ - 1, LANTERN);
    if (hash2(bx * 5.1 + 0.7, bz * 3.3 - 0.2) < 0.6) put(maxX - 1, base + 1, maxZ - 1, CHEST);
  }

  function buildMarket(bx, bz, base, put, air) {
    const r = 2;
    for (let x = bx - r; x <= bx + r; x++) for (let z = bz - r; z <= bz + r; z++) {
      const g = heightAt(x, z);
      for (let y = g + 1; y < base; y++) put(x, y, z, DIRT);
      for (let y = base + 1; y <= base + 5; y++) air(x, y, z);
      put(x, base, z, STONE_BRICK);
    }
    for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) for (let y = base + 1; y <= base + 3; y++) put(bx + ox, y, bz + oz, LOG);
    for (let x = bx - r - 1; x <= bx + r + 1; x++) for (let z = bz - r - 1; z <= bz + r + 1; z++) put(x, base + 4, z, hash2(x * 1.3, z * 1.7) < 0.5 ? BRICK : PLANKS);
    const wares = [LEAVES, SAND, IRON_ORE, CACTUS, PLANKS, COAL_ORE];
    for (let x = bx - r; x <= bx + r; x++) {
      put(x, base + 1, bz - r, PLANKS);
      if (x > bx - r && x < bx + r) put(x, base + 2, bz - r, wares[((x * 3 + bz) % wares.length + wares.length) % wares.length]);
    }
    put(bx, base + 1, bz + r, CHEST);
    put(bx - r, base + 3, bz - r, LANTERN);
  }

  function addVillagePlan(plan, inWin) {
    const { x: cx, z: cz, base, slots } = plan;
    const put = (x, y, z, t) => { if (inWin(x, z)) world.set(key(x, y, z), t); };
    const air = (x, y, z) => { if (inWin(x, z)) world.delete(key(x, y, z)); };
    for (const s of slots) buildPath(cx, cz, s.bx, s.bz, base, put, air);
    buildWell(cx, cz, base, put, air);
    for (const s of slots) {
      if (s.kind === 'farm') buildFarm(s.bx, s.bz, base, put, air);
      else if (s.kind === 'blacksmith') buildBlacksmith(s.bx, s.bz, base, cx - s.bx, cz - s.bz, put, air);
      else if (s.kind === 'market') buildMarket(s.bx, s.bz, base, put, air);
      else buildHouse(s.bx, s.bz, base, cx - s.bx, cz - s.bz, put, air);
    }
    buildLamp(cx + 3, base, cz + 2, put, air);
    buildLamp(cx - 3, base, cz - 2, put, air);
  }

  /* ---- 共通: 地下から地上へ登る石レンガ階段 ---- */
  function carveStairUp(sx, sz, startY, dir, sign, put, air) {
    const stepX = dir === 'x' ? sign : 0, stepZ = dir === 'x' ? 0 : sign;
    const perpX = dir === 'x' ? 0 : 1, perpZ = dir === 'x' ? 1 : 0;
    let x = sx, z = sz, y = startY;
    for (let i = 0; i < 48; i++) {
      const ground = heightAt(x, z);
      put(x, y - 1, z, STONE_BRICK);
      put(x + perpX, y - 1, z + perpZ, STONE_BRICK);
      for (let h = 0; h < 3; h++) { air(x, y + h, z); air(x + perpX, y + h, z + perpZ); }
      put(x - perpX, y - 1, z - perpZ, STONE_BRICK);
      put(x + perpX * 2, y - 1, z + perpZ * 2, STONE_BRICK);
      if (y >= ground) {
        const open = [[x, z], [x + perpX, z + perpZ]];
        for (let h = 0; h < 3; h++) { air(x, ground + h, z); air(x + perpX, ground + h, z + perpZ); }
        addDungeonEntranceMarker(x, z, ground, open, put);
        return;
      }
      x += stepX; z += stepZ; y += 1;
    }
  }

  /* ---- 廃坑（木の支柱トンネル＋たいまつ＋露出鉱石＋溶岩ハザード＋宝箱＋地上入口） ---- */
  const MINESHAFT_CELL = 70;
  function mineshaftPlanForCell(cx, cz) {
    const chance = hash2(cx * 21.7 + 9.1, cz * 19.3 - 4.7);
    if (chance > 0.12) return null;
    const x = cx * MINESHAFT_CELL + 14 + (hash2(cx * 3.1 + 0.5, cz * 2.7 - 0.3) * (MINESHAFT_CELL - 28) | 0);
    const z = cz * MINESHAFT_CELL + 14 + (hash2(cx * 1.7 - 0.4, cz * 4.3 + 0.6) * (MINESHAFT_CELL - 28) | 0);
    if (distFromSpawn(x, z) < SPAWN_CLEAR_R + 64) return null;
    const surf = heightAt(x, z);
    if (surf <= SEA + 3) return null;
    const floorY = 5 + (hash2(cx * 5.7, cz * 6.3) * 5 | 0);
    if (floorY >= surf - 6) return null;
    const dir = hash2(cx + 4.4, cz - 3.3) < 0.5 ? 'x' : 'z';
    const sign = hash2(cx * 0.9 + 1.2, cz * 0.9 - 2.1) < 0.5 ? 1 : -1;
    const len = 22 + (hash2(cx * 2.3 + 1.7, cz * 3.9 - 0.8) * 16 | 0);
    return { x, z, floorY, surf, dir, sign, len };
  }

  function nearestMineshaft(px, pz) {
    let best = null;
    const c0 = Math.floor((px - MINESHAFT_CELL) / MINESHAFT_CELL) - 2, c1 = Math.floor((px + MINESHAFT_CELL) / MINESHAFT_CELL) + 2;
    const d0 = Math.floor((pz - MINESHAFT_CELL) / MINESHAFT_CELL) - 2, d1 = Math.floor((pz + MINESHAFT_CELL) / MINESHAFT_CELL) + 2;
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const p = mineshaftPlanForCell(cx, cz); if (!p) continue;
      const dd = Math.hypot(p.x - px, p.z - pz);
      if (!best || dd < best.dd) best = { plan: p, dd };
    }
    return best;
  }

  function collectMineshaftPlans(x0, x1, z0, z1) {
    const plans = [];
    const pad = 44;
    const c0 = Math.floor((x0 - pad) / MINESHAFT_CELL), c1 = Math.floor((x1 + pad) / MINESHAFT_CELL);
    const d0 = Math.floor((z0 - pad) / MINESHAFT_CELL), d1 = Math.floor((z1 + pad) / MINESHAFT_CELL);
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const p = mineshaftPlanForCell(cx, cz); if (p) plans.push(p);
    }
    return plans;
  }

  function addMineshaftPlan(plan, inWin) {
    const { x: ox, z: oz, floorY, dir, sign, len } = plan;
    const put = (x, y, z, t) => { if (inWin(x, z)) world.set(key(x, y, z), t); };
    const air = (x, y, z) => { if (inWin(x, z)) world.delete(key(x, y, z)); };
    const stepX = dir === 'x' ? sign : 0, stepZ = dir === 'x' ? 0 : sign;
    const perpX = dir === 'x' ? 0 : 1, perpZ = dir === 'x' ? 1 : 0;
    const lavaAt = 6 + (hash2(ox * 1.3, oz * 1.7) * (len - 12) | 0);
    for (let s = 0; s <= len; s++) {
      const bx = ox + stepX * s, bz = oz + stepZ * s;
      for (let p = -1; p <= 1; p++) {
        const cxp = bx + perpX * p, czp = bz + perpZ * p;
        put(cxp, floorY, czp, PLANKS);
        for (let h = 1; h <= 3; h++) air(cxp, floorY + h, czp);
      }
      // 支柱フレーム（4マスごと）
      if (s % 4 === 0) {
        for (const p of [-1, 1]) {
          const cxp = bx + perpX * p, czp = bz + perpZ * p;
          put(cxp, floorY + 1, czp, LOG); put(cxp, floorY + 2, czp, LOG);
        }
        for (let p = -1; p <= 1; p++) put(bx + perpX * p, floorY + 3, bz + perpZ * p, PLANKS);
      }
      // たいまつ（8マスごと）
      if (s % 8 === 4) put(bx + perpX, floorY + 2, bz + perpZ, TORCH);
      // 壁に露出鉱石
      if (hash2(bx * 2.3 + s, bz * 3.1 - s) > 0.86) {
        const wx = bx + perpX * 2, wz = bz + perpZ * 2;
        put(wx, floorY + 1, wz, hash2(bx * 1.1, bz * 1.9) < 0.3 ? IRON_ORE : COAL_ORE);
      }
      // 溶岩ハザードの小さな池
      if (s >= lavaAt && s <= lavaAt + 1) { put(bx, floorY, bz, LAVA); air(bx, floorY + 1, bz); }
    }
    // 終端の小部屋＋宝箱
    const ex = ox + stepX * len, ez = oz + stepZ * len;
    for (let p = -1; p <= 1; p++) for (let q = 1; q <= 2; q++) {
      const rx = ex + stepX * q + perpX * p, rz = ez + stepZ * q + perpZ * p;
      put(rx, floorY, rz, STONE_BRICK);
      for (let h = 1; h <= 3; h++) air(rx, floorY + h, rz);
    }
    put(ex + stepX, floorY + 1, ez, CHEST);
    put(ex + stepX + perpX, floorY + 2, ez + perpZ, LANTERN);
    // 入口側から地上への階段
    carveStairUp(ox - stepX, oz - stepZ, floorY + 1, dir, -sign, put, air);
  }

  /* ---- 地下湖（大空洞＋水/溶岩＋発光結晶＋砂の岸＋地上への階段） ---- */
  const LAKE_CELL = 104;
  function lakePlanForCell(cx, cz) {
    const chance = hash2(cx * 15.3 - 7.7, cz * 23.9 + 5.1);
    if (chance > 0.085) return null;
    const x = cx * LAKE_CELL + 22 + (hash2(cx * 2.9 + 0.6, cz * 3.7 - 0.5) * (LAKE_CELL - 44) | 0);
    const z = cz * LAKE_CELL + 22 + (hash2(cx * 1.3 - 0.7, cz * 4.9 + 0.4) * (LAKE_CELL - 44) | 0);
    if (distFromSpawn(x, z) < SPAWN_CLEAR_R + 70) return null;
    const surf = heightAt(x, z);
    if (surf <= SEA + 5) return null;
    const rH = 7 + (hash2(cx * 2.1, cz * 1.9) * 4 | 0);
    const rV = 4 + (hash2(cx * 3.3, cz * 2.7) * 2 | 0);
    const midY = 7 + rV;
    if (midY + rV >= surf - 3) return null;
    const lava = hash2(cx * 6.1 + 3.3, cz * 7.7 - 2.2) < 0.3;
    return { x, z, midY, rH, rV, surf, lava };
  }

  function nearestLake(px, pz) {
    let best = null;
    const c0 = Math.floor((px - LAKE_CELL) / LAKE_CELL) - 2, c1 = Math.floor((px + LAKE_CELL) / LAKE_CELL) + 2;
    const d0 = Math.floor((pz - LAKE_CELL) / LAKE_CELL) - 2, d1 = Math.floor((pz + LAKE_CELL) / LAKE_CELL) + 2;
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const p = lakePlanForCell(cx, cz); if (!p) continue;
      const dd = Math.hypot(p.x - px, p.z - pz);
      if (!best || dd < best.dd) best = { plan: p, dd };
    }
    return best;
  }

  function collectLakePlans(x0, x1, z0, z1) {
    const plans = [];
    const pad = 40;
    const c0 = Math.floor((x0 - pad) / LAKE_CELL), c1 = Math.floor((x1 + pad) / LAKE_CELL);
    const d0 = Math.floor((z0 - pad) / LAKE_CELL), d1 = Math.floor((z1 + pad) / LAKE_CELL);
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const p = lakePlanForCell(cx, cz); if (p) plans.push(p);
    }
    return plans;
  }

  function addLakePlan(plan, inWin) {
    const { x: cx, z: cz, midY, rH, rV, lava } = plan;
    const put = (x, y, z, t) => { if (inWin(x, z)) world.set(key(x, y, z), t); };
    const air = (x, y, z) => { if (inWin(x, z)) world.delete(key(x, y, z)); };
    const liquid = lava ? LAVA : WATER;
    const waterY = midY - 1; // 水面（この高さ以下を液体で満たす）
    for (let x = cx - rH; x <= cx + rH; x++) for (let z = cz - rH; z <= cz + rH; z++) {
      for (let y = midY - rV; y <= midY + rV; y++) {
        const d = Math.hypot((x - cx) / rH, (y - midY) / rV, (z - cz) / rH);
        if (d > 1) continue;
        if (y <= waterY) put(x, y, z, liquid);
        else air(x, y, z);
      }
    }
    // 岸と天井の演出：水際は砂、天井寄りの固体面に発光結晶
    for (let x = cx - rH - 1; x <= cx + rH + 1; x++) for (let z = cz - rH - 1; z <= cz + rH + 1; z++) {
      const dh = Math.hypot((x - cx) / rH, (z - cz) / rH);
      if (dh <= 1.05 && dh > 0.55 && !lava) {
        const t = world.get(key(x, waterY, z));
        if (t !== undefined && t !== WATER) put(x, waterY, z, SAND);
      }
      if (dh < 0.85 && hash2(x * 2.7 + 1.3, z * 3.1 - 0.7) > 0.8) {
        const cy = midY + rV;
        if (world.has(key(x, cy + 1, z))) put(x, cy, z, GLOW_CRYSTAL);
      }
    }
    // 岸の一点から地上への階段
    const dir = hash2(cx * 0.7, cz * 0.7) < 0.5 ? 'x' : 'z';
    const sign = hash2(cx * 1.1 + 2.2, cz * 1.1 - 1.3) < 0.5 ? 1 : -1;
    const startX = dir === 'x' ? cx + sign * (rH - 1) : cx;
    const startZ = dir === 'x' ? cz : cz + sign * (rH - 1);
    carveStairUp(startX, startZ, waterY + 1, dir, sign, put, air);
  }

  /* ---- 構造物ビルドキュー（生成フェーズで順に実行） ---- */
  function collectBuilders(x0, x1, z0, z1, inWin) {
    const out = [];
    for (const p of collectStructurePlans(x0, x1, z0, z1)) out.push(() => addStructurePlan(p, inWin));
    for (const p of collectDungeonPlans(x0, x1, z0, z1)) out.push(() => addDungeonPlan(p, inWin));
    for (const p of collectVillagePlans(x0, x1, z0, z1)) out.push(() => addVillagePlan(p, inWin));
    for (const p of collectMineshaftPlans(x0, x1, z0, z1)) out.push(() => addMineshaftPlan(p, inWin));
    for (const p of collectLakePlans(x0, x1, z0, z1)) out.push(() => addLakePlan(p, inWin));
    return out;
  }

  let winCX = 1e9, winCZ = 1e9;
  let generatedX0 = 1e9, generatedX1 = -1e9, generatedZ0 = 1e9, generatedZ1 = -1e9;
  let worldJob = null, pregenJob = null, pregenStatus = 'マップ生成中...';

  function setGeneratedBounds(x0, x1, z0, z1) {
    generatedX0 = x0; generatedX1 = x1; generatedZ0 = z0; generatedZ1 = z1;
  }
  function generatedContains(x0, x1, z0, z1) {
    return x0 >= generatedX0 && x1 <= generatedX1 && z0 >= generatedZ0 && z1 <= generatedZ1;
  }
  function sameRenderChunkArea(ccx, ccz) {
    if (winCX > 1e8) return false;
    return chunkCoord(ccx - WIN_R) === chunkCoord(winCX - WIN_R) &&
      chunkCoord(ccx + WIN_R) === chunkCoord(winCX + WIN_R) &&
      chunkCoord(ccz - WIN_R) === chunkCoord(winCZ - WIN_R) &&
      chunkCoord(ccz + WIN_R) === chunkCoord(winCZ + WIN_R);
  }
  function worldPreloadReady() { return !pregenJob && !rebuildJob; }
  function worldPreloadStatus() { return pregenStatus; }
  function updatePreloadText(text) {
    pregenStatus = text;
    const go = document.querySelector('#overlay .go');
    if (go && !started) go.textContent = text;
  }
  function rangeCells(ranges) {
    return ranges.reduce((n, r) => n + (r.x1 - r.x0 + 1) * (r.z1 - r.z0 + 1), 0);
  }
  function rangeDone(ranges, state) {
    let done = 0;
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const total = (r.x1 - r.x0 + 1) * (r.z1 - r.z0 + 1);
      if (i < state.i) done += total;
      else if (i === state.i) done += Math.max(0, (r.x - r.x0) * (r.z1 - r.z0 + 1) + (r.z - r.z0));
    }
    return done;
  }
  function startPreGenerate(ccx, ccz, x0, x1, z0, z1) {
    const gx0 = ccx - PREGEN_R, gx1 = ccx + PREGEN_R, gz0 = ccz - PREGEN_R, gz1 = ccz + PREGEN_R;
    const M = TREE_MARGIN;
    const terrainRanges = x0 == null ? [{ x0: gx0, x1: gx1, z0: gz0, z1: gz1, x: gx0, z: gz0 }]
      : rangesOutsideRect(gx0, gx1, gz0, gz1, x0, x1, z0, z1);
    const treeRanges = x0 == null ? [{ x0: gx0 - M, x1: gx1 + M, z0: gz0 - M, z1: gz1 + M, x: gx0 - M, z: gz0 - M }]
      : rangesOutsideRect(gx0 - M, gx1 + M, gz0 - M, gz1 + M, x0 - M, x1 + M, z0 - M, z1 + M);
    sortRangesNear(terrainRanges, ccx, ccz);
    sortRangesNear(treeRanges, ccx, ccz);
    pregenJob = {
      gx0, gx1, gz0, gz1,
      terrainRanges, treeRanges,
      terrainTotal: Math.max(1, rangeCells(terrainRanges)),
      treeTotal: Math.max(1, rangeCells(treeRanges)),
      phase: 'terrain',
      scan: { i: 0 },
      structures: null,
      si: 0,
    };
    updatePreloadText('マップ生成中... 0%');
  }

  function generateTerrainColumn(x, z) {
    const h = heightAt(x, z), top = topTypeAt(x, z, h);
    const biome = biomeAt(x, z);
    const mouth = caveMouthAt(x, z, h);
    const waterFeature = waterFeatureAt(x, z, h);
    const bedType = waterFeature ? (waterFeature.bed || SAND) : SAND;
    const fillType = waterFeature ? (waterFeature.fill || WATER) : WATER;
    const lavaCap = biome.id === 'volcano' && h >= 27 && hash2(x * 1.3 + 4.1, z * 1.7 - 2.3) < 0.5;
    for (let y = 0; y <= h; y++) {
      if (y < h && (isCaveAt(x, y, z, h) || (mouth && y >= h - 4))) continue;
      let type;
      if (waterFeature && y >= waterFeature.level - waterFeature.deep && y <= waterFeature.level - 1) type = bedType;
      else if (y === h) type = waterFeature && waterFeature.shore ? SAND : lavaCap ? LAVA : top;
      else if (top === SAND && y >= h - 4) type = SAND;
      else if ((top === GRASS || top === SNOW) && y >= h - 3) type = DIRT;
      else type = oreTypeAt(x, y, z, h);
      world.set(key(x, y, z), type);
    }
    if (waterFeature) {
      // 床を確実に塞ぐ（洞窟入口/洞窟が水の真下を貫通して水が浮くのを防ぐ）
      for (let y = waterFeature.level - waterFeature.deep; y <= waterFeature.level - 1; y++) world.set(key(x, y, z), bedType);
      for (let y = waterFeature.level; y <= Math.max(h + 1, waterFeature.level); y++) world.delete(key(x, y, z));
      world.set(key(x, waterFeature.level, z), fillType);
      if (waterFeature.fallTop != null) for (let y = waterFeature.level + 1; y <= waterFeature.fallTop; y++) world.set(key(x, y, z), fillType);
    }
    for (let y = h + 1; y <= SEA; y++) world.set(key(x, y, z), WATER);
    addCaveDetails(x, z, h, mouth);
  }

  function addTreeAt(x, z, inWin) {
    if (inSpawnClearing(x, z)) return;
    if (!isTrunk(x, z)) return;
    if (structureAffectsColumn(x, z, TREE_MARGIN)) return;
    if (villageAffectsColumn(x, z, 1)) return;
    const gh = heightAt(x, z); if (topTypeAt(x, z, gh) !== GRASS) return;
    if (waterFeatureAt(x, z, gh)) return;
    const jungle = biomeAt(x, z).id === 'jungle';
    const trunk = (jungle ? 6 : 4) + (hash2(x + 7, z - 3) * (jungle ? 5 : 3) | 0), topY = gh + trunk, r = (jungle ? 2 : 2) + (hash2(x - 1, z + 5) < (jungle ? 0.8 : 0.5) ? 1 : 0);
    if (inWin(x, z)) for (let i = 1; i <= trunk; i++) world.set(key(x, gh + i, z), LOG);
    for (let dy = -2; dy <= 2; dy++) {
      const ry = r - Math.abs(dy) * 0.4;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.hypot(dx, dz, dy * 1.2) > ry + 0.4) continue;
        const lx = x + dx, lz = z + dz;
        if (inWin(lx, lz) && !world.has(key(lx, topY + dy, lz))) world.set(key(lx, topY + dy, lz), LEAVES);
      }
    }
    if (inWin(x, z)) world.set(key(x, topY + 1, z), LEAVES);
  }

  // 自然ディテール（岩・倒木・枯れ木・サボテン・沼の水草）をまばらに散らす
  function addDecorAt(x, z, inWin) {
    const sel = hash2(x * 0.37 + 11.1, z * 0.51 - 7.3);
    if (sel > 0.022) return;
    if (inSpawnClearing(x, z)) return;
    if (structureAffectsColumn(x, z, 1) || villageAffectsColumn(x, z, 1)) return;
    const biome = biomeAt(x, z);
    const gh = heightAt(x, z);
    const wf = waterFeatureAt(x, z, gh);
    if (wf) {
      if (biome.id === 'swamp' && sel < 0.012 && inWin(x, z) && world.get(key(x, wf.level, z)) === WATER) world.set(key(x, wf.level, z), LEAVES);
      return;
    }
    const top = topTypeAt(x, z, gh);
    const setCol = (lx, lz, ly, t) => { if (inWin(lx, lz)) world.set(key(lx, ly, lz), t); };
    if (top === SAND && biome.id === 'desert') {
      if (sel < 0.008) { const ht = 2 + (hash2(x * 2.3, z * 1.7) < 0.5 ? 0 : 1); for (let y = 1; y <= ht; y++) setCol(x, z, gh + y, CACTUS); }
      else if (sel < 0.016) { const ht = 1 + (hash2(x * 1.9, z * 2.7) < 0.4 ? 1 : 0); for (let y = 1; y <= ht; y++) setCol(x, z, gh + y, LOG); }
      return;
    }
    if (top !== GRASS) return;
    if (sel < 0.005) { // 岩
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > 2) continue;
        const g2 = heightAt(x + dx, z + dz);
        const hh = 1 + ((dx === 0 && dz === 0) && hash2(x * 3.1, z * 2.9) < 0.5 ? 1 : 0);
        for (let y = 1; y <= hh; y++) setCol(x + dx, z + dz, g2 + y, STONE);
      }
    } else if (sel < 0.011 && (biome.id === 'forest' || biome.id === 'jungle')) { // 倒木
      const dirX = hash2(x * 1.3, z * 1.7) < 0.5;
      const len = 2 + (hash2(x * 2.1, z * 1.1) < 0.5 ? 0 : 1);
      for (let i = 0; i < len; i++) { const lx = x + (dirX ? i : 0), lz = z + (dirX ? 0 : i); const g2 = heightAt(lx, lz); setCol(lx, lz, g2 + 1, LOG); }
    }
  }

  function applyEditsInArea(x0, x1, z0, z1) {
    for (const [k, v] of edits) {
      const c = k.split(',');
      const ex = +c[0], ez = +c[2];
      if (ex < x0 || ex > x1 || ez < z0 || ez > z1) continue;
      if (v < 0) world.delete(k); else world.set(k, v);
    }
  }

  function regenWindow(ccx, ccz) {
    const hadWindow = winCX < 1e8;
    const oldX0 = winCX - WIN_R, oldX1 = winCX + WIN_R, oldZ0 = winCZ - WIN_R, oldZ1 = winCZ + WIN_R;
    const x0 = ccx - WIN_R, x1 = ccx + WIN_R, z0 = ccz - WIN_R, z1 = ccz + WIN_R;
    const oldContains = (x, z) => hadWindow && x >= oldX0 && x <= oldX1 && z >= oldZ0 && z <= oldZ1;

    if (hadWindow) {
      if (generatedContains(x0 - TREE_MARGIN, x1 + TREE_MARGIN, z0 - TREE_MARGIN, z1 + TREE_MARGIN)) {
        const sameChunks = sameRenderChunkArea(ccx, ccz);
        winCX = ccx; winCZ = ccz;
        if (!sameChunks) requestRebuildWindowMove(x0, x1, z0, z1, oldX0, oldX1, oldZ0, oldZ1);
        return;
      }
      if (worldJob) {
        const drift = Math.max(Math.abs(ccx - worldJob.ccx), Math.abs(ccz - worldJob.ccz));
        if (drift < JOB_RETARGET_STEP) return;
      }
      worldJob = {
        ccx, ccz, x0, x1, z0, z1, oldContains,
        oldX0, oldX1, oldZ0, oldZ1,
        terrainRanges: sortRangesNear(rangesOutsideRect(x0, x1, z0, z1, oldX0, oldX1, oldZ0, oldZ1), ccx, ccz),
        treeRanges: sortRangesNear(rangesOutsideRect(x0 - TREE_MARGIN, x1 + TREE_MARGIN, z0 - TREE_MARGIN, z1 + TREE_MARGIN, oldX0 + TREE_MARGIN, oldX1 - TREE_MARGIN, oldZ0 + TREE_MARGIN, oldZ1 - TREE_MARGIN), ccx, ccz),
        phase: 'terrain',
        scan: { i: 0 },
        keyIter: null,
      };
      return;
    }

    winCX = ccx; winCZ = ccz;
    world.clear();
    setGeneratedBounds(1e9, -1e9, 1e9, -1e9);
    startPreGenerate(ccx, ccz, null, null, null, null);
  }

  function processWorldJob() {
    if (pregenJob) {
      const job = pregenJob;
      const end = performance.now() + PREGEN_JOB_MS;
      if (job.phase === 'terrain') {
        if (processRanges(job.terrainRanges, job.scan, end, generateTerrainColumn)) {
          job.phase = 'structures';
          const inGenerated = (x, z) => x >= job.gx0 && x <= job.gx1 && z >= job.gz0 && z <= job.gz1;
          job.buildQueue = collectBuilders(job.gx0, job.gx1, job.gz0, job.gz1, inGenerated);
          job.bi = 0;
        } else {
          updatePreloadText(`マップ生成中... ${Math.min(64, Math.floor(rangeDone(job.terrainRanges, job.scan) / job.terrainTotal * 64))}%`);
          return;
        }
      }
      if (job.phase === 'structures') {
        while (job.bi < job.buildQueue.length && performance.now() < end) job.buildQueue[job.bi++]();
        if (job.bi >= job.buildQueue.length) {
          job.phase = 'trees';
          job.scan = { i: 0 };
        } else {
          updatePreloadText(`マップ生成中... ${65 + Math.floor(job.bi / Math.max(1, job.buildQueue.length) * 10)}%`);
          return;
        }
      }
      if (job.phase === 'trees') {
        const inGenerated = (x, z) => x >= job.gx0 && x <= job.gx1 && z >= job.gz0 && z <= job.gz1;
        if (processRanges(job.treeRanges, job.scan, end, (x, z) => { addTreeAt(x, z, inGenerated); addDecorAt(x, z, inGenerated); })) {
          applyEditsInArea(job.gx0, job.gx1, job.gz0, job.gz1);
          setGeneratedBounds(job.gx0, job.gx1, job.gz0, job.gz1);
          pregenJob = null;
          requestRebuildAsync(winCX - WIN_R, winCX + WIN_R, winCZ - WIN_R, winCZ + WIN_R);
          updatePreloadText('地形描画中...');
        } else {
          updatePreloadText(`マップ生成中... ${75 + Math.min(24, Math.floor(rangeDone(job.treeRanges, job.scan) / job.treeTotal * 24))}%`);
          return;
        }
      }
    }
    const job = worldJob;
    if (!job) return;
    const end = performance.now() + WORLD_JOB_MS;

    if (job.phase === 'terrain') {
      if (processRanges(job.terrainRanges, job.scan, end, generateTerrainColumn)) {
        applyEditsInArea(job.x0, job.x1, job.z0, job.z1);
        winCX = job.ccx; winCZ = job.ccz;
        requestRebuildWindowMove(job.x0, job.x1, job.z0, job.z1, job.oldX0, job.oldX1, job.oldZ0, job.oldZ1);
        job.phase = 'structures';
        const inWin = (x, z) => x >= job.x0 && x <= job.x1 && z >= job.z0 && z <= job.z1;
        job.buildQueue = collectBuilders(job.x0, job.x1, job.z0, job.z1, inWin);
        job.bi = 0;
      }
    }

    if (job.phase === 'structures') {
      while (job.bi < job.buildQueue.length && performance.now() < end) job.buildQueue[job.bi++]();
      if (job.bi >= job.buildQueue.length) {
        job.phase = 'trees';
        job.scan = { i: 0 };
      }
    }

    if (job.phase === 'trees') {
      const inWin = (x, z) => x >= job.x0 && x <= job.x1 && z >= job.z0 && z <= job.z1;
      if (processRanges(job.treeRanges, job.scan, end, (x, z) => { addTreeAt(x, z, inWin); addDecorAt(x, z, inWin); })) {
        applyEditsInArea(job.x0, job.x1, job.z0, job.z1);
        job.phase = 'cleanup';
        job.keyIter = world.keys();
      }
    }

    if (job.phase === 'cleanup') {
      while (performance.now() < end) {
        const n = job.keyIter.next();
        if (n.done) {
          winCX = job.ccx; winCZ = job.ccz;
          setGeneratedBounds(job.x0, job.x1, job.z0, job.z1);
          requestRebuildWindowMove(job.x0, job.x1, job.z0, job.z1, job.oldX0, job.oldX1, job.oldZ0, job.oldZ1);
          if (worldJob === job) worldJob = null;
          break;
        }
        const c = n.value.split(',');
        const x = +c[0], z = +c[2];
        if (x < job.x0 || x > job.x1 || z < job.z0 || z > job.z1) world.delete(n.value);
      }
    }
  }
