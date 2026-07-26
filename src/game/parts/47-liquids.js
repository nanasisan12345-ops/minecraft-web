  /* ============== 流れる液体（水/溶岩）: イベント駆動セルオートマトン ==============
   * liquids: "x,y,z" -> { t: WATER|LAVA, lv: 0-7 }（0=源, 1-7=流れ）。
   * 流水セルは setBlock で world に置くだけ（永続化しない）。源のみ SAVE.liquids に保存し、
   * ロード時に再シムして流れを作り直す。自然地形の海/川/湖/溶岩は暗黙ブロックなので普段はシム対象外だが、
   * 隣を掘られたセルだけ nat 源としてシムへ取り込み、本家同様「掘れば流れ込む」を再現する。
   * 毎フレーム全走査は禁止：pending(再評価待ち集合) が空ならコスト0。 */
  const liquids = new Map();
  // 32-world-window.js の blockAt に liquids を見せる（掘り跡へ流れ込んだ液体を空気にしないため）
  if (typeof bindLiquidCells === 'function') bindLiquidCells(liquids);
  const LIQ_MAXLV = { [WATER]: 7, [LAVA]: 6 };   // 地上: 水は7マス(lv1-7)、溶岩は3マス(lv2,4,6)
  const LIQ_DROP = { [WATER]: 1, [LAVA]: 2 };     // 水平1マスあたりの減衰
  const LIQ_TICK = { water: 0.25, lava: 1.5 };    // 更新間隔（秒）
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIRS6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const liqKey = (x, y, z) => x + ',' + y + ',' + z;
  const pending = new Set();
  const procCount = new Map(); // セルごとの処理回数（1操作あたり）。振動する境界セルを凍結して必ずアイドルへ収束させる安全弁
  const PROC_CAP = 40;         // 正常な氾濫は数〜十数回で収束。これを超えたセルは以後スキップ（静止）
  // 浸水セルの総数上限。超えたら新しいセルを作らず静止する（本家より安全側の安全弁）。
  // 溶岩は水より厳しく抑える: 山の斜面に流すと落下ごとにレベルが1へ戻るため延々と流れ落ち続け、
  // しかも地形を不可逆に変える（石化）うえダメージ源でもある。
  let NAT_FLOOD_CAP = 1500;
  const LAVA_FLOOD_RATIO = 0.4;
  function liquidCellCap(type) { return type === LAVA ? Math.floor(NAT_FLOOD_CAP * LAVA_FLOOD_RATIO) : NAT_FLOOD_CAP; }
  function setFloodCap(n) { NAT_FLOOD_CAP = Math.max(1, Math.floor(n)); return NAT_FLOOD_CAP; }
  const dirtyLiquidChunks = new Set();
  let liqWaterClock = 0, liqLavaClock = 0;
  let liqProcessedLastTick = 0;

  function getLiquid(x, y, z) { return liquids.get(liqKey(x, y, z)) || null; }
  function enqueueLiquid(x, y, z) { pending.add(liqKey(x, y, z)); }
  function enqueueNeighbors(x, y, z) { for (const [dx, dy, dz] of DIRS6) pending.add(liqKey(x + dx, y + dy, z + dz)); }
  function markLiquidDirty(x, z) {
    const cx = chunkCoord(x), cz = chunkCoord(z);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) dirtyLiquidChunks.add(chunkKey(cx + dx, cz + dz));
  }
  function flushLiquidRebuilds() {
    if (!dirtyLiquidChunks.size) return;
    for (const id of dirtyLiquidChunks) { const c = id.split(','); if (typeof rebuildChunk === 'function') rebuildChunk(+c[0], +c[1]); }
    dirtyLiquidChunks.clear();
  }

  // このセルの液体タイプ（simmed か 自然の水/溶岩）。液体でなければ null。
  function liquidTypeAt(x, y, z) {
    const l = getLiquid(x, y, z); if (l) return l.t;
    const b = blockAt(x, y, z);
    return (b === WATER || b === LAVA) ? b : null;
  }
  // 同タイプ液体のレベル（自然の水/溶岩は源=0扱い）。液体でなければ null。
  function sameTypeLevel(x, y, z, T) {
    const l = getLiquid(x, y, z);
    if (l) return l.t === T ? l.lv : null;
    return blockAt(x, y, z) === T ? 0 : null;
  }
  // 無限水源の判定用: シム管理下の水源(lv0)だけを数える。自然地形の海/川/湖(暗黙の水)は
  // 数えない（数えると岸辺沿いに源化が連鎖してマップ全域が氾濫する）。
  function waterSourceAt(x, y, z) {
    const l = getLiquid(x, y, z);
    return l ? (l.t === WATER && l.lv === 0) : false;
  }

  function setLiquidCell(x, y, z, type, level) {
    liquids.set(liqKey(x, y, z), { t: type, lv: level });
    setBlock(x, y, z, type);
    markLiquidDirty(x, z);
  }
  function clearLiquidCell(x, y, z) {
    const k = liqKey(x, y, z);
    if (!liquids.has(k)) return;
    liquids.delete(k);
    if (SAVE.liquids) delete SAVE.liquids[k];
    if (typeof deleteBlockKey === 'function') deleteBlockKey(k); else setBlock(x, y, z, null);
    markLiquidDirty(x, z);
  }
  // 溶岩セルが水に触れていたら石化（源=黒曜石 / 流れ=丸石）。永続ブロックとして残す。
  function solidifyLavaIfWater(x, y, z, lv) {
    for (const [dx, dy, dz] of DIRS6) {
      if (liquidTypeAt(x + dx, y + dy, z + dz) === WATER) {
        liquids.delete(liqKey(x, y, z));
        if (SAVE.liquids) delete SAVE.liquids[liqKey(x, y, z)];
        const result = (lv === 0) ? OBSIDIAN : COBBLESTONE;
        setEdit(key(x, y, z), result); saveEditsSoon(); setBlock(x, y, z, result); markLiquidDirty(x, z);
        if (typeof playSizzle === 'function') playSizzle(x, y, z);
        enqueueNeighbors(x, y, z);
        return true;
      }
    }
    return false;
  }
  // 水セルが2つ以上の水源に水平隣接し下が塞がっていれば源化（無限水源）
  function tryInfiniteWaterSource(x, y, z) {
    const l = getLiquid(x, y, z);
    if (!l || l.t !== WATER || l.lv === 0) return;
    let sources = 0;
    for (const [dx, dz] of DIRS4) if (waterSourceAt(x + dx, y, z + dz)) sources++;
    if (sources < 2) return;
    const below = blockAt(x, y - 1, z);
    const belowSolid = (below !== undefined && TYPES[below] && TYPES[below].solid !== false) || below === WATER;
    if (belowSolid) { setLiquidCell(x, y, z, WATER, 0); enqueueNeighbors(x, y, z); }
  }

  function updateLiquidCell(x, y, z) {
    const l = getLiquid(x, y, z);
    if (!l) return;
    const T = l.t, maxlv = LIQ_MAXLV[T], drop = LIQ_DROP[T];

    // 溶岩×水の石化を最優先
    if (T === LAVA && solidifyLavaIfWater(x, y, z, l.lv)) return;

    // 源でない流水のレベル＝最寄り源からの距離（BFS的な不動点なので振動しない）。
    // newLv = min( 真上から供給なら1, 隣接同液体の(レベル+減衰) の最小 )。maxlv 超なら支え無し＝枯れる。
    if (l.lv > 0) {
      let newLv = 99;
      if (liquidTypeAt(x, y + 1, z) === T) newLv = 1; // 上から落下供給
      for (const [dx, dz] of DIRS4) {
        const nl = sameTypeLevel(x + dx, y, z + dz, T);
        if (nl != null) { const cand = nl + drop; if (cand < newLv) newLv = cand; }
      }
      if (newLv > maxlv) { clearLiquidCell(x, y, z); enqueueNeighbors(x, y, z); return; }
      if (newLv !== l.lv) { liquids.set(liqKey(x, y, z), { t: T, lv: newLv }); markLiquidDirty(x, z); enqueueNeighbors(x, y, z); }
    }

    const curLv = getLiquid(x, y, z).lv;

    // 流れ: 下が空気なら落下（足元で広がるので水平拡散はしない）、塞がっていれば水平へ拡散。
    // 拡散先は enqueueLiquid のみ（enqueueNeighbors は自セルを再登録し無限振動を招くため使わない。
    // 下流の再評価は「変化した/枯れたセル」側の enqueueNeighbors が担う）。
    const cap = liquidCellCap(T);
    if (blockAt(x, y - 1, z) === undefined) {
      if (liquids.size < cap) {
        setLiquidCell(x, y - 1, z, T, 1);
        enqueueLiquid(x, y - 1, z);
      }
    } else if (curLv < maxlv) {
      for (const [dx, dz] of DIRS4) {
        const nx = x + dx, nz = z + dz, nb = blockAt(nx, y, nz);
        if (nb === undefined) {
          if (liquids.size >= cap) continue;
          setLiquidCell(nx, y, nz, T, curLv + drop); enqueueLiquid(nx, y, nz);
        } else if (nb === WATER && T === LAVA) {
          // 溶岩が水セルへ流れ込む → 石
          const wl = getLiquid(nx, y, nz);
          liquids.delete(liqKey(nx, y, nz)); if (SAVE.liquids) delete SAVE.liquids[liqKey(nx, y, nz)];
          setEdit(key(nx, y, nz), STONE); saveEditsSoon(); setBlock(nx, y, nz, STONE); markLiquidDirty(nx, nz);
          if (typeof playSizzle === 'function') playSizzle(nx, y, nz);
        } else if (nb === T) {
          const nl = getLiquid(nx, y, nz);
          if (nl && nl.t === T && nl.lv > curLv + drop) { setLiquidCell(nx, y, nz, T, curLv + drop); enqueueLiquid(nx, y, nz); }
        }
      }
    }
    if (T === WATER) tryInfiniteWaterSource(x, y, z);
  }

  // メインループから毎フレーム。pending が空ならほぼ即 return（アイドルコスト0）。
  function updateLiquids(dt) {
    liqProcessedLastTick = 0;
    if (!pending.size) return;
    liqWaterClock += dt; liqLavaClock += dt;
    const doWater = liqWaterClock >= LIQ_TICK.water;
    const doLava = liqLavaClock >= LIQ_TICK.lava;
    if (!doWater && !doLava) return;
    if (doWater) liqWaterClock = 0;
    if (doLava) liqLavaClock = 0;
    const batch = [...pending];
    const MAX_PER_TICK = 400; // フレームスパイク防止
    let processed = 0;
    for (const k of batch) {
      if (processed >= MAX_PER_TICK) break;
      const l = liquids.get(k);
      if (!l) { pending.delete(k); continue; }         // 液体でない待機セルは破棄
      const isWater = l.t === WATER;
      if ((isWater && !doWater) || (!isWater && !doLava)) continue; // 別tick担当は残す
      pending.delete(k);
      const pc = (procCount.get(k) || 0) + 1;
      if (pc > PROC_CAP) continue;   // 処理し過ぎ（＝振動）のセルは凍結してアイドルへ収束
      procCount.set(k, pc);
      const c = k.split(',');
      updateLiquidCell(+c[0], +c[1], +c[2]);
      processed++;
    }
    liqProcessedLastTick = processed;
    flushLiquidRebuilds();
  }

  /* --- 自然の水/溶岩からの浸水（本家の「掘れば流れ込む」） ---
   * 自然地形の海/川/湖/滝/溶岩は暗黙ブロックでシム対象外なので、隣に空気ができても自力では
   * 流れ出さない。掘った/爆破したセルの隣に自然液体があれば、その液体セルだけを源として
   * シムへ取り込み（nat=true）、あとは既存のフローに任せる。
   * nat 源は SAVE.natFlood に保存し、ロード時に「今もそこが液体なら」復元する。 */
  function registerNaturalSource(x, y, z, type) {
    const k = liqKey(x, y, z);
    if (liquids.has(k)) { enqueueLiquid(x, y, z); return false; }
    liquids.set(k, { t: type, lv: 0, nat: true });
    if (!SAVE.natFlood) SAVE.natFlood = {};
    SAVE.natFlood[k] = type;
    markSaveDirty();
    enqueueLiquid(x, y, z);
    return true;
  }
  // 破壊/爆発で (x,y,z) が空気になった直後に呼ぶ（rsOnBlockChanged と同じ立ち位置）
  function liquidOnBlockRemoved(x, y, z) {
    if (blockAt(x, y, z) !== undefined) return 0;
    let added = 0;
    for (const [dx, dy, dz] of DIRS6) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (liquids.has(liqKey(nx, ny, nz))) { enqueueLiquid(nx, ny, nz); continue; }
      const b = blockAt(nx, ny, nz);
      if (b !== WATER && b !== LAVA) continue;
      if (registerNaturalSource(nx, ny, nz, b)) added++;
    }
    if (added) { procCount.clear(); flushLiquidRebuilds(); }
    return added;
  }
  // 緊急脱出用: 浸水と流水を全部消し、浸水起点の記録も捨てる（リロードで乾いた状態に戻る）
  function dryUpFlood() {
    const keys = [...liquids.keys()];
    for (const k of keys) {
      const c = k.split(','), x = +c[0], z = +c[2];
      liquids.delete(k);
      if (SAVE.liquids) delete SAVE.liquids[k];
      if (typeof deleteBlockKey === 'function') deleteBlockKey(k); else setBlock(x, +c[1], z, null);
      markLiquidDirty(x, z);
    }
    SAVE.natFlood = {};
    pending.clear(); procCount.clear();
    markSaveDirty();
    flushLiquidRebuilds();
    return { cleared: keys.length };
  }

  /* --- 液体の演出（滝のしぶき / 溶岩の火花と煙 / 環境音の音量） ---
   * 自然の海・川・湖・火山も対象にしたいので liquids Map ではなく blockAt を見る。
   * 毎フレーム走査は重いので 0.25 秒ごとにプレイヤー周辺の 15x7x15（≈1600セル）だけ調べる。 */
  const FX_R = 7, FX_RY = 3, FX_INTERVAL = 0.25;
  const _fxVel = new THREE.Vector3();
  let fxClock = 0, fxWaterAmt = 0, fxLavaAmt = 0;
  function spawnWaterSplash(x, y, z) {
    if (Math.random() > 0.3) return;
    for (let i = 0; i < 2; i++) {
      _fxVel.set(rnd(-0.8, 0.8), rnd(0.6, 2.2), rnd(-0.8, 0.8));
      spawnFx(x + 0.5 + rnd(-0.4, 0.4), y + rnd(0, 0.25), z + 0.5 + rnd(-0.4, 0.4),
        0xcfe6ff, _fxVel, rnd(0.35, 0.6), rnd(0.6, 1.1), 20, true);
    }
  }
  function spawnLavaFx(x, y, z) {
    const r = Math.random();
    if (r < 0.05) {           // 火花（本家の lava pop）
      _fxVel.set(rnd(-0.6, 0.6), rnd(2.2, 4.0), rnd(-0.6, 0.6));
      spawnFx(x + 0.5 + rnd(-0.35, 0.35), y + 1.0, z + 0.5 + rnd(-0.35, 0.35),
        0xffb43a, _fxVel, rnd(0.5, 0.85), rnd(0.8, 1.4), 20, true);
      if (typeof playLavaPop === 'function') playLavaPop(x, y, z);
    } else if (r < 0.13) {    // 煙（負の重力でゆっくり上へ）
      _fxVel.set(rnd(-0.2, 0.2), rnd(0.5, 1.0), rnd(-0.2, 0.2));
      spawnFx(x + 0.5 + rnd(-0.4, 0.4), y + 1.05, z + 0.5 + rnd(-0.4, 0.4),
        0x5a5148, _fxVel, rnd(1.2, 2.0), rnd(1.4, 2.4), -0.35, true);
    }
  }
  function updateLiquidFx(dt) {
    if (typeof updateFxParticles !== 'function') return;
    updateFxParticles(dt);
    if (!started) return;   // プリロード中は演出を出さない
    fxClock += dt;
    if (fxClock < FX_INTERVAL) return;
    fxClock = 0;
    const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
    let water = 0, lava = 0;
    for (let x = px - FX_R; x <= px + FX_R; x++) for (let z = pz - FX_R; z <= pz + FX_R; z++) for (let y = py - FX_RY; y <= py + FX_RY; y++) {
      const t = blockAt(x, y, z);
      if (t !== WATER && t !== LAVA) continue;
      const openAbove = blockAt(x, y + 1, z) === undefined;
      const openBelow = blockAt(x, y - 1, z) === undefined;
      if (t === WATER) {
        if (openAbove) water++;
        // 滝＝上から水が供給されていて、横が開いている柱。柱全体からしぶきが散る（本家と同じ見え方）。
        // 「下が空気」だけで判定すると柱の先端1セルしか出ないので、横の開きも見る。
        const fed = blockAt(x, y + 1, z) === WATER;
        const sideOpen = fed && (blockAt(x + 1, y, z) === undefined || blockAt(x - 1, y, z) === undefined
          || blockAt(x, y, z + 1) === undefined || blockAt(x, y, z - 1) === undefined);
        if (sideOpen || openBelow) { water += 2; spawnWaterSplash(x, y, z); }
      } else {
        if (openAbove) { lava++; spawnLavaFx(x, y, z); }
        if (openBelow) lava += 2;
      }
    }
    fxWaterAmt = water; fxLavaAmt = lava;
  }
  // 44-sound-effects.js の環境音が参照する「近くの液体の量」
  function liquidAmbience() { return { water: fxWaterAmt, lava: fxLavaAmt }; }

  /* --- 公開API（バケツ/セーブ/デバッグ用） --- */
  function placeLiquidSource(x, y, z, type) {
    procCount.clear();
    setLiquidCell(x, y, z, type, 0);
    if (!SAVE.liquids) SAVE.liquids = {};
    SAVE.liquids[liqKey(x, y, z)] = type;
    markSaveDirty();
    enqueueLiquid(x, y, z); enqueueNeighbors(x, y, z);
    flushLiquidRebuilds();
  }
  // バケツで汲めるのは源(lv0)のみ。汲んだら消して周囲を再シム（下流が枯れる）。
  function pickupLiquidSource(x, y, z) {
    const l = getLiquid(x, y, z);
    if (!l || l.lv !== 0) return null;
    const type = l.t;
    if (l.nat) return type;   // 自然の海/湖/溶岩は汲んでも減らない（本家の無限水源）
    procCount.clear();
    clearLiquidCell(x, y, z);
    enqueueNeighbors(x, y, z);
    flushLiquidRebuilds();
    return type;
  }
  // 液体セルにブロックを置いた（塞いだ）とき: 液体エントリを外し下流を再シム（枯れる）。
  function displaceLiquidAt(x, y, z) {
    const k = liqKey(x, y, z);
    if (!liquids.has(k)) return;
    procCount.clear();
    liquids.delete(k);
    if (SAVE.liquids) delete SAVE.liquids[k];
    if (SAVE.natFlood) delete SAVE.natFlood[k];
    enqueueNeighbors(x, y, z);
    flushLiquidRebuilds();
  }
  function restoreLiquids() {
    // 自然からの浸水起点: 地形が今もその液体のままなら源として取り込む（掘り跡が edits に残っているので再浸水する）
    if (SAVE.natFlood) {
      for (const k of Object.keys(SAVE.natFlood)) {
        const c = k.split(','), x = +c[0], y = +c[1], z = +c[2], type = SAVE.natFlood[k];
        if (blockAt(x, y, z) !== type) { delete SAVE.natFlood[k]; continue; }
        liquids.set(k, { t: type, lv: 0, nat: true });
        enqueueLiquid(x, y, z); enqueueNeighbors(x, y, z);
      }
    }
    if (!SAVE.liquids) { flushLiquidRebuilds(); return; }
    for (const k of Object.keys(SAVE.liquids)) {
      const c = k.split(','), type = SAVE.liquids[k];
      setLiquidCell(+c[0], +c[1], +c[2], type, 0);
      enqueueLiquid(+c[0], +c[1], +c[2]); enqueueNeighbors(+c[0], +c[1], +c[2]);
    }
    flushLiquidRebuilds();
  }
  // メッシュ用: 範囲内のシム液体セルを [x,y,z,lv,...] のフラット配列で返す（34 collectMeshPayload が使う）
  function collectLiquidMeshCells(x0, x1, z0, z1) {
    const out = [];
    for (const [k, v] of liquids) {
      const c = k.split(','), x = +c[0], z = +c[2];
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      out.push(x, +c[1], z, v.lv);
    }
    return out;
  }
  // レベル勾配から流向（正規化xz単位ベクトル）を返す。シム液体セルでなければ null。
  // 隣がより弱い(lvが大きい)ほど、また隣が落下口(空気の上に空気)ならその方向へ流れる。
  function liquidFlowVector(x, y, z) {
    const l = getLiquid(x, y, z);
    if (!l) return null;
    let vx = 0, vz = 0;
    for (const [dx, dz] of DIRS4) {
      const nx = x + dx, nz = z + dz;
      const nl = sameTypeLevel(nx, y, nz, l.t);
      if (nl != null) { vx += dx * (nl - l.lv); vz += dz * (nl - l.lv); }
      else if (blockAt(nx, y, nz) === undefined && blockAt(nx, y - 1, nz) === undefined) { vx += dx * 2; vz += dz * 2; }
    }
    const m = Math.hypot(vx, vz);
    if (m < 1e-6) return null;
    return { x: vx / m, z: vz / m };
  }
  function liquidInfoAt(x, y, z) {
    const l = getLiquid(x, y, z);
    return { pos: [x, y, z], liquid: l ? { type: l.t === WATER ? 'water' : 'lava', level: l.lv } : null, block: blockAt(x, y, z) };
  }
  function liquidSimStats() {
    let sources = 0, flowing = 0, natural = 0;
    for (const v of liquids.values()) { (v.lv === 0 ? sources++ : flowing++); if (v.nat) natural++; }
    const sample = [];
    for (const k of pending) { if (sample.length >= 8) break; const l = liquids.get(k); sample.push({ k, l: l ? { t: l.t === WATER ? 'W' : 'L', lv: l.lv } : null }); }
    return { cells: liquids.size, sources, flowing, natural, cap: NAT_FLOOD_CAP, lavaCap: liquidCellCap(LAVA), pending: pending.size, processedLastTick: liqProcessedLastTick, pendingSample: sample };
  }
