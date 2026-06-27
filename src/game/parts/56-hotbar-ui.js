  /* ============== ホットバー UI ============== */
  const hotbar = document.getElementById('hotbar');
  HOTBAR.forEach((typeIdx, i) => {
    const slot = document.createElement('div'); slot.className = 'slot';
    slot.innerHTML = `<span class="sw"></span><b>${i + 1}</b><small>${TYPES[typeIdx].name}</small><em></em>`;
    slot.querySelector('.sw').style.backgroundImage = `url(${TYPES[typeIdx].icon.image.toDataURL()})`;
    slot.addEventListener('click', () => selectSlot(i));
    hotbar.appendChild(slot);
  });
  function selectSlot(i) { selected = i; [...hotbar.children].forEach((s, idx) => s.classList.toggle('on', idx === selected)); }
  function updateHotbarCounts() {
    [...hotbar.children].forEach((slot, i) => {
      const n = inventoryCount(HOTBAR[i]);
      slot.classList.toggle('empty', n <= 0);
      slot.querySelector('em').textContent = n;
    });
  }
  selectSlot(0);
  updateHotbarCounts();
  const stats = document.getElementById('stats');
  const foodHud = document.createElement('div');
  foodHud.id = 'foodHud';
  document.body.appendChild(foodHud);
  function foodHudButton(id) {
    const def = ITEMS[id];
    const n = inventoryCount(id);
    return `<button data-food="${id}"${n <= 0 ? ' disabled' : ''}><span>${def.name}</span><b>${n}</b><small>+${def.food}</small></button>`;
  }
  function updateFoodHud() {
    const tool = bestTool('pickaxe') || bestTool('axe') || bestTool('shovel');
    const toolText = tool ? `${tool.name} ${toolDurabilityText(tool.id)}` : '道具なし';
    foodHud.innerHTML = `<div class="food-actions">${foodHudButton('apple')}${foodHudButton('berries')}</div><div class="tool-durability">${toolText}</div>`;
  }
  foodHud.addEventListener('click', e => {
    const btn = e.target.closest('[data-food]');
    if (!btn) return;
    eatInventoryFood(btn.dataset.food);
  });
  addEventListener('keydown', e => {
    if (e.code !== 'KeyH' || !started) return;
    if (eatInventoryFood('apple') || eatInventoryFood('berries')) e.preventDefault();
  });
  updateFoodHud();
