  /* ============== コンテナUI（インベントリ / 2x2クラフト / 作業台3x3 / かまど / チェスト） ==============
   * すべての画面で下段に「メイン27 + ホットバー9」を表示し、上段だけ差し替える。
   * マウスカーソルにアイテムを持って、クリックで移動 / 右クリックで半分・1個ずつ、
   * Shift+クリックでコンテナ⇔インベントリの即時移動ができる。 */
  const invScreen = document.createElement('div');
  invScreen.id = 'invScreen';
  invScreen.innerHTML = `
    <div class="inv-head"><b></b><button data-inv-close="1">閉じる (E)</button></div>
    <div class="inv-top"></div>
    <div class="inv-bottom">
      <div class="inv-label">インベントリ</div>
      <div class="inv-main inv-grid"></div>
      <div class="inv-hotbar inv-grid"></div>
    </div>
  `;
  document.body.appendChild(invScreen);
  const cursorItemEl = document.createElement('div');
  cursorItemEl.id = 'cursorItem';
  document.body.appendChild(cursorItemEl);

  const UI = { mode: null, ctx: null, craftCells: [], craftW: 0, cursor: null };
  function isContainerOpen() { return UI.mode !== null; }

  function slotArrayFor(src) {
    if (src === 'inv') return INV;
    if (src === 'craft') return UI.craftCells;
    if (src === 'chest') return chestSlots(UI.ctx.key);
    return null;
  }
  function getSlot(src, idx) {
    if (src === 'fin') return furnaceState(UI.ctx.key).in;
    if (src === 'ffuel') return furnaceState(UI.ctx.key).fuel;
    if (src === 'fout') return furnaceState(UI.ctx.key).out;
    const arr = slotArrayFor(src);
    return arr ? arr[idx] || null : null;
  }
  function setSlot(src, idx, item) {
    if (src === 'fin') { furnaceState(UI.ctx.key).in = item; return; }
    if (src === 'ffuel') { furnaceState(UI.ctx.key).fuel = item; return; }
    if (src === 'fout') { furnaceState(UI.ctx.key).out = item; return; }
    const arr = slotArrayFor(src);
    if (arr) arr[idx] = item;
  }
  function canPlaceInto(src, item) {
    if (src === 'fout') return false; // 出力は取り出し専用
    if (src === 'ffuel') { const d = item && ITEM_DEFS[item.id]; return !!(d && d.fuel); }
    return true;
  }

  function renderSlotContent(el, item) {
    el.innerHTML = '';
    if (!item) return;
    const icon = document.createElement('span');
    icon.className = 'sl-icon';
    icon.style.backgroundImage = `url(${itemIconUrl(item.id)})`;
    el.appendChild(icon);
    if (item.n > 1) {
      const n = document.createElement('em');
      n.textContent = item.n;
      el.appendChild(n);
    }
    const d = ITEM_DEFS[item.id];
    if (d && d.durability && Number.isFinite(item.dur) && item.dur < d.durability) {
      const bar = document.createElement('span');
      bar.className = 'sl-dur';
      const r = Math.max(0, item.dur / d.durability);
      bar.innerHTML = `<i style="width:${(r * 100).toFixed(0)}%;background:${r > 0.5 ? '#7ee06a' : r > 0.25 ? '#f0c04a' : '#f05a4a'}"></i>`;
      el.appendChild(bar);
    }
    const name = ITEM_DEFS[item.id] ? ITEM_DEFS[item.id].name : item.id;
    el.title = item.n > 1 ? `${name} x${item.n}` : name;
  }
  function makeSlotEl(src, idx, cls = '') {
    const el = document.createElement('div');
    el.className = `inv-slot ${cls}`;
    el.dataset.src = src;
    el.dataset.idx = String(idx);
    renderSlotContent(el, getSlot(src, idx));
    return el;
  }

  function craftResultItem() {
    const r = matchRecipe(UI.craftCells, UI.craftW);
    return r ? { recipe: r, item: mkItem(r.out, r.n) } : null;
  }

  function renderContainer() {
    if (!UI.mode) return;
    const head = invScreen.querySelector('.inv-head b');
    const top = invScreen.querySelector('.inv-top');
    top.innerHTML = '';
    if (UI.mode === 'inventory' || UI.mode === 'table') {
      head.textContent = UI.mode === 'table' ? '作業台' : 'インベントリ';
      const w = UI.craftW;
      const wrap = document.createElement('div');
      wrap.className = 'craft-area';
      const grid = document.createElement('div');
      grid.className = 'inv-grid craft-grid';
      grid.style.gridTemplateColumns = `repeat(${w}, 46px)`;
      for (let i = 0; i < w * w; i++) grid.appendChild(makeSlotEl('craft', i));
      const arrow = document.createElement('div');
      arrow.className = 'craft-arrow';
      arrow.textContent = '→';
      const res = document.createElement('div');
      res.className = 'inv-grid';
      const resSlot = document.createElement('div');
      resSlot.className = 'inv-slot result-slot';
      resSlot.dataset.src = 'result';
      resSlot.dataset.idx = '0';
      const cr = craftResultItem();
      renderSlotContent(resSlot, cr ? cr.item : null);
      res.appendChild(resSlot);
      wrap.append(grid, arrow, res);
      top.appendChild(wrap);
      if (UI.mode === 'inventory') {
        const hint = document.createElement('div');
        hint.className = 'craft-hint';
        hint.textContent = '2x2クラフト（丸太→板材、板材→棒/作業台 など）。大きなレシピは作業台で。';
        top.appendChild(hint);
      }
    } else if (UI.mode === 'furnace') {
      head.textContent = 'かまど';
      const wrap = document.createElement('div');
      wrap.className = 'furnace-area';
      wrap.innerHTML = `
        <div class="furnace-col">
          <div class="furnace-slot-label">材料</div>
          <div class="f-in"></div>
          <div class="furnace-fire"><i class="f-fuelbar"></i></div>
          <div class="furnace-slot-label">燃料</div>
          <div class="f-fuel"></div>
        </div>
        <div class="furnace-mid">
          <div class="furnace-progress"><i class="f-progbar"></i></div>
          <div class="furnace-progress-label">精錬</div>
        </div>
        <div class="furnace-col">
          <div class="furnace-slot-label">完成</div>
          <div class="f-out"></div>
        </div>
      `;
      wrap.querySelector('.f-in').appendChild(makeSlotEl('fin', 0));
      wrap.querySelector('.f-fuel').appendChild(makeSlotEl('ffuel', 0));
      wrap.querySelector('.f-out').appendChild(makeSlotEl('fout', 0, 'result-slot'));
      top.appendChild(wrap);
      updateFurnaceBars();
    } else if (UI.mode === 'chest') {
      head.textContent = 'チェスト';
      const grid = document.createElement('div');
      grid.className = 'inv-grid chest-grid';
      for (let i = 0; i < CHEST_SLOTS; i++) grid.appendChild(makeSlotEl('chest', i));
      top.appendChild(grid);
    }
    const main = invScreen.querySelector('.inv-main');
    main.innerHTML = '';
    for (let i = HOTBAR_SIZE; i < INV_SIZE; i++) main.appendChild(makeSlotEl('inv', i));
    const hot = invScreen.querySelector('.inv-hotbar');
    hot.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) hot.appendChild(makeSlotEl('inv', i, i === selected ? 'hot-selected' : ''));
    renderCursorItem();
  }
  function updateFurnaceBars() {
    if (UI.mode !== 'furnace') return;
    const st = furnaceState(UI.ctx.key);
    const prog = invScreen.querySelector('.f-progbar');
    const fuel = invScreen.querySelector('.f-fuelbar');
    if (prog) prog.style.width = `${Math.min(100, (st.prog / SMELT_TIME) * 100).toFixed(0)}%`;
    if (fuel) fuel.style.height = `${st.fuelMax > 0 ? Math.min(100, (st.fuelLeft / st.fuelMax) * 100).toFixed(0) : 0}%`;
  }
  function refreshOpenPanels() {
    if (UI.mode) renderContainer();
    if (typeof updateTravelerPanel === 'function') updateTravelerPanel();
  }
  function renderCursorItem() {
    cursorItemEl.innerHTML = '';
    cursorItemEl.style.display = UI.cursor ? 'block' : 'none';
    if (UI.cursor) renderSlotContent(cursorItemEl, UI.cursor);
  }
  addEventListener('mousemove', e => {
    if (!UI.cursor) return;
    cursorItemEl.style.left = `${e.clientX + 6}px`;
    cursorItemEl.style.top = `${e.clientY + 6}px`;
  });

  function containerChanged() {
    if (UI.mode === 'chest' || UI.mode === 'furnace') markSaveDirty();
    invChanged(); // ホットバー/保存/再描画（refreshOpenPanels経由）
  }

  function takeCraftResult() {
    const cr = craftResultItem();
    if (!cr) return;
    const cap = maxStack(cr.item.id);
    if (UI.cursor) {
      if (UI.cursor.id !== cr.item.id || UI.cursor.n + cr.item.n > cap) return;
      UI.cursor.n += cr.item.n;
    } else {
      UI.cursor = cr.item;
    }
    consumeCraftGrid(UI.craftCells);
    thock(320);
    if (typeof progressEvent === 'function') progressEvent('craft', cr.recipe.out);
    containerChanged();
  }
  function quickMove(src, idx) {
    const item = getSlot(src, idx);
    if (!item) return;
    let leftover = null;
    if (src === 'inv') {
      if (UI.mode === 'chest') {
        leftover = mergeIntoSlots(chestSlots(UI.ctx.key), item);
      } else {
        // ホットバー⇔メインの入れ替え
        const range = idx < HOTBAR_SIZE ? [HOTBAR_SIZE, INV_SIZE] : [0, HOTBAR_SIZE];
        const sub = INV.slice(range[0], range[1]);
        leftover = mergeIntoSlots(sub, item);
        for (let i = 0; i < sub.length; i++) INV[range[0] + i] = sub[i];
      }
      setSlot(src, idx, leftover);
    } else {
      const before = item.n;
      const rest = giveItem(item.id, item.n, item.dur);
      if (rest >= before) return; // 入らなかった
      setSlot(src, idx, rest > 0 ? mkItem(item.id, rest, item.dur) : null);
    }
    containerChanged();
  }
  function handleSlotClick(src, idx, button, shiftKey) {
    if (src === 'result') { takeCraftResult(); return; }
    if (shiftKey && button === 0) { quickMove(src, idx); return; }
    const item = getSlot(src, idx);
    if (src === 'fout') {
      // 出力スロットは取り出しのみ
      if (!item) return;
      if (!UI.cursor) { UI.cursor = item; setSlot(src, idx, null); }
      else if (UI.cursor.id === item.id && UI.cursor.n + item.n <= maxStack(item.id)) { UI.cursor.n += item.n; setSlot(src, idx, null); }
      else return;
      containerChanged();
      return;
    }
    if (button === 0) {
      if (!UI.cursor) {
        if (!item) return;
        UI.cursor = item;
        setSlot(src, idx, null);
      } else if (!canPlaceInto(src, UI.cursor)) {
        return;
      } else if (!item) {
        setSlot(src, idx, UI.cursor);
        UI.cursor = null;
      } else if (item.id === UI.cursor.id && maxStack(item.id) > 1) {
        const cap = maxStack(item.id);
        const add = Math.min(cap - item.n, UI.cursor.n);
        item.n += add;
        UI.cursor.n -= add;
        if (UI.cursor.n <= 0) UI.cursor = null;
      } else {
        setSlot(src, idx, UI.cursor);
        UI.cursor = item;
      }
    } else if (button === 2) {
      if (!UI.cursor) {
        if (!item) return;
        const half = Math.ceil(item.n / 2);
        UI.cursor = mkItem(item.id, half, item.dur);
        item.n -= half;
        if (item.n <= 0) setSlot(src, idx, null);
      } else if (canPlaceInto(src, UI.cursor)) {
        if (!item) {
          setSlot(src, idx, mkItem(UI.cursor.id, 1, UI.cursor.dur));
          UI.cursor.n -= 1;
        } else if (item.id === UI.cursor.id && item.n < maxStack(item.id)) {
          item.n += 1;
          UI.cursor.n -= 1;
        } else return;
        if (UI.cursor.n <= 0) UI.cursor = null;
      }
    }
    containerChanged();
  }
  invScreen.addEventListener('mousedown', e => {
    const close = e.target.closest('[data-inv-close]');
    if (close) { closeContainer(); return; }
    const slot = e.target.closest('.inv-slot');
    if (!slot) return;
    e.preventDefault();
    handleSlotClick(slot.dataset.src, +slot.dataset.idx, e.button, e.shiftKey);
  });
  invScreen.addEventListener('contextmenu', e => e.preventDefault());

  function openContainer(mode, ctx = null) {
    if (UI.mode) closeContainer();
    UI.mode = mode;
    UI.ctx = ctx;
    UI.craftW = mode === 'table' ? 3 : 2;
    UI.craftCells = new Array(UI.craftW * UI.craftW).fill(null);
    if (mode === 'chest' && ctx && ctx.world) rollWorldChestLoot(ctx.key);
    invScreen.classList.add('show');
    releasePointerForUi();
    renderContainer();
    thock(mode === 'chest' ? 340 : 220);
  }
  function closeContainer() {
    if (!UI.mode) return;
    // クラフト枠とカーソルの持ちものはインベントリへ戻す
    for (let i = 0; i < UI.craftCells.length; i++) {
      const s = UI.craftCells[i];
      if (s) giveItem(s.id, s.n, s.dur);
      UI.craftCells[i] = null;
    }
    if (UI.cursor) { giveItem(UI.cursor.id, UI.cursor.n, UI.cursor.dur); UI.cursor = null; }
    UI.mode = null;
    UI.ctx = null;
    invScreen.classList.remove('show');
    renderCursorItem();
    invChanged();
    if (typeof relockPointerForGame === 'function') relockPointerForGame();
  }
  function toggleInventoryScreen() {
    if (UI.mode) closeContainer();
    else openContainer('inventory');
  }

  /* --- 拾得トースト（画面右下に「+2 丸太」を積む） --- */
  const pickupToastBox = document.createElement('div');
  pickupToastBox.id = 'pickupToasts';
  document.body.appendChild(pickupToastBox);
  function showPickupToast(id, n) {
    const d = ITEM_DEFS[id];
    if (!d) return;
    const row = document.createElement('div');
    row.className = 'pickup-toast';
    row.innerHTML = `<span class="pt-icon" style="background-image:url(${itemIconUrl(id)})"></span><span>+${n} ${d.name}</span>`;
    pickupToastBox.appendChild(row);
    while (pickupToastBox.children.length > 5) pickupToastBox.removeChild(pickupToastBox.firstChild);
    setTimeout(() => { row.classList.add('fade'); setTimeout(() => row.remove(), 400); }, 1500);
  }
