  /* ============== アイテム定義 + スロット式インベントリ（ホットバー9 + メイン27） ==============
   * アイテムIDはすべて文字列。設置できるブロックは def.block にブロック種indexを持つ。
   * スロットは {id, n, dur} | null。道具/武器はスタック1でスロットごとに耐久値(dur)を持つ。 */
  const STACK_MAX = 64;
  const ITEM_DEFS = {
    // --- ブロック（主要なものは名前付きID。残りは下で自動登録） ---
    grass_block:    { name: '草ブロック', cat: 'block', block: GRASS },
    dirt:           { name: '土', cat: 'block', block: DIRT },
    stone:          { name: '石', cat: 'block', block: STONE },
    deepslate:      { name: '深層岩', cat: 'block', block: DEEPSLATE },
    cobblestone:    { name: '丸石', cat: 'block', block: COBBLESTONE },
    sand:           { name: '砂', cat: 'block', block: SAND },
    log:            { name: '丸太', cat: 'block', block: LOG, fuel: 1.5 },
    leaves:         { name: '葉', cat: 'block', block: LEAVES },
    planks:         { name: '板材', cat: 'block', block: PLANKS, fuel: 1.5 },
    glass:          { name: 'ガラス', cat: 'block', block: GLASS },
    brick:          { name: 'レンガ', cat: 'block', block: BRICK },
    snow:           { name: '雪', cat: 'block', block: SNOW },
    stone_brick:    { name: '石レンガ', cat: 'block', block: STONE_BRICK },
    // 階段/ハーフブロック（block は基準バリアント。設置時に向き/上下を確定する）
    oak_stairs:         { name: '木の階段', cat: 'block', block: OAK_STAIRS, stairs: true, fuel: 1.5 , iconShape: 'stairs' },
    cobblestone_stairs: { name: '丸石の階段', cat: 'block', block: OAK_STAIRS + 4, stairs: true , iconShape: 'stairs' },
    stone_brick_stairs: { name: '石レンガの階段', cat: 'block', block: OAK_STAIRS + 8, stairs: true , iconShape: 'stairs' },
    oak_slab:           { name: '木のハーフブロック', cat: 'block', block: OAK_SLAB, slab: true, fuel: 0.75 , iconShape: 'slab' },
    cobblestone_slab:   { name: '丸石のハーフブロック', cat: 'block', block: OAK_SLAB + 2, slab: true , iconShape: 'slab' },
    stone_brick_slab:   { name: '石レンガのハーフブロック', cat: 'block', block: OAK_SLAB + 4, slab: true , iconShape: 'slab' },
    torch:          { name: '松明', cat: 'block', block: TORCH },
    crafting_table: { name: '作業台', cat: 'block', block: CRAFTING_TABLE, fuel: 1.5 },
    furnace:        { name: 'かまど', cat: 'block', block: FURNACE },
    chest:          { name: 'チェスト', cat: 'block', block: CHEST, fuel: 1.5 },
    bed:            { name: 'ベッド', cat: 'block', block: BED },
    lantern:        { name: 'ランタン', cat: 'block', block: LANTERN },
    oak_door:       { name: '木のドア', cat: 'block', block: OAK_DOOR_Z_CLOSED, fuel: 1.5 },
    oak_trapdoor:   { name: '木のトラップドア', cat: 'block', block: OAK_TRAPDOOR_CLOSED, fuel: 1.5 , iconShape: 'trapdoor' },
    oak_fence:      { name: '木のフェンス', cat: 'block', block: OAK_FENCE, fuel: 1.5 , iconShape: 'fence' },
    oak_fence_gate: { name: '木のフェンスゲート', cat: 'block', block: OAK_FENCE_GATE_Z_CLOSED, fuel: 1.5 , iconShape: 'gate' },
    cobblestone_wall: { name: '丸石の壁', cat: 'block', block: COBBLESTONE_WALL , iconShape: 'wall' },
    ladder:         { name: 'はしご', cat: 'block', block: LADDER, ladder: true, fuel: 1.5 , iconShape: 'ladder' },
    glass_pane:     { name: '板ガラス', cat: 'block', block: GLASS_PANE , iconShape: 'pane' },
    sign:           { name: '看板', cat: 'block', block: SIGN, sign: true, fuel: 1.5 , iconShape: 'sign' },
    obsidian:       { name: '黒曜石', cat: 'block', block: OBSIDIAN },
    // レッドストーン部品（rsGround: 不透明ブロックの上面にのみ設置）
    redstone_dust:  { name: 'レッドストーンダスト', cat: 'material', block: REDSTONE_WIRE, rsGround: true },
    redstone_torch: { name: 'レッドストーントーチ', cat: 'block', block: REDSTONE_TORCH, rsGround: true, fuel: 0.5 },
    lever:          { name: 'レバー', cat: 'block', block: LEVER_OFF, rsGround: true },
    stone_button:   { name: '石のボタン', cat: 'block', block: STONE_BUTTON_OFF, rsGround: true , iconShape: 'button' },
    stone_pressure_plate:  { name: '石の感圧板', cat: 'block', block: STONE_PLATE_OFF, rsGround: true , iconShape: 'plate' },
    wooden_pressure_plate: { name: '木の感圧板', cat: 'block', block: WOOD_PLATE_OFF, rsGround: true, fuel: 1.5 , iconShape: 'plate' },
    redstone_lamp:  { name: 'レッドストーンランプ', cat: 'block', block: REDSTONE_LAMP_OFF },
    glow_crystal:   { name: '発光結晶', cat: 'block', block: GLOW_CRYSTAL },
    gold_block:     { name: '金ブロック', cat: 'block', block: GOLD_BLOCK },
    iron_block:     { name: '鉄ブロック', cat: 'block', block: IRON_BLOCK },
    diamond_block:  { name: 'ダイヤブロック', cat: 'block', block: DIAMOND_BLOCK },
    coal_block:     { name: '石炭ブロック', cat: 'block', block: COAL_BLOCK, fuel: 72 },
    roof_tile:      { name: '瓦', cat: 'block', block: ROOF_TILE },
    // --- 素材 ---
    stick:        { name: '棒', cat: 'material', fuel: 0.5 },
    coal:         { name: '石炭', cat: 'material', fuel: 8 },
    raw_iron:     { name: '粗鉄', cat: 'material' },
    iron_ingot:   { name: '鉄インゴット', cat: 'material' },
    raw_gold:     { name: '粗金', cat: 'material' },
    gold_ingot:   { name: '金インゴット', cat: 'material' },
    diamond:      { name: 'ダイヤ', cat: 'material' },
    glow_shard:   { name: '発光結晶の欠片', cat: 'material' },
    fiber:        { name: '繊維', cat: 'material' },
    cloth:        { name: '布', cat: 'material' },
    wheat:        { name: '小麦', cat: 'material' },
    wheat_seeds:  { name: '小麦の種', cat: 'material' },
    bone:         { name: '骨', cat: 'material' },
    slime_ball:   { name: 'スライム玉', cat: 'material' },
    gunpowder:    { name: '火薬', cat: 'material' },
    bucket:       { name: 'バケツ', cat: 'material', stack: 1 },
    water_bucket: { name: '水入りバケツ', cat: 'material', stack: 1 },
    lava_bucket:  { name: '溶岩入りバケツ', cat: 'material', stack: 1 },
    milk_bucket:  { name: '牛乳', cat: 'material', stack: 1 },
    tnt:          { name: 'TNT', cat: 'block', block: TNT },
    sapling:      { name: '苗木', cat: 'block', block: SAPLING, fuel: 0.5 },
    // --- 食料 ---
    apple:        { name: 'リンゴ', cat: 'food', food: 4, heal: 1 },
    berries:      { name: 'ベリー', cat: 'food', food: 2 },
    bread:        { name: 'パン', cat: 'food', food: 5 },
    raw_meat:     { name: '生肉', cat: 'food', food: 2 },
    cooked_meat:  { name: '焼いた肉', cat: 'food', food: 8, heal: 1 },
    rotten_flesh: { name: '腐った肉', cat: 'food', food: 2 },
    // --- 道具（スタック1・耐久値つき。tier: 1木 2石 3鉄 4ダイヤ） ---
    wood_pickaxe:    { name: '木のツルハシ', cat: 'tool', tool: 'pickaxe', tier: 1, durability: 60, damage: 2 },
    stone_pickaxe:   { name: '石のツルハシ', cat: 'tool', tool: 'pickaxe', tier: 2, durability: 132, damage: 3 },
    iron_pickaxe:    { name: '鉄のツルハシ', cat: 'tool', tool: 'pickaxe', tier: 3, durability: 250, damage: 4 },
    diamond_pickaxe: { name: 'ダイヤのツルハシ', cat: 'tool', tool: 'pickaxe', tier: 4, durability: 1024, damage: 5 },
    wood_axe:        { name: '木の斧', cat: 'tool', tool: 'axe', tier: 1, durability: 60, damage: 3 },
    stone_axe:       { name: '石の斧', cat: 'tool', tool: 'axe', tier: 2, durability: 132, damage: 4 },
    iron_axe:        { name: '鉄の斧', cat: 'tool', tool: 'axe', tier: 3, durability: 250, damage: 5 },
    wood_shovel:     { name: '木のシャベル', cat: 'tool', tool: 'shovel', tier: 1, durability: 60, damage: 1 },
    stone_shovel:    { name: '石のシャベル', cat: 'tool', tool: 'shovel', tier: 2, durability: 132, damage: 2 },
    iron_shovel:     { name: '鉄のシャベル', cat: 'tool', tool: 'shovel', tier: 3, durability: 250, damage: 3 },
    wood_hoe:        { name: '木のクワ', cat: 'tool', tool: 'hoe', tier: 1, durability: 60, damage: 1 },
    stone_hoe:       { name: '石のクワ', cat: 'tool', tool: 'hoe', tier: 2, durability: 132, damage: 1 },
    iron_hoe:        { name: '鉄のクワ', cat: 'tool', tool: 'hoe', tier: 3, durability: 250, damage: 1 },
    // --- 武器 ---
    wood_sword:    { name: '木の剣', cat: 'weapon', tool: 'sword', tier: 1, durability: 60, damage: 3 },
    stone_sword:   { name: '石の剣', cat: 'weapon', tool: 'sword', tier: 2, durability: 132, damage: 4 },
    iron_sword:    { name: '鉄の剣', cat: 'weapon', tool: 'sword', tier: 3, durability: 250, damage: 6 },
    diamond_sword: { name: 'ダイヤの剣', cat: 'weapon', tool: 'sword', tier: 4, durability: 1024, damage: 8 },
    bow:           { name: '弓', cat: 'weapon', tool: 'bow', tier: 1, durability: 120, damage: 5 },
    arrow:         { name: '矢', cat: 'material' },
    // --- 防具（1スロット。armor 1につき被ダメージ-6%） ---
    cloth_armor:   { name: '布の服', cat: 'armor', armor: 2, durability: 80 },
    iron_armor:    { name: '鉄の鎧', cat: 'armor', armor: 5, durability: 240 },
    diamond_armor: { name: 'ダイヤの鎧', cat: 'armor', armor: 7, durability: 500 },
  };
  // 名前付きIDにない設置可能ブロック（和風建材など）も、採掘したら持てるよう自動登録する
  const ITEM_FOR_BLOCK = [];
  // 各定義に自分のIDを持たせる。設置処理は def.id で分岐する（ドア/ベッド/苗木など）
  for (const [id, def] of Object.entries(ITEM_DEFS)) {
    def.id = id;
    if (def.block != null) ITEM_FOR_BLOCK[def.block] = id;
  }
  // 階段/ハーフの全バリアント → 親アイテム（どの向きを壊しても同じアイテムをドロップ）
  for (let i = 0; i < 4; i++) {
    ITEM_FOR_BLOCK[OAK_STAIRS + i] = 'oak_stairs';
    ITEM_FOR_BLOCK[OAK_STAIRS + 4 + i] = 'cobblestone_stairs';
    ITEM_FOR_BLOCK[OAK_STAIRS + 8 + i] = 'stone_brick_stairs';
  }
  for (let i = 0; i < 2; i++) {
    ITEM_FOR_BLOCK[OAK_SLAB + i] = 'oak_slab';
    ITEM_FOR_BLOCK[OAK_SLAB + 2 + i] = 'cobblestone_slab';
    ITEM_FOR_BLOCK[OAK_SLAB + 4 + i] = 'stone_brick_slab';
  }
  // はしご/看板の全向き → 親アイテム（どの向きを壊しても同じアイテムをドロップ）
  for (let i = 0; i < 4; i++) {
    ITEM_FOR_BLOCK[LADDER + i] = 'ladder';
    ITEM_FOR_BLOCK[SIGN + i] = 'sign';
  }
  for (let b = 0; b < TYPES.length; b++) {
    if (ITEM_FOR_BLOCK[b] || !TYPES[b] || TYPES[b].solid === false || TYPES[b].noAutoItem) continue;
    const id = `block_${b}`;
    ITEM_DEFS[id] = { name: TYPES[b].name, cat: 'block', block: b };
    ITEM_FOR_BLOCK[b] = id;
  }
  for (const b of DOOR_TYPE_IDS) {
    ITEM_FOR_BLOCK[b] = 'oak_door';
  }
  for (const b of BED_TYPE_IDS) {
    ITEM_FOR_BLOCK[b] = 'bed';
  }
  ITEM_FOR_BLOCK[OAK_TRAPDOOR_CLOSED] = 'oak_trapdoor';
  ITEM_FOR_BLOCK[OAK_TRAPDOOR_OPEN] = 'oak_trapdoor';
  ITEM_FOR_BLOCK[OAK_FENCE_GATE_Z_CLOSED] = 'oak_fence_gate';
  ITEM_FOR_BLOCK[OAK_FENCE_GATE_Z_OPEN] = 'oak_fence_gate';
  // レッドストーンの on/off バリアント → 親アイテム
  ITEM_FOR_BLOCK[REDSTONE_TORCH_OFF] = 'redstone_torch';
  ITEM_FOR_BLOCK[LEVER_ON] = 'lever';
  ITEM_FOR_BLOCK[STONE_BUTTON_ON] = 'stone_button';
  ITEM_FOR_BLOCK[STONE_PLATE_ON] = 'stone_pressure_plate';
  ITEM_FOR_BLOCK[WOOD_PLATE_ON] = 'wooden_pressure_plate';
  ITEM_FOR_BLOCK[REDSTONE_LAMP_ON] = 'redstone_lamp';
  ITEM_FOR_BLOCK[OAK_FENCE_GATE_X_CLOSED] = 'oak_fence_gate';
  ITEM_FOR_BLOCK[OAK_FENCE_GATE_X_OPEN] = 'oak_fence_gate';
  function itemDef(id) { return ITEM_DEFS[id] || null; }
  function itemLabel(id) { const d = ITEM_DEFS[id]; return d ? d.name : String(id); }
  function maxStack(id) {
    const d = ITEM_DEFS[id];
    if (!d) return STACK_MAX;
    if (d.durability) return 1;
    return d.stack || STACK_MAX;
  }
  function mkItem(id, n = 1, dur) {
    const d = ITEM_DEFS[id];
    if (!d) return null;
    const it = { id, n };
    if (d.durability) it.dur = Number.isFinite(dur) ? dur : d.durability;
    return it;
  }

  /* --- インベントリ本体: 0-8 ホットバー / 9-35 メイン --- */
  const INV_SIZE = 36, HOTBAR_SIZE = 9;
  const INV = new Array(INV_SIZE).fill(null);
  function normalizeSlot(s) {
    if (!s || typeof s !== 'object' || !ITEM_DEFS[s.id]) return null;
    const n = Math.floor(+s.n);
    if (!Number.isFinite(n) || n <= 0) return null;
    return mkItem(s.id, Math.min(n, maxStack(s.id)), s.dur);
  }
  function loadInventoryFromSave() {
    if (!Array.isArray(SAVE.inv)) return;
    for (let i = 0; i < INV_SIZE; i++) INV[i] = normalizeSlot(SAVE.inv[i]);
  }
  function invChanged() {
    SAVE.inv = INV;
    markSaveDirty();
    if (typeof updateHotbarUI === 'function') updateHotbarUI();
    if (typeof refreshOpenPanels === 'function') refreshOpenPanels();
  }
  function countItem(id) {
    let n = 0;
    for (const s of INV) if (s && s.id === id) n += s.n;
    return n;
  }
  function hasItems(cost) { return cost.every(([id, n]) => countItem(id) >= n); }
  function takeItems(cost) {
    if (!hasItems(cost)) return false;
    for (const [id, amount] of cost) {
      let left = amount;
      for (let i = 0; i < INV_SIZE && left > 0; i++) {
        const s = INV[i];
        if (!s || s.id !== id) continue;
        const take = Math.min(s.n, left);
        s.n -= take; left -= take;
        if (s.n <= 0) INV[i] = null;
      }
    }
    invChanged();
    return true;
  }
  // アイテムを拾う。入り切らなかった数を返す（0なら全部入った）
  function giveItem(id, amount = 1, dur) {
    const d = ITEM_DEFS[id];
    if (!d || amount <= 0) return amount;
    let left = amount;
    const cap = maxStack(id);
    if (cap > 1) {
      for (let i = 0; i < INV_SIZE && left > 0; i++) {
        const s = INV[i];
        if (!s || s.id !== id || s.n >= cap) continue;
        const add = Math.min(cap - s.n, left);
        s.n += add; left -= add;
      }
    }
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      if (INV[i]) continue;
      const add = Math.min(cap, left);
      INV[i] = mkItem(id, add, dur);
      left -= add;
    }
    if (left < amount) {
      invChanged();
      if (typeof showPickupToast === 'function') showPickupToast(id, amount - left);
      if (typeof progressEvent === 'function') progressEvent('item', id);
    }
    return left;
  }
  // スロットにアイテムを直接入れる（コンテナUI用）。入り切らなかった残りを返す
  function mergeIntoSlots(slots, item) {
    if (!item) return null;
    const cap = maxStack(item.id);
    let left = item.n;
    if (cap > 1) {
      for (let i = 0; i < slots.length && left > 0; i++) {
        const s = slots[i];
        if (!s || s.id !== item.id || s.n >= cap) continue;
        const add = Math.min(cap - s.n, left);
        s.n += add; left -= add;
      }
    }
    for (let i = 0; i < slots.length && left > 0; i++) {
      if (slots[i]) continue;
      const add = Math.min(cap, left);
      slots[i] = mkItem(item.id, add, item.dur);
      left -= add;
    }
    return left > 0 ? mkItem(item.id, left, item.dur) : null;
  }
  function selectedItem() { return INV[selected] || null; }
  function selectedItemDef() { const s = selectedItem(); return s ? ITEM_DEFS[s.id] : null; }
  // 選択中の道具の耐久値を減らす。壊れたら true
  function damageSelectedTool(amount = 1) {
    const s = selectedItem(), d = s ? ITEM_DEFS[s.id] : null;
    if (!s || !d || !d.durability) return false;
    s.dur = (Number.isFinite(s.dur) ? s.dur : d.durability) - amount;
    if (s.dur > 0) { invChanged(); return false; }
    INV[selected] = null;
    invChanged();
    thock(70);
    if (typeof setDebugToast === 'function') setDebugToast(`${d.name} が壊れた！`, 2.0);
    return true;
  }
  // 右クリックで食べる
  function eatSelectedFood() {
    const s = selectedItem(), d = s ? ITEM_DEFS[s.id] : null;
    if (!s || !d || !d.food) return false;
    if (SURVIVAL.hunger >= 20 && SURVIVAL.health >= 20) return false;
    s.n -= 1;
    if (s.n <= 0) INV[selected] = null;
    SURVIVAL.hunger = Math.min(20, SURVIVAL.hunger + d.food);
    if (d.heal) SURVIVAL.health = Math.min(20, SURVIVAL.health + d.heal);
    updateSurvivalHud();
    invChanged();
    thock(360);
    if (typeof progressEvent === 'function') progressEvent('eat', s.id);
    return true;
  }

  /* --- アイテムアイコン（ブロックはテクスチャ、その他は簡易ドット絵を生成） --- */
  // 素材テクスチャが同じで形だけ違うブロック（階段/ハーフ/フェンス…）は、そのままだと
  // アイコンが見分けられない。素材を形のシルエットで抜いて作り分ける。座標は32x32基準。
  const ICON_SHAPES = {
    stairs:   [[0, 16, 32, 16], [16, 0, 16, 16]],
    slab:     [[0, 16, 32, 16]],
    fence:    [[13, 1, 6, 30], [2, 8, 28, 5], [2, 19, 28, 5]],
    gate:     [[2, 5, 6, 24], [24, 5, 6, 24], [8, 9, 16, 5], [8, 20, 16, 5]],
    wall:     [[9, 3, 14, 29], [2, 11, 28, 9]],
    pane:     [[12, 0, 8, 32]],
    ladder:   [[5, 1, 4, 30], [23, 1, 4, 30], [9, 5, 14, 3], [9, 14, 14, 3], [9, 23, 14, 3]],
    trapdoor: [[0, 11, 32, 10]],
    button:   [[9, 12, 14, 8]],
    plate:    [[2, 13, 28, 6]],
    sign:     [[3, 3, 26, 16], [14, 19, 4, 11]],
  };
  function shapedIconUrl(tex, rects) {
    const S = tex.image.width, k = S / 32;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    for (const [x, y, w, h] of rects) {
      g.save();
      g.beginPath(); g.rect(x * k, y * k, w * k, h * k); g.clip();
      g.drawImage(tex.image, 0, 0);
      g.restore();
    }
    return c.toDataURL();
  }
  const ITEM_ICON_CACHE = new Map();
  function itemIconUrl(id) {
    if (ITEM_ICON_CACHE.has(id)) return ITEM_ICON_CACHE.get(id);
    const d = ITEM_DEFS[id];
    let url = '';
    if (d && d.block != null && TYPES[d.block] && TYPES[d.block].icon) {
      const shape = ICON_SHAPES[d.iconShape];
      url = shape ? shapedIconUrl(TYPES[d.block].icon, shape) : TYPES[d.block].icon.image.toDataURL();
    } else if (d) {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      drawItemIcon(c.getContext('2d'), 32, id, d);
      url = c.toDataURL();
    }
    ITEM_ICON_CACHE.set(id, url);
    return url;
  }
  function drawItemIcon(g, S, id, d) {
    const px = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
    const metal = id.startsWith('diamond') ? '#66e0ee' : id.startsWith('iron') ? '#d8dde2' : id.startsWith('stone') ? '#8a8f92' : '#b5824a';
    const darkMetal = id.startsWith('diamond') ? '#2f98a8' : id.startsWith('iron') ? '#9aa3aa' : id.startsWith('stone') ? '#5f6468' : '#6d4c1b';
    if (d.tool === 'bow') {
      px(10, 4, 3, 4, '#7a4d24'); px(8, 7, 3, 6, '#7a4d24'); px(7, 13, 3, 6, '#7a4d24'); px(8, 19, 3, 6, '#7a4d24'); px(10, 24, 3, 4, '#7a4d24');
      px(14, 5, 1, 22, '#e8e4d6');
    } else if (d.armor) {
      const c = id.startsWith('diamond') ? '#66e0ee' : id.startsWith('iron') ? '#d8dde2' : '#f0ede2';
      const dark = id.startsWith('diamond') ? '#2f98a8' : id.startsWith('iron') ? '#9aa3aa' : '#c9c4b2';
      px(6, 6, 6, 6, c); px(20, 6, 6, 6, c);
      px(6, 12, 20, 14, c);
      px(12, 6, 8, 4, dark);
      px(8, 14, 16, 2, dark);
    } else if (id === 'arrow') {
      px(15, 4, 2, 20, '#cabb9a');
      px(13, 3, 6, 4, '#8a8f92');
      px(12, 23, 3, 5, '#e8e4d6'); px(17, 23, 3, 5, '#e8e4d6');
    } else if (d.tool === 'pickaxe') {
      px(14, 8, 4, 22, '#7a4d24');
      px(6, 4, 20, 4, metal); px(4, 6, 4, 6, metal); px(24, 6, 4, 6, metal);
      px(6, 8, 20, 2, darkMetal);
    } else if (d.tool === 'axe') {
      px(14, 8, 4, 22, '#7a4d24');
      px(8, 3, 12, 10, metal); px(6, 5, 4, 6, metal);
      px(8, 11, 12, 2, darkMetal);
    } else if (d.tool === 'shovel') {
      px(14, 2, 4, 20, '#7a4d24');
      px(11, 20, 10, 9, metal); px(13, 27, 6, 3, darkMetal);
    } else if (d.tool === 'hoe') {
      px(14, 6, 4, 22, '#7a4d24');
      px(6, 4, 12, 4, metal); px(6, 8, 4, 5, metal);
      px(6, 6, 12, 2, darkMetal);
    } else if (d.tool === 'sword') {
      px(14, 2, 4, 18, metal); px(15, 3, 1, 15, '#ffffff');
      px(9, 20, 14, 3, darkMetal); px(14, 23, 4, 7, '#7a4d24');
    } else if (d.food) {
      const body = id === 'apple' ? '#d43b2f' : id === 'berries' ? '#7a3ca8' : id === 'bread' ? '#c98d46' : id === 'rotten_flesh' ? '#7a8a3a' : id === 'cooked_meat' ? '#9a5a30' : '#d4747e';
      px(8, 10, 16, 14, body);
      px(10, 8, 12, 4, body);
      px(11, 12, 4, 3, 'rgba(255,255,255,0.45)');
      if (id === 'apple') px(15, 4, 3, 5, '#5a8a3a');
      if (id === 'bread') { px(8, 14, 16, 2, '#a06a2e'); px(8, 19, 16, 2, '#a06a2e'); }
      if (id === 'raw_meat' || id === 'cooked_meat') px(20, 12, 4, 10, '#f2e6d8');
    } else if (id === 'bucket' || id.endsWith('_bucket')) {
      const fill = id === 'water_bucket' ? '#3a78d8' : id === 'lava_bucket' ? '#ff7a2a' : id === 'milk_bucket' ? '#f4f2ec' : null;
      const body = '#b9bec3', light = '#dce0e4', dark = '#7c8288';
      px(8, 6, 2, 7, dark); px(22, 6, 2, 7, dark); px(9, 5, 14, 2, dark);   // 取っ手
      px(7, 12, 18, 3, dark);                                                // 縁
      if (fill) px(9, 13, 14, 4, fill);                                      // 中身
      px(9, 15, 14, 11, body); px(9, 15, 3, 11, light);                      // 本体
      px(11, 26, 10, 2, dark);                                              // 底
    } else {
      const colors = {
        stick: '#8a5a2b', coal: '#2e3236', raw_iron: '#c78a55', iron_ingot: '#d8dde2',
        raw_gold: '#d8ae3c', gold_ingot: '#f2cb45', diamond: '#5fe0ee', glow_shard: '#6df7ff',
        fiber: '#a8c26a', cloth: '#f0ede2', wheat: '#dcc25e', bone: '#ece8da', slime_ball: '#5aae4c',
        wheat_seeds: '#8bbf4a', gunpowder: '#4a4a4a',
      };
      const c = colors[id] || '#c0c0c0';
      if (id.endsWith('_ingot')) {
        px(6, 14, 20, 10, c); px(8, 11, 16, 3, c);
        px(8, 15, 16, 2, 'rgba(255,255,255,0.5)');
      } else if (id === 'stick') {
        px(18, 4, 4, 8, c); px(15, 10, 4, 8, c); px(12, 16, 4, 8, c); px(9, 22, 4, 7, c);
      } else if (id === 'wheat_seeds') {
        for (const [x, y] of [[9, 10], [16, 9], [12, 15], [19, 16], [8, 19], [15, 21]]) { px(x, y, 3, 4, c); px(x, y, 3, 2, '#c8e08a'); }
      } else if (id === 'fiber' || id === 'wheat') {
        for (let i = 0; i < 4; i++) px(8 + i * 5, 6, 2, 20, c);
        px(6, 22, 20, 3, id === 'wheat' ? '#a8863a' : '#7a9a4a');
      } else if (id === 'bone') {
        px(12, 6, 8, 4, c); px(14, 8, 4, 16, c); px(12, 22, 8, 4, c);
      } else {
        px(9, 9, 14, 14, c); px(7, 12, 4, 8, c); px(21, 12, 4, 8, c); px(12, 7, 8, 4, c); px(12, 21, 8, 4, c);
        px(11, 11, 5, 4, 'rgba(255,255,255,0.4)');
      }
    }
  }
  loadInventoryFromSave();
  SAVE.armor = normalizeSlot(SAVE.armor);
