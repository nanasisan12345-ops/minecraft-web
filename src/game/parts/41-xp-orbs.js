  /* ============== XP（経験値オーブとレベル） ==============
   * オーブは 41-item-drops.js のドロップ実体を雛形にした別リスト。吸引半径2.4/取得1.1も同じ。
   * このゲームはキープインベントリ方針なので、死亡してもXPは失わない（2026-07-12 ユーザー決定）。 */
  const XP = { level: 0, points: 0 };
  const XP_ORBS = [];
  const XP_ORB_MAX = 80;
  // 本家式の必要XP: Lv0-15: 2L+7 / Lv16-30: 5L-38 / Lv31+: 9L-158
  function xpToNext(level) {
    if (level <= 15) return 2 * level + 7;
    if (level <= 30) return 5 * level - 38;
    return 9 * level - 158;
  }
  if (SAVE.xp && Number.isFinite(SAVE.xp.level)) {
    XP.level = Math.max(0, SAVE.xp.level | 0);
    XP.points = Math.max(0, SAVE.xp.points || 0);
  }
  function collectXpForSave() { SAVE.xp = { level: XP.level, points: XP.points }; }

  const xpHud = document.createElement('div');
  xpHud.id = 'xpHud';
  xpHud.innerHTML = '<div class="xpbar"><i></i></div><span class="xplv"></span>';
  document.body.appendChild(xpHud);
  const xpBarFill = xpHud.querySelector('.xpbar i');
  const xpLevelText = xpHud.querySelector('.xplv');
  function updateXpHud() {
    const need = xpToNext(XP.level);
    xpBarFill.style.width = `${Math.max(0, Math.min(1, XP.points / need)) * 100}%`;
    xpLevelText.textContent = XP.level > 0 ? String(XP.level) : '';
  }
  // started は 54-input.js の let なのでこの時点では参照できない（TDZ）。
  // 初期は隠しておき、表示切替は updateXpOrbs から行う
  xpHud.classList.add('hidden');
  let xpHudShown = false;
  updateXpHud();

  // 端数XP（精錬など）は内部に溜めて、整数になったぶんだけオーブにする
  let xpFraction = 0;
  function addXpPoints(n) {
    if (!(n > 0)) return;
    XP.points += n;
    let leveled = false;
    while (XP.points >= xpToNext(XP.level)) {
      XP.points -= xpToNext(XP.level);
      XP.level += 1;
      leveled = true;
    }
    if (leveled) {
      thock(880);
      if (typeof progressEvent === 'function') progressEvent('xp_level', XP.level);
    }
    markSaveDirty();
    updateXpHud();
  }

  const xpOrbGeo = new THREE.SphereGeometry(0.11, 8, 6);
  const xpOrbMat = new THREE.MeshBasicMaterial({ color: 0x9cf03a, transparent: true, opacity: 0.95 });
  // value を 1/3/7 のオーブに分割する（本家も大きい値はまとめて出る）
  function spawnXpOrb(x, y, z, value) {
    value = Math.floor(value);
    if (value <= 0) return;
    for (const step of [7, 3, 1]) {
      while (value >= step) {
        value -= step;
        if (XP_ORBS.length >= XP_ORB_MAX) { const old = XP_ORBS.shift(); scene.remove(old.mesh); }
        const mesh = new THREE.Mesh(xpOrbGeo, xpOrbMat);
        mesh.position.set(x + 0.5 + rnd(-0.2, 0.2), y + 0.5, z + 0.5 + rnd(-0.2, 0.2));
        scene.add(mesh);
        XP_ORBS.push({
          mesh, value: step, life: 120, pickupDelay: 0.35,
          vx: rnd(-1.1, 1.1), vy: rnd(1.8, 3.2), vz: rnd(-1.1, 1.1),
          bob: Math.random() * Math.PI * 2,
        });
      }
    }
  }
  // 小数のXP（精錬0.7など）を蓄積し、1以上になったぶんをオーブ化する
  function spawnXpFraction(x, y, z, amount) {
    xpFraction += amount;
    const whole = Math.floor(xpFraction);
    if (whole <= 0) return;
    xpFraction -= whole;
    spawnXpOrb(x, y, z, whole);
  }

  function updateXpOrbs(dt) {
    if (xpHudShown !== started) { xpHudShown = started; xpHud.classList.toggle('hidden', !started); }
    const px = player.pos.x, py = player.pos.y - 0.6, pz = player.pos.z;
    for (let i = XP_ORBS.length - 1; i >= 0; i--) {
      const o = XP_ORBS[i];
      o.life -= dt;
      o.pickupDelay = Math.max(0, o.pickupDelay - dt);
      if (o.life <= 0) { scene.remove(o.mesh); XP_ORBS.splice(i, 1); continue; }
      const p = o.mesh.position;
      const dx = px - p.x, dy = py - p.y, dz = pz - p.z;
      const dist = Math.hypot(dx, dy, dz);
      if (o.pickupDelay <= 0 && dist < 1.1 && !SURVIVAL.dead) {
        addXpPoints(o.value);
        thock(1180);
        scene.remove(o.mesh);
        XP_ORBS.splice(i, 1);
        continue;
      }
      if (o.pickupDelay <= 0 && dist < 2.4 && !SURVIVAL.dead) {
        // プレイヤーへ吸い寄せられる
        const k = 9.0 * dt / Math.max(0.4, dist);
        o.vx += dx * k; o.vy += dy * k; o.vz += dz * k;
        o.vx *= 0.86; o.vy *= 0.86; o.vz *= 0.86;
      } else {
        o.vy -= 16 * dt;
        o.vx *= 0.92; o.vz *= 0.92;
      }
      p.x += o.vx * dt; p.y += o.vy * dt; p.z += o.vz * dt;
      const gy = dropGroundY(p.x, p.y + 0.3, p.z);
      if (gy != null && p.y < gy + 0.12 && o.vy <= 0) {
        p.y = gy + 0.12;
        o.vy = 0; o.vx *= 0.7; o.vz *= 0.7;
      }
      o.bob += dt * 3.4;
      o.mesh.scale.setScalar(1 + Math.sin(o.bob) * 0.12);
    }
  }
  function clearXpOrbs() {
    for (const o of XP_ORBS) scene.remove(o.mesh);
    XP_ORBS.length = 0;
  }
