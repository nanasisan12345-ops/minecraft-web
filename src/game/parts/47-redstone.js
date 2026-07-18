  /* ============== レッドストーン基礎: イベント駆動の信号グラフ ==============
   * ブロック実体はIDバリアント（on/off を別IDで edits に保存＝回路の状態はセーブ互換のまま復元）。
   * ここではワイヤの信号強度とタイマーだけを持つ。変化イベントで rsDirty を立て、0.1s の
   * RSティックで「トーチNOT更新（前tickの値で判定=本家の1tick遅延）→ワイヤBFS→出力適用」。
   * アイドル時（rsDirty=false かつ ボタン/感圧板なし）はコスト0。毎フレーム全走査はしない。 */
  const RS_TICK_SEC = 0.1;
  const RS_DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const RS_DIRS6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const RS_BLOCK_IDS = new Set([REDSTONE_WIRE, REDSTONE_TORCH, REDSTONE_TORCH_OFF, LEVER_OFF, LEVER_ON,
    STONE_BUTTON_OFF, STONE_BUTTON_ON, STONE_PLATE_OFF, STONE_PLATE_ON, WOOD_PLATE_OFF, WOOD_PLATE_ON,
    REDSTONE_LAMP_OFF, REDSTONE_LAMP_ON]);
  const rsCells = new Map();        // "x,y,z" -> ブロックID（RS部品のレジストリ。ブロック実体と同期）
  const rsWireLevel = new Map();    // "x,y,z" -> 0-15（ワイヤ強度。再計算で更新、セーブしない）
  const rsButtonTimer = new Map();  // "x,y,z" -> 残り秒（押下中のボタン）
  const rsPrevPowered = new Map();  // 出力セル(ドア等)の前回受電状態。立ち上がり/立ち下がりエッジ検出用
  const rsOrphans = new Set();      // 撤去された部品の位置。次tickで周囲の出力(ドア等)に断エッジを届けてから消す
  const dirtyRsChunks = new Set();
  let rsDirty = false;
  let rsClock = 0;
  let rsPlateCount = 0;             // 感圧板の数（0ならポーリングもしない）

  function rsSourceStrength(t) {
    return (t === REDSTONE_TORCH || t === LEVER_ON || t === STONE_BUTTON_ON ||
      t === STONE_PLATE_ON || t === WOOD_PLATE_ON) ? 15 : 0;
  }
  function rsIsPlate(t) { return t === STONE_PLATE_OFF || t === STONE_PLATE_ON || t === WOOD_PLATE_OFF || t === WOOD_PLATE_ON; }
  function rsRecountPlates() { rsPlateCount = 0; for (const t of rsCells.values()) if (rsIsPlate(t)) rsPlateCount++; }

  // ワイヤ視覚（強度で明度が変わる）は自チャンク＋ハロー(±1マス)が届く隣接チャンクだけ再構築
  function markRsChunkDirty(x, z) {
    const cx = chunkCoord(x), cz = chunkCoord(z);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const b = chunkBounds(cx + dx, cz + dz);
      if (x >= b.x0 - 1 && x <= b.x1 + 1 && z >= b.z0 - 1 && z <= b.z1 + 1) dirtyRsChunks.add(chunkKey(cx + dx, cz + dz));
    }
  }
  function flushRsRebuilds() {
    if (!dirtyRsChunks.size) return;
    for (const id of dirtyRsChunks) { const c = id.split(','); if (typeof rebuildChunk === 'function') rebuildChunk(+c[0], +c[1]); }
    dirtyRsChunks.clear();
  }

  // レジストリの自己修復つき参照: ブロック実体と食い違っていたら実体に合わせる（爆発等の消し漏れ対策）
  function rsCellType(k) {
    const t = rsCells.get(k);
    if (t === undefined) return undefined;
    const c = k.split(','), actual = blockAt(+c[0], +c[1], +c[2]);
    if (actual !== t) {
      if (actual !== undefined && RS_BLOCK_IDS.has(actual)) { rsCells.set(k, actual); return actual; }
      rsCells.delete(k); rsWireLevel.delete(k); rsButtonTimer.delete(k);
      rsOrphans.add(k); rsDirty = true; // 消えた部品の周囲へ断エッジを届ける
      return undefined;
    }
    return t;
  }

  // ブロックの設置/破壊/ID切替をレジストリへ反映（52の設置/破壊・爆発・復元から呼ばれる）
  function rsOnBlockChanged(x, y, z, newType) {
    const k = key(x, y, z);
    if (newType != null && newType >= 0 && RS_BLOCK_IDS.has(newType)) { rsCells.set(k, newType); rsDirty = true; }
    else if (rsCells.has(k)) {
      rsCells.delete(k); rsWireLevel.delete(k); rsButtonTimer.delete(k);
      rsOrphans.add(k); // 周囲の出力へ断エッジを届ける
      rsDirty = true;
    } else if (rsCells.size) {
      rsDirty = true; // RSでないブロックの増減も回路の隣接に影響しうる（TNT設置等）
    }
    rsRecountPlates();
    rsPrevPowered.delete(k);
  }

  // このセルが受電しているか（隣接6方向の アクティブ源 / 強度>0のワイヤ から）。
  // 真上に立つトーチは「このセルに取り付いた」ものなので数えない（トーチは自分の足場を給電しない）。
  function rsPoweredAt(x, y, z) {
    let p = 0;
    for (const [dx, dy, dz] of RS_DIRS6) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const nk = key(nx, ny, nz);
      const t = rsCellType(nk);
      if (t === undefined) continue;
      if (t === REDSTONE_WIRE) { const lv = rsWireLevel.get(nk) || 0; if (lv > p) p = lv; continue; }
      if ((t === REDSTONE_TORCH) && dy === 1) continue; // 真上のトーチ＝自分に刺さっている
      const s = rsSourceStrength(t);
      if (s > p) p = s;
    }
    return p;
  }

  // トーチのNOT判定（前tickのワイヤ強度で判定＝1RSティックの遅延）。変化したら true
  function rsUpdateTorches() {
    let changed = false;
    for (const [k, t] of [...rsCells]) {
      if (t !== REDSTONE_TORCH && t !== REDSTONE_TORCH_OFF) continue;
      if (rsCellType(k) !== t) continue;
      const c = k.split(','), x = +c[0], y = +c[1], z = +c[2];
      const attachPowered = rsPoweredAt(x, y - 1, z) > 0; // 取付ブロック（足場）が受電→消灯
      const want = attachPowered ? REDSTONE_TORCH_OFF : REDSTONE_TORCH;
      if (want === t) continue;
      setEdit(k, want); saveEditsSoon(); setBlock(x, y, z, want);
      rsCells.set(k, want);
      requestEditedBlockRebuild(x, y, z, want); // 光レベル7の点灯/消灯を広域再メッシュ
      changed = true;
    }
    return changed;
  }

  // ワイヤ強度の再計算: アクティブ源の隣接ワイヤ=15 から BFS で -1 減衰（水平4方向＋段差の斜め上下）。
  // 強度が1つでも変わったら true（トーチのNOT判定は前tick値を使うため、次tickの再評価が要る）
  function rsRecomputeWires() {
    const next = new Map();
    const q = [];
    for (const [k, t] of rsCells) { if (t === REDSTONE_WIRE && rsCellType(k) === REDSTONE_WIRE) next.set(k, 0); }
    for (const [k, t] of rsCells) {
      if (!rsSourceStrength(t) || rsCellType(k) !== t) continue;
      const c = k.split(','), x = +c[0], y = +c[1], z = +c[2];
      for (const [dx, dy, dz] of RS_DIRS6) {
        const nk = key(x + dx, y + dy, z + dz);
        if (next.has(nk) && next.get(nk) < 15) { next.set(nk, 15); q.push(nk); }
      }
    }
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi], lv = next.get(k);
      if (lv <= 1) continue;
      const c = k.split(','), x = +c[0], y = +c[1], z = +c[2];
      for (const [dx, dz] of RS_DIRS4) for (const dy of [0, 1, -1]) {
        const nk = key(x + dx, y + dy, z + dz);
        if (next.has(nk) && next.get(nk) < lv - 1) { next.set(nk, lv - 1); q.push(nk); }
      }
    }
    let changed = false;
    for (const [k, lv] of next) {
      if ((rsWireLevel.get(k) || 0) !== lv) { changed = true; const c = k.split(','); markRsChunkDirty(+c[0], +c[2]); }
    }
    if (rsWireLevel.size !== next.size) changed = true;
    rsWireLevel.clear();
    for (const [k, lv] of next) rsWireLevel.set(k, lv);
    return changed;
  }

  // 出力の適用: グラフ（ワイヤ/源）の隣接セルにある ドア/トラップドア/ゲート/ランプ/TNT。
  // ドア系は受電の立ち上がりで開・立ち下がりで閉（定常状態では手動開閉を邪魔しない＝受電優先はエッジで実現）
  function rsApplyOutputs() {
    const seen = new Set();
    const liveKeys = new Set();
    for (const [k, t] of rsCells) {
      if (t !== REDSTONE_WIRE && !rsSourceStrength(t) && t !== REDSTONE_TORCH_OFF) continue;
      const c = k.split(','), x = +c[0], y = +c[1], z = +c[2];
      for (const [dx, dy, dz] of RS_DIRS6) rsApplyOutputAt(x + dx, y + dy, z + dz, seen, liveKeys);
    }
    // 撤去された部品の周囲も走査（隣のドア等に「断」の立ち下がりを届ける）
    for (const k of rsOrphans) {
      const c = k.split(','), x = +c[0], y = +c[1], z = +c[2];
      for (const [dx, dy, dz] of RS_DIRS6) rsApplyOutputAt(x + dx, y + dy, z + dz, seen, liveKeys);
    }
    rsOrphans.clear();
    // グラフから切り離された出力セルのエッジ状態を掃除
    for (const k of [...rsPrevPowered.keys()]) if (!liveKeys.has(k)) rsPrevPowered.delete(k);
  }
  function rsApplyOutputAt(x, y, z, seen, liveKeys) {
    const k = key(x, y, z);
    if (seen.has(k)) return;
    seen.add(k);
    const t = blockAt(x, y, z);
    if (t === undefined) return;
    const isDoor = typeof isDoorBlock === 'function' && isDoorBlock(t);
    const isTrap = typeof isTrapdoorBlock === 'function' && isTrapdoorBlock(t);
    const isGate = typeof isFenceGateBlock === 'function' && isFenceGateBlock(t);
    const isLamp = t === REDSTONE_LAMP_OFF || t === REDSTONE_LAMP_ON;
    const isTnt = t === TNT;
    if (!isDoor && !isTrap && !isGate && !isLamp && !isTnt) return;

    // ドアは上下2セルで1枚: 下セルに正規化し、どちらかが受電していれば powered
    let ck = k, powered;
    if (isDoor) {
      const pair = doorPairAt(x, y, z, t);
      if (!pair) return;
      ck = key(pair.x, pair.y, pair.z);
      powered = rsPoweredAt(pair.x, pair.y, pair.z) > 0 || rsPoweredAt(pair.x, pair.y + 1, pair.z) > 0;
    } else {
      powered = rsPoweredAt(x, y, z) > 0;
    }
    liveKeys.add(ck);
    const prev = rsPrevPowered.get(ck) || false;
    if (powered === prev) { if (isLamp) rsSyncLamp(x, y, z, t, powered); return; }
    rsPrevPowered.set(ck, powered);

    if (isLamp) { rsSyncLamp(x, y, z, t, powered); return; }
    if (isTnt) { if (powered && typeof igniteTNT === 'function') igniteTNT(x, y, z); return; }
    if (isDoor) {
      const c = ck.split(','), pair = doorPairAt(+c[0], +c[1], +c[2], blockAt(+c[0], +c[1], +c[2]));
      if (pair && pair.info.open !== powered) toggleDoorAt(pair.x, pair.y, pair.z, blockAt(pair.x, pair.y, pair.z));
      return;
    }
    if (isTrap) {
      const open = t === OAK_TRAPDOOR_OPEN;
      if (open !== powered) toggleTrapdoorAt(x, y, z, t);
      return;
    }
    if (isGate) {
      const info = FENCE_GATE_INFO.get(t);
      if (info && info.open !== powered) toggleFenceGateAt(x, y, z, t);
    }
  }
  // ランプはエッジではなく定常同期（設置直後から受電状態に一致させる）
  function rsSyncLamp(x, y, z, t, powered) {
    const want = powered ? REDSTONE_LAMP_ON : REDSTONE_LAMP_OFF;
    if (t === want) return;
    const k = key(x, y, z);
    setEdit(k, want); saveEditsSoon(); setBlock(x, y, z, want);
    rsCells.set(k, want);
    requestEditedBlockRebuild(x, y, z, want); // 光レベル15の点灯/消灯を広域再メッシュ
  }

  // 感圧板: 上に乗っている実体（プレイヤー/モブ/動物、木の板はドロップも）で ON/OFF
  function rsEntityOnCell(x, y, z, includeDrops) {
    const inCell = (px, py, pz) => px >= x - 0.2 && px <= x + 1.2 && pz >= z - 0.2 && pz <= z + 1.2 && py >= y - 0.2 && py <= y + 1.1;
    // プレイヤーは縦スパン（足=pos.y-EYE(1.6) 〜 頭=pos.y+0.2）が板セルの下部と重なるかで判定
    if (typeof player !== 'undefined' &&
      player.pos.x >= x - 0.2 && player.pos.x <= x + 1.2 && player.pos.z >= z - 0.2 && player.pos.z <= z + 1.2 &&
      player.pos.y + 0.2 >= y && player.pos.y - 1.6 <= y + 0.8) return true;
    if (typeof MOBS !== 'undefined') for (const m of MOBS) { if (m.position && inCell(m.position.x, m.position.y, m.position.z)) return true; }
    if (typeof ANIMALS !== 'undefined') for (const a of ANIMALS) { if (a.position && inCell(a.position.x, a.position.y, a.position.z)) return true; }
    if (includeDrops && typeof ITEM_DROPS !== 'undefined') for (const d of ITEM_DROPS) { const p = d.mesh && d.mesh.position; if (p && inCell(p.x, p.y, p.z)) return true; }
    return false;
  }
  function rsCheckPlates() {
    for (const [k, t] of [...rsCells]) {
      if (!rsIsPlate(t) || rsCellType(k) !== t) continue;
      const c = k.split(','), x = +c[0], y = +c[1], z = +c[2];
      const wood = t === WOOD_PLATE_OFF || t === WOOD_PLATE_ON;
      const active = rsEntityOnCell(x, y, z, wood);
      const want = wood ? (active ? WOOD_PLATE_ON : WOOD_PLATE_OFF) : (active ? STONE_PLATE_ON : STONE_PLATE_OFF);
      if (want === t) continue;
      setEdit(k, want); saveEditsSoon(); setBlock(x, y, z, want);
      rsCells.set(k, want);
      markRsChunkDirty(x, z);
      rsDirty = true;
      if (active) thock(300);
    }
  }

  // ボタン: 押すと1.0秒ON（本家: 石ボタン1.0s）
  function rsPressButtonAt(x, y, z) {
    const k = key(x, y, z);
    if (blockAt(x, y, z) !== STONE_BUTTON_OFF) return false;
    setEdit(k, STONE_BUTTON_ON); saveEditsSoon(); setBlock(x, y, z, STONE_BUTTON_ON);
    rsCells.set(k, STONE_BUTTON_ON);
    rsButtonTimer.set(k, 1.0);
    markRsChunkDirty(x, z);
    rsDirty = true;
    thock(330);
    return true;
  }
  function rsToggleLeverAt(x, y, z, t) {
    const k = key(x, y, z);
    const want = t === LEVER_OFF ? LEVER_ON : LEVER_OFF;
    setEdit(k, want); saveEditsSoon(); setBlock(x, y, z, want);
    rsCells.set(k, want);
    markRsChunkDirty(x, z);
    rsDirty = true;
    thock(want === LEVER_ON ? 320 : 240);
    if (typeof setDebugToast === 'function') setDebugToast(want === LEVER_ON ? 'レバーON' : 'レバーOFF', 0.8);
    return true;
  }

  // メインループから毎フレーム。何も無ければ即 return（アイドルコスト0）
  function updateRedstone(dt) {
    if (!rsCells.size && !rsOrphans.size && !rsButtonTimer.size) return;
    if (rsButtonTimer.size) {
      for (const [k, left] of [...rsButtonTimer]) {
        const rest = left - dt;
        if (rest > 0) { rsButtonTimer.set(k, rest); continue; }
        rsButtonTimer.delete(k);
        const c = k.split(','), x = +c[0], y = +c[1], z = +c[2];
        if (blockAt(x, y, z) === STONE_BUTTON_ON) {
          setEdit(k, STONE_BUTTON_OFF); saveEditsSoon(); setBlock(x, y, z, STONE_BUTTON_OFF);
          rsCells.set(k, STONE_BUTTON_OFF);
          markRsChunkDirty(x, z);
          rsDirty = true;
          thock(220);
        }
      }
    }
    rsClock += dt;
    if (rsClock < RS_TICK_SEC) return;
    rsClock = 0;
    if (rsPlateCount) rsCheckPlates();
    if (!rsDirty) { flushRsRebuilds(); return; }
    rsDirty = false;
    if (rsUpdateTorches()) rsDirty = true;   // トーチが変わったら次tickへ伝播（1RSティック遅延）
    if (rsRecomputeWires()) rsDirty = true;  // ワイヤが変わったら次tickでトーチを再評価
    rsApplyOutputs();
    flushRsRebuilds();
  }

  // ロード時: edits からRS部品を拾ってレジストリ復元。ボタン/感圧板の押下状態は揮発なのでOFFへ正規化
  function restoreRedstone() {
    if (typeof edits === 'undefined' || !edits) return;
    for (const [id, t] of edits) {
      if (!RS_BLOCK_IDS.has(t)) continue;
      let norm = t;
      if (t === STONE_BUTTON_ON) norm = STONE_BUTTON_OFF;
      else if (t === STONE_PLATE_ON) norm = STONE_PLATE_OFF;
      else if (t === WOOD_PLATE_ON) norm = WOOD_PLATE_OFF;
      const c = id.split(','), x = +c[0], y = +c[1], z = +c[2];
      if (norm !== t) { setEdit(id, norm); setBlock(x, y, z, norm); }
      rsCells.set(id, norm);
    }
    rsRecountPlates();
    if (rsCells.size) rsDirty = true;
  }

  // メッシュ用: 範囲内のワイヤ強度を [x,y,z,lv,...] で返す（34 collectMeshPayload が使う）
  function collectRsWireCells(x0, x1, z0, z1) {
    const out = [];
    for (const [k, t] of rsCells) {
      if (t !== REDSTONE_WIRE) continue;
      const c = k.split(','), x = +c[0], z = +c[2];
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      out.push(x, +c[1], z, rsWireLevel.get(k) || 0);
    }
    return out;
  }

  function rsSignalInfoAt(x, y, z) {
    const k = key(x, y, z);
    const t = rsCellType(k);
    return {
      pos: [x, y, z],
      block: blockAt(x, y, z),
      type: t,
      wireLevel: t === REDSTONE_WIRE ? (rsWireLevel.get(k) || 0) : null,
      sourceStrength: t !== undefined ? rsSourceStrength(t) : 0,
      powered: rsPoweredAt(x, y, z),
    };
  }
  function rsStats() {
    let wires = 0, sources = 0, torches = 0, plates = 0, buttons = 0, lamps = 0;
    for (const t of rsCells.values()) {
      if (t === REDSTONE_WIRE) wires++;
      else if (t === REDSTONE_TORCH || t === REDSTONE_TORCH_OFF) torches++;
      else if (rsIsPlate(t)) plates++;
      else if (t === STONE_BUTTON_OFF || t === STONE_BUTTON_ON) buttons++;
      else if (t === REDSTONE_LAMP_OFF || t === REDSTONE_LAMP_ON) lamps++;
      if (rsSourceStrength(t)) sources++;
    }
    return { cells: rsCells.size, wires, sources, torches, plates, buttons, lamps, dirty: rsDirty, buttonTimers: rsButtonTimer.size };
  }
