  /* ============== クラフトレシピ（形合わせ判定） + かまど精錬ロジック ==============
   * レシピは pattern（行の配列）と keys（文字 -> アイテムID）で定義する。
   * グリッド内の配置を外接矩形に切り出して比較するので、2x2/3x3のどこに置いてもよい。
   * 左右反転も一致とみなす（斧などの利き手違い）。 */
  const RECIPES = [
    { out: 'planks', n: 4, pattern: ['L'], keys: { L: 'log' } },
    { out: 'stick', n: 4, pattern: ['P', 'P'], keys: { P: 'planks' } },
    { out: 'crafting_table', n: 1, pattern: ['PP', 'PP'], keys: { P: 'planks' } },
    { out: 'furnace', n: 1, pattern: ['CCC', 'C C', 'CCC'], keys: { C: 'cobblestone' } },
    { out: 'chest', n: 1, pattern: ['PPP', 'P P', 'PPP'], keys: { P: 'planks' } },
    { out: 'oak_door', n: 3, pattern: ['PP', 'PP', 'PP'], keys: { P: 'planks' } },
    { out: 'oak_trapdoor', n: 2, pattern: ['PPP', 'PPP'], keys: { P: 'planks' } },
    { out: 'oak_fence', n: 3, pattern: ['PSP', 'PSP'], keys: { P: 'planks', S: 'stick' } },
    { out: 'oak_fence_gate', n: 1, pattern: ['SPS', 'SPS'], keys: { P: 'planks', S: 'stick' } },
    { out: 'cobblestone_wall', n: 6, pattern: ['CCC', 'CCC'], keys: { C: 'cobblestone' } },
    { out: 'ladder', n: 3, pattern: ['S S', 'SSS', 'S S'], keys: { S: 'stick' } },
    { out: 'glass_pane', n: 16, pattern: ['GGG', 'GGG'], keys: { G: 'glass' } },
    { out: 'sign', n: 3, pattern: ['PPP', 'PPP', ' S '], keys: { P: 'planks', S: 'stick' } },
    { out: 'torch', n: 4, pattern: ['O', 'S'], keys: { O: 'coal', S: 'stick' } },
    { out: 'cloth', n: 1, pattern: ['FF', 'FF'], keys: { F: 'fiber' } },
    { out: 'bread', n: 1, pattern: ['WWW'], keys: { W: 'wheat' } },
    { out: 'bed', n: 1, pattern: ['CCC', 'PPP'], keys: { C: 'cloth', P: 'planks' } },
    { out: 'stone_brick', n: 4, pattern: ['TT', 'TT'], keys: { T: 'stone' } },
    // 階段（素材6→4）とハーフブロック（素材3→6）
    { out: 'oak_stairs', n: 4, pattern: ['M  ', 'MM ', 'MMM'], keys: { M: 'planks' } },
    { out: 'cobblestone_stairs', n: 4, pattern: ['M  ', 'MM ', 'MMM'], keys: { M: 'cobblestone' } },
    { out: 'stone_brick_stairs', n: 4, pattern: ['M  ', 'MM ', 'MMM'], keys: { M: 'stone_brick' } },
    { out: 'oak_slab', n: 6, pattern: ['MMM'], keys: { M: 'planks' } },
    { out: 'cobblestone_slab', n: 6, pattern: ['MMM'], keys: { M: 'cobblestone' } },
    { out: 'stone_brick_slab', n: 6, pattern: ['MMM'], keys: { M: 'stone_brick' } },
    { out: 'tnt', n: 1, pattern: ['GSG', 'SGS', 'GSG'], keys: { G: 'gunpowder', S: 'sand' } },
    // 鉱物の収納ブロック（9個 → 1ブロック、逆に1ブロック → 9個）
    { out: 'iron_block', n: 1, pattern: ['MMM', 'MMM', 'MMM'], keys: { M: 'iron_ingot' } },
    { out: 'iron_ingot', n: 9, pattern: ['B'], keys: { B: 'iron_block' } },
    { out: 'gold_block', n: 1, pattern: ['MMM', 'MMM', 'MMM'], keys: { M: 'gold_ingot' } },
    { out: 'gold_ingot', n: 9, pattern: ['B'], keys: { B: 'gold_block' } },
    { out: 'diamond_block', n: 1, pattern: ['MMM', 'MMM', 'MMM'], keys: { M: 'diamond' } },
    { out: 'diamond', n: 9, pattern: ['B'], keys: { B: 'diamond_block' } },
    { out: 'coal_block', n: 1, pattern: ['MMM', 'MMM', 'MMM'], keys: { M: 'coal' } },
    { out: 'coal', n: 9, pattern: ['B'], keys: { B: 'coal_block' } },
    // レッドストーン部品（本家準拠: トーチ=棒+ダスト / レバー=棒+丸石 / ボタン=石1 / 感圧板=同素材2 /
    // ランプ=ダスト4+発光結晶の欠片1（C16でグロウストーンに移行するまでの代用））
    { out: 'redstone_torch', n: 1, pattern: ['R', 'S'], keys: { R: 'redstone_dust', S: 'stick' } },
    { out: 'lever', n: 1, pattern: ['S', 'C'], keys: { S: 'stick', C: 'cobblestone' } },
    { out: 'stone_button', n: 1, pattern: ['T'], keys: { T: 'stone' } },
    { out: 'stone_pressure_plate', n: 1, pattern: ['TT'], keys: { T: 'stone' } },
    { out: 'wooden_pressure_plate', n: 1, pattern: ['PP'], keys: { P: 'planks' } },
    { out: 'redstone_lamp', n: 1, pattern: [' R ', 'RGR', ' R '], keys: { R: 'redstone_dust', G: 'glow_shard' } },
    // バケツ（鉄インゴット3個をV字に）
    { out: 'bucket', n: 1, pattern: ['M M', ' M '], keys: { M: 'iron_ingot' } },
    // ツルハシ
    { out: 'wood_pickaxe', n: 1, pattern: ['MMM', ' S ', ' S '], keys: { M: 'planks', S: 'stick' } },
    { out: 'stone_pickaxe', n: 1, pattern: ['MMM', ' S ', ' S '], keys: { M: 'cobblestone', S: 'stick' } },
    { out: 'iron_pickaxe', n: 1, pattern: ['MMM', ' S ', ' S '], keys: { M: 'iron_ingot', S: 'stick' } },
    { out: 'diamond_pickaxe', n: 1, pattern: ['MMM', ' S ', ' S '], keys: { M: 'diamond', S: 'stick' } },
    // 斧
    { out: 'wood_axe', n: 1, pattern: ['MM', 'MS', ' S'], keys: { M: 'planks', S: 'stick' } },
    { out: 'stone_axe', n: 1, pattern: ['MM', 'MS', ' S'], keys: { M: 'cobblestone', S: 'stick' } },
    { out: 'iron_axe', n: 1, pattern: ['MM', 'MS', ' S'], keys: { M: 'iron_ingot', S: 'stick' } },
    // シャベル
    { out: 'wood_shovel', n: 1, pattern: ['M', 'S', 'S'], keys: { M: 'planks', S: 'stick' } },
    { out: 'stone_shovel', n: 1, pattern: ['M', 'S', 'S'], keys: { M: 'cobblestone', S: 'stick' } },
    { out: 'iron_shovel', n: 1, pattern: ['M', 'S', 'S'], keys: { M: 'iron_ingot', S: 'stick' } },
    // クワ（農業用）
    { out: 'wood_hoe', n: 1, pattern: ['MM', 'S ', 'S '], keys: { M: 'planks', S: 'stick' } },
    { out: 'stone_hoe', n: 1, pattern: ['MM', 'S ', 'S '], keys: { M: 'cobblestone', S: 'stick' } },
    { out: 'iron_hoe', n: 1, pattern: ['MM', 'S ', 'S '], keys: { M: 'iron_ingot', S: 'stick' } },
    // 剣
    { out: 'wood_sword', n: 1, pattern: ['M', 'M', 'S'], keys: { M: 'planks', S: 'stick' } },
    { out: 'stone_sword', n: 1, pattern: ['M', 'M', 'S'], keys: { M: 'cobblestone', S: 'stick' } },
    { out: 'iron_sword', n: 1, pattern: ['M', 'M', 'S'], keys: { M: 'iron_ingot', S: 'stick' } },
    { out: 'diamond_sword', n: 1, pattern: ['M', 'M', 'S'], keys: { M: 'diamond', S: 'stick' } },
    // 弓と矢
    { out: 'bow', n: 1, pattern: [' SF', 'S F', ' SF'], keys: { S: 'stick', F: 'fiber' } },
    { out: 'arrow', n: 4, pattern: ['C', 'S', 'F'], keys: { C: 'cobblestone', S: 'stick', F: 'fiber' } },
    // 防具（胸当て型）
    { out: 'cloth_armor', n: 1, pattern: ['M M', 'MMM', 'MMM'], keys: { M: 'cloth' } },
    { out: 'iron_armor', n: 1, pattern: ['M M', 'MMM', 'MMM'], keys: { M: 'iron_ingot' } },
    { out: 'diamond_armor', n: 1, pattern: ['M M', 'MMM', 'MMM'], keys: { M: 'diamond' } },
  ];
  // レシピの pattern を [ [id|null,...], ... ] に正規化してキャッシュ
  for (const r of RECIPES) {
    r.rows = r.pattern.map(row => [...row].map(ch => (ch === ' ' ? null : r.keys[ch])));
    r.mirror = r.rows.map(row => [...row].reverse());
  }
  // グリッド（item|null の配列, 幅w）から非空セルの外接矩形を id の行列で切り出す
  function craftGridRows(cells, w) {
    const h = Math.ceil(cells.length / w);
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!cells[y * w + x]) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (maxX < 0) return null;
    const rows = [];
    for (let y = minY; y <= maxY; y++) {
      const row = [];
      for (let x = minX; x <= maxX; x++) { const s = cells[y * w + x]; row.push(s ? s.id : null); }
      rows.push(row);
    }
    return rows;
  }
  function rowsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let y = 0; y < a.length; y++) {
      if (a[y].length !== b[y].length) return false;
      for (let x = 0; x < a[y].length; x++) if (a[y][x] !== b[y][x]) return false;
    }
    return true;
  }
  // グリッドに一致するレシピを返す（なければ null）
  function matchRecipe(cells, w) {
    const rows = craftGridRows(cells, w);
    if (!rows) return null;
    for (const r of RECIPES) {
      if (r.rows.length > w || r.rows[0].length > w) continue; // 2x2グリッドに3x3レシピは組めない
      if (rowsEqual(rows, r.rows) || rowsEqual(rows, r.mirror)) return r;
    }
    return null;
  }
  // クラフト実行: 各セルを1個ずつ消費
  function consumeCraftGrid(cells) {
    for (let i = 0; i < cells.length; i++) {
      const s = cells[i];
      if (!s) continue;
      s.n -= 1;
      if (s.n <= 0) cells[i] = null;
    }
  }

  /* --- かまど --- */
  const SMELT_TIME = 10; // 1アイテムの精錬秒数
  const SMELT_RESULT = {
    raw_iron: 'iron_ingot',
    raw_gold: 'gold_ingot',
    sand: 'glass',
    raw_meat: 'cooked_meat',
    cobblestone: 'stone',
    log: 'coal', // 木炭の代わり
  };
  function furnaceState(id) {
    let st = SAVE.furnaces[id];
    if (!st) { st = { in: null, fuel: null, out: null, prog: 0, fuelLeft: 0, fuelMax: 0 }; SAVE.furnaces[id] = st; }
    return st;
  }
  function furnaceCanSmelt(st) {
    if (!st.in) return false;
    const outId = SMELT_RESULT[st.in.id];
    if (!outId) return false;
    if (st.out && (st.out.id !== outId || st.out.n >= maxStack(outId))) return false;
    return true;
  }
  // 点火状態に合わせて、かまどブロックの見た目を FURNACE ⇄ FURNACE_LIT で切り替える。
  // 起動中(fuelLeft>0)は炎テクスチャ＆発光。プレイヤー設置(edit)は setEdit で、
  // 構造物由来(world)は setBlock で切り替える。edits に載る FURNACE_LIT は起動時に正規化する。
  function syncFurnaceVisual(id, lit) {
    const c = id.split(',');
    const x = +c[0], y = +c[1], z = +c[2];
    const cur = blockAt(x, y, z);
    if (cur !== FURNACE && cur !== FURNACE_LIT) return; // かまどが撤去済み
    const want = lit ? FURNACE_LIT : FURNACE;
    if (cur === want) return;
    if (edits.get(id) === FURNACE || edits.get(id) === FURNACE_LIT) { setEdit(id, want); saveEditsSoon(); }
    setBlock(x, y, z, want);
    requestEditedBlockRebuild(x, y, z, FURNACE_LIT); // 点火⇄消火は光レベルが変わるので広域再メッシュ
  }
  function updateFurnaces(dt) {
    let changed = false;
    for (const id of Object.keys(SAVE.furnaces)) {
      const st = SAVE.furnaces[id];
      const canSmelt = furnaceCanSmelt(st);
      // 燃料の点火
      if (st.fuelLeft <= 0 && canSmelt && st.fuel) {
        const fdef = ITEM_DEFS[st.fuel.id];
        if (fdef && fdef.fuel) {
          st.fuel.n -= 1;
          if (st.fuel.n <= 0) st.fuel = null;
          st.fuelLeft = st.fuelMax = fdef.fuel * SMELT_TIME;
          changed = true;
        }
      }
      if (st.fuelLeft > 0) {
        st.fuelLeft = Math.max(0, st.fuelLeft - dt);
        if (canSmelt) {
          st.prog += dt;
          if (st.prog >= SMELT_TIME) {
            st.prog = 0;
            const outId = SMELT_RESULT[st.in.id];
            st.in.n -= 1;
            if (st.in.n <= 0) st.in = null;
            if (st.out) st.out.n += 1; else st.out = mkItem(outId, 1);
            changed = true;
            if (typeof progressEvent === 'function') progressEvent('smelt', outId);
          }
        } else {
          st.prog = 0;
        }
      } else if (!canSmelt || !st.fuel) {
        st.prog = Math.max(0, st.prog - dt * 2);
      }
      // 見た目を点火状態に合わせる
      syncFurnaceVisual(id, st.fuelLeft > 0);
      // 空のかまど状態は保存から掃除する
      if (!st.in && !st.fuel && !st.out && st.prog <= 0 && st.fuelLeft <= 0) { syncFurnaceVisual(id, false); delete SAVE.furnaces[id]; changed = true; }
    }
    if (changed) {
      markSaveDirty();
      if (typeof refreshOpenPanels === 'function') refreshOpenPanels();
    }
  }
  // 起動時: 前回セッションで点火のまま保存された FURNACE_LIT の edit を FURNACE へ戻す
  // （まだ燃料が残っていれば updateFurnaces が即座に再点火する）。
  for (const [eid, et] of edits) if (et === FURNACE_LIT) setEdit(eid, FURNACE);
  // かまど/チェストを壊したときに中身をプレイヤーへ渡す
  function spillFurnace(id) {
    const st = SAVE.furnaces[id];
    if (!st) return;
    for (const s of [st.in, st.fuel, st.out]) if (s) giveItem(s.id, s.n, s.dur);
    delete SAVE.furnaces[id];
    markSaveDirty();
  }

  /* --- チェスト（27スロットの本物のコンテナ） --- */
  const CHEST_SLOTS = 27;
  function chestSlots(id) {
    let arr = SAVE.chests[id];
    if (!Array.isArray(arr) || arr.length !== CHEST_SLOTS) {
      arr = new Array(CHEST_SLOTS).fill(null);
      SAVE.chests[id] = arr;
    }
    return arr;
  }
  // ワールド生成チェスト（遺跡/廃坑/構造物）は初回オープン時に探索報酬を入れる
  function rollWorldChestLoot(id) {
    if (SAVE.chestSeen[id]) return;
    SAVE.chestSeen[id] = 1;
    const slots = chestSlots(id);
    const pool = [
      ['coal', 2, 6], ['raw_iron', 1, 4], ['raw_gold', 1, 2], ['diamond', 1, 2], ['iron_ingot', 1, 2],
      ['apple', 1, 3], ['bread', 1, 2], ['berries', 2, 5], ['torch', 2, 6], ['stick', 2, 6],
      ['planks', 3, 8], ['glow_shard', 1, 2], ['fiber', 2, 5], ['cloth', 1, 2], ['wheat', 1, 3],
    ];
    const picks = 3 + (Math.random() * 3 | 0);
    for (let i = 0; i < picks; i++) {
      const e = pool[Math.random() * pool.length | 0];
      const item = mkItem(e[0], e[1] + (Math.random() * (e[2] - e[1] + 1) | 0));
      const slot = Math.random() * CHEST_SLOTS | 0;
      if (!slots[slot]) slots[slot] = item;
      else mergeIntoSlots(slots, item);
    }
    markSaveDirty();
    if (typeof progressEvent === 'function') progressEvent('chestLoot', id);
  }
  function spillChest(id) {
    const arr = SAVE.chests[id];
    if (arr) for (const s of arr) if (s) giveItem(s.id, s.n, s.dur);
    delete SAVE.chests[id];
    markSaveDirty();
  }
