  /* ============== インベントリ整理画面 ============== */
  const inventoryPanel = document.createElement('div');
  inventoryPanel.id = 'inventoryPanel';
  inventoryPanel.dataset.tab = 'blocks';
  inventoryPanel.innerHTML = `
    <div class="inventory-head">
      <b>インベントリ</b>
      <button data-close="1">閉じる</button>
    </div>
    <div class="inventory-tabs">
      <button data-tab="blocks">ブロック</button>
      <button data-tab="materials">素材</button>
      <button data-tab="tools">道具</button>
      <button data-tab="food">食料</button>
    </div>
    <div class="inventory-list"></div>
  `;
  document.body.appendChild(inventoryPanel);

  function inventoryEntriesFor(tab) {
    const entries = [];
    if (tab === 'blocks') {
      for (let i = 0; i < TYPES.length; i++) {
        if (TYPES[i] && TYPES[i].solid !== false && inventoryCount(i) > 0) entries.push({ id: i, name: itemLabel(i), count: inventoryCount(i), kind: 'block' });
      }
    } else {
      for (const [id, def] of Object.entries(ITEMS)) {
        const count = inventoryCount(id);
        if (count <= 0) continue;
        if (tab === 'materials' && !def.tool && !def.food) entries.push({ id, name: def.name, count, kind: 'material' });
        if (tab === 'tools' && def.tool) entries.push({ id, name: def.name, count, kind: 'tool', detail: toolDurabilityText(id) });
        if (tab === 'food' && def.food) entries.push({ id, name: def.name, count, kind: 'food', detail: `回復 +${def.food}` });
      }
    }
    return entries;
  }

  function setInventoryTab(tab) {
    inventoryPanel.dataset.tab = tab;
    updateInventoryPanel();
  }

  function setInventoryPanelOpen(open) {
    inventoryPanel.classList.toggle('show', open);
    if (open) {
      releasePointerForUi();
      updateInventoryPanel();
    }
  }

  function updateInventoryPanel() {
    if (!inventoryPanel || !inventoryPanel.classList.contains('show')) return;
    const tab = inventoryPanel.dataset.tab || 'blocks';
    inventoryPanel.querySelectorAll('.inventory-tabs button').forEach(btn => btn.classList.toggle('on', btn.dataset.tab === tab));
    const list = inventoryPanel.querySelector('.inventory-list');
    const entries = inventoryEntriesFor(tab);
    list.innerHTML = '';
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'inventory-empty';
      empty.textContent = 'まだアイテムがありません';
      list.appendChild(empty);
      return;
    }
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = `inventory-item ${entry.kind}`;
      const icon = document.createElement('span');
      icon.className = 'inventory-icon';
      if (typeof entry.id === 'number' && TYPES[entry.id] && TYPES[entry.id].icon) {
        icon.style.backgroundImage = `url(${TYPES[entry.id].icon.image.toDataURL()})`;
      } else {
        icon.textContent = entry.kind === 'tool' ? 'T' : entry.kind === 'food' ? 'F' : 'M';
      }
      const main = document.createElement('div');
      main.className = 'inventory-main';
      main.innerHTML = `<b>${entry.name}</b><small>${entry.detail || itemCategoryLabel(entry.kind)}</small>`;
      const count = document.createElement('em');
      count.textContent = `x${entry.count}`;
      row.append(icon, main, count);
      if (entry.kind === 'food') {
        const eat = document.createElement('button');
        eat.type = 'button';
        eat.dataset.eat = entry.id;
        eat.textContent = '食べる';
        row.appendChild(eat);
      }
      list.appendChild(row);
    }
  }

  function itemCategoryLabel(kind) {
    if (kind === 'block') return '設置できるブロック';
    if (kind === 'tool') return '採掘用の道具';
    if (kind === 'food') return '空腹を回復';
    return 'クラフト素材';
  }

  inventoryPanel.addEventListener('click', e => {
    const close = e.target.closest('[data-close]');
    const tab = e.target.closest('[data-tab]');
    const eat = e.target.closest('[data-eat]');
    if (close) setInventoryPanelOpen(false);
    if (tab) setInventoryTab(tab.dataset.tab);
    if (eat) {
      eatInventoryFood(eat.dataset.eat);
      updateInventoryPanel();
    }
  });

  addEventListener('keydown', e => {
    if (e.code !== 'Tab') return;
    e.preventDefault();
    setInventoryPanelOpen(!inventoryPanel.classList.contains('show'));
  });
