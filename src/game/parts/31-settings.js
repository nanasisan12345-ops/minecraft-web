  /* ============== 設定（描画距離 / 視野角 / マウス感度 / シード） ============== */
  const SETTINGS_KEY = 'mc_settings_v1';
  const DEFAULT_SETTINGS = { renderDistance: 72, fov: 75, mouseSensitivity: 1 };
  function loadGameSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return {
        renderDistance: [48, 72, 96].includes(+saved.renderDistance) ? +saved.renderDistance : DEFAULT_SETTINGS.renderDistance,
        fov: Math.max(55, Math.min(95, +saved.fov || DEFAULT_SETTINGS.fov)),
        mouseSensitivity: Math.max(0.45, Math.min(1.8, +saved.mouseSensitivity || DEFAULT_SETTINGS.mouseSensitivity)),
      };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }
  const GAME_SETTINGS = loadGameSettings();
  function saveGameSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(GAME_SETTINGS));
  }
  function applyCameraSettings() {
    camera.fov = GAME_SETTINGS.fov;
    camera.updateProjectionMatrix();
  }
  applyCameraSettings();
