  /* ============== クラフト / かまど ============== */
  const RECIPES = [
    { id: 'planks', name: '板材 x4', out: PLANKS, amount: 4, cost: [[LOG, 1]] },
    { id: 'stick', name: '棒 x4', out: 'stick', amount: 4, cost: [[PLANKS, 2]] },
    { id: 'crafting', name: '作業台', out: CRAFTING_TABLE, amount: 1, cost: [[PLANKS, 4]] },
    { id: 'furnace', name: 'かまど', out: FURNACE, amount: 1, cost: [[STONE, 8]] },
    { id: 'torch', name: 'たいまつ x4', out: TORCH, amount: 4, cost: [['coal', 1], ['stick', 1]] },
    { id: 'woodPickaxe', name: '木のツルハシ', out: 'woodPickaxe', amount: 1, cost: [[PLANKS, 3], ['stick', 2]] },
    { id: 'stonePickaxe', name: '石のツルハシ', out: 'stonePickaxe', amount: 1, cost: [[STONE, 3], ['stick', 2]] },
    { id: 'ironPickaxe', name: '鉄のツルハシ', out: 'ironPickaxe', amount: 1, cost: [['ironIngot', 3], ['stick', 2]] },
    { id: 'woodAxe', name: '木の斧', out: 'woodAxe', amount: 1, cost: [[PLANKS, 3], ['stick', 2]] },
    { id: 'stoneAxe', name: '石の斧', out: 'stoneAxe', amount: 1, cost: [[STONE, 3], ['stick', 2]] },
    { id: 'woodShovel', name: '木のシャベル', out: 'woodShovel', amount: 1, cost: [[PLANKS, 1], ['stick', 2]] },
    { id: 'stoneShovel', name: '石のシャベル', out: 'stoneShovel', amount: 1, cost: [[STONE, 1], ['stick', 2]] },
  ];
  const SMELT_RECIPES = [
    { id: 'iron', name: '粗鉄 -> 鉄インゴット', in: 'rawIron', out: 'ironIngot', cost: [['rawIron', 1], ['coal', 1]] },
    { id: 'gold', name: '粗金 -> 金インゴット', in: 'rawGold', out: 'goldIngot', cost: [['rawGold', 1], ['coal', 1]] },
    { id: 'glass', name: '砂 -> ガラス', in: SAND, out: GLASS, cost: [[SAND, 1], ['coal', 1]] },
  ];

  const craftPanel = document.createElement('div');
  craftPanel.id = 'craftPanel';
  craftPanel.innerHTML = `<div class="craft-head"><b>クラフト</b><button data-close="1">閉じる</button></div><div class="craft-tools"></div><div class="craft-list"></div>`;
  document.body.appendChild(craftPanel);

  function costText(cost) {
    return cost.map(([id, amount]) => `${itemLabel(id)} ${inventoryCount(id)}/${amount}`).join(' ・ ');
  }
  function closeCraftPanel() {
    craftPanel.classList.remove('show');
  }
  function toggleCraftPanel(mode = 'craft') {
    const showing = craftPanel.classList.contains('show') && craftPanel.dataset.mode === mode;
    if (showing) { closeCraftPanel(); return; }
    craftPanel.dataset.mode = mode;
    craftPanel.classList.add('show');
    releasePointerForUi();
    updateCraftPanel();
  }
  function doRecipe(recipe) {
    if (!consumeMany(recipe.cost)) { thock(90); updateCraftPanel(); return; }
    addInventory(recipe.out, recipe.amount || 1);
    thock(300);
    updateCraftPanel();
  }
  function updateCraftPanel() {
    if (!craftPanel || !craftPanel.classList.contains('show')) return;
    const mode = craftPanel.dataset.mode || 'craft';
    const list = craftPanel.querySelector('.craft-list');
    const tools = craftPanel.querySelector('.craft-tools');
    const recipes = mode === 'smelt' ? SMELT_RECIPES : RECIPES;
    craftPanel.querySelector('.craft-head b').textContent = mode === 'smelt' ? 'かまど' : 'クラフト';
    tools.innerHTML = `<button data-mode="craft"${mode === 'craft' ? ' class="on"' : ''}>作業台</button><button data-mode="smelt"${mode === 'smelt' ? ' class="on"' : ''}>かまど</button>`;
    list.innerHTML = '';
    for (const recipe of recipes) {
      const btn = document.createElement('button');
      btn.className = 'recipe';
      btn.disabled = !hasInventory(recipe.cost);
      btn.innerHTML = `<span>${recipe.name}</span><small>${costText(recipe.cost)}</small>`;
      btn.addEventListener('click', () => doRecipe(recipe));
      list.appendChild(btn);
    }
  }
  craftPanel.addEventListener('click', e => {
    const close = e.target.closest('[data-close]');
    const mode = e.target.closest('[data-mode]');
    if (close) closeCraftPanel();
    if (mode) toggleCraftPanel(mode.dataset.mode);
  });
