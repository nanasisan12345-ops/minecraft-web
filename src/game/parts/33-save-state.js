  /* ============== 統合セーブ（サバイバル状態を1キーに集約） ==============
   * プレイヤー/インベントリ/かまど/チェスト/ベッド/進捗/取引回数をまとめて保存する。
   * ブロック編集(edits)は既存の mc_edits_ キーのまま（データが大きく更新頻度も違うため分離）。
   * 保存先は localStorage だが、SAVE 全体が1つの直列化可能オブジェクトなので、
   * 将来 IndexedDB に移す場合もこの getItem/setItem 2箇所を差し替えるだけでよい。 */
  const SAVE_STORAGE_KEY = `mc_save_${WORLD_SEED}`;
  const SAVE = {
    v: 1,
    player: null,        // {x,y,z,yaw,pitch,hp,hunger}
    time: null,          // DAY.time (0..1)
    inv: null,           // 36スロット [{id,n,dur}|null]
    armor: null,         // 防具スロット {id,n,dur}|null
    drops: [],           // 地面に落ちているアイテム [{x,y,z,id,n,dur,life}]
    selected: 0,         // ホットバー選択
    spawn: null,         // ベッドで設定したリスポーン地点 {x,y,z}
    furnaces: {},        // "x,y,z" -> {in,fuel,out,prog,fuelLeft,fuelMax}
    chests: {},          // "x,y,z" -> 27スロット配列
    chestSeen: {},       // 生成チェストのロット抽選済みフラグ "x,y,z" -> 1
    crops: {},           // 成長中の作物 "x,y,z" -> 経過秒
    saplings: {},        // 成長中の苗木 "x,y,z" -> 経過秒
    trades: {},          // 取引ID -> 回数
    progress: [],        // 達成済み進捗ID
    stats: { kills: 0, nights: 0 },
  };
  function loadSaveState() {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;
      for (const k of Object.keys(SAVE)) if (data[k] !== undefined) SAVE[k] = data[k];
      if (!SAVE.stats || typeof SAVE.stats !== 'object') SAVE.stats = { kills: 0, nights: 0 };
      if (!Array.isArray(SAVE.progress)) SAVE.progress = [];
      for (const k of ['furnaces', 'chests', 'chestSeen', 'trades', 'crops', 'saplings']) if (!SAVE[k] || typeof SAVE[k] !== 'object') SAVE[k] = {};
    } catch (e) {}
  }
  function writeSaveNow() {
    if (typeof collectSaveState === 'function') collectSaveState(); // プレイヤー位置/時間などの動的値を回収
    try { localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(SAVE)); } catch (e) {}
  }
  // 変更のたびに呼ぶ（少し遅延させて書き込みをまとめる）
  function markSaveDirty() {
    clearTimeout(markSaveDirty.t);
    markSaveDirty.t = setTimeout(writeSaveNow, 350);
  }
  let autosaveClock = 0;
  function updateAutosave(dt) {
    autosaveClock += dt;
    if (autosaveClock >= 10) { autosaveClock = 0; writeSaveNow(); }
  }
  addEventListener('beforeunload', writeSaveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) writeSaveNow(); });
  loadSaveState();
