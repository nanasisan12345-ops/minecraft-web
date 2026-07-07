  /* ============== 入力・開始/一時停止 ============== */
  const keys = {};
  const mouseHeld = { left: false };
  let selected = Number.isFinite(SAVE.selected) ? Math.min(8, Math.max(0, SAVE.selected | 0)) : 0;
  let started = false;
  let uiPointerUnlock = false;
  const overlay = document.getElementById('overlay');
  // 音楽会場の起動キー（数字キーはホットバー選択に譲り、英字キーに一本化）
  const RAVE_KEY_BINDINGS = [
    { code: 'KeyR', key: 'R', kind: 'classic' },
    { code: 'KeyT', key: 'T', kind: 'neon' },
    { code: 'KeyY', key: 'Y', kind: 'forest' },
    { code: 'KeyU', key: 'U', kind: 'laser' },
    { code: 'KeyI', key: 'I', kind: 'future' },
    { code: 'KeyO', key: 'O', kind: 'bass' },
    { code: 'KeyP', key: 'P', kind: 'chill' },
    { code: 'BracketLeft', key: '[', kind: 'dub' },
  ];
  const PLAYER_DANCE_KEYS = [
    { code: 'KeyZ', key: 'Z', move: 'bounce', label: 'ジャンプ' },
    { code: 'KeyX', key: 'X', move: 'handsup', label: '手上げ' },
    { code: 'KeyC', key: 'C', move: 'point', label: 'ポイント' },
    { code: 'KeyV', key: 'V', move: 'spin', label: 'スピン' },
  ];
  // DJ操作は会場起動中のみ有効（E はインベントリと共用のため）
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
    writeSaveNow();
  }
  function releasePointerForUi() {
    if (document.pointerLockElement === canvas) {
      uiPointerUnlock = true;
      document.exitPointerLock();
    }
  }
  // UIパネルを閉じた直後にポインタロックへ戻す（閉じる操作=ユーザー操作の中で呼ぶこと）
  function relockPointerForGame() {
    if (!started) return;
    if (typeof SURVIVAL !== 'undefined' && SURVIVAL.dead) return;
    if (document.pointerLockElement === canvas) return;
    const p = canvas.requestPointerLock && canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }
  window.__startGame = startGame;
  overlay.addEventListener('click', startGame);
  canvas.addEventListener('mousedown', e => {
    if (!started) { startGame(); return; }
    if (typeof SURVIVAL !== 'undefined' && SURVIVAL.dead) return;
    if (isContainerOpen()) return;
    // ポインタロックが外れたままなら、このクリックはロック復帰に使う（誤って掘らない）
    if (document.pointerLockElement !== canvas) { relockPointerForGame(); return; }
    if (e.button === 0) {
      mouseHeld.left = true;
      if (typeof tryMeleeAttack === 'function') tryMeleeAttack();
    } else if (e.button === 2) {
      interactOrPlace();
    }
  });
  addEventListener('mouseup', e => { if (e.button === 0) mouseHeld.left = false; });
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('mousemove', e => {
    // ポインタロック中だけ視点を回す（ロックが外れてカーソルが見えている間は回さない）
    if (!started || isContainerOpen() || document.pointerLockElement !== canvas) return;
    // フレームが詰まるとブラウザがマウス移動をまとめて巨大なmovementXとして返し視点が吹っ飛ぶ。1イベントの移動量を制限する。
    const mx = Math.max(-120, Math.min(120, e.movementX)), my = Math.max(-120, Math.min(120, e.movementY));
    yaw -= mx * 0.0022 * GAME_SETTINGS.mouseSensitivity; pitch -= my * 0.0022 * GAME_SETTINGS.mouseSensitivity;
    const lim = Math.PI / 2 - 0.01; pitch = Math.max(-lim, Math.min(lim, pitch));
  });
  document.addEventListener('pointerlockchange', () => {
    if (uiPointerUnlock) { uiPointerUnlock = false; return; }
    if (started && document.pointerLockElement !== canvas && !isContainerOpen()) pause();
  });
  addEventListener('keydown', e => {
    // コンテナ（インベントリ/作業台/かまど/チェスト）を開いている間
    if (isContainerOpen()) {
      if (e.code === 'KeyQ' && typeof dropInventoryItem === 'function') {
        dropInventoryItem(e.ctrlKey || e.metaKey);
        e.preventDefault();
        return;
      }
      if (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyE') closeContainer();
      e.preventDefault();
      return;
    }
    if (typeof isTravelerPanelOpen === 'function' && isTravelerPanelOpen()) {
      if (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyE') setTravelerPanelOpen(false);
      e.preventDefault();
      return;
    }
    keys[e.code] = true;
    if (e.code === 'Escape') pause();
    if (e.code === 'F3') { toggleDebugFly(); e.preventDefault(); }
    if (e.code === 'F4') { teleportToNearbyCave(); e.preventDefault(); }
    if (e.code === 'F6') { teleportToNearbyDungeon(); e.preventDefault(); }
    if (e.code === 'F7') { teleportToNearbyVillage(); e.preventDefault(); }
    if (e.code === 'F8') { teleportToNearbyMineshaft(); e.preventDefault(); }
    if (e.code === 'F9') { teleportToNearbyLake(); e.preventDefault(); }
    if (e.code === 'F10') { teleportToNearbyCanyon(); e.preventDefault(); }
    if (e.code === 'F11') { teleportToFuji(); e.preventDefault(); }
    if (e.code === 'Digit0' && DEBUG.fly) { teleportToNearbyJapanese(); e.preventDefault(); }
    if (e.code === 'Comma') { updateSettingsPanel(); setSettingsPanelOpen(!settingsPanel.classList.contains('show')); e.preventDefault(); }
    // 数字キー 1-9 はホットバー選択
    if (started && /^Digit[1-9]$/.test(e.code)) {
      selectSlot(+e.code.slice(5) - 1);
      e.preventDefault();
      return;
    }
    // インベントリ開閉
    if (started && (e.code === 'Tab' || (e.code === 'KeyE' && !(typeof RAVE !== 'undefined' && RAVE.on)))) {
      toggleInventoryScreen();
      e.preventDefault();
      return;
    }
    if (started && e.code === 'KeyQ' && (e.ctrlKey || e.metaKey || !(typeof RAVE !== 'undefined' && RAVE.on))) {
      dropSelectedItem(e.ctrlKey || e.metaKey);
      e.preventDefault();
      return;
    }
    const venueKey = RAVE_KEY_BINDINGS.find(v => v.code === e.code);
    if (venueKey) { raveToggle(venueKey.kind); e.preventDefault(); }
    const danceKey = PLAYER_DANCE_KEYS.find(v => v.code === e.code);
    if (danceKey) { triggerPlayerDance(danceKey); e.preventDefault(); }
    if (typeof RAVE !== 'undefined' && RAVE.on) {
      const djKey = DJ_KEYS.find(v => v.code === e.code);
      if (djKey) { djKey.fn(); e.preventDefault(); }
    }
    if (e.code === 'KeyN') { toggleThirdPerson(); e.preventDefault(); }
    if (e.code === 'KeyM') { setRaveMuted(!RAVE.muted); e.preventDefault(); } // 全体ミュート切替
    if (e.code === 'KeyG') { // 確認用：天候を手動で切替（快晴→晴れ→曇り→雨）。屋外のみ（会場中は天候停止）
      const order = ['clear', 'fair', 'cloudy', 'rain'];
      weatherState = order[(order.indexOf(weatherState) + 1) % order.length];
      weatherLabel = WEATHER[weatherState].label; setWeatherVals(wTgt, WEATHER[weatherState]);
      weatherClock = 0; weatherNext = rnd(35, 85); e.preventDefault();
    }
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('wheel', e => { if (started && !isContainerOpen()) selectSlot((selected + (e.deltaY > 0 ? 1 : -1) + HOTBAR_SIZE) % HOTBAR_SIZE); }, { passive: true });
