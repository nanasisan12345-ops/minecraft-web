  /* ============== 動物NPC（ブロック調の軽量な野生動物） ============== */
  const ANIMALS = [];
  const ANIMAL_MAX = 26, ANIMAL_SPAWN_R = 74, ANIMAL_DESPAWN_R = 105, ANIMAL_KEEP_OUT = 12;
  const ANIMAL_TYPES = {
    cow: { color: 0x6b4328, accent: 0xf5f0df, biome: ['plains', 'forest'] },
    sheep: { color: 0xf1eee0, accent: 0x26211d, biome: ['plains', 'snowfield'] },
    pig: { color: 0xf19aad, accent: 0xffc0cc, biome: ['plains', 'forest'] },
    chicken: { color: 0xf6f0d8, accent: 0xd9342b, biome: ['plains', 'forest'] },
    deer: { color: 0x9a5d32, accent: 0xf2dfbd, biome: ['forest', 'plains'] },
    squirrel: { color: 0xb86f32, accent: 0xf2c89b, biome: ['forest'] },
    duck: { color: 0xf2f0dc, accent: 0xf0b327, biome: ['plains', 'forest'] },
    bear: { color: 0x5b3824, accent: 0xc69b6d, biome: ['forest'] },
    hedgehog: { color: 0x8a5a3a, accent: 0xe5c69a, biome: ['forest', 'plains'] },
    sparrow: { color: 0x9c7652, accent: 0xe9d2a8, biome: ['forest', 'plains'] },
  };
  const ANIMAL_BEHAVIOR = {
    cow: { scale: 1.16, speed: 0.5, turn: 0.45, turnMin: 3.5, turnMax: 7.0, pauseChance: 0.24, pauseMin: 0.8, pauseMax: 2.0, bob: 0.016, step: 4.0 },
    sheep: { scale: 0.98, speed: 0.62, turn: 0.65, turnMin: 2.6, turnMax: 5.6, pauseChance: 0.28, pauseMin: 0.5, pauseMax: 1.5, bob: 0.02, step: 5.0 },
    pig: { scale: 0.82, speed: 0.82, turn: 0.95, turnMin: 1.8, turnMax: 4.0, pauseChance: 0.18, pauseMin: 0.25, pauseMax: 0.9, bob: 0.018, step: 6.2 },
    chicken: { scale: 0.58, speed: 1.35, turn: 1.45, turnMin: 0.8, turnMax: 2.2, pauseChance: 0.34, pauseMin: 0.15, pauseMax: 0.55, bob: 0.035, step: 10.0 },
    deer: { scale: 1.05, speed: 0.92, turn: 0.5, turnMin: 3.0, turnMax: 6.5, pauseChance: 0.38, pauseMin: 0.7, pauseMax: 1.8, bob: 0.018, step: 5.2 },
    squirrel: { scale: 0.42, speed: 1.55, turn: 1.8, turnMin: 0.7, turnMax: 1.9, pauseChance: 0.44, pauseMin: 0.08, pauseMax: 0.35, bob: 0.05, step: 13.0 },
    duck: { scale: 0.62, speed: 0.92, turn: 1.2, turnMin: 1.2, turnMax: 3.2, pauseChance: 0.2, pauseMin: 0.2, pauseMax: 0.8, bob: 0.032, step: 8.0 },
    bear: { scale: 1.35, speed: 0.42, turn: 0.38, turnMin: 4.0, turnMax: 8.0, pauseChance: 0.36, pauseMin: 1.0, pauseMax: 2.6, bob: 0.014, step: 3.2 },
    hedgehog: { scale: 0.5, speed: 0.78, turn: 1.1, turnMin: 1.4, turnMax: 3.4, pauseChance: 0.5, pauseMin: 0.25, pauseMax: 1.0, bob: 0.018, step: 7.0 },
    sparrow: { scale: 0.36, speed: 1.65, turn: 1.7, turnMin: 0.8, turnMax: 2.1, pauseChance: 0.42, pauseMin: 0.1, pauseMax: 0.45, bob: 0.045, step: 12.0 },
  };
  const animalMatCache = new Map();
  let animalSpawnClock = 0;
  function animalMat(color) {
    if (!animalMatCache.has(color)) animalMatCache.set(color, new THREE.MeshLambertMaterial({ color }));
    return animalMatCache.get(color);
  }
  function animalBox(parent, sx, sy, sz, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), animalMat(color));
    m.castShadow = false; m.receiveShadow = true; m.position.set(x, y, z); parent.add(m); return m;
  }
  function animalAngleDelta(a, b) {
    return Math.atan2(Math.sin(b - a), Math.cos(b - a));
  }
  function makeAnimal(kind) {
    const cfg = ANIMAL_TYPES[kind], g = new THREE.Group();
    const leg = (x, z, color, h = 0.34) => animalBox(g, 0.12, h, 0.12, color, x, h * 0.5, z);
    const eyes = (y, z, color = 0x111111) => {
      animalBox(g, 0.055, 0.055, 0.026, color, -0.105, y, z);
      animalBox(g, 0.055, 0.055, 0.026, color, 0.105, y, z);
    };
    const cuteEyes = (y, z, gap = 0.105) => {
      animalBox(g, 0.075, 0.075, 0.022, 0xf7f7f2, -gap, y, z);
      animalBox(g, 0.075, 0.075, 0.022, 0xf7f7f2, gap, y, z);
      animalBox(g, 0.035, 0.035, 0.018, 0x151515, -gap, y - 0.003, z - 0.02);
      animalBox(g, 0.035, 0.035, 0.018, 0x151515, gap, y - 0.003, z - 0.02);
    };
    if (kind === 'cow') {
      animalBox(g, 0.7, 0.44, 0.92, cfg.color, 0, 0.44, 0.08);
      animalBox(g, 0.3, 0.28, 0.16, cfg.accent, -0.18, 0.52, -0.08);
      animalBox(g, 0.28, 0.22, 0.16, cfg.accent, 0.18, 0.36, 0.24);
      animalBox(g, 0.36, 0.32, 0.36, cfg.color, 0, 0.55, -0.58);
      animalBox(g, 0.28, 0.14, 0.07, 0xe8c9a5, 0, 0.47, -0.79);
      animalBox(g, 0.045, 0.035, 0.02, 0x7a4d39, -0.055, 0.48, -0.835);
      animalBox(g, 0.045, 0.035, 0.02, 0x7a4d39, 0.055, 0.48, -0.835);
      cuteEyes(0.6, -0.785, 0.095);
      animalBox(g, 0.08, 0.07, 0.1, 0xefe5c4, -0.19, 0.77, -0.62);
      animalBox(g, 0.08, 0.07, 0.1, 0xefe5c4, 0.19, 0.77, -0.62);
      animalBox(g, 0.12, 0.16, 0.07, cfg.color, -0.26, 0.57, -0.57);
      animalBox(g, 0.12, 0.16, 0.07, cfg.color, 0.26, 0.57, -0.57);
      leg(-0.26, -0.26, cfg.color); leg(0.26, -0.26, cfg.color); leg(-0.26, 0.42, cfg.color); leg(0.26, 0.42, cfg.color);
      animalBox(g, 0.08, 0.08, 0.22, cfg.color, 0, 0.56, 0.7);
    } else if (kind === 'sheep') {
      animalBox(g, 0.74, 0.5, 0.84, cfg.color, 0, 0.48, 0.08);
      animalBox(g, 0.58, 0.18, 0.62, 0xffffff, 0, 0.78, 0.04);
      animalBox(g, 0.2, 0.24, 0.44, 0xffffff, -0.42, 0.54, 0.04);
      animalBox(g, 0.2, 0.24, 0.44, 0xffffff, 0.42, 0.54, 0.04);
      animalBox(g, 0.22, 0.2, 0.22, 0xffffff, -0.28, 0.72, -0.22);
      animalBox(g, 0.22, 0.2, 0.22, 0xffffff, 0.28, 0.72, -0.22);
      animalBox(g, 0.34, 0.32, 0.3, cfg.accent, 0, 0.56, -0.58);
      animalBox(g, 0.38, 0.16, 0.26, 0xffffff, 0, 0.75, -0.56);
      animalBox(g, 0.22, 0.11, 0.07, 0xd8c7b0, 0, 0.5, -0.78);
      cuteEyes(0.61, -0.765, 0.085);
      animalBox(g, 0.09, 0.12, 0.07, cfg.accent, -0.23, 0.56, -0.56);
      animalBox(g, 0.09, 0.12, 0.07, cfg.accent, 0.23, 0.56, -0.56);
      leg(-0.22, -0.18, cfg.accent, 0.28); leg(0.22, -0.18, cfg.accent, 0.28); leg(-0.22, 0.32, cfg.accent, 0.28); leg(0.22, 0.32, cfg.accent, 0.28);
      animalBox(g, 0.16, 0.16, 0.12, 0xffffff, 0, 0.52, 0.56);
    } else if (kind === 'pig') {
      animalBox(g, 0.68, 0.38, 0.8, cfg.color, 0, 0.39, 0.06);
      animalBox(g, 0.38, 0.34, 0.34, cfg.color, 0, 0.48, -0.54);
      animalBox(g, 0.26, 0.14, 0.09, cfg.accent, 0, 0.44, -0.76);
      animalBox(g, 0.035, 0.035, 0.026, 0xa14d5f, -0.06, 0.47, -0.815);
      animalBox(g, 0.035, 0.035, 0.026, 0xa14d5f, 0.06, 0.47, -0.815);
      cuteEyes(0.55, -0.745, 0.09);
      animalBox(g, 0.11, 0.15, 0.07, cfg.color, -0.23, 0.63, -0.53);
      animalBox(g, 0.11, 0.15, 0.07, cfg.color, 0.23, 0.63, -0.53);
      animalBox(g, 0.18, 0.18, 0.08, 0xffadbd, -0.28, 0.42, 0.02);
      animalBox(g, 0.18, 0.18, 0.08, 0xffadbd, 0.28, 0.42, 0.02);
      leg(-0.22, -0.18, cfg.color, 0.24); leg(0.22, -0.18, cfg.color, 0.24); leg(-0.22, 0.3, cfg.color, 0.24); leg(0.22, 0.3, cfg.color, 0.24);
      animalBox(g, 0.08, 0.08, 0.14, cfg.accent, 0, 0.45, 0.54);
    } else if (kind === 'chicken') {
      animalBox(g, 0.38, 0.42, 0.44, cfg.color, 0, 0.42, 0.04);
      animalBox(g, 0.3, 0.3, 0.28, cfg.color, 0, 0.72, -0.24);
      animalBox(g, 0.18, 0.1, 0.14, 0xffc638, 0, 0.68, -0.48);
      eyes(0.76, -0.39);
      animalBox(g, 0.18, 0.1, 0.08, cfg.accent, 0, 0.93, -0.24);
      g.userData.leftWing = animalBox(g, 0.08, 0.24, 0.22, 0xf0e9cf, -0.26, 0.42, 0.03);
      g.userData.rightWing = animalBox(g, 0.08, 0.24, 0.22, 0xf0e9cf, 0.26, 0.42, 0.03);
      leg(-0.08, 0.02, 0xffc638, 0.22); leg(0.08, 0.02, 0xffc638, 0.22);
      animalBox(g, 0.22, 0.24, 0.08, 0xffffff, 0, 0.54, 0.32);
    } else if (kind === 'deer') {
      animalBox(g, 0.52, 0.42, 0.9, cfg.color, 0, 0.58, 0.08);
      animalBox(g, 0.2, 0.24, 0.16, 0xf1d8b0, -0.16, 0.62, 0.0);
      animalBox(g, 0.28, 0.3, 0.32, cfg.color, 0, 0.78, -0.58);
      animalBox(g, 0.22, 0.11, 0.08, 0x4b2a19, 0, 0.72, -0.78);
      cuteEyes(0.82, -0.755, 0.075);
      animalBox(g, 0.08, 0.18, 0.06, cfg.color, -0.2, 0.91, -0.56);
      animalBox(g, 0.08, 0.18, 0.06, cfg.color, 0.2, 0.91, -0.56);
      animalBox(g, 0.05, 0.22, 0.05, cfg.accent, -0.12, 1.05, -0.6);
      animalBox(g, 0.05, 0.22, 0.05, cfg.accent, 0.12, 1.05, -0.6);
      animalBox(g, 0.14, 0.04, 0.04, cfg.accent, -0.17, 1.14, -0.6);
      animalBox(g, 0.14, 0.04, 0.04, cfg.accent, 0.17, 1.14, -0.6);
      leg(-0.18, -0.24, 0x4b2a19, 0.52); leg(0.18, -0.24, 0x4b2a19, 0.52); leg(-0.18, 0.36, 0x4b2a19, 0.52); leg(0.18, 0.36, 0x4b2a19, 0.52);
      animalBox(g, 0.16, 0.14, 0.1, 0xf7f1e2, 0, 0.64, 0.6);
    } else if (kind === 'squirrel') {
      animalBox(g, 0.42, 0.34, 0.48, cfg.color, 0, 0.34, 0.02);
      animalBox(g, 0.3, 0.28, 0.28, cfg.color, 0, 0.52, -0.32);
      animalBox(g, 0.2, 0.12, 0.08, cfg.accent, 0, 0.47, -0.5);
      cuteEyes(0.57, -0.49, 0.075);
      animalBox(g, 0.07, 0.11, 0.06, cfg.color, -0.18, 0.68, -0.32);
      animalBox(g, 0.07, 0.11, 0.06, cfg.color, 0.18, 0.68, -0.32);
      g.userData.tail = animalBox(g, 0.28, 0.66, 0.18, cfg.color, 0, 0.58, 0.42);
      animalBox(g, 0.2, 0.34, 0.12, 0xd9904b, 0, 0.62, 0.5);
      leg(-0.12, -0.08, cfg.color, 0.2); leg(0.12, -0.08, cfg.color, 0.2); leg(-0.12, 0.22, cfg.color, 0.22); leg(0.12, 0.22, cfg.color, 0.22);
    } else if (kind === 'duck') {
      animalBox(g, 0.44, 0.36, 0.52, cfg.color, 0, 0.34, 0.06);
      animalBox(g, 0.3, 0.3, 0.3, cfg.color, 0, 0.6, -0.3);
      animalBox(g, 0.24, 0.1, 0.16, cfg.accent, 0, 0.55, -0.54);
      cuteEyes(0.65, -0.46, 0.08);
      g.userData.leftWing = animalBox(g, 0.08, 0.22, 0.26, 0xd7d2bc, -0.29, 0.36, 0.06);
      g.userData.rightWing = animalBox(g, 0.08, 0.22, 0.26, 0xd7d2bc, 0.29, 0.36, 0.06);
      leg(-0.09, 0.02, 0xf0a51f, 0.18); leg(0.09, 0.02, 0xf0a51f, 0.18);
      animalBox(g, 0.2, 0.18, 0.08, 0xffffff, 0, 0.42, 0.36);
    } else if (kind === 'bear') {
      animalBox(g, 0.86, 0.56, 1.05, cfg.color, 0, 0.5, 0.08);
      animalBox(g, 0.44, 0.38, 0.38, cfg.color, 0, 0.68, -0.62);
      animalBox(g, 0.3, 0.18, 0.1, cfg.accent, 0, 0.6, -0.84);
      animalBox(g, 0.05, 0.035, 0.02, 0x1b1512, 0, 0.62, -0.91);
      cuteEyes(0.72, -0.835, 0.095);
      animalBox(g, 0.13, 0.13, 0.08, cfg.color, -0.22, 0.9, -0.62);
      animalBox(g, 0.13, 0.13, 0.08, cfg.color, 0.22, 0.9, -0.62);
      leg(-0.28, -0.24, cfg.color, 0.34); leg(0.28, -0.24, cfg.color, 0.34); leg(-0.28, 0.38, cfg.color, 0.34); leg(0.28, 0.38, cfg.color, 0.34);
      animalBox(g, 0.18, 0.14, 0.1, cfg.accent, 0, 0.5, 0.66);
    } else if (kind === 'hedgehog') {
      animalBox(g, 0.5, 0.28, 0.56, cfg.color, 0, 0.28, 0.08);
      animalBox(g, 0.34, 0.24, 0.28, cfg.accent, 0, 0.35, -0.36);
      animalBox(g, 0.18, 0.08, 0.08, 0x6b3f2a, 0, 0.31, -0.56);
      cuteEyes(0.39, -0.545, 0.065);
      for (let i = 0; i < 5; i++) animalBox(g, 0.07, 0.16, 0.07, 0x4d3627, -0.24 + i * 0.12, 0.52, -0.1);
      for (let i = 0; i < 4; i++) animalBox(g, 0.07, 0.14, 0.07, 0x4d3627, -0.18 + i * 0.12, 0.49, 0.18);
      leg(-0.15, -0.12, 0x4d3627, 0.14); leg(0.15, -0.12, 0x4d3627, 0.14); leg(-0.15, 0.22, 0x4d3627, 0.14); leg(0.15, 0.22, 0x4d3627, 0.14);
    } else if (kind === 'sparrow') {
      animalBox(g, 0.3, 0.26, 0.34, cfg.color, 0, 0.35, 0.04);
      animalBox(g, 0.24, 0.22, 0.22, cfg.color, 0, 0.55, -0.22);
      animalBox(g, 0.14, 0.07, 0.1, 0xd29c45, 0, 0.52, -0.41);
      cuteEyes(0.59, -0.36, 0.065);
      animalBox(g, 0.24, 0.1, 0.08, cfg.accent, 0, 0.31, -0.02);
      g.userData.leftWing = animalBox(g, 0.06, 0.18, 0.22, 0x775337, -0.2, 0.36, 0.02);
      g.userData.rightWing = animalBox(g, 0.06, 0.18, 0.22, 0x775337, 0.2, 0.36, 0.02);
      leg(-0.06, 0.02, 0xd29c45, 0.18); leg(0.06, 0.02, 0xd29c45, 0.18);
      animalBox(g, 0.18, 0.14, 0.08, 0x775337, 0, 0.42, 0.28);
    }
    const behavior = ANIMAL_BEHAVIOR[kind] || ANIMAL_BEHAVIOR.sheep;
    g.scale.setScalar(behavior.scale);
    g.userData.kind = kind; g.userData.home = new THREE.Vector3(); g.userData.behavior = behavior; g.userData.dir = Math.random() * Math.PI * 2; g.userData.turnTo = g.userData.dir; g.userData.nextTurn = rnd(behavior.turnMin, behavior.turnMax); g.userData.idleTime = rnd(0, behavior.pauseMax * 0.5); g.userData.blockedCooldown = 0; g.userData.flapTime = 0; g.userData.flightTime = 0; g.userData.flightDuration = 0; g.userData.flightCooldown = kind === 'sparrow' ? rnd(2.0, 6.0) : 0; g.userData.walkPhase = Math.random() * Math.PI * 2; g.userData.speed = behavior.speed;
    g.rotation.y = g.userData.dir + Math.PI;
    return g;
  }
  function animalKindForBiome(biome) {
    const pool = Object.keys(ANIMAL_TYPES).filter(k => ANIMAL_TYPES[k].biome.includes(biome.id));
    if (!pool.length) return null;
    return pool[(hash2(biome.base + Math.random() * 91, biome.height + Math.random() * 53) * pool.length) | 0];
  }
  function canPlaceAnimalAt(x, z) {
    if (inSpawnClearing(x, z, ANIMAL_KEEP_OUT)) return false;
    const h = heightAt(x, z);
    const top = topTypeAt(x, z, h);
    if (top !== GRASS && top !== SNOW) return false;
    if (typeof waterFeatureAt === 'function' && waterFeatureAt(x, z, h)) return false;
    if (hasBlock(x, h + 1, z) || structureAffectsColumn(x, z, 2)) return false;
    const biome = biomeAt(x, z);
    if (biome.id === 'desert' || biome.id === 'highlands') return false;
    return true;
  }
  function spawnAnimalNearPlayer() {
    if (!started || ANIMALS.length >= ANIMAL_MAX || typeof RAVE !== 'undefined' && RAVE.on) return;
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2, r = rnd(18, ANIMAL_SPAWN_R);
      const x = Math.floor(player.pos.x + Math.cos(a) * r), z = Math.floor(player.pos.z + Math.sin(a) * r);
      if (!canPlaceAnimalAt(x, z)) continue;
      const biome = biomeAt(x, z), kind = animalKindForBiome(biome); if (!kind) continue;
      const h = heightAt(x, z), animal = makeAnimal(kind);
      animal.position.set(x + 0.5, h + 1, z + 0.5);
      animal.userData.home.copy(animal.position);
      scene.add(animal); ANIMALS.push(animal);
      return;
    }
  }
  function updateAnimal(animal, dt) {
    const u = animal.userData, b = u.behavior || ANIMAL_BEHAVIOR.sheep;
    u.nextTurn -= dt;
    u.idleTime = Math.max(0, (u.idleTime || 0) - dt);
    u.blockedCooldown = Math.max(0, (u.blockedCooldown || 0) - dt);
    u.flightCooldown = Math.max(0, (u.flightCooldown || 0) - dt);
    if (u.kind === 'sparrow' && (u.flightTime || 0) <= 0 && u.flightCooldown <= 0 && Math.random() < 0.03) {
      u.flightDuration = rnd(1.4, 2.6);
      u.flightTime = u.flightDuration;
      u.flightCooldown = rnd(5.0, 10.0);
      u.idleTime = 0;
      u.turnTo += rnd(-0.7, 0.7);
    }
    const flying = u.kind === 'sparrow' && (u.flightTime || 0) > 0;
    if (u.nextTurn <= 0) {
      u.turnTo += rnd(-b.turn, b.turn);
      u.nextTurn = rnd(b.turnMin, b.turnMax);
      if (!flying && Math.random() < b.pauseChance) u.idleTime = rnd(b.pauseMin, b.pauseMax);
    }
    u.dir += animalAngleDelta(u.dir, u.turnTo) * Math.min(1, dt * (u.kind === 'chicken' ? 6.0 : 3.2));
    const moveSpeed = u.idleTime > 0 ? 0 : u.speed * (flying ? 1.55 : 1);
    const nx = animal.position.x + Math.sin(u.dir) * moveSpeed * dt, nz = animal.position.z + Math.cos(u.dir) * moveSpeed * dt;
    const ix = Math.floor(nx), iz = Math.floor(nz), h = heightAt(ix, iz);
    const currentGroundY = heightAt(Math.floor(animal.position.x), Math.floor(animal.position.z)) + 1;
    const targetGroundY = h + 1;
    const homeDist = Math.hypot(nx - u.home.x, nz - u.home.z);
    let moved = false;
    const flyColumnOk = flying && (topTypeAt(ix, iz, h) === GRASS || topTypeAt(ix, iz, h) === SNOW) && !(typeof waterFeatureAt === 'function' && waterFeatureAt(ix, iz, h)) && !structureAffectsColumn(ix, iz, 2);
    if (moveSpeed > 0 && (canPlaceAnimalAt(ix, iz) || flyColumnOk) && (flying || Math.abs(h + 1 - animal.position.y) < 1.8) && homeDist < (flying ? 30 : 22)) {
      animal.position.x = nx; animal.position.z = nz; moved = true;
      if (u.kind === 'chicken' && targetGroundY > currentGroundY + 0.15) u.flapTime = 0.38;
    } else if (u.blockedCooldown <= 0) {
      const backHome = Math.atan2(u.home.x - animal.position.x, u.home.z - animal.position.z);
      u.turnTo = homeDist >= 22 ? backHome : u.dir + Math.PI + rnd(-b.turn * 0.7, b.turn * 0.7);
      u.blockedCooldown = rnd(0.6, 1.4);
      u.nextTurn = rnd(Math.max(0.7, b.turnMin * 0.6), Math.max(1.2, b.turnMax * 0.6));
    }
    u.walkPhase += moved ? dt * b.step : dt * (u.kind === 'chicken' ? 5.0 : 1.5);
    const groundY = heightAt(Math.floor(animal.position.x), Math.floor(animal.position.z)) + 1;
    u.flapTime = Math.max(0, (u.flapTime || 0) - dt);
    const flapLift = u.kind === 'chicken' && u.flapTime > 0 ? Math.sin((u.flapTime / 0.38) * Math.PI) * 0.22 : 0;
    const squirrelHop = u.kind === 'squirrel' && moved ? Math.max(0, Math.sin(u.walkPhase)) * 0.08 : 0;
    const birdHop = u.kind === 'sparrow' && moved && !flying ? Math.max(0, Math.sin(u.walkPhase * 1.2)) * 0.06 : 0;
    const flightProgress = flying && u.flightDuration > 0 ? 1 - (u.flightTime / u.flightDuration) : 0;
    const flightLift = flying ? 0.35 + Math.sin(flightProgress * Math.PI) * 1.05 : 0;
    animal.position.y = groundY + Math.sin(u.walkPhase) * (moved ? b.bob : b.bob * 0.25) + flapLift + squirrelHop + birdHop + flightLift;
    if ((u.kind === 'chicken' || u.kind === 'duck' || u.kind === 'sparrow') && u.leftWing && u.rightWing) {
      const wingBoost = u.kind === 'chicken' && u.flapTime > 0 ? 0.75 : u.kind === 'sparrow' && flying ? 0.95 : u.kind === 'sparrow' && moved ? 0.45 : u.kind === 'duck' ? 0.2 : 0.12;
      const flap = Math.sin((u.kind === 'sparrow' ? performance.now() * (flying ? 0.055 : 0.028) : u.walkPhase) + (u.kind === 'duck' ? 0.8 : 0)) * wingBoost;
      u.leftWing.rotation.z = flap;
      u.rightWing.rotation.z = -flap;
    }
    if (flying) u.flightTime = Math.max(0, u.flightTime - dt);
    if (u.kind === 'squirrel' && u.tail) u.tail.rotation.x = -0.22 + Math.sin(u.walkPhase * 0.55) * 0.18;
    if (u.kind === 'deer') animal.rotation.x = u.idleTime > 0 ? Math.sin(u.walkPhase * 0.35) * 0.025 : 0;
    animal.rotation.y += animalAngleDelta(animal.rotation.y, u.dir + Math.PI) * Math.min(1, dt * 8);
  }
  function updateAnimals(dt) {
    animalSpawnClock -= dt;
    if (animalSpawnClock <= 0) { spawnAnimalNearPlayer(); animalSpawnClock = rnd(1.2, 3.2); }
    for (let i = ANIMALS.length - 1; i >= 0; i--) {
      const a = ANIMALS[i];
      const dist = Math.hypot(a.position.x - player.pos.x, a.position.z - player.pos.z);
      if (dist > ANIMAL_DESPAWN_R) {
        scene.remove(a);
        ANIMALS.splice(i, 1);
        continue;
      }
      updateAnimal(a, dt);
    }
  }
