  /* ============== ドロップアイテム（地面に落ちて、近づくと吸い寄せられて拾える） ==============
   * ブロック破壊やMOB討伐のドロップはインベントリ直行ではなく、この実体として世界に出る。
   * ブロック系はミニキューブ、素材/道具はアイコンのスプライトで表示する。 */
  const ITEM_DROPS = [];
  const ITEM_DROP_MAX = 90;
  const dropGeoCache = new THREE.BoxGeometry(0.26, 0.26, 0.26);
  const dropSpriteCache = new Map();
  function dropVisualFor(id) {
    const def = ITEM_DEFS[id];
    if (def && def.block != null && TYPES[def.block]) {
      return new THREE.Mesh(dropGeoCache, TYPES[def.block].mats);
    }
    let mat = dropSpriteCache.get(id);
    if (!mat) {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      drawItemIcon(c.getContext('2d'), 32, id, def || {});
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      dropSpriteCache.set(id, mat);
    }
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(0.4);
    return s;
  }
  function spawnItemDrop(x, y, z, id, n = 1, dur, life = 90) {
    if (!ITEM_DEFS[id] || n <= 0) return;
    if (ITEM_DROPS.length >= ITEM_DROP_MAX) {
      const old = ITEM_DROPS.shift();
      scene.remove(old.mesh);
    }
    const mesh = dropVisualFor(id);
    mesh.position.set(x + 0.5 + rnd(-0.15, 0.15), y + 0.45, z + 0.5 + rnd(-0.15, 0.15));
    scene.add(mesh);
    ITEM_DROPS.push({
      mesh, id, n, dur, life,
      vx: rnd(-1.2, 1.2), vy: rnd(2.0, 3.6), vz: rnd(-1.2, 1.2),
      grounded: false, restY: null, spin: Math.random() * Math.PI * 2,
      pickupDelay: 0.45,
    });
    return ITEM_DROPS[ITEM_DROPS.length - 1];
  }
  function spawnThrownItemDrop(id, n = 1, dur) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const d = spawnItemDrop(player.pos.x + dir.x * 0.65 - 0.5, player.pos.y - 0.95 + dir.y * 0.2, player.pos.z + dir.z * 0.65 - 0.5, id, n, dur, 300);
    if (!d) return null;
    d.vx = dir.x * 4.2 + rnd(-0.25, 0.25);
    d.vy = Math.max(0.6, 1.2 + dir.y * 3.0);
    d.vz = dir.z * 4.2 + rnd(-0.25, 0.25);
    d.pickupDelay = 1.0;
    d.grounded = false;
    return d;
  }
  function dropSelectedItem(fullStack = false) {
    if (!started || SURVIVAL.dead) return false;
    const s = selectedItem();
    if (!s) { thock(80); return false; }
    const amount = fullStack ? s.n : 1;
    if (!spawnThrownItemDrop(s.id, amount, s.dur)) return false;
    s.n -= amount;
    if (s.n <= 0) INV[selected] = null;
    invChanged();
    thock(150);
    if (typeof setDebugToast === 'function') setDebugToast(`${ITEM_DEFS[s.id].name} を捨てた`, 0.9);
    return true;
  }
  // 落下地点の地面の高さ（ブロック上面）を探す
  function dropGroundY(x, y, z) {
    const fx = Math.floor(x), fz = Math.floor(z);
    for (let by = Math.floor(y); by >= Math.max(CHUNK_Y_MIN, Math.floor(y) - 6); by--) {
      if (isSolid(fx, by, fz)) return by + 1;
    }
    return null;
  }
  // リロード後に前回の落ちものを復元する（82のループ開始前に一度呼ぶ）
  function loadSavedDrops() {
    if (!Array.isArray(SAVE.drops)) { SAVE.drops = []; return; }
    for (const d of SAVE.drops) {
      if (d && ITEM_DEFS[d.id]) spawnItemDrop(d.x, d.y, d.z, d.id, d.n, d.dur, d.life || 60);
    }
    SAVE.drops = [];
  }
  function collectDropsForSave() {
    SAVE.drops = ITEM_DROPS.map(d => ({
      x: Math.floor(d.mesh.position.x), y: Math.floor(d.mesh.position.y), z: Math.floor(d.mesh.position.z),
      id: d.id, n: d.n, dur: d.dur, life: Math.ceil(d.life),
    }));
  }
  function updateItemDrops(dt) {
    for (let i = ITEM_DROPS.length - 1; i >= 0; i--) {
      const d = ITEM_DROPS[i];
      d.life -= dt;
      d.pickupDelay = Math.max(0, d.pickupDelay - dt);
      if (d.life <= 0) { scene.remove(d.mesh); ITEM_DROPS.splice(i, 1); continue; }
      const p = d.mesh.position;
      // 液体の流れに押される＋水には浮く（C8）
      const lbx = Math.floor(p.x), lby = Math.floor(p.y), lbz = Math.floor(p.z);
      if (typeof liquidFlowVector === 'function') {
        const fv = liquidFlowVector(lbx, lby, lbz);
        if (fv) { p.x += fv.x * 1.4 * dt; p.z += fv.z * 1.4 * dt; }
      }
      const inWater = blockAt(lbx, lby, lbz) === WATER;
      if (!d.grounded) {
        if (inWater) d.vy = Math.min(d.vy + 40 * dt, 0.9); // 浮力: 水面までゆっくり浮上
        else d.vy -= 16 * dt;
        p.x += d.vx * dt; p.z += d.vz * dt;
        const ny = p.y + d.vy * dt;
        const g = dropGroundY(p.x, p.y + 0.2, p.z);
        if (d.vy < 0 && g != null && ny <= g + 0.22) {
          d.grounded = true; d.restY = g + 0.22; p.y = d.restY;
        } else {
          p.y = ny;
          if (p.y < CHUNK_Y_MIN - 10) { scene.remove(d.mesh); ITEM_DROPS.splice(i, 1); continue; }
        }
      } else {
        d.spin += dt * 1.6;
        if (d.mesh.isMesh) d.mesh.rotation.y = d.spin;
        p.y = d.restY + 0.05 + Math.sin(d.spin * 1.7) * 0.045;
        // 足元のブロックが掘られたら再び落ちる
        if (Math.random() < dt * 2) {
          const g = dropGroundY(p.x, p.y, p.z);
          if (g == null || Math.abs(g + 0.22 - d.restY) > 0.3) { d.grounded = false; d.vy = 0; }
        }
      }
      // プレイヤーへの吸い寄せと拾得
      if (d.pickupDelay <= 0 && started && !SURVIVAL.dead) {
        const cx = player.pos.x - p.x, cy = (player.pos.y - 0.9) - p.y, cz = player.pos.z - p.z;
        const dist = Math.hypot(cx, cy, cz);
        if (dist < 1.1) {
          const leftover = giveItem(d.id, d.n, d.dur);
          if (leftover <= 0) { scene.remove(d.mesh); ITEM_DROPS.splice(i, 1); continue; }
          d.n = leftover;
          d.pickupDelay = 0.8; // インベントリ満杯: 少し待って再試行
        } else if (dist < 2.4) {
          const pull = 7.5 * dt / Math.max(0.3, dist);
          p.x += cx * pull; p.y += cy * pull; p.z += cz * pull;
          d.grounded = false; d.vy = 0;
        }
      }
    }
  }
