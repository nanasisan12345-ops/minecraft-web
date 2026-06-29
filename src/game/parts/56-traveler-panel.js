  /* ============== 村人の会話 / 取引画面 ============== */
  const travelerPanel = document.createElement('div');
  travelerPanel.id = 'travelerPanel';
  travelerPanel.innerHTML = `
    <div class="traveler-head">
      <div><b>村人</b><small></small></div>
      <button data-traveler-close="1">閉じる</button>
    </div>
    <div class="traveler-line"></div>
    <div class="traveler-trades"></div>
  `;
  document.body.appendChild(travelerPanel);

  const TRAVELER_PANEL = { traveler: null };

  function isTravelerPanelOpen() {
    return travelerPanel.classList.contains('show');
  }

  function setTravelerPanelOpen(open) {
    travelerPanel.classList.toggle('show', open);
    if (open) {
      releasePointerForUi();
      updateTravelerPanel();
    } else {
      TRAVELER_PANEL.traveler = null;
    }
  }

  function openTravelerPanel(traveler) {
    TRAVELER_PANEL.traveler = traveler;
    setTravelerPanelOpen(true);
  }

  function tradeItemsText(items) {
    return items.map(([id, amount]) => `${itemLabel(id)} x${amount}`).join(' + ');
  }

  function tradeCostText(cost) {
    return cost.map(([id, amount]) => `${itemLabel(id)} ${inventoryCount(id)}/${amount}`).join(' ・ ');
  }

  function updateTravelerPanel() {
    if (!isTravelerPanelOpen()) return;
    const t = TRAVELER_PANEL.traveler;
    const role = t && TRAVELER_ROLES[t.userData.role] ? TRAVELER_ROLES[t.userData.role] : TRAVELER_ROLES.wanderer;
    travelerPanel.querySelector('.traveler-head b').textContent = role.label;
    travelerPanel.querySelector('.traveler-head small').textContent = '右クリックで会話';
    travelerPanel.querySelector('.traveler-line').textContent = role.line;
    const list = travelerPanel.querySelector('.traveler-trades');
    list.innerHTML = '';
    for (const trade of role.trades) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'traveler-trade';
      btn.dataset.trade = trade.id;
      btn.disabled = !canDoTravelerTrade(trade);
      btn.innerHTML = `<span>${trade.name}</span><small>渡す: ${tradeCostText(trade.cost)}</small><em>受取: ${tradeItemsText(trade.out)}</em>`;
      list.appendChild(btn);
    }
  }

  travelerPanel.addEventListener('click', e => {
    const close = e.target.closest('[data-traveler-close]');
    const trade = e.target.closest('[data-trade]');
    if (close) { setTravelerPanelOpen(false); return; }
    if (trade && doTravelerTrade(trade.dataset.trade)) updateTravelerPanel();
  });
