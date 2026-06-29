  /* ============== 宝箱画面 ============== */
  const chestPanel = document.createElement('div');
  chestPanel.id = 'chestPanel';
  chestPanel.innerHTML = `
    <div class="chest-head">
      <b>宝箱</b>
      <button data-chest-close="1">閉じる</button>
    </div>
    <div class="chest-grid"></div>
    <div class="chest-foot">
      <span class="chest-status"></span>
      <button data-chest-take-all="1">すべて取る</button>
    </div>
  `;
  document.body.appendChild(chestPanel);

  const CHEST_PANEL = { id: '' };

  function isChestPanelOpen() {
    return chestPanel.classList.contains('show');
  }

  function setChestPanelOpen(open) {
    chestPanel.classList.toggle('show', open);
    if (open) {
      releasePointerForUi();
      updateChestPanel();
    } else {
      CHEST_PANEL.id = '';
    }
  }

  function openChestPanel(id) {
    CHEST_PANEL.id = id;
    setChestPanelOpen(true);
  }

  function chestEntryIcon(entry) {
    const icon = document.createElement('span');
    icon.className = 'chest-icon';
    if (typeof entry.item === 'number' && TYPES[entry.item] && TYPES[entry.item].icon) {
      icon.style.backgroundImage = `url(${TYPES[entry.item].icon.image.toDataURL()})`;
    } else {
      const def = ITEMS[entry.item];
      icon.textContent = def && def.tool ? 'T' : def && def.food ? 'F' : 'M';
    }
    return icon;
  }

  function updateChestPanel() {
    if (!isChestPanelOpen()) return;
    const loot = CHEST_PANEL.id && typeof chestLootForPanel === 'function' ? chestLootForPanel(CHEST_PANEL.id) : [];
    const grid = chestPanel.querySelector('.chest-grid');
    const status = chestPanel.querySelector('.chest-status');
    const takeAll = chestPanel.querySelector('[data-chest-take-all]');
    grid.innerHTML = '';
    status.textContent = loot.length ? `${loot.length}スタック` : '空';
    takeAll.disabled = !loot.length;
    for (let i = 0; i < 18; i++) {
      const entry = loot[i];
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'chest-slot';
      slot.dataset.chestSlot = String(i);
      if (!entry) {
        slot.disabled = true;
        grid.appendChild(slot);
        continue;
      }
      const name = itemLabel(entry.item);
      slot.title = `${name} x${entry.count}`;
      const count = document.createElement('em');
      count.textContent = `x${entry.count}`;
      slot.append(chestEntryIcon(entry), count);
      grid.appendChild(slot);
    }
  }

  chestPanel.addEventListener('click', e => {
    const close = e.target.closest('[data-chest-close]');
    const takeAll = e.target.closest('[data-chest-take-all]');
    const slot = e.target.closest('[data-chest-slot]');
    if (close) { setChestPanelOpen(false); return; }
    if (!CHEST_PANEL.id) return;
    if (takeAll) {
      takeAllChestLoot(CHEST_PANEL.id);
      updateChestPanel();
      return;
    }
    if (slot && !slot.disabled) {
      takeChestStack(CHEST_PANEL.id, +slot.dataset.chestSlot);
      updateChestPanel();
    }
  });
