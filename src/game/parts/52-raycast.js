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
      if (isSolid(x, y, z)) return { block: [x, y, z], normal: [nx, ny, nz] };
      if (tx < ty) { if (tx < tz) { x += sx; t = tx; tx += dx; nx = -sx; ny = 0; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
      else { if (ty < tz) { y += sy; t = ty; ty += dy; nx = 0; ny = -sy; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
    }
    return null;
  }

  /* --- ブロックごとの適正ツール / 硬さ / 必要ツールレベル --- */
  function blockPreferredTool(type) {
    if ([STONE, COBBLESTONE, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, BRICK, FURNACE, FURNACE_LIT, GLOW_CRYSTAL, DRIPSTONE, STONE_BRICK, MOSSY_BRICK, PLASTER, ROOF_TILE, GOLD_BLOCK, COPPER_ROOF, BRONZE, BRONZE_DARK].includes(type)) return 'pickaxe';
    if ([LOG, PLANKS, CRAFTING_TABLE, CHEST, OPEN_CHEST, BED, CACTUS, VILLAGE_SIGN, VERMILION, TATAMI, SHOJI, NOREN, PAPER_LANTERN].includes(type)) return 'axe';
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
  ]);
  // 掘ってもドロップしない（必要ツールレベル未満）判定。tier: 1木 2石 3鉄 4ダイヤ
  function requiredToolTier(type) {
    if ([IRON_ORE].includes(type)) return 2;                        // 鉄鉱石: 石ツルハシ以上
    if ([GOLD_ORE, DIAMOND_ORE].includes(type)) return 3;           // 金/ダイヤ鉱石: 鉄ツルハシ以上
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
    const base = BLOCK_HARDNESS.get(type) || 1.2;
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
    setEdit(id, -1); saveEditsSoon(); setBlock(x, y, z, null); requestEditedBlockRebuild(x, y, z); thock(150);
  }
  function updateMining(dt, tg) {
    if (!mouseHeld.left || !started || SURVIVAL.dead || !tg || isContainerOpen()) { resetMining(); return; }
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
    }
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
    // ブロック設置
    if (!tg || !def || def.block == null) { if (def && def.block == null) thock(90); return; }
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return;
    if (isSolid(x, y, z) || overlapsPlayer(x, y, z)) return;
    const s = selectedItem();
    s.n -= 1;
    if (s.n <= 0) INV[selected] = null;
    invChanged();
    const type = def.block;
    registerPlacedLight(x, y, z, type);
    setEdit(key(x, y, z), type); saveEditsSoon(); setBlock(x, y, z, type); requestEditedBlockRebuild(x, y, z); thock(260);
    if (typeof progressEvent === 'function') progressEvent('place', ITEM_FOR_BLOCK[type]);
  }
