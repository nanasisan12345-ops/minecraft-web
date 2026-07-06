  /* ============== 農業（クワで耕す→種まき→成長→収穫） ==============
   * 耕地(FARMLAND)は土/草をクワで叩くと出来る。その上に小麦の種を植えると
   * WHEAT_YOUNG が生え、一定時間で WHEAT_RIPE に育つ。収穫すると小麦＋種が採れる。
   * 成長中の作物は SAVE.crops("x,y,z" -> 経過秒) で追跡し、育ちきったらブロックを差し替える。 */
  const CROP_GROW_TIME = 80;       // 種まきから実るまでの秒数
  const CROP_TICK = 1.5;           // 成長を進める間隔（毎フレームは重いのでまとめる）
  let cropTickClock = 0;

  function tillableBlock(t) { return t === DIRT || t === GRASS; }

  // クワで土/草を耕して耕地にする
  function tillSoil(x, y, z) {
    const t = blockAt(x, y, z);
    if (!tillableBlock(t)) return false;
    if (hasBlock(x, y + 1, z)) return false; // 上に何か乗っていたら耕せない
    setEdit(key(x, y, z), FARMLAND); saveEditsSoon();
    setBlock(x, y, z, FARMLAND); requestEditedBlockRebuild(x, y, z);
    damageSelectedTool(1);
    burst(x, y, z, TYPES[FARMLAND].color);
    thock(180);
    return true;
  }

  // 耕地の上に種をまく
  function plantSeed(farmX, farmY, farmZ) {
    if (blockAt(farmX, farmY, farmZ) !== FARMLAND) return false;
    const ay = farmY + 1;
    if (hasBlock(farmX, ay, farmZ)) return false;
    if (!takeItems([['wheat_seeds', 1]])) return false;
    setEdit(key(farmX, ay, farmZ), WHEAT_YOUNG); saveEditsSoon();
    setBlock(farmX, ay, farmZ, WHEAT_YOUNG); requestEditedBlockRebuild(farmX, ay, farmZ);
    SAVE.crops[key(farmX, ay, farmZ)] = 0;
    markSaveDirty();
    thock(240);
    return true;
  }

  // 実った小麦を収穫（小麦1＋種1〜2）。未成熟なら知らせるだけ
  function harvestCrop(x, y, z) {
    const t = blockAt(x, y, z);
    if (t === WHEAT_RIPE) {
      spawnItemDrop(x, y, z, 'wheat', 1);
      spawnItemDrop(x, y, z, 'wheat_seeds', 1 + (Math.random() * 2 | 0));
      delete SAVE.crops[key(x, y, z)];
      setEdit(key(x, y, z), -1); saveEditsSoon();
      setBlock(x, y, z, null); requestEditedBlockRebuild(x, y, z);
      markSaveDirty();
      burst(x, y, z, TYPES[WHEAT_RIPE].color);
      thock(300);
      if (typeof progressEvent === 'function') progressEvent('item', 'wheat');
      return true;
    }
    if (t === WHEAT_YOUNG) {
      if (typeof setDebugToast === 'function') setDebugToast('まだ育っていない（もう少し待とう）', 1.6);
      return true;
    }
    return false;
  }

  // 作物ブロックが壊された/耕地が壊れたときに追跡データを片付ける
  function clearCropAt(x, y, z) { delete SAVE.crops[key(x, y, z)]; }

  /* --- 苗木と植林（葉から採れる苗木を植えると時間で木に育つ） --- */
  const SAPLING_GROW_TIME = 95;
  function saplingSoil(t) { return t === GRASS || t === DIRT; }
  // 苗木を土/草の上に植える（selectedItem が sapling のとき interactOrPlace から呼ぶ）
  function plantSaplingAt(groundX, groundY, groundZ) {
    if (!saplingSoil(blockAt(groundX, groundY, groundZ))) return false;
    const ay = groundY + 1;
    if (hasBlock(groundX, ay, groundZ)) return false;
    if (!takeItems([['sapling', 1]])) return false;
    setEdit(key(groundX, ay, groundZ), SAPLING); saveEditsSoon();
    setBlock(groundX, ay, groundZ, SAPLING); requestEditedBlockRebuild(groundX, ay, groundZ);
    SAVE.saplings[key(groundX, ay, groundZ)] = 0;
    markSaveDirty();
    thock(240);
    return true;
  }
  function clearSaplingAt(x, y, z) { delete SAVE.saplings[key(x, y, z)]; }
  // 苗木の位置(y=地面+1)から木を生やす。空間が無ければ false
  function growTree(x, y, z) {
    const h = 4 + (Math.random() * 2 | 0);
    for (let dy = 0; dy < h + 1; dy++) { const t = blockAt(x, y + dy, z); if (t !== undefined && t !== SAPLING && t !== LEAVES) return false; }
    const put = (bx, by, bz, type, overwriteLeaf) => {
      if (by < CHUNK_Y_MIN || by > CHUNK_Y_MAX) return;
      const cur = blockAt(bx, by, bz);
      if (cur !== undefined && cur !== SAPLING && !(overwriteLeaf && cur === LEAVES)) return;
      setEdit(key(bx, by, bz), type); setBlock(bx, by, bz, type); requestEditedBlockRebuild(bx, by, bz);
    };
    for (let dy = 0; dy < h; dy++) put(x, y + dy, z, LOG, true);          // 幹
    const topY = y + h - 1;
    for (let dy = 0; dy <= 2; dy++) {
      const r = dy < 2 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (dx === 0 && dz === 0 && dy < 2) continue;                     // 幹の芯は葉にしない
        if (Math.abs(dx) === r && Math.abs(dz) === r && Math.random() < 0.6) continue; // 角を間引く
        put(x + dx, topY + dy, z + dz, LEAVES);
      }
    }
    put(x, topY + 3, z, LEAVES, true);
    saveEditsSoon();
    return true;
  }
  function updateSaplings(dt) {
    for (const id of Object.keys(SAVE.saplings)) {
      const c = id.split(','); const bx = +c[0], by = +c[1], bz = +c[2];
      if (blockAt(bx, by, bz) !== SAPLING) { delete SAVE.saplings[id]; continue; }
      SAVE.saplings[id] += dt;
      if (SAVE.saplings[id] >= SAPLING_GROW_TIME) {
        if (growTree(bx, by, bz)) { delete SAVE.saplings[id]; markSaveDirty(); }
        else SAVE.saplings[id] = SAPLING_GROW_TIME - 8; // 空間が無い間は少し待って再挑戦
      }
    }
  }

  function updateCrops(dt) {
    cropTickClock += dt;
    if (cropTickClock < CROP_TICK) return;
    const step = cropTickClock;
    cropTickClock = 0;
    let changed = false;
    for (const id of Object.keys(SAVE.crops)) {
      // 作物ブロックが無くなっていたら（採掘・撤去）追跡をやめる
      const c = id.split(',');
      const bx = +c[0], by = +c[1], bz = +c[2];
      const t = blockAt(bx, by, bz);
      if (t !== WHEAT_YOUNG) { delete SAVE.crops[id]; changed = true; continue; }
      SAVE.crops[id] += step;
      if (SAVE.crops[id] >= CROP_GROW_TIME) {
        delete SAVE.crops[id];
        setEdit(id, WHEAT_RIPE); saveEditsSoon();
        setBlock(bx, by, bz, WHEAT_RIPE); requestEditedBlockRebuild(bx, by, bz);
        changed = true;
      }
    }
    if (changed) markSaveDirty();
  }
