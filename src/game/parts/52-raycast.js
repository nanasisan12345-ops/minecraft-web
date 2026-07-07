  /* ============== ボクセルレイキャスト / 採掘 / 設置 / ブロックインタラクション ============== */
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
      if (isTargetableBlock(x, y, z)) return { block: [x, y, z], normal: [nx, ny, nz] };
      if (tx < ty) { if (tx < tz) { x += sx; t = tx; tx += dx; nx = -sx; ny = 0; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
      else { if (ty < tz) { y += sy; t = ty; ty += dy; nx = 0; ny = -sy; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
    }
    return null;
  }
  // バケツ用: 手前の水/溶岩ブロックを拾う（非solidなので通常のpickTargetでは当たらない）
  function pickLiquidTarget() {
    const o = camera.position, dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    let tx = intbound(o.x, dir.x), ty = intbound(o.y, dir.y), tz = intbound(o.z, dir.z);
    const dx = sx !== 0 ? 1 / Math.abs(dir.x) : Infinity, dy = sy !== 0 ? 1 / Math.abs(dir.y) : Infinity, dz = sz !== 0 ? 1 / Math.abs(dir.z) : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 256 && t <= REACH; i++) {
      const bt = blockAt(x, y, z);
      if (bt === WATER || bt === LAVA) return { block: [x, y, z], type: bt, normal: [nx, ny, nz] };
      if (bt !== undefined && TYPES[bt].solid !== false) return null;  // 液体より手前に固体があれば汲めない
      if (tx < ty) { if (tx < tz) { x += sx; t = tx; tx += dx; nx = -sx; ny = 0; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
      else { if (ty < tz) { y += sy; t = ty; ty += dy; nx = 0; ny = -sy; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
    }
    return null;
  }
  function isTargetableBlock(x, y, z) {
    const type = blockAt(x, y, z);
    return type !== undefined && (TYPES[type].solid !== false || isInteractableBlock(type));
  }

  const DOOR_INFO = new Map([
    [OAK_DOOR_Z_CLOSED, { facing: 'n', open: false, top: false }],
    [OAK_DOOR_Z_CLOSED_TOP, { facing: 'n', open: false, top: true }],
    [OAK_DOOR_Z_OPEN, { facing: 'n', open: true, top: false }],
    [OAK_DOOR_Z_OPEN_TOP, { facing: 'n', open: true, top: true }],
    [OAK_DOOR_X_CLOSED, { facing: 'e', open: false, top: false }],
    [OAK_DOOR_X_CLOSED_TOP, { facing: 'e', open: false, top: true }],
    [OAK_DOOR_X_OPEN, { facing: 'e', open: true, top: false }],
    [OAK_DOOR_X_OPEN_TOP, { facing: 'e', open: true, top: true }],
    [OAK_DOOR_S_CLOSED, { facing: 's', open: false, top: false }],
    [OAK_DOOR_S_CLOSED_TOP, { facing: 's', open: false, top: true }],
    [OAK_DOOR_S_OPEN, { facing: 's', open: true, top: false }],
    [OAK_DOOR_S_OPEN_TOP, { facing: 's', open: true, top: true }],
    [OAK_DOOR_W_CLOSED, { facing: 'w', open: false, top: false }],
    [OAK_DOOR_W_CLOSED_TOP, { facing: 'w', open: false, top: true }],
    [OAK_DOOR_W_OPEN, { facing: 'w', open: true, top: false }],
    [OAK_DOOR_W_OPEN_TOP, { facing: 'w', open: true, top: true }],
  ]);
  function isDoorBlock(type) { return DOOR_INFO.has(type); }
  function doorTypes(facing, open) {
    if (facing === 's') return open ? [OAK_DOOR_S_OPEN, OAK_DOOR_S_OPEN_TOP] : [OAK_DOOR_S_CLOSED, OAK_DOOR_S_CLOSED_TOP];
    if (facing === 'e') return open ? [OAK_DOOR_X_OPEN, OAK_DOOR_X_OPEN_TOP] : [OAK_DOOR_X_CLOSED, OAK_DOOR_X_CLOSED_TOP];
    if (facing === 'w') return open ? [OAK_DOOR_W_OPEN, OAK_DOOR_W_OPEN_TOP] : [OAK_DOOR_W_CLOSED, OAK_DOOR_W_CLOSED_TOP];
    return open ? [OAK_DOOR_Z_OPEN, OAK_DOOR_Z_OPEN_TOP] : [OAK_DOOR_Z_CLOSED, OAK_DOOR_Z_CLOSED_TOP];
  }
  function doorPairAt(x, y, z, type = blockAt(x, y, z)) {
    const info = DOOR_INFO.get(type);
    if (!info) return null;
    const by = info.top ? y - 1 : y;
    const bottomType = blockAt(x, by, z);
    const bottomInfo = DOOR_INFO.get(bottomType);
    if (!bottomInfo || bottomInfo.top) return null;
    return { x, y: by, z, info: bottomInfo };
  }
  function chooseDoorBaseType(normal) {
    if (normal[0] > 0) return OAK_DOOR_W_CLOSED;
    if (normal[0] < 0) return OAK_DOOR_X_CLOSED;
    if (normal[2] > 0) return OAK_DOOR_Z_CLOSED;
    if (normal[2] < 0) return OAK_DOOR_S_CLOSED;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    if (Math.abs(dir.x) > Math.abs(dir.z)) return dir.x > 0 ? OAK_DOOR_W_CLOSED : OAK_DOOR_X_CLOSED;
    return dir.z > 0 ? OAK_DOOR_Z_CLOSED : OAK_DOOR_S_CLOSED;
  }
  function setDoorPair(x, y, z, lower, upper) {
    const lowerId = key(x, y, z), upperId = key(x, y + 1, z);
    setEdit(lowerId, lower); setEdit(upperId, upper); saveEditsSoon();
    setBlock(x, y, z, lower); setBlock(x, y + 1, z, upper);
    requestEditedBlockRebuild(x, y, z); requestEditedBlockRebuild(x, y + 1, z);
  }
  function toggleDoorAt(x, y, z, type) {
    const pair = doorPairAt(x, y, z, type);
    if (!pair) return false;
    const [lower, upper] = doorTypes(pair.info.facing, !pair.info.open);
    setDoorPair(pair.x, pair.y, pair.z, lower, upper);
    thock(pair.info.open ? 180 : 260);
    if (typeof setDebugToast === 'function') setDebugToast(pair.info.open ? 'ドアを閉めた' : 'ドアを開けた', 1.0);
    return true;
  }
  function removeDoorPairAt(x, y, z, type) {
    const pair = doorPairAt(x, y, z, type);
    if (!pair) return false;
    setEdit(key(pair.x, pair.y, pair.z), -1);
    setEdit(key(pair.x, pair.y + 1, pair.z), -1);
    saveEditsSoon();
    setBlock(pair.x, pair.y, pair.z, null);
    setBlock(pair.x, pair.y + 1, pair.z, null);
    requestEditedBlockRebuild(pair.x, pair.y, pair.z);
    requestEditedBlockRebuild(pair.x, pair.y + 1, pair.z);
    return true;
  }
  function placeDoorFromTarget(tg) {
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    if (y < CHUNK_Y_MIN || y + 1 > CHUNK_Y_MAX) return false;
    if (isPlacementBlocked(x, y, z) || isPlacementBlocked(x, y + 1, z) || overlapsPlayer(x, y, z) || overlapsPlayer(x, y + 1, z)) return false;
    const lower = chooseDoorBaseType(tg.normal);
    const [, upper] = doorTypes(DOOR_INFO.get(lower).facing, false);
    const s = selectedItem();
    if (!s) return false;
    s.n -= 1;
    if (s.n <= 0) INV[selected] = null;
    invChanged();
    setDoorPair(x, y, z, lower, upper);
    thock(260);
    if (typeof progressEvent === 'function') progressEvent('place', 'oak_door');
    return true;
  }
  function isTrapdoorBlock(type) { return type === OAK_TRAPDOOR_CLOSED || type === OAK_TRAPDOOR_OPEN; }
  function toggleTrapdoorAt(x, y, z, type) {
    if (!isTrapdoorBlock(type)) return false;
    const next = type === OAK_TRAPDOOR_CLOSED ? OAK_TRAPDOOR_OPEN : OAK_TRAPDOOR_CLOSED;
    const id = key(x, y, z);
    setEdit(id, next); saveEditsSoon();
    setBlock(x, y, z, next);
    requestEditedBlockRebuild(x, y, z);
    thock(type === OAK_TRAPDOOR_CLOSED ? 230 : 170);
    if (typeof setDebugToast === 'function') setDebugToast(type === OAK_TRAPDOOR_CLOSED ? 'トラップドアを開けた' : 'トラップドアを閉めた', 1.0);
    return true;
  }
  const FENCE_GATE_INFO = new Map([
    [OAK_FENCE_GATE_Z_CLOSED, { axis: 'z', open: false }],
    [OAK_FENCE_GATE_Z_OPEN, { axis: 'z', open: true }],
    [OAK_FENCE_GATE_X_CLOSED, { axis: 'x', open: false }],
    [OAK_FENCE_GATE_X_OPEN, { axis: 'x', open: true }],
  ]);
  function isFenceGateBlock(type) { return FENCE_GATE_INFO.has(type); }
  function fenceGateType(axis, open) {
    if (axis === 'x') return open ? OAK_FENCE_GATE_X_OPEN : OAK_FENCE_GATE_X_CLOSED;
    return open ? OAK_FENCE_GATE_Z_OPEN : OAK_FENCE_GATE_Z_CLOSED;
  }
  function chooseFenceGateBaseType(normal) {
    if (Math.abs(normal[0]) > 0) return OAK_FENCE_GATE_X_CLOSED;
    if (Math.abs(normal[2]) > 0) return OAK_FENCE_GATE_Z_CLOSED;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    return Math.abs(dir.x) > Math.abs(dir.z) ? OAK_FENCE_GATE_X_CLOSED : OAK_FENCE_GATE_Z_CLOSED;
  }
  function toggleFenceGateAt(x, y, z, type) {
    const info = FENCE_GATE_INFO.get(type);
    if (!info) return false;
    const next = fenceGateType(info.axis, !info.open);
    const id = key(x, y, z);
    setEdit(id, next); saveEditsSoon();
    setBlock(x, y, z, next);
    requestEditedBlockRebuild(x, y, z);
    thock(info.open ? 180 : 260);
    if (typeof setDebugToast === 'function') setDebugToast(info.open ? 'フェンスゲートを閉めた' : 'フェンスゲートを開けた', 1.0);
    return true;
  }
  function placeFenceGateFromTarget(tg) {
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    const type = chooseFenceGateBaseType(tg.normal);
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return false;
    if (isPlacementBlocked(x, y, z) || overlapsPlayer(x, y, z, type)) return false;
    const s = selectedItem();
    if (!s) return false;
    s.n -= 1;
    if (s.n <= 0) INV[selected] = null;
    invChanged();
    setEdit(key(x, y, z), type); saveEditsSoon();
    setBlock(x, y, z, type);
    requestEditedBlockRebuild(x, y, z);
    thock(260);
    if (typeof progressEvent === 'function') progressEvent('place', 'oak_fence_gate');
    return true;
  }
  function isInteractableBlock(type) {
    return isDoorBlock(type) || isTrapdoorBlock(type) || isFenceGateBlock(type);
  }
  function isPlacementBlocked(x, y, z) {
    const type = blockAt(x, y, z);
    return type !== undefined && (TYPES[type].solid !== false || isInteractableBlock(type));
  }

  /* --- ブロックごとの適正ツール / 硬さ / 必要ツールレベル --- */
  function blockPreferredTool(type) {
    if ([STONE, COBBLESTONE, COBBLESTONE_WALL, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, BRICK, FURNACE, FURNACE_LIT, GLOW_CRYSTAL, DRIPSTONE, STONE_BRICK, MOSSY_BRICK, PLASTER, ROOF_TILE, GOLD_BLOCK, COPPER_ROOF, BRONZE, BRONZE_DARK, IRON_BLOCK, DIAMOND_BLOCK, COAL_BLOCK].includes(type)) return 'pickaxe';
    if (isDoorBlock(type) || isTrapdoorBlock(type) || isFenceGateBlock(type) || type === OAK_FENCE) return 'axe';
    if ([LOG, PLANKS, CRAFTING_TABLE, CHEST, OPEN_CHEST, BED, CACTUS, VILLAGE_SIGN, VERMILION, TATAMI, SHOJI, NOREN, PAPER_LANTERN, OAK_DOOR_Z_CLOSED, OAK_DOOR_Z_CLOSED_TOP, OAK_DOOR_Z_OPEN, OAK_DOOR_Z_OPEN_TOP, OAK_DOOR_X_CLOSED, OAK_DOOR_X_CLOSED_TOP, OAK_DOOR_X_OPEN, OAK_DOOR_X_OPEN_TOP, OAK_TRAPDOOR_CLOSED, OAK_TRAPDOOR_OPEN, OAK_FENCE, OAK_FENCE_GATE_Z_CLOSED, OAK_FENCE_GATE_Z_OPEN, OAK_FENCE_GATE_X_CLOSED, OAK_FENCE_GATE_X_OPEN].includes(type)) return 'axe';
    if ([DIRT, GRASS, SAND, SNOW, FARMLAND].includes(type)) return 'shovel';
    return null;
  }
  const BLOCK_HARDNESS = new Map([
    [LEAVES, 0.25], [TORCH, 0.1], [SNOW, 0.22], [DIRT, 0.6], [GRASS, 0.7], [SAND, 0.55],
    [LOG, 2.2], [PLANKS, 1.8], [CRAFTING_TABLE, 1.8], [BED, 0.9], [FARMLAND, 0.6],
    [STONE, 2.4], [COBBLESTONE, 2.6], [BRICK, 2.8], [FURNACE, 3.0], [FURNACE_LIT, 3.0],
    [COAL_ORE, 3.0], [IRON_ORE, 3.4], [GOLD_ORE, 3.4], [DIAMOND_ORE, 4.0],
    [GLASS, 0.4], [GLOW_CRYSTAL, 1.2], [DRIPSTONE, 1.0],
    [STONE_BRICK, 2.6], [MOSSY_BRICK, 2.4], [CHEST, 1.8], [OPEN_CHEST, 1.4], [LANTERN, 0.4], [CACTUS, 0.5], [VILLAGE_SIGN, 0.7],
    [VERMILION, 1.4], [PLASTER, 1.4], [ROOF_TILE, 2.2], [GOLD_BLOCK, 2.6], [COPPER_ROOF, 2.2],
    [TATAMI, 0.7], [SHOJI, 0.4], [NOREN, 0.35], [PAPER_LANTERN, 0.3],
    [BRONZE, 2.4], [BRONZE_DARK, 2.4],
    [IRON_BLOCK, 3.0], [DIAMOND_BLOCK, 3.4], [COAL_BLOCK, 3.0],
    [OAK_DOOR_Z_CLOSED, 1.0], [OAK_DOOR_Z_CLOSED_TOP, 1.0], [OAK_DOOR_Z_OPEN, 1.0], [OAK_DOOR_Z_OPEN_TOP, 1.0],
    [OAK_DOOR_X_CLOSED, 1.0], [OAK_DOOR_X_CLOSED_TOP, 1.0], [OAK_DOOR_X_OPEN, 1.0], [OAK_DOOR_X_OPEN_TOP, 1.0],
    [OAK_TRAPDOOR_CLOSED, 0.9], [OAK_TRAPDOOR_OPEN, 0.9],
    [OAK_FENCE, 1.0], [OAK_FENCE_GATE_Z_CLOSED, 1.0], [OAK_FENCE_GATE_Z_OPEN, 1.0], [OAK_FENCE_GATE_X_CLOSED, 1.0], [OAK_FENCE_GATE_X_OPEN, 1.0],
    [COBBLESTONE_WALL, 2.6],
  ]);
  // 掘ってもドロップしない（必要ツールレベル未満）判定。tier: 1木 2石 3鉄 4ダイヤ
  function requiredToolTier(type) {
    if ([IRON_ORE, IRON_BLOCK].includes(type)) return 2;            // 鉄鉱石/鉄ブロック: 石ツルハシ以上
    if ([GOLD_ORE, DIAMOND_ORE, GOLD_BLOCK, DIAMOND_BLOCK].includes(type)) return 3; // 金/ダイヤ鉱石・ブロック: 鉄ツルハシ以上
    if (blockPreferredTool(type) === 'pickaxe') return 1;           // 石系: 何かしらのツルハシが必要
    return 0;
  }
  function heldToolInfo() {
    const s = selectedItem();
    const d = s ? ITEM_DEFS[s.id] : null;
    if (!d || !d.tool || d.tool === 'sword') return null;
    return { id: s.id, tool: d.tool, tier: d.tier };
  }
  // 破壊にかかる秒数。適正ツールを持っていると速い。
  function miningTime(type) {
    const base = isDoorBlock(type) ? 1.0 : (BLOCK_HARDNESS.get(type) || 1.2);
    const tool = blockPreferredTool(type);
    if (!tool) return Math.min(base, 1.2);
    const held = heldToolInfo();
    if (!held || held.tool !== tool) {
      // ツルハシ必須ブロックを素手で掘ると非常に遅い
      return requiredToolTier(type) >= 1 ? base * 2.4 : base * 1.6;
    }
    return base / ({ 1: 2.2, 2: 4.0, 3: 6.5, 4: 9.0 }[held.tier] || 2.0);
  }
  // ブロック -> ドロップするアイテム（[id, n] の配列）
  function blockDrops(type) {
    if (isDoorBlock(type)) return [['oak_door', 1]];
    if (isTrapdoorBlock(type)) return [['oak_trapdoor', 1]];
    if (isFenceGateBlock(type)) return [['oak_fence_gate', 1]];
    if (type === STONE) return [['cobblestone', 1]];
    if (type === COAL_ORE) return [['coal', 1]];
    if (type === IRON_ORE) return [['raw_iron', 1]];
    if (type === GOLD_ORE) return [['raw_gold', 1]];
    if (type === DIAMOND_ORE) return [['diamond', 1]];
    if (type === GLOW_CRYSTAL) return [['glow_shard', 1]];
    if (type === OPEN_CHEST || type === VILLAGE_SIGN) return [['planks', 1]];
    if (type === FARMLAND || type === FURNACE_LIT) return [[type === FARMLAND ? 'dirt' : 'furnace', 1]];
    if (type === GRASS) {
      const out = [['dirt', 1]];
      if (Math.random() < 0.15) out.push(['fiber', 1]);
      if (Math.random() < 0.22) out.push(['wheat_seeds', 1]);
      return out;
    }
    if (type === LEAVES) {
      const out = [];
      if (Math.random() < 0.3) out.push(['stick', 1]);
      if (Math.random() < 0.14) out.push(['fiber', 1]);
      if (Math.random() < 0.08) out.push(['apple', 1]);
      if (Math.random() < 0.10) out.push(['berries', 1]);
      if (Math.random() < 0.10) out.push(['sapling', 1]);
      return out;
    }
    const id = ITEM_FOR_BLOCK[type];
    return id ? [[id, 1]] : [];
  }

  /* --- 置いた明かりの記録（敵スポーン抑制に使う） --- */
  const PLACED_LIGHTS = new Map(); // "x,y,z" -> {x,y,z}
  const LIGHT_BLOCK_TYPES = [TORCH, LANTERN, PAPER_LANTERN, GLOW_CRYSTAL];
  function registerPlacedLight(x, y, z, type) {
    if (!LIGHT_BLOCK_TYPES.includes(type)) return;
    PLACED_LIGHTS.set(key(x, y, z), { x, y, z });
  }
  function unregisterPlacedLight(x, y, z) {
    PLACED_LIGHTS.delete(key(x, y, z));
  }
  function nearPlacedLight(x, y, z, r = 8) {
    for (const l of PLACED_LIGHTS.values()) {
      if (Math.abs(l.x - x) <= r && Math.abs(l.z - z) <= r && Math.abs(l.y - y) <= r + 2) return true;
    }
    return false;
  }
  // 既存セーブの編集からプレイヤーが置いた明かりを復元
  for (const [id, type] of edits) {
    if (type >= 0 && LIGHT_BLOCK_TYPES.includes(type)) {
      const c = id.split(',');
      PLACED_LIGHTS.set(id, { x: +c[0], y: +c[1], z: +c[2] });
    }
  }

  /* --- 採掘 --- */
  const breakMeter = document.createElement('div');
  breakMeter.id = 'breakMeter';
  breakMeter.innerHTML = '<span></span>';
  document.body.appendChild(breakMeter);
  const MINING = { active: false, id: '', progress: 0, tap: 0 };
  function resetMining() {
    MINING.active = false; MINING.id = ''; MINING.progress = 0; MINING.tap = 0;
    breakMeter.classList.remove('show');
    breakMeter.querySelector('span').style.width = '0%';
  }
  function finishBreak(tg) {
    const [x, y, z] = tg.block; const t = blockAt(x, y, z); if (t === undefined) return;
    burst(x, y, z, TYPES[t].color);
    const tool = blockPreferredTool(t);
    const held = heldToolInfo();
    const needTier = requiredToolTier(t);
    const hasProperTool = held && held.tool === tool && held.tier >= needTier;
    const id = key(x, y, z);
    // 中身持ちブロックの後始末
    if (t === CHEST) { rollWorldChestLoot(id); spillChest(id); delete SAVE.chestSeen[id]; markSaveDirty(); }
    if (t === FURNACE || t === FURNACE_LIT) spillFurnace(id);
    if (t === BED && SAVE.spawn && SAVE.spawn.x === x && SAVE.spawn.y === y && SAVE.spawn.z === z) { SAVE.spawn = null; markSaveDirty(); }
    // 耕地を壊したら上の作物も一緒に撤去する
    if (t === FARMLAND) {
      const above = blockAt(x, y + 1, z);
      if (above === WHEAT_YOUNG || above === WHEAT_RIPE) {
        if (above === WHEAT_RIPE) spawnItemDrop(x, y + 1, z, 'wheat', 1);
        spawnItemDrop(x, y + 1, z, 'wheat_seeds', 1);
        if (typeof clearCropAt === 'function') clearCropAt(x, y + 1, z);
        setEdit(key(x, y + 1, z), -1); setBlock(x, y + 1, z, null); requestEditedBlockRebuild(x, y + 1, z);
      }
    }
    // 土/草を壊したら上の苗木も落として撤去する
    if ((t === GRASS || t === DIRT) && blockAt(x, y + 1, z) === SAPLING) {
      spawnItemDrop(x, y + 1, z, 'sapling', 1);
      if (typeof clearSaplingAt === 'function') clearSaplingAt(x, y + 1, z);
      setEdit(key(x, y + 1, z), -1); setBlock(x, y + 1, z, null); requestEditedBlockRebuild(x, y + 1, z);
    }
    // ドロップ（必要ツールレベルを満たさない鉱石/石はドロップしない）。実体として地面に落ちる
    if (needTier === 0 || hasProperTool) {
      for (const [itemId, n] of blockDrops(t)) spawnItemDrop(x, y, z, itemId, n);
    } else if (typeof setDebugToast === 'function' && needTier >= 2) {
      setDebugToast(`${TYPES[t].name} には${needTier >= 3 ? '鉄' : '石'}のツルハシ以上が必要`, 1.6);
    }
    // 道具の耐久値を消費
    if (held && held.tool === tool) damageSelectedTool(1);
    unregisterPlacedLight(x, y, z);
    if (isDoorBlock(t)) {
      removeDoorPairAt(x, y, z, t);
      thock(150);
      return;
    }
    setEdit(id, -1); saveEditsSoon(); setBlock(x, y, z, null); requestEditedBlockRebuild(x, y, z); thock(150);
  }
  function updateMining(dt, tg) {
    if (!mouseHeld.left || !started || SURVIVAL.dead || !tg || isContainerOpen()) { resetMining(); return; }
    const [x, y, z] = tg.block, id = key(x, y, z), t = blockAt(x, y, z);
    if (t === undefined || (TYPES[t].solid === false && !isInteractableBlock(t))) { resetMining(); return; }
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

  /* --- ベッド --- */
  function trySleepInBed(x, y, z) {
    if (DAY.label !== '夜' && DAY.label !== '夕方') {
      if (typeof setDebugToast === 'function') setDebugToast('まだ眠くない（夜になったら眠れる）', 2.0);
      return;
    }
    if (typeof hostileNear === 'function' && hostileNear(player.pos, 14)) {
      if (typeof setDebugToast === 'function') setDebugToast('近くにモンスターがいて眠れない！', 2.2);
      thock(90);
      return;
    }
    SAVE.spawn = { x, y, z };
    DAY.time = 0.26; // 朝
    SURVIVAL.hunger = Math.max(0, SURVIVAL.hunger - 1);
    markSaveDirty();
    if (typeof progressEvent === 'function') progressEvent('sleep');
    if (typeof setDebugToast === 'function') setDebugToast('ぐっすり眠って朝になった（リスポーン地点を設定）', 2.6);
    thock(420);
  }

  /* --- バケツ: 水/溶岩を汲む・置く、牛から牛乳、牛乳を飲む --- */
  function tryUseBucket() {
    const s = selectedItem(); if (!s) return false;
    if (s.id === 'bucket') {
      // 牛を右クリックで牛乳
      const at = typeof pickAnimalTarget === 'function' ? pickAnimalTarget() : null;
      if (at && at.userData.kind === 'cow' && !at.userData.baby) {
        INV[selected] = mkItem('milk_bucket'); invChanged(); thock(300); return true;
      }
      // 水/溶岩を汲む
      const lq = pickLiquidTarget();
      if (lq) {
        INV[selected] = mkItem(lq.type === LAVA ? 'lava_bucket' : 'water_bucket'); invChanged();
        // プレイヤーが置いた液体(edit)なら汲んだら消す（自然の水源は無限のまま）
        const lid = key(lq.block[0], lq.block[1], lq.block[2]);
        if (edits.get(lid) === lq.type) { setEdit(lid, -1); saveEditsSoon(); setBlock(lq.block[0], lq.block[1], lq.block[2], null); requestEditedBlockRebuild(lq.block[0], lq.block[1], lq.block[2]); }
        thock(300); return true;
      }
      return false;
    }
    if (s.id === 'water_bucket' || s.id === 'lava_bucket') {
      const tg = pickTarget(); if (!tg) return false;
      const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
      const type = s.id === 'lava_bucket' ? LAVA : WATER;
      if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX || isPlacementBlocked(x, y, z) || overlapsPlayer(x, y, z, type)) return false;
      setEdit(key(x, y, z), type); saveEditsSoon(); setBlock(x, y, z, type); requestEditedBlockRebuild(x, y, z);
      INV[selected] = mkItem('bucket'); invChanged(); thock(240); return true;
    }
    if (s.id === 'milk_bucket') {
      SURVIVAL.hunger = Math.min(20, SURVIVAL.hunger + 1);
      if (typeof updateSurvivalHud === 'function') updateSurvivalHud();
      INV[selected] = mkItem('bucket'); invChanged(); thock(360); return true;
    }
    return false;
  }

  /* --- 右クリック: インタラクション or 設置 or 食べる --- */
  function interactOrPlace() {
    if (SURVIVAL.dead || isContainerOpen()) return;
    // 村人との会話を最優先
    const traveler = typeof pickTravelerTarget === 'function' ? pickTravelerTarget() : null;
    if (traveler) {
      if (typeof openTravelerPanel === 'function') openTravelerPanel(traveler);
      thock(180);
      return;
    }
    // 動物への餌やり（繁殖）: 手前の動物を優先。餌が合えば消費して恋愛モードへ
    const heldDef = selectedItemDef();
    if (heldDef && typeof pickAnimalTarget === 'function') {
      const animalTg = pickAnimalTarget();
      if (animalTg && feedAnimal(animalTg, heldDef)) {
        const s = selectedItem();
        s.n -= 1;
        if (s.n <= 0) INV[selected] = null;
        invChanged();
        return;
      }
    }
    const tg = pickTarget();
    if (tg) {
      const [bx, by, bz] = tg.block;
      const hitType = blockAt(bx, by, bz);
      if (hitType === CRAFTING_TABLE) { openContainer('table'); return; }
      if (hitType === FURNACE || hitType === FURNACE_LIT) { openContainer('furnace', { key: key(bx, by, bz) }); return; }
      if (hitType === CHEST) {
        const id = key(bx, by, bz);
        // プレイヤーが置いたチェスト以外（＝ワールド生成）は初回に報酬を抽選
        const isPlayerChest = edits.get(id) === CHEST;
        openContainer('chest', { key: id, world: !isPlayerChest });
        if (typeof progressEvent === 'function') progressEvent('openChest');
        return;
      }
      if (hitType === OPEN_CHEST) { openContainer('chest', { key: key(bx, by, bz) }); return; }
      if (hitType === BED) { trySleepInBed(bx, by, bz); return; }
      if (hitType === TNT) { igniteTNT(bx, by, bz); return; }   // TNTを右クリックで着火
      if (isDoorBlock(hitType)) { toggleDoorAt(bx, by, bz, hitType); return; }
      if (isTrapdoorBlock(hitType)) { toggleTrapdoorAt(bx, by, bz, hitType); return; }
      if (isFenceGateBlock(hitType)) { toggleFenceGateAt(bx, by, bz, hitType); return; }
    }
    // バケツ（水/溶岩/牛乳）
    if (tryUseBucket()) return;
    // 弓を持っていたら撃つ
    const def = selectedItemDef();
    if (def && def.tool === 'bow') { shootPlayerArrow(); return; }
    // 苗木を土/草の上に植える
    if (tg && def && def.id === 'sapling' && tg.normal[1] === 1) {
      if (plantSaplingAt(tg.block[0], tg.block[1], tg.block[2])) return;
    }
    // 農業: クワで耕す / 耕地の上の作物を収穫 / 種をまく
    if (tg) {
      const [bx, by, bz] = tg.block;
      const hitType = blockAt(bx, by, bz);
      if (def && def.tool === 'hoe' && tillableBlock(hitType)) { tillSoil(bx, by, bz); return; }
      if (hitType === FARMLAND) {
        const above = blockAt(bx, by + 1, bz);
        if (above === WHEAT_RIPE || above === WHEAT_YOUNG) { harvestCrop(bx, by + 1, bz); return; }
        if (def && def.id === 'wheat_seeds') { plantSeed(bx, by, bz); return; }
      }
    }
    // 食べ物を持っていたら食べる
    if (def && def.food) { eatSelectedFood(); return; }
    if (tg && def && def.id === 'oak_door') { placeDoorFromTarget(tg); return; }
    if (tg && def && def.id === 'oak_fence_gate') { placeFenceGateFromTarget(tg); return; }
    // ブロック設置
    if (!tg || !def || def.block == null) { if (def && def.block == null) thock(90); return; }
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return;
    const type = def.block;
    if (isPlacementBlocked(x, y, z) || overlapsPlayer(x, y, z, type)) return;
    const s = selectedItem();
    s.n -= 1;
    if (s.n <= 0) INV[selected] = null;
    invChanged();
    registerPlacedLight(x, y, z, type);
    setEdit(key(x, y, z), type); saveEditsSoon(); setBlock(x, y, z, type); requestEditedBlockRebuild(x, y, z); thock(260);
    if (typeof progressEvent === 'function') progressEvent('place', ITEM_FOR_BLOCK[type]);
  }
