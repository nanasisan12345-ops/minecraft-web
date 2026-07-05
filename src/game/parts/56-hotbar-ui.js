  /* ============== ホットバーUI（9枠・スロット式） ============== */
  const hotbar = document.getElementById('hotbar');
  const hotbarSlots = [];
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.innerHTML = `<b>${i + 1}</b><div class="sl-body"></div><small></small>`;
    slot.addEventListener('click', () => selectSlot(i));
    hotbar.appendChild(slot);
    hotbarSlots.push(slot);
  }
  function selectSlot(i) {
    selected = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    SAVE.selected = selected;
    markSaveDirty();
    updateHotbarUI();
  }
  function updateHotbarUI() {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = hotbarSlots[i];
      const item = INV[i];
      slot.classList.toggle('on', i === selected);
      slot.classList.toggle('empty', !item);
      const body = slot.querySelector('.sl-body');
      renderSlotContent(body, item);
      slot.querySelector('small').textContent = item && i === selected ? ITEM_DEFS[item.id].name : '';
    }
  }
  updateHotbarUI();
  const stats = document.getElementById('stats');
  function selectedItemName() {
    const s = INV[selected];
    return s ? `${ITEM_DEFS[s.id].name}${s.n > 1 ? ' x' + s.n : ''}` : '素手';
  }
