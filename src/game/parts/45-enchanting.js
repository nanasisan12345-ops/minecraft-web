  /* ============== エンチャント（C11） ==============
   * 付与内容はスロットの item に `ench: { id: level }` として持たせる。旧セーブには無いフィールド
   * なので「無ければ 0」で読むだけでよく、既存のワールドはそのまま動く。
   * 効果の数値は本家準拠（手順書11の数値リファレンス）。 */
  const ENCH_DEFS = {
    efficiency:  { name: '効率', max: 3, tools: ['pickaxe', 'axe', 'shovel'] },
    unbreaking:  { name: '耐久', max: 3, tools: ['pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'bow'] },
    sharpness:   { name: 'ダメージ増加', max: 3, tools: ['sword'] },
    fire_aspect: { name: '火属性', max: 1, tools: ['sword'] },
    infinity:    { name: '無限', max: 1, tools: ['bow'] },
    protection:  { name: '防護', max: 3, armor: true },
  };
  const ROMAN = ['', 'I', 'II', 'III'];
  function enchLevel(item, id) {
    return (item && item.ench && item.ench[id]) || 0;
  }
  // その道具/防具に付けられるエンチャントID一覧
  function enchantableFor(item) {
    const d = item && ITEM_DEFS[item.id];
    if (!d) return [];
    return Object.keys(ENCH_DEFS).filter((id) => {
      const e = ENCH_DEFS[id];
      if (e.armor) return !!d.armor;
      return !!d.tool && e.tools.includes(d.tool);
    });
  }
  // 「効率 III」のような表示名を組み立てる
  function enchDisplayLines(item) {
    if (!item || !item.ench) return [];
    return Object.entries(item.ench)
      .filter(([id, lv]) => ENCH_DEFS[id] && lv > 0)
      .map(([id, lv]) => `${ENCH_DEFS[id].name} ${ROMAN[Math.min(3, lv)] || lv}`);
  }
  function hasAnyEnch(item) { return !!(item && item.ench && Object.keys(item.ench).length); }
  function applyEnch(item, id, level) {
    if (!item || !ENCH_DEFS[id] || level <= 0) return false;
    item.ench = item.ench || {};
    item.ench[id] = Math.min(ENCH_DEFS[id].max, Math.max(item.ench[id] || 0, level));
    return true;
  }

  /* --- 効果の計算（各所から呼ぶ） --- */
  // 効率N: 採掘速度に N^2+1 を加算
  function enchMiningBonus(item) {
    const n = enchLevel(item, 'efficiency');
    return n > 0 ? n * n + 1 : 0;
  }
  // 耐久N: 耐久が減る確率を 1/(N+1) に
  function enchConsumesDurability(item) {
    const n = enchLevel(item, 'unbreaking');
    return n <= 0 || Math.random() < 1 / (n + 1);
  }
  // ダメージ増加N: +0.5N+0.5
  function enchDamageBonus(item) {
    const n = enchLevel(item, 'sharpness');
    return n > 0 ? 0.5 * n + 0.5 : 0;
  }
  // 防護N: 被ダメージ -4%×N（上限64%）
  function enchProtectionCut(item) {
    const n = enchLevel(item, 'protection');
    return Math.min(0.64, 0.04 * n);
  }
  // 火属性N: 命中で 4N 秒炎上
  function enchFireSeconds(item) {
    const n = enchLevel(item, 'fire_aspect');
    return n > 0 ? 4 * n : 0;
  }

  /* --- エンチャントテーブルの抽選 --- */
  // 周囲2ブロック（同じ高さ〜+1）の本棚を最大15冊まで数える
  function bookshelvesAround(x, y, z) {
    let n = 0;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 1; dy++) {
      if (dx === 0 && dz === 0) continue;
      if (blockAt(x + dx, y + dy, z + dz) === BOOKSHELF) n++;
    }
    return Math.min(15, n);
  }
  // 3択の「要求レベル」。0冊で最上段8、15冊で30（線形）。消費レベルは枠の位置ぶん(1/2/3)
  function enchantOffers(item, shelves) {
    const pool = enchantableFor(item);
    if (!pool.length) return [];
    const top = Math.round(8 + (30 - 8) * (shelves / 15));
    const offers = [];
    for (let slot = 0; slot < 3; slot++) {
      const req = Math.max(1, Math.round(top * (slot + 1) / 3));
      const id = pool[Math.floor(Math.random() * pool.length)];
      const maxLv = ENCH_DEFS[id].max;
      // 上の枠ほど高いレベルが出る
      const lv = Math.max(1, Math.min(maxLv, Math.round(maxLv * (slot + 1) / 3)));
      offers.push({ id, level: lv, req, cost: slot + 1, label: `${ENCH_DEFS[id].name} ${ROMAN[lv] || lv}` });
    }
    return offers;
  }

  /* --- 金床（C11） ---
   * 同種の道具2つ → 残耐久の合計 + 上限の12%（上限まで）。道具+修理素材 → 上限の50%回復。
   * エンチャントは高い方を引き継ぐ。 */
  const REPAIR_MATERIAL = { wood: 'planks', stone: 'cobblestone', iron: 'iron_ingot', gold: 'gold_ingot', diamond: 'diamond' };
  function repairMaterialFor(id) {
    for (const k of Object.keys(REPAIR_MATERIAL)) if (id.startsWith(k + '_')) return REPAIR_MATERIAL[k];
    return null;
  }
  function anvilResult(a, b) {
    if (!a || !b) return null;
    const da = ITEM_DEFS[a.id];
    if (!da || !da.durability) return null;
    const max = da.durability;
    const durA = Number.isFinite(a.dur) ? a.dur : max;
    let out = null, cost = 0;
    if (b.id === a.id) {
      const durB = Number.isFinite(b.dur) ? b.dur : max;
      out = { id: a.id, n: 1, dur: Math.min(max, durA + durB + Math.round(max * 0.12)) };
      cost = 2;
    } else if (b.id === repairMaterialFor(a.id)) {
      out = { id: a.id, n: 1, dur: Math.min(max, durA + Math.round(max * 0.5)) };
      cost = 1;
    } else {
      return null;
    }
    const merged = { ...(a.ench || {}) };
    for (const [k, v] of Object.entries(b.ench || {})) merged[k] = Math.max(merged[k] || 0, v);
    if (Object.keys(merged).length) { out.ench = merged; cost += 1; }
    return { item: out, cost: Math.min(3, cost) };
  }
