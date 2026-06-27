  /* ============== インベントリ（ブロック + 素材/道具） ============== */
  const ITEMS = {
    stick: { name: '棒' },
    coal: { name: '石炭' },
    rawIron: { name: '粗鉄' },
    rawGold: { name: '粗金' },
    ironIngot: { name: '鉄インゴット' },
    goldIngot: { name: '金インゴット' },
    diamond: { name: 'ダイヤ' },
    glowShard: { name: '発光結晶の欠片' },
    apple: { name: 'リンゴ', food: 4, heal: 1 },
    berries: { name: 'ベリー', food: 2, heal: 0.4 },
    woodPickaxe: { name: '木のツルハシ', tool: 'pickaxe', tier: 1, durability: 42 },
    stonePickaxe: { name: '石のツルハシ', tool: 'pickaxe', tier: 2, durability: 86 },
    ironPickaxe: { name: '鉄のツルハシ', tool: 'pickaxe', tier: 3, durability: 180 },
    woodAxe: { name: '木の斧', tool: 'axe', tier: 1, durability: 42 },
    stoneAxe: { name: '石の斧', tool: 'axe', tier: 2, durability: 86 },
    woodShovel: { name: '木のシャベル', tool: 'shovel', tier: 1, durability: 42 },
    stoneShovel: { name: '石のシャベル', tool: 'shovel', tier: 2, durability: 86 },
  };
  const INVENTORY = new Map();
  const TOOL_DURABILITY = new Map();
  const INVENTORY_STORAGE_KEY = `mc_inventory_${WORLD_SEED}`;
  const DURABILITY_STORAGE_KEY = `mc_tool_durability_${WORLD_SEED}`;
  function inventoryStartCount(type) {
    if (type === TORCH) return 16;
    if (type === GLASS) return 16;
    if (type === LEAVES) return 24;
    if (type === CRAFTING_TABLE || type === FURNACE) return 0;
    return 32;
  }
  function invKey(k) {
    if (typeof k === 'number') return k;
    if (typeof k === 'string' && /^-?\d+$/.test(k)) return +k;
    return k;
  }
  function itemLabel(id) {
    if (typeof id === 'number') return TYPES[id] ? TYPES[id].name : String(id);
    return ITEMS[id] ? ITEMS[id].name : String(id);
  }
  function initInventory() {
    try {
      const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) for (const [k, v] of arr) if (Number.isFinite(+v)) INVENTORY.set(invKey(k), +v);
      }
    } catch (e) {}
    try {
      const raw = localStorage.getItem(DURABILITY_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) for (const [k, v] of arr) if (Number.isFinite(+v)) TOOL_DURABILITY.set(k, +v);
      }
    } catch (e) {}
    for (const t of HOTBAR) if (!INVENTORY.has(t)) INVENTORY.set(t, inventoryStartCount(t));
    for (const id of Object.keys(ITEMS)) if (ITEMS[id].durability && inventoryCount(id) > 0) ensureToolDurability(id);
  }
  function saveInventorySoon() {
    clearTimeout(saveInventorySoon.t);
    saveInventorySoon.t = setTimeout(() => {
      try { localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify([...INVENTORY])); } catch (e) {}
    }, 180);
  }
  function saveDurabilitySoon() {
    clearTimeout(saveDurabilitySoon.t);
    saveDurabilitySoon.t = setTimeout(() => {
      try { localStorage.setItem(DURABILITY_STORAGE_KEY, JSON.stringify([...TOOL_DURABILITY])); } catch (e) {}
    }, 180);
  }
  function inventoryCount(type) { return INVENTORY.get(type) || 0; }
  function maxDurability(id) { return ITEMS[id] && ITEMS[id].durability ? ITEMS[id].durability : 0; }
  function ensureToolDurability(id) {
    const max = maxDurability(id);
    if (!max || inventoryCount(id) <= 0) return 0;
    const current = TOOL_DURABILITY.get(id);
    if (!Number.isFinite(current) || current <= 0 || current > max) {
      TOOL_DURABILITY.set(id, max);
      saveDurabilitySoon();
      return max;
    }
    return current;
  }
  function toolDurabilityText(id) {
    const max = maxDurability(id);
    if (!max || inventoryCount(id) <= 0) return '';
    return `${Math.max(0, Math.ceil(ensureToolDurability(id)))}/${max}`;
  }
  function damageTool(id, amount = 1) {
    const max = maxDurability(id);
    if (!max || inventoryCount(id) <= 0) return false;
    const next = ensureToolDurability(id) - amount;
    if (next > 0) {
      TOOL_DURABILITY.set(id, next);
      saveDurabilitySoon();
      if (typeof updateFoodHud === 'function') updateFoodHud();
      return false;
    }
    TOOL_DURABILITY.delete(id);
    consumeInventory(id, 1);
    if (inventoryCount(id) > 0) ensureToolDurability(id);
    saveDurabilitySoon();
    thock(70);
    if (typeof updateFoodHud === 'function') updateFoodHud();
    return true;
  }
  function addInventory(type, amount = 1) {
    if (type == null) return;
    if (typeof type === 'number' && (!TYPES[type] || TYPES[type].solid === false)) return;
    INVENTORY.set(type, Math.min(999, inventoryCount(type) + amount));
    if (ITEMS[type] && ITEMS[type].durability) ensureToolDurability(type);
    saveInventorySoon();
    if (typeof updateHotbarCounts === 'function') updateHotbarCounts();
    if (typeof updateCraftPanel === 'function') updateCraftPanel();
    if (typeof updateFoodHud === 'function') updateFoodHud();
    if (typeof updateInventoryPanel === 'function') updateInventoryPanel();
  }
  function consumeInventory(type, amount = 1) {
    const n = inventoryCount(type);
    if (n < amount) return false;
    INVENTORY.set(type, n - amount);
    saveInventorySoon();
    if (typeof updateHotbarCounts === 'function') updateHotbarCounts();
    if (typeof updateCraftPanel === 'function') updateCraftPanel();
    if (typeof updateFoodHud === 'function') updateFoodHud();
    if (typeof updateInventoryPanel === 'function') updateInventoryPanel();
    return true;
  }
  function hasInventory(cost) {
    return cost.every(([id, amount]) => inventoryCount(id) >= amount);
  }
  function consumeMany(cost) {
    if (!hasInventory(cost)) return false;
    for (const [id, amount] of cost) consumeInventory(id, amount);
    return true;
  }
  function bestTool(tool) {
    let best = null;
    for (const [id, def] of Object.entries(ITEMS)) {
      if (def.tool === tool && inventoryCount(id) > 0 && ensureToolDurability(id) > 0 && (!best || def.tier > best.tier)) best = { id, durabilityLeft: ensureToolDurability(id), ...def };
    }
    return best;
  }
  initInventory();
