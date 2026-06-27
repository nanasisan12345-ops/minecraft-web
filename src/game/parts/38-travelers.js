  /* ============== 旅人NPC（通常ワールド用の村人風ブロックモデル） ============== */
  const TRAVELERS = [];
  const TRAVELER_MAX = 8, TRAVELER_SPAWN_R = 82, TRAVELER_DESPAWN_R = 120;
  const TRAVELER_TYPES = [
    { robe: 0x7a5a36, trim: 0xc19a5a, hood: 0x5d432b },
    { robe: 0x435f7a, trim: 0x9fc3d8, hood: 0x2f455c },
    { robe: 0x6f4b72, trim: 0xd9b0c9, hood: 0x513452 },
    { robe: 0x55764a, trim: 0xb8d28a, hood: 0x3c5735 },
  ];
  const travelerMatCache = new Map();
  let travelerSpawnClock = 2.5;
  function travelerMat(color) {
    if (!travelerMatCache.has(color)) travelerMatCache.set(color, new THREE.MeshLambertMaterial({ color }));
    return travelerMatCache.get(color);
  }
  function travelerBox(parent, sx, sy, sz, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), travelerMat(color));
    m.castShadow = false; m.receiveShadow = true; m.position.set(x, y, z); parent.add(m); return m;
  }
  function makeTraveler() {
    const cfg = TRAVELER_TYPES[(Math.random() * TRAVELER_TYPES.length) | 0];
    const g = new THREE.Group();
    const body = travelerBox(g, 0.54, 0.86, 0.34, cfg.robe, 0, 0.78, 0);
    travelerBox(g, 0.58, 0.12, 0.38, cfg.trim, 0, 1.16, -0.01);
    travelerBox(g, 0.46, 0.18, 0.36, cfg.trim, 0, 0.43, -0.01);
    const head = travelerBox(g, 0.46, 0.46, 0.46, 0xc69063, 0, 1.45, -0.02);
    travelerBox(head, 0.18, 0.18, 0.10, 0xb6754d, 0, -0.02, -0.27);
    travelerBox(head, 0.28, 0.07, 0.03, cfg.hood, 0, 0.1, -0.252);
    travelerBox(head, 0.055, 0.055, 0.025, 0x15120f, -0.105, 0.035, -0.268);
    travelerBox(head, 0.055, 0.055, 0.025, 0x15120f, 0.105, 0.035, -0.268);
    travelerBox(g, 0.13, 0.56, 0.14, 0x4a3124, -0.17, 0.54, -0.02);
    travelerBox(g, 0.13, 0.56, 0.14, 0x4a3124, 0.17, 0.54, -0.02);
    const leftArm = travelerBox(g, 0.17, 0.62, 0.14, cfg.hood, -0.36, 0.94, -0.06);
    const rightArm = travelerBox(g, 0.17, 0.62, 0.14, cfg.hood, 0.36, 0.94, -0.06);
    leftArm.rotation.z = -0.34; rightArm.rotation.z = 0.34;
    travelerBox(g, 0.56, 0.12, 0.18, cfg.hood, 0, 0.88, -0.24);
    const pack = travelerBox(g, 0.42, 0.48, 0.16, 0x6b4b2e, 0, 0.88, 0.26);
    travelerBox(pack, 0.34, 0.06, 0.05, 0xc49a5a, 0, 0.14, 0.09);
    g.userData.kind = 'traveler';
    g.userData.head = head;
    g.userData.body = body;
    g.userData.dir = Math.random() * Math.PI * 2;
    g.userData.turnTo = g.userData.dir;
    g.userData.nextTurn = rnd(2.0, 5.4);
    g.userData.idleTime = rnd(0.6, 2.2);
    g.userData.walkPhase = Math.random() * Math.PI * 2;
    g.userData.home = new THREE.Vector3();
    g.userData.speed = rnd(0.45, 0.72);
    g.rotation.y = g.userData.dir + Math.PI;
    return g;
  }
  function travelerSurfaceY(x, z) {
    for (let y = CHUNK_Y_MAX; y >= 0; y--) {
      const t = world.get(key(x, y, z));
      if (t !== undefined && TYPES[t].solid !== false) return y;
    }
    return heightAt(x, z);
  }
  function canPlaceTravelerAt(x, z) {
    if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 8)) return false;
    if (!structureAffectsColumn(x, z, 9) && !villageAffectsColumn(x, z, 2) && biomeAt(x, z).id !== 'plains') return false;
    const y = travelerSurfaceY(x, z), top = world.get(key(x, y, z));
    if (![GRASS, STONE, BRICK, SAND, SNOW, PLANKS].includes(top)) return false;
    if (typeof waterFeatureAt === 'function' && waterFeatureAt(x, z, heightAt(x, z))) return false;
    if (world.has(key(x, y + 1, z)) || world.has(key(x, y + 2, z))) return false;
    return true;
  }
  function villageSpawnSpot() {
    if (typeof nearestVillage !== 'function') return null;
    const v = nearestVillage(Math.floor(player.pos.x), Math.floor(player.pos.z));
    if (!v || v.dd > TRAVELER_SPAWN_R) return null;
    const slots = v.plan.slots;
    const pick = Math.random() < 0.5 || !slots.length ? null : slots[(Math.random() * slots.length) | 0];
    const bx = pick ? pick.bx : v.plan.x, bz = pick ? pick.bz : v.plan.z;
    return { x: bx + ((Math.random() * 7 - 3) | 0), z: bz + ((Math.random() * 7 - 3) | 0) };
  }
  function spawnTravelerNearPlayer() {
    if (!started || TRAVELERS.length >= TRAVELER_MAX || typeof RAVE !== 'undefined' && RAVE.on) return;
    for (let tries = 0; tries < 18; tries++) {
      let x, z;
      const spot = tries < 6 ? villageSpawnSpot() : null; // 村が近ければ村に住まわせる
      if (spot) { x = spot.x; z = spot.z; }
      else { const a = Math.random() * Math.PI * 2, r = rnd(24, TRAVELER_SPAWN_R); x = Math.floor(player.pos.x + Math.cos(a) * r); z = Math.floor(player.pos.z + Math.sin(a) * r); }
      if (!canPlaceTravelerAt(x, z)) continue;
      const y = travelerSurfaceY(x, z), traveler = makeTraveler();
      traveler.position.set(x + 0.5, y + 1, z + 0.5);
      traveler.userData.home.copy(traveler.position);
      scene.add(traveler); TRAVELERS.push(traveler);
      return;
    }
  }
  function updateTraveler(t, dt) {
    const u = t.userData;
    u.nextTurn -= dt; u.idleTime = Math.max(0, u.idleTime - dt);
    const pd = Math.hypot(player.pos.x - t.position.x, player.pos.z - t.position.z);
    if (pd < 7) {
      u.turnTo = Math.atan2(player.pos.x - t.position.x, player.pos.z - t.position.z);
      u.idleTime = Math.max(u.idleTime, 0.35);
    } else if (u.nextTurn <= 0) {
      u.turnTo += rnd(-0.95, 0.95);
      u.nextTurn = rnd(2.0, 5.8);
      if (Math.random() < 0.45) u.idleTime = rnd(0.6, 2.0);
    }
    u.dir += animalAngleDelta(u.dir, u.turnTo) * Math.min(1, dt * 2.4);
    const moving = u.idleTime <= 0 && pd >= 5;
    const nx = t.position.x + Math.sin(u.dir) * u.speed * dt, nz = t.position.z + Math.cos(u.dir) * u.speed * dt;
    const ix = Math.floor(nx), iz = Math.floor(nz);
    const homeDist = Math.hypot(nx - u.home.x, nz - u.home.z);
    if (moving && homeDist < 18 && canPlaceTravelerAt(ix, iz)) {
      const y = travelerSurfaceY(ix, iz);
      if (Math.abs(y + 1 - t.position.y) < 1.3) {
        t.position.x = nx; t.position.z = nz; t.position.y = y + 1;
      }
    } else if (moving) {
      u.turnTo = Math.atan2(u.home.x - t.position.x, u.home.z - t.position.z) + rnd(-0.5, 0.5);
      u.nextTurn = rnd(1.0, 2.2);
    }
    u.walkPhase += dt * (moving ? 5.4 : 1.4);
    t.position.y = travelerSurfaceY(Math.floor(t.position.x), Math.floor(t.position.z)) + 1 + Math.sin(u.walkPhase) * (moving ? 0.018 : 0.006);
    t.rotation.y += animalAngleDelta(t.rotation.y, u.dir + Math.PI) * Math.min(1, dt * 7);
    if (u.head) u.head.rotation.x = Math.sin(u.walkPhase * 0.55) * (pd < 7 ? 0.08 : 0.035);
    if (u.body) u.body.rotation.z = Math.sin(u.walkPhase) * (moving ? 0.025 : 0.01);
  }
  function updateTravelers(dt) {
    travelerSpawnClock -= dt;
    if (travelerSpawnClock <= 0) { spawnTravelerNearPlayer(); travelerSpawnClock = rnd(4.5, 9.5); }
    for (let i = TRAVELERS.length - 1; i >= 0; i--) {
      const t = TRAVELERS[i];
      const dist = Math.hypot(t.position.x - player.pos.x, t.position.z - player.pos.z);
      if (dist > TRAVELER_DESPAWN_R) {
        scene.remove(t); TRAVELERS.splice(i, 1); continue;
      }
      updateTraveler(t, dt);
    }
  }
