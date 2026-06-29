  /* ============== 旅人NPC（通常ワールド用の村人風ブロックモデル） ============== */
  const TRAVELERS = [];
  const TRAVELER_MAX = 8, TRAVELER_SPAWN_R = 82, TRAVELER_DESPAWN_R = 120;
  const TRAVELER_TYPES = [
    { robe: 0x7a5a36, trim: 0xc19a5a, hood: 0x5d432b },
    { robe: 0x435f7a, trim: 0x9fc3d8, hood: 0x2f455c },
    { robe: 0x6f4b72, trim: 0xd9b0c9, hood: 0x513452 },
    { robe: 0x55764a, trim: 0xb8d28a, hood: 0x3c5735 },
  ];
  const TRAVELER_ROLE_BY_BUILDING = {
    farm: 'farmer',
    blacksmith: 'smith',
    market: 'merchant',
    church: 'cleric',
    tower: 'guard',
    library: 'librarian',
    stable: 'herder',
  };
  const TRAVELER_ROLES = {
    farmer: {
      label: '農家',
      line: '畑のものなら少し分けられるよ。',
      trades: [
        { id: 'farmer-apple', name: 'リンゴ x2', cost: [['berries', 4]], out: [['apple', 2]] },
        { id: 'farmer-berries', name: 'ベリー x5', cost: [['apple', 1]], out: [['berries', 5]] },
      ],
    },
    smith: {
      label: '鍛冶屋',
      line: '鉱石を持ってきたなら、道具にしてやろう。',
      trades: [
        { id: 'smith-ingot', name: '鉄インゴット x2', cost: [['rawIron', 2], ['coal', 1]], out: [['ironIngot', 2]] },
        { id: 'smith-pickaxe', name: '鉄のツルハシ', cost: [['ironIngot', 3], ['stick', 2]], out: [['ironPickaxe', 1]] },
      ],
    },
    merchant: {
      label: '商人',
      line: '旅の荷物を軽くしていかないかい。',
      trades: [
        { id: 'merchant-torch', name: 'たいまつ x10', cost: [['coal', 3], ['stick', 1]], out: [[TORCH, 10]] },
        { id: 'merchant-glass', name: 'ガラス x6', cost: [[SAND, 6], ['coal', 1]], out: [[GLASS, 6]] },
      ],
    },
    cleric: {
      label: '聖職者',
      line: '暗い地下へ行くなら、明かりを持っていきなさい。',
      trades: [
        { id: 'cleric-lantern', name: 'ランタン x2', cost: [['glowShard', 1], ['coal', 1]], out: [[LANTERN, 2]] },
        { id: 'cleric-food', name: 'リンゴ x3', cost: [['glowShard', 1]], out: [['apple', 3]] },
      ],
    },
    guard: {
      label: '見張り',
      line: '遠くへ行くなら、足場と明かりを切らすなよ。',
      trades: [
        { id: 'guard-stone', name: '石レンガ x8', cost: [[STONE, 8]], out: [[STONE_BRICK, 8]] },
        { id: 'guard-axe', name: '石の斧', cost: [[STONE, 3], ['stick', 2]], out: [['stoneAxe', 1]] },
      ],
    },
    librarian: {
      label: '司書',
      line: '古い地図の余白には、地下の明かりの話が残っているよ。',
      trades: [
        { id: 'librarian-glass', name: 'ガラス x8', cost: [[SAND, 8], ['coal', 1]], out: [[GLASS, 8]] },
        { id: 'librarian-lantern', name: 'ランタン x1', cost: [['glowShard', 1]], out: [[LANTERN, 1]] },
      ],
    },
    herder: {
      label: '牧場係',
      line: '家畜小屋のまわりは、食べ物を切らさないのが大事だ。',
      trades: [
        { id: 'herder-berries', name: 'ベリー x6', cost: [['apple', 1]], out: [['berries', 6]] },
        { id: 'herder-planks', name: '板材 x10', cost: [[LOG, 3]], out: [[PLANKS, 10]] },
      ],
    },
    wanderer: {
      label: '旅人',
      line: 'このあたりは地形がよく変わる。迷ったら高い場所を見るといい。',
      trades: [
        { id: 'wanderer-planks', name: '板材 x8', cost: [[LOG, 2]], out: [[PLANKS, 8]] },
        { id: 'wanderer-torch', name: 'たいまつ x6', cost: [['coal', 2]], out: [[TORCH, 6]] },
      ],
    },
  };
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
  function travelerRoleForBuilding(kind) {
    return TRAVELER_ROLE_BY_BUILDING[kind] || (Math.random() < 0.35 ? 'merchant' : 'wanderer');
  }
  function travelerRoleForSurface(x, z) {
    if (typeof nearestVillage === 'function') {
      const v = nearestVillage(x, z);
      if (v && v.dd < 42 && v.plan.slots && v.plan.slots.length) {
        let best = null;
        for (const s of v.plan.slots) {
          const dd = Math.hypot(s.bx - x, s.bz - z);
          if (!best || dd < best.dd) best = { dd, kind: s.kind };
        }
        if (best && best.dd < 12) return travelerRoleForBuilding(best.kind);
      }
    }
    return 'wanderer';
  }
  function makeTraveler(role = 'wanderer') {
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
    g.userData.role = TRAVELER_ROLES[role] ? role : 'wanderer';
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
    return { x: bx + ((Math.random() * 7 - 3) | 0), z: bz + ((Math.random() * 7 - 3) | 0), kind: pick ? pick.kind : 'market' };
  }
  function spawnTravelerNearPlayer() {
    if (!started || TRAVELERS.length >= TRAVELER_MAX || typeof RAVE !== 'undefined' && RAVE.on) return;
    for (let tries = 0; tries < 18; tries++) {
      let x, z;
      const spot = tries < 6 ? villageSpawnSpot() : null; // 村が近ければ村に住まわせる
      if (spot) { x = spot.x; z = spot.z; }
      else { const a = Math.random() * Math.PI * 2, r = rnd(24, TRAVELER_SPAWN_R); x = Math.floor(player.pos.x + Math.cos(a) * r); z = Math.floor(player.pos.z + Math.sin(a) * r); }
      if (!canPlaceTravelerAt(x, z)) continue;
      const y = travelerSurfaceY(x, z), role = spot ? travelerRoleForBuilding(spot.kind) : travelerRoleForSurface(x, z), traveler = makeTraveler(role);
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
  function pickTravelerTarget() {
    if (!TRAVELERS.length) return null;
    const origin = camera.position, dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let best = null;
    for (const t of TRAVELERS) {
      const center = t.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      const to = center.sub(origin);
      const along = to.dot(dir);
      if (along < 0.25 || along > REACH + 0.8) continue;
      const miss = to.addScaledVector(dir, -along).length();
      if (miss > 0.72) continue;
      if (!best || along < best.dist) best = { traveler: t, dist: along };
    }
    return best ? best.traveler : null;
  }
  function travelerTradeById(id) {
    for (const role of Object.values(TRAVELER_ROLES)) {
      const found = role.trades.find(t => t.id === id);
      if (found) return found;
    }
    return null;
  }
  function canDoTravelerTrade(trade) {
    return trade && trade.cost.every(([id, amount]) => inventoryCount(id) >= amount);
  }
  function doTravelerTrade(id) {
    const trade = travelerTradeById(id);
    if (!canDoTravelerTrade(trade)) { thock(90); return false; }
    for (const [item, amount] of trade.cost) consumeInventory(item, amount);
    for (const [item, amount] of trade.out) addInventory(item, amount);
    thock(330);
    if (typeof setDebugToast === 'function') setDebugToast(`${trade.name} を受け取った`, 1.8);
    return true;
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
