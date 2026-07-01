  /* ============== ボクセルレイキャスト ============== */
  const mod = (a, n) => ((a % n) + n) % n;
  function intbound(s, ds) { if (ds < 0) return intbound(-s, -ds); return (1 - mod(s, 1)) / ds; }
  function pickTarget() {
    const o = camera.position, dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    let tx = intbound(o.x, dir.x), ty = intbound(o.y, dir.y), tz = intbound(o.z, dir.z);
    const dx = sx !== 0 ? 1 / Math.abs(dir.x) : Infinity, dy = sy !== 0 ? 1 / Math.abs(dir.y) : Infinity, dz = sz !== 0 ? 1 / Math.abs(dir.z) : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 256 && t <= REACH; i++) {
      if (isSolid(x, y, z)) return { block: [x, y, z], normal: [nx, ny, nz] };
      if (tx < ty) { if (tx < tz) { x += sx; t = tx; tx += dx; nx = -sx; ny = 0; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
      else { if (ty < tz) { y += sy; t = ty; ty += dy; nx = 0; ny = -sy; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
    }
    return null;
  }
  function blockDrop(type) {
    if (type === COAL_ORE) return 'coal';
    if (type === IRON_ORE) return 'rawIron';
    if (type === GOLD_ORE) return 'rawGold';
    if (type === DIAMOND_ORE) return 'diamond';
    if (type === GLOW_CRYSTAL) return 'glowShard';
    if (type === OPEN_CHEST) return PLANKS;
    if (type === VILLAGE_SIGN) return PLANKS;
    return type;
  }
  // 宝箱の中身（地下遺跡の探索報酬）。石炭は確定、残りはプールから2〜4種を抽選。
  function rollChestLoot() {
    const out = [['coal', 2 + (Math.random() * 4 | 0)]];
    const pool = [
      ['rawIron', 1, 3], ['rawGold', 1, 2], ['diamond', 1, 2], ['ironIngot', 1, 2],
      ['apple', 1, 3], ['berries', 2, 5], [GLOW_CRYSTAL, 1, 2], [TORCH, 2, 5],
      ['stick', 2, 6], [PLANKS, 3, 8], ['goldIngot', 1, 1],
    ];
    const picks = 2 + (Math.random() * 3 | 0);
    for (let i = 0; i < picks; i++) {
      const e = pool[Math.random() * pool.length | 0];
      out.push([e[0], e[1] + (Math.random() * (e[2] - e[1] + 1) | 0)]);
    }
    return out;
  }
  const CHEST_STORAGE_KEY = `mc_chests_${WORLD_SEED}`;
  const CHEST_LOOT = new Map();
  function chestItemKey(k) {
    if (typeof k === 'number') return k;
    if (typeof k === 'string' && /^-?\d+$/.test(k)) return +k;
    return k;
  }
  function normalizeChestLoot(loot) {
    const out = [];
    if (!Array.isArray(loot)) return out;
    for (const e of loot) {
      const item = Array.isArray(e) ? e[0] : e && e.item;
      const count = Array.isArray(e) ? e[1] : e && e.count;
      const n = Math.floor(+count);
      if (item == null || !Number.isFinite(n) || n <= 0) continue;
      out.push({ item: chestItemKey(item), count: Math.min(999, n) });
    }
    return out;
  }
  function loadChestLootState() {
    try {
      const raw = localStorage.getItem(CHEST_STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (const [id, loot] of arr) {
        if (typeof id !== 'string') continue;
        const normalized = normalizeChestLoot(loot);
        if (normalized.length) CHEST_LOOT.set(id, normalized);
      }
    } catch (e) {}
  }
  function saveChestLootSoon() {
    clearTimeout(saveChestLootSoon.t);
    saveChestLootSoon.t = setTimeout(() => {
      try {
        const arr = [...CHEST_LOOT].map(([id, loot]) => [id, loot.map(e => [e.item, e.count])]);
        localStorage.setItem(CHEST_STORAGE_KEY, JSON.stringify(arr));
      } catch (e) {}
    }, 180);
  }
  function chestLootFor(id) {
    let loot = CHEST_LOOT.get(id);
    if (!loot) {
      loot = normalizeChestLoot(rollChestLoot());
      CHEST_LOOT.set(id, loot);
      saveChestLootSoon();
    }
    return loot;
  }
  function chestLootForPanel(id) {
    const loot = CHEST_LOOT.get(id);
    return loot ? loot.map(e => ({ item: e.item, count: e.count })) : [];
  }
  function markChestEmpty(id) {
    CHEST_LOOT.delete(id);
    saveChestLootSoon();
    const [x, y, z] = id.split(',').map(Number);
    if (blockAt(x, y, z) === CHEST) {
      setEdit(id, OPEN_CHEST);
      saveEditsSoon();
      setBlock(x, y, z, OPEN_CHEST);
      requestEditedBlockRebuild(x, y, z);
      burst(x, y, z, TYPES[CHEST].color);
    }
  }
  function takeChestStack(id, slotIndex) {
    const loot = CHEST_LOOT.get(id);
    if (!loot || !loot[slotIndex]) return false;
    const entry = loot.splice(slotIndex, 1)[0];
    addInventory(entry.item, entry.count);
    if (!loot.length) markChestEmpty(id);
    else { CHEST_LOOT.set(id, loot); saveChestLootSoon(); }
    thock(320);
    return true;
  }
  function takeAllChestLoot(id) {
    const loot = CHEST_LOOT.get(id) || chestLootFor(id);
    if (!loot.length) return false;
    for (const entry of loot) addInventory(entry.item, entry.count);
    markChestEmpty(id);
    thock(440);
    return true;
  }
  loadChestLootState();
  function blockPreferredTool(type) {
    if ([STONE, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, BRICK, FURNACE, GLOW_CRYSTAL, DRIPSTONE, STONE_BRICK, MOSSY_BRICK, PLASTER, ROOF_TILE, GOLD_BLOCK, COPPER_ROOF].includes(type)) return 'pickaxe';
    if ([LOG, PLANKS, CRAFTING_TABLE, CHEST, OPEN_CHEST, CACTUS, VILLAGE_SIGN, VERMILION, TATAMI, SHOJI, NOREN, PAPER_LANTERN].includes(type)) return 'axe';
    if ([DIRT, GRASS, SAND, SNOW].includes(type)) return 'shovel';
    return null;
  }
  const BLOCK_HARDNESS = new Map([
    [LEAVES, 0.18], [TORCH, 0.12], [SNOW, 0.22], [DIRT, 0.45], [GRASS, 0.5], [SAND, 0.38],
    [LOG, 1.15], [PLANKS, 0.85], [CRAFTING_TABLE, 0.85],
    [STONE, 1.45], [BRICK, 1.85], [FURNACE, 1.9],
    [COAL_ORE, 1.7], [IRON_ORE, 2.05], [GOLD_ORE, 2.25], [DIAMOND_ORE, 2.55],
    [GLASS, 0.28], [GLOW_CRYSTAL, 0.9], [DRIPSTONE, 0.72],
    [STONE_BRICK, 1.85], [MOSSY_BRICK, 1.7], [CHEST, 1.15], [OPEN_CHEST, 0.85], [LANTERN, 0.3], [CACTUS, 0.4], [VILLAGE_SIGN, 0.45],
    [VERMILION, 0.85], [PLASTER, 0.9], [ROOF_TILE, 1.45], [GOLD_BLOCK, 1.7], [COPPER_ROOF, 1.45],
    [TATAMI, 0.45], [SHOJI, 0.32], [NOREN, 0.28], [PAPER_LANTERN, 0.24],
  ]);
  const breakMeter = document.createElement('div');
  breakMeter.id = 'breakMeter';
  breakMeter.innerHTML = '<span></span>';
  document.body.appendChild(breakMeter);
  const MINING = { active: false, id: '', progress: 0, tap: 0 };
  function miningTime(type) {
    const base = BLOCK_HARDNESS.get(type) || 0.9;
    const tool = blockPreferredTool(type);
    if (!tool) return base;
    const held = bestTool(tool);
    if (!held) return base * 1.75;
    return base / ({ 1: 1.9, 2: 3.0, 3: 4.4 }[held.tier] || 1.6);
  }
  function resetMining() {
    MINING.active = false; MINING.id = ''; MINING.progress = 0; MINING.tap = 0;
    breakMeter.classList.remove('show');
    breakMeter.querySelector('span').style.width = '0%';
  }
  function finishBreak(tg) {
    const [x, y, z] = tg.block; const t = blockAt(x, y, z); if (t === undefined) return;
    burst(x, y, z, TYPES[t].color);
    const tool = blockPreferredTool(t), held = tool ? bestTool(tool) : null;
    if (t === LEAVES && Math.random() < 0.22) addInventory('apple', 1);
    if ((t === GRASS || t === LEAVES) && Math.random() < 0.12) addInventory('berries', 1);
    if (t === CHEST) {
      const id = key(x, y, z);
      for (const entry of chestLootFor(id)) addInventory(entry.item, entry.count);
      CHEST_LOOT.delete(id);
      saveChestLootSoon();
      thock(440);
    } else {
      const bonus = held && held.tier >= 2 && (t === COAL_ORE || t === DIAMOND_ORE) && Math.random() < 0.18 ? 1 : 0;
      addInventory(blockDrop(t), 1 + bonus);
    }
    if (held) damageTool(held.id, [STONE, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, GLOW_CRYSTAL, DRIPSTONE, STONE_BRICK, MOSSY_BRICK].includes(t) ? 2 : 1);
    setEdit(key(x, y, z), -1); saveEditsSoon(); setBlock(x, y, z, null); requestEditedBlockRebuild(x, y, z); thock(150);
  }
  function breakBlock() {
    const tg = pickTarget(); if (!tg) return;
    finishBreak(tg);
  }
  function updateMining(dt, tg) {
    if (!mouseHeld.left || !started || !tg) { resetMining(); return; }
    const [x, y, z] = tg.block, id = key(x, y, z), t = blockAt(x, y, z);
    if (t === undefined || TYPES[t].solid === false) { resetMining(); return; }
    if (MINING.id !== id) { MINING.active = true; MINING.id = id; MINING.progress = 0; MINING.tap = 0; }
    const total = Math.max(0.08, miningTime(t));
    MINING.progress += dt / total;
    MINING.tap += dt;
    if (MINING.tap > 0.22) { MINING.tap = 0; thock(105 + Math.min(260, MINING.progress * 210)); }
    breakMeter.classList.add('show');
    breakMeter.querySelector('span').style.width = `${Math.min(100, MINING.progress * 100).toFixed(1)}%`;
    if (MINING.progress >= 1) {
      finishBreak(tg);
      resetMining();
    }
  }
  function openChest(block) {
    const [x, y, z] = block;
    const id = key(x, y, z), t = blockAt(x, y, z);
    if (t !== CHEST && t !== OPEN_CHEST) return;
    if (t === CHEST) chestLootFor(id);
    if (typeof openChestPanel === 'function') openChestPanel(id);
    else if (t === CHEST) takeAllChestLoot(id);
    thock(t === CHEST ? 360 : 120);
  }
  function placeBlock() {
    const traveler = typeof pickTravelerTarget === 'function' ? pickTravelerTarget() : null;
    if (traveler) {
      if (typeof openTravelerPanel === 'function') openTravelerPanel(traveler);
      else if (typeof setDebugToast === 'function') setDebugToast('村人: またあとで話そう', 1.6);
      thock(180);
      return;
    }
    const tg = pickTarget(); if (!tg) return;
    const hitType = blockAt(tg.block[0], tg.block[1], tg.block[2]);
    if (hitType === CRAFTING_TABLE) { toggleCraftPanel('craft'); return; }
    if (hitType === FURNACE) { toggleCraftPanel('smelt'); return; }
    if (hitType === CHEST) { openChest(tg.block); return; }
    if (hitType === OPEN_CHEST) { openChest(tg.block); return; }
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return;
    if (isSolid(x, y, z) || overlapsPlayer(x, y, z)) return;
    const ty = currentPlaceType(); if (!consumeInventory(ty, 1)) { thock(90); return; }
    setEdit(key(x, y, z), ty); saveEditsSoon(); setBlock(x, y, z, ty); requestEditedBlockRebuild(x, y, z); thock(260);
  }
