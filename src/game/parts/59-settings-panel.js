  /* ============== 設定パネルUI ============== */
  const settingsButton = document.createElement('button');
  settingsButton.id = 'settingsButton';
  settingsButton.type = 'button';
  settingsButton.title = '設定';
  settingsButton.textContent = '⚙';
  document.body.appendChild(settingsButton);

  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'settingsPanel';
  settingsPanel.innerHTML = `
    <div class="settings-head"><b>設定</b><button type="button" data-close>閉じる</button></div>
    <div class="settings-row">
      <label>描画距離</label>
      <select data-setting="renderDistance">
        <option value="48">軽い</option>
        <option value="72">標準</option>
        <option value="96">広い</option>
      </select>
      <small>再読み込み後に反映</small>
    </div>
    <div class="settings-row">
      <label>視野角</label>
      <input type="range" min="55" max="95" step="1" data-setting="fov">
      <output data-output="fov"></output>
    </div>
    <div class="settings-row">
      <label>マウス感度</label>
      <input type="range" min="0.45" max="1.8" step="0.05" data-setting="mouseSensitivity">
      <output data-output="mouseSensitivity"></output>
    </div>
    <div class="settings-row">
      <label>ワールドシード</label>
      <input type="number" min="1" max="2147483646" step="1" data-seed>
      <button type="button" data-apply-seed>作成</button>
    </div>
    <div class="settings-actions">
      <button type="button" data-apply-reload>保存して再読み込み</button>
      <button type="button" data-random-seed>ランダムワールド</button>
    </div>
  `;
  document.body.appendChild(settingsPanel);

  function setSettingsPanelOpen(open) {
    settingsPanel.classList.toggle('show', open);
    if (open) releasePointerForUi();
  }
  function updateSettingsPanel() {
    settingsPanel.querySelector('[data-setting="renderDistance"]').value = String(GAME_SETTINGS.renderDistance);
    settingsPanel.querySelector('[data-setting="fov"]').value = String(GAME_SETTINGS.fov);
    settingsPanel.querySelector('[data-setting="mouseSensitivity"]').value = String(GAME_SETTINGS.mouseSensitivity);
    settingsPanel.querySelector('[data-output="fov"]').textContent = `${GAME_SETTINGS.fov}`;
    settingsPanel.querySelector('[data-output="mouseSensitivity"]').textContent = `${GAME_SETTINGS.mouseSensitivity.toFixed(2)}`;
    settingsPanel.querySelector('[data-seed]').value = String(WORLD_SEED);
  }
  settingsButton.addEventListener('click', e => {
    e.stopPropagation();
    updateSettingsPanel();
    setSettingsPanelOpen(!settingsPanel.classList.contains('show'));
  });
  settingsPanel.addEventListener('click', e => e.stopPropagation());
  settingsPanel.addEventListener('input', e => {
    const name = e.target.getAttribute('data-setting');
    if (!name) return;
    GAME_SETTINGS[name] = name === 'renderDistance' ? +e.target.value : Number(Number(e.target.value).toFixed(2));
    saveGameSettings();
    if (name === 'fov') applyCameraSettings();
    updateSettingsPanel();
  });
  settingsPanel.addEventListener('click', e => {
    if (e.target.matches('[data-close]')) setSettingsPanelOpen(false);
    if (e.target.matches('[data-apply-reload]')) { saveGameSettings(); location.reload(); }
    if (e.target.matches('[data-random-seed]')) setWorldSeed(Math.floor(Math.random() * 2147483646) + 1);
    if (e.target.matches('[data-apply-seed]')) setWorldSeed(settingsPanel.querySelector('[data-seed]').value);
  });
