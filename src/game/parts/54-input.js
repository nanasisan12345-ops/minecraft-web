  /* ============== 入力・開始/一時停止 ============== */
  const keys = {};
  const mouseHeld = { left: false };
  let selected = 0, started = false;
  let uiPointerUnlock = false;
  const overlay = document.getElementById('overlay');
  const RAVE_KEY_BINDINGS = [
    { code: 'Digit1', key: '1', kind: 'classic' },
    { code: 'Digit2', key: '2', kind: 'neon' },
    { code: 'Digit3', key: '3', kind: 'forest' },
    { code: 'Digit4', key: '4', kind: 'laser' },
    { code: 'Digit5', key: '5', kind: 'future' },
    { code: 'Digit6', key: '6', kind: 'bass' },
    { code: 'Digit7', key: '7', kind: 'chill' },
    { code: 'Digit8', key: '8', kind: 'dub' },
  ];
  // 旧アルファベットキーもエイリアスとして残す（数字キーと併用可）
  const RAVE_ALT_KEYS = [
    { code: 'KeyR', kind: 'classic' }, { code: 'KeyT', kind: 'neon' }, { code: 'KeyY', kind: 'forest' }, { code: 'KeyU', kind: 'laser' },
    { code: 'KeyI', kind: 'future' }, { code: 'KeyO', kind: 'bass' }, { code: 'KeyP', kind: 'chill' }, { code: 'BracketLeft', kind: 'dub' },
  ];
  const PLAYER_DANCE_KEYS = [
    { code: 'KeyZ', key: 'Z', move: 'bounce', label: 'ジャンプ' },
    { code: 'KeyX', key: 'X', move: 'handsup', label: '手上げ' },
    { code: 'KeyC', key: 'C', move: 'point', label: 'ポイント' },
    { code: 'KeyV', key: 'V', move: 'spin', label: 'スピン' },
  ];
  const DJ_KEYS = [
    { code: 'KeyQ', fn: () => switchRaveSong(-1) },
    { code: 'KeyE', fn: () => switchRaveSong(1) },
    { code: 'KeyJ', fn: () => djFilterSweep() },
    { code: 'KeyK', fn: () => djCrashHit() },
    { code: 'KeyL', fn: () => djLoopRoll() },
  ];
  function startGame() {
    if (started) return;
    if (typeof worldPreloadReady === 'function' && !worldPreloadReady()) {
      const go = overlay.querySelector('.go');
      if (go) go.textContent = typeof worldPreloadStatus === 'function' ? worldPreloadStatus() : 'マップ生成中...';
      return;
    }
    started = true; overlay.style.display = 'none'; initAudio();
    if (typeof MUSIC !== 'undefined' && MUSIC.el && RAVE.on) { MUSIC.el.play().then(resyncBeatClock).catch(() => {}); } // 再開時にBGMも再生・拍を再同期
    const p = canvas.requestPointerLock && canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }
  function pause() {
    if (!started) return;
    started = false; overlay.style.display = 'flex';
    if (typeof MUSIC !== 'undefined' && MUSIC.el) { try { MUSIC.el.pause(); } catch (e) {} } // BGMも一時停止
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
  function releasePointerForUi() {
    if (document.pointerLockElement === canvas) {
      uiPointerUnlock = true;
      document.exitPointerLock();
    }
  }
  window.__startGame = startGame;
  overlay.addEventListener('click', startGame);
  canvas.addEventListener('mousedown', e => {
    if (!started) { startGame(); return; }
    if (e.button === 0) mouseHeld.left = true;
    else if (e.button === 2) placeBlock();
  });
  addEventListener('mouseup', e => { if (e.button === 0) mouseHeld.left = false; });
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('mousemove', e => {
    if (!started) return;
    // フレームが詰まるとブラウザがマウス移動をまとめて巨大なmovementXとして返し視点が吹っ飛ぶ。1イベントの移動量を制限する。
    const mx = Math.max(-120, Math.min(120, e.movementX)), my = Math.max(-120, Math.min(120, e.movementY));
    yaw -= mx * 0.0022 * GAME_SETTINGS.mouseSensitivity; pitch -= my * 0.0022 * GAME_SETTINGS.mouseSensitivity;
    const lim = Math.PI / 2 - 0.01; pitch = Math.max(-lim, Math.min(lim, pitch));
  });
  document.addEventListener('pointerlockchange', () => {
    if (uiPointerUnlock) { uiPointerUnlock = false; return; }
    if (started && document.pointerLockElement !== canvas) pause();
  });
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Escape') pause();
    if (e.code === 'F3') { toggleDebugFly(); e.preventDefault(); }
    if (e.code === 'F4') { teleportToNearbyCave(); e.preventDefault(); }
    if (e.code === 'F6') { teleportToNearbyDungeon(); e.preventDefault(); }
    if (e.code === 'F7') { teleportToNearbyVillage(); e.preventDefault(); }
    if (e.code === 'F8') { teleportToNearbyMineshaft(); e.preventDefault(); }
    if (e.code === 'F9') { teleportToNearbyLake(); e.preventDefault(); }
    if (e.code === 'F10') { teleportToNearbyCanyon(); e.preventDefault(); }
    if (e.code === 'Comma') { updateSettingsPanel(); setSettingsPanelOpen(!settingsPanel.classList.contains('show')); e.preventDefault(); }
    const venueKey = RAVE_KEY_BINDINGS.find(v => v.code === e.code) || RAVE_ALT_KEYS.find(v => v.code === e.code);
    if (venueKey) { raveToggle(venueKey.kind); e.preventDefault(); }
    const danceKey = PLAYER_DANCE_KEYS.find(v => v.code === e.code);
    if (danceKey) { triggerPlayerDance(danceKey); e.preventDefault(); }
    const djKey = DJ_KEYS.find(v => v.code === e.code);
    if (djKey) { djKey.fn(); e.preventDefault(); }
    if (e.code === 'KeyN') { toggleThirdPerson(); e.preventDefault(); }
    if (e.code === 'KeyM') { setRaveMuted(!RAVE.muted); e.preventDefault(); } // 全体ミュート切替
    if (e.code === 'KeyB') { toggleCraftPanel('craft'); e.preventDefault(); }
    if (e.code === 'KeyF') { toggleCraftPanel('smelt'); e.preventDefault(); }
    if (e.code === 'KeyG') { // 確認用：天候を手動で切替（快晴→晴れ→曇り→雨）。屋外のみ（会場中は天候停止）
      const order = ['clear', 'fair', 'cloudy', 'rain'];
      weatherState = order[(order.indexOf(weatherState) + 1) % order.length];
      weatherLabel = WEATHER[weatherState].label; setWeatherVals(wTgt, WEATHER[weatherState]);
      weatherClock = 0; weatherNext = rnd(35, 85); e.preventDefault();
    }
    // 数字キーは音楽会場に割当（ブロック選択はマウスホイール／ホットバークリックで行う）
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('wheel', e => { if (started) selectSlot((selected + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length); }, { passive: true });
