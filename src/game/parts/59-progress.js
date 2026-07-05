  /* ============== 進捗 / チュートリアル（次にやることを右上に表示） ============== */
  const PROGRESS_GOALS = [
    { id: 'get_log', label: '木を壊して丸太を手に入れる', ev: 'item', data: 'log' },
    { id: 'get_planks', label: '丸太から板材を作る（Eでインベントリ→2x2クラフト）', ev: 'item', data: 'planks' },
    { id: 'make_table', label: '板材4つで作業台を作る', ev: 'item', data: 'crafting_table' },
    { id: 'wood_pickaxe', label: '作業台で木のツルハシを作る（板材3+棒2）', ev: 'item', data: 'wood_pickaxe' },
    { id: 'get_cobble', label: 'ツルハシで石を掘って丸石を手に入れる', ev: 'item', data: 'cobblestone' },
    { id: 'stone_pickaxe', label: '石のツルハシを作る', ev: 'item', data: 'stone_pickaxe' },
    { id: 'get_coal', label: '石炭鉱石を掘って石炭を手に入れる', ev: 'item', data: 'coal' },
    { id: 'make_torch', label: '松明を作る（石炭+棒）', ev: 'item', data: 'torch' },
    { id: 'make_furnace', label: '丸石8つでかまどを作る', ev: 'item', data: 'furnace' },
    { id: 'get_raw_iron', label: '鉄鉱石を掘る（石のツルハシ以上）', ev: 'item', data: 'raw_iron' },
    { id: 'iron_ingot', label: 'かまどで粗鉄を精錬して鉄インゴットにする', ev: 'item', data: 'iron_ingot' },
    { id: 'iron_sword', label: '鉄の剣を作る（鉄2+棒1）', ev: 'item', data: 'iron_sword' },
    { id: 'survive_night', label: '夜を生き延びる', ev: 'survive_night' },
    { id: 'make_chest', label: 'チェストを作る（板材8）', ev: 'item', data: 'chest' },
    { id: 'sleep_bed', label: 'ベッドで眠る（布3+板材3で作成）', ev: 'sleep' },
    { id: 'explore_cave', label: '洞窟を深くまで探索する', ev: 'cave' },
    { id: 'get_diamond', label: 'ダイヤを見つける（鉄のツルハシ以上）', ev: 'item', data: 'diamond' },
    { id: 'find_village', label: '村を見つける', ev: 'village' },
    { id: 'do_trade', label: '村人と取引する', ev: 'trade' },
  ];
  const objectiveHud = document.createElement('div');
  objectiveHud.id = 'objectiveHud';
  document.body.appendChild(objectiveHud);
  const progressToast = document.createElement('div');
  progressToast.id = 'progressToast';
  document.body.appendChild(progressToast);
  let progressToastClock = 0;

  function progressDone(id) { return SAVE.progress.includes(id); }
  function currentGoal() { return PROGRESS_GOALS.find(g => !progressDone(g.id)) || null; }
  function updateObjectiveHud() {
    const g = currentGoal();
    const doneCount = PROGRESS_GOALS.filter(x => progressDone(x.id)).length;
    if (!g) {
      objectiveHud.innerHTML = `<small>進捗 ${doneCount}/${PROGRESS_GOALS.length}</small><b>🏆 全ての進捗を達成した！</b>`;
      return;
    }
    objectiveHud.innerHTML = `<small>目標 ${doneCount + 1}/${PROGRESS_GOALS.length}</small><b>${g.label}</b>`;
  }
  function completeGoal(g) {
    SAVE.progress.push(g.id);
    markSaveDirty();
    progressToast.innerHTML = `<b>✅ 進捗達成!</b><span>${g.label}</span>`;
    progressToast.classList.add('show');
    progressToastClock = 3.4;
    thock(520);
    updateObjectiveHud();
  }
  function progressEvent(ev, data) {
    for (const g of PROGRESS_GOALS) {
      if (progressDone(g.id) || g.ev !== ev) continue;
      if (g.ev === 'item' && g.data !== data) continue;
      completeGoal(g);
    }
  }
  // ロード時: すでに持っているアイテムぶんの進捗は静かに反映
  for (const g of PROGRESS_GOALS) {
    if (g.ev === 'item' && !progressDone(g.id) && countItem(g.data) > 0) SAVE.progress.push(g.id);
  }
  let progressWorldClock = 0;
  function updateProgress(dt) {
    if (progressToastClock > 0) {
      progressToastClock -= dt;
      if (progressToastClock <= 0) progressToast.classList.remove('show');
    }
    progressWorldClock -= dt;
    if (progressWorldClock > 0 || !started) return;
    progressWorldClock = 1.2;
    const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
    if (!progressDone('find_village') && typeof villageLabelAt === 'function' && villageLabelAt(px, pz)) progressEvent('village');
    if (!progressDone('explore_cave') && player.pos.y < heightAt(px, pz) - 12) progressEvent('cave');
  }
  updateObjectiveHud();
