  /* ============== 落下ブロック（砂・砂利は支えを失うと落ちる） ==============
   * 本家準拠: 下が空気/非固体になった砂・砂利は実体として落下し、固体の上に着地して
   * ブロックへ戻る。柱になっていれば上から順に連鎖して落ちる。
   * 落下中の分は SAVE.falling に持たせるので、途中でリロードしても消えない。 */
  const FALLING_BLOCKS = [];
  const FALLING_MAX = 96;          // 砂漠を掘り抜いたときの上限。超えた分は落とさず据え置き
  const FALL_GRAVITY = 22, FALL_MAX_SPEED = 24;
  const FALL_CHAIN_MAX = 128;      // 1回の連鎖で落とす柱の高さの上限（無限ループ防止）
  const fallingGeo = new THREE.BoxGeometry(1, 1, 1);

  function isFallingType(t) {
    if (t === undefined) return false;
    return t === SAND || (typeof GRAVEL !== 'undefined' && t === GRAVEL);
  }
  // そのセルが落下ブロックを支えられるか（空気と水/溶岩の上では支えられない＝本家と同じ）
  function supportsFallingBlock(x, y, z) {
    const b = blockAt(x, y, z);
    if (b === undefined) return false;
    if (b === WATER || (typeof LAVA !== 'undefined' && b === LAVA)) return false;
    return TYPES[b] && TYPES[b].solid !== false;
  }
  function spawnFallingBlock(x, y, z, t) {
    if (FALLING_BLOCKS.length >= FALLING_MAX) return null;
    const mesh = new THREE.Mesh(fallingGeo, TYPES[t].mats);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    scene.add(mesh);
    const fb = { mesh, t, x, z, vy: 0 };
    FALLING_BLOCKS.push(fb);
    return fb;
  }
  // (x,y,z) の砂/砂利が宙に浮いていれば落下させる。落ちたら真上も続けて調べる（柱の連鎖）
  function tryFallBlockAt(x, y, z) {
    let started = 0;
    for (let i = 0; i < FALL_CHAIN_MAX; i++) {
      const cy = y + i;
      const t = blockAt(x, cy, z);
      if (!isFallingType(t)) break;
      if (supportsFallingBlock(x, cy - 1, z)) break;   // 支えがあるので落ちない
      if (!spawnFallingBlock(x, cy, z, t)) break;      // 上限に達した
      setEdit(key(x, cy, z), -1);
      setBlock(x, cy, z, null);
      requestEditedBlockRebuild(x, cy, z, t);
      // 抜けた跡の後始末は破壊経路と揃える（隣の海/湖から流れ込む・上のRS部品が剥がれる）
      if (typeof liquidOnBlockRemoved === 'function') liquidOnBlockRemoved(x, cy, z);
      if (typeof breakUnsupportedRsBlocks === 'function') breakUnsupportedRsBlocks(x, cy, z);
      started++;
    }
    if (started) saveEditsSoon();
    return started;
  }
  // ブロックが消えた直後に呼ぶ（破壊・爆発・液体に押し流されたとき）
  function fallingOnBlockRemoved(x, y, z) {
    return tryFallBlockAt(x, y + 1, z);
  }
  // 着地: 空いているセルへブロックとして戻す。埋まっていたらアイテムとして落とす（本家と同じ）
  // 置けるセルか（空気、または押しのけられる水/溶岩）
  function fallingCanLandIn(x, y, z) {
    const b = blockAt(x, y, z);
    return b === undefined || b === WATER || (typeof LAVA !== 'undefined' && b === LAVA);
  }
  function landFallingBlock(fb, startY) {
    scene.remove(fb.mesh);
    const x = fb.x, z = fb.z;
    // 柱で落ちてきた分が同じフレームで同じセルに着地しようとするので、埋まっていたら上へ積む
    let ly = startY;
    for (let i = 0; i < 8 && ly < CHUNK_Y_MAX && !fallingCanLandIn(x, ly, z); i++) ly++;
    // 水/溶岩は押しのけて積もる（本家準拠。海に砂を落として埋め立てられる）
    const at = blockAt(x, ly, z);
    const replaceable = fallingCanLandIn(x, ly, z);
    if (ly <= CHUNK_Y_MAX && replaceable && !overlapsPlayer(x, ly, z, fb.t)) {
      setEdit(key(x, ly, z), fb.t);
      saveEditsSoon();
      setBlock(x, ly, z, fb.t);
      requestEditedBlockRebuild(x, ly, z, fb.t);
      if (at !== undefined && typeof displaceLiquidAt === 'function') displaceLiquidAt(x, ly, z); // 塞いだ液体の下流を枯らす
      if (typeof rsOnBlockChanged === 'function') rsOnBlockChanged(x, ly, z, fb.t);
      thock(230);
      return;
    }
    const itemId = ITEM_FOR_BLOCK[fb.t];
    if (itemId && typeof spawnItemDrop === 'function') spawnItemDrop(x, ly, z, itemId, 1);
  }
  function updateFallingBlocks(dt) {
    for (let i = FALLING_BLOCKS.length - 1; i >= 0; i--) {
      const fb = FALLING_BLOCKS[i];
      fb.vy = Math.max(-FALL_MAX_SPEED, fb.vy - FALL_GRAVITY * dt);
      const p = fb.mesh.position;
      const nextBottom = (p.y - 0.5) + fb.vy * dt;
      const cell = Math.floor(nextBottom);
      if (cell < CHUNK_Y_MIN || supportsFallingBlock(fb.x, cell, fb.z)) {
        FALLING_BLOCKS.splice(i, 1);
        landFallingBlock(fb, Math.max(CHUNK_Y_MIN, cell + 1));
        continue;
      }
      p.y += fb.vy * dt;
    }
  }
  // リロード後の復元（82のループ開始前に一度呼ぶ）
  function loadSavedFallingBlocks() {
    if (!Array.isArray(SAVE.falling)) { SAVE.falling = []; return; }
    for (const f of SAVE.falling) {
      if (!f || !TYPES[f.t]) continue;
      const fb = spawnFallingBlock(f.x, f.y, f.z, f.t);
      if (fb) fb.vy = Number.isFinite(f.vy) ? f.vy : 0;
    }
    SAVE.falling = [];
  }
  function collectFallingForSave() {
    SAVE.falling = FALLING_BLOCKS.map(fb => ({
      x: fb.x, y: fb.mesh.position.y - 0.5, z: fb.z, t: fb.t, vy: +fb.vy.toFixed(2),
    }));
  }
  function fallingBlockStats() {
    return {
      count: FALLING_BLOCKS.length,
      cells: FALLING_BLOCKS.map(fb => ({ x: fb.x, y: +(fb.mesh.position.y - 0.5).toFixed(2), z: fb.z, type: TYPES[fb.t].name, vy: +fb.vy.toFixed(2) })),
    };
  }
