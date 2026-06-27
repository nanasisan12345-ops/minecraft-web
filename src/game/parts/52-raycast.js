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
  function blockPreferredTool(type) {
    if ([STONE, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, BRICK, FURNACE, GLOW_CRYSTAL, DRIPSTONE, STONE_BRICK, MOSSY_BRICK].includes(type)) return 'pickaxe';
    if ([LOG, PLANKS, CRAFTING_TABLE, CHEST, OPEN_CHEST, CACTUS].includes(type)) return 'axe';
    if ([DIRT, GRASS, SAND, SNOW].includes(type)) return 'shovel';
    return null;
  }
  const BLOCK_HARDNESS = new Map([
    [LEAVES, 0.18], [TORCH, 0.12], [SNOW, 0.22], [DIRT, 0.45], [GRASS, 0.5], [SAND, 0.38],
    [LOG, 1.15], [PLANKS, 0.85], [CRAFTING_TABLE, 0.85],
    [STONE, 1.45], [BRICK, 1.85], [FURNACE, 1.9],
    [COAL_ORE, 1.7], [IRON_ORE, 2.05], [GOLD_ORE, 2.25], [DIAMOND_ORE, 2.55],
    [GLASS, 0.28], [GLOW_CRYSTAL, 0.9], [DRIPSTONE, 0.72],
    [STONE_BRICK, 1.85], [MOSSY_BRICK, 1.7], [CHEST, 1.15], [OPEN_CHEST, 0.85], [LANTERN, 0.3], [CACTUS, 0.4],
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
    const [x, y, z] = tg.block; const t = world.get(key(x, y, z)); if (t === undefined) return;
    burst(x, y, z, TYPES[t].color);
    const tool = blockPreferredTool(t), held = tool ? bestTool(tool) : null;
    if (t === LEAVES && Math.random() < 0.22) addInventory('apple', 1);
    if ((t === GRASS || t === LEAVES) && Math.random() < 0.12) addInventory('berries', 1);
    if (t === CHEST) {
      for (const [item, n] of rollChestLoot()) addInventory(item, n);
      thock(440);
    } else {
      const bonus = held && held.tier >= 2 && (t === COAL_ORE || t === DIAMOND_ORE) && Math.random() < 0.18 ? 1 : 0;
      addInventory(blockDrop(t), 1 + bonus);
    }
    if (held) damageTool(held.id, [STONE, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, GLOW_CRYSTAL, DRIPSTONE, STONE_BRICK, MOSSY_BRICK].includes(t) ? 2 : 1);
    edits.set(key(x, y, z), -1); saveEditsSoon(); setBlock(x, y, z, null); requestEditedBlockRebuild(x, y, z); thock(150);
  }
  function breakBlock() {
    const tg = pickTarget(); if (!tg) return;
    finishBreak(tg);
  }
  function updateMining(dt, tg) {
    if (!mouseHeld.left || !started || !tg) { resetMining(); return; }
    const [x, y, z] = tg.block, id = key(x, y, z), t = world.get(id);
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
    if (world.get(key(x, y, z)) !== CHEST) return;
    const got = [];
    for (const [item, n] of rollChestLoot()) { addInventory(item, n); got.push(`${itemLabel(item)}x${n}`); }
    edits.set(key(x, y, z), OPEN_CHEST); saveEditsSoon(); setBlock(x, y, z, OPEN_CHEST); requestEditedBlockRebuild(x, y, z);
    burst(x, y, z, TYPES[CHEST].color); thock(440);
    if (typeof setDebugToast === 'function') setDebugToast('宝箱: ' + got.join(' / '), 3.0);
  }
  function placeBlock() {
    const tg = pickTarget(); if (!tg) return;
    const hitType = world.get(key(tg.block[0], tg.block[1], tg.block[2]));
    if (hitType === CRAFTING_TABLE) { toggleCraftPanel('craft'); return; }
    if (hitType === FURNACE) { toggleCraftPanel('smelt'); return; }
    if (hitType === CHEST) { openChest(tg.block); return; }
    if (hitType === OPEN_CHEST) { thock(120); return; }
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    if (isSolid(x, y, z) || overlapsPlayer(x, y, z)) return;
    const ty = currentPlaceType(); if (!consumeInventory(ty, 1)) { thock(90); return; }
    edits.set(key(x, y, z), ty); saveEditsSoon(); setBlock(x, y, z, ty); requestEditedBlockRebuild(x, y, z); thock(260);
  }
