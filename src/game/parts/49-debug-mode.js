  /* ============== 通常ワールド用デバッグ移動 ============== */
  const DEBUG = {
    fly: false,
    toast: '',
    toastClock: 0,
  };
  const debugHud = document.createElement('div');
  debugHud.id = 'debugHud';
  document.body.appendChild(debugHud);

  function setDebugToast(text, seconds = 2.4) {
    DEBUG.toast = text;
    DEBUG.toastClock = seconds;
    updateDebugHud();
  }

  function toggleDebugFly() {
    DEBUG.fly = !DEBUG.fly;
    player.vel.set(0, 0, 0);
    player.onGround = DEBUG.fly;
    setDebugToast(DEBUG.fly ? 'デバッグ飛行 ON' : 'デバッグ飛行 OFF');
  }

  function findNearbyCaveMouth(cx, cz) {
    const maxR = 220;
    for (let r = 24; r <= maxR; r += 8) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) {
        const x = Math.round(cx + Math.cos(a) * r);
        const z = Math.round(cz + Math.sin(a) * r);
        const h = heightAt(x, z);
        if (!caveMouthAt(x, z, h)) continue;
        return { x, y: h + 4, z };
      }
    }
    return null;
  }

  function teleportToNearbyCave() {
    const c = findNearbyCaveMouth(Math.floor(player.pos.x), Math.floor(player.pos.z));
    if (!c) {
      setDebugToast('近くに洞窟入口が見つかりません');
      return;
    }
    player.pos.set(c.x + 0.5, c.y, c.z + 0.5);
    player.vel.set(0, 0, 0);
    player.onGround = false;
    regenWindow(Math.floor(player.pos.x), Math.floor(player.pos.z));
    setDebugToast(`洞窟入口へ移動: ${c.x}, ${c.z}`);
  }

  function teleportToNearbyDungeon() {
    const found = nearestDungeon(Math.floor(player.pos.x), Math.floor(player.pos.z));
    if (!found) {
      setDebugToast('近くに地下遺跡が見つかりません');
      return;
    }
    const p = found.plan;
    player.pos.set(p.x + 0.5, p.floorY + 2, p.z + 0.5);
    player.vel.set(0, 0, 0);
    player.onGround = false;
    regenWindow(Math.floor(player.pos.x), Math.floor(player.pos.z));
    setDebugToast(`地下遺跡へ移動: ${p.x}, ${p.z}`);
  }

  function teleportToNearbyVillage() {
    const found = nearestVillage(Math.floor(player.pos.x), Math.floor(player.pos.z));
    if (!found) {
      setDebugToast('近くに村が見つかりません');
      return;
    }
    const p = found.plan;
    player.pos.set(p.x + 0.5, p.base + 3, p.z + 0.5);
    player.vel.set(0, 0, 0);
    player.onGround = false;
    regenWindow(Math.floor(player.pos.x), Math.floor(player.pos.z));
    setDebugToast(`村へ移動: ${p.x}, ${p.z}`);
  }

  function teleportToNearbyMineshaft() {
    const found = nearestMineshaft(Math.floor(player.pos.x), Math.floor(player.pos.z));
    if (!found) { setDebugToast('近くに廃坑が見つかりません'); return; }
    const p = found.plan;
    player.pos.set(p.x + 0.5, p.floorY + 2, p.z + 0.5);
    player.vel.set(0, 0, 0); player.onGround = false;
    regenWindow(Math.floor(player.pos.x), Math.floor(player.pos.z));
    setDebugToast(`廃坑へ移動: ${p.x}, ${p.z}`);
  }

  function findNearbyCanyon(cx, cz) {
    const maxR = 340;
    for (let r = 32; r <= maxR; r += 8) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) {
        const x = Math.round(cx + Math.cos(a) * r);
        const z = Math.round(cz + Math.sin(a) * r);
        const h = heightAt(x, z);
        if (h < SEA + 9 || !canyonAt(x, z)) continue;
        // 近くの縁（峡谷でない列）に立たせて見下ろせるようにする
        for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3]]) {
          if (!canyonAt(x + dx, z + dz)) return { x: x + dx, y: heightAt(x + dx, z + dz) + 2, z: z + dz };
        }
        return { x, y: h + 8, z };
      }
    }
    return null;
  }

  function teleportToNearbyCanyon() {
    const c = findNearbyCanyon(Math.floor(player.pos.x), Math.floor(player.pos.z));
    if (!c) { setDebugToast('近くに峡谷が見つかりません'); return; }
    player.pos.set(c.x + 0.5, c.y, c.z + 0.5);
    player.vel.set(0, 0, 0); player.onGround = false;
    regenWindow(Math.floor(player.pos.x), Math.floor(player.pos.z));
    setDebugToast(`峡谷へ移動: ${c.x}, ${c.z}`);
  }

  function teleportToFuji() {
    const f = fujiCenter();
    const x = f.x, z = f.z, y = heightAt(x, z) + 3;
    player.pos.set(x + 0.5, y, z + 0.5);
    player.vel.set(0, 0, 0); player.onGround = false;
    if (!DEBUG.fly) DEBUG.fly = true;   // 山頂は宙に浮くので飛行ONにする
    regenWindow(Math.floor(player.pos.x), Math.floor(player.pos.z));
    setDebugToast(`富士山頂へ移動: ${x}, ${z}`);
  }

  const JP_ORDER = ['torii', 'waterTorii', 'pagoda', 'teahouse', 'castle', 'daibutsu', 'riceTerrace', 'tokyoTower', 'lighthouse', 'bell', 'well', 'inari', 'jinja', 'graveyard'];
  const JP_LABEL = { torii: '鳥居', waterTorii: '水上鳥居', pagoda: '五重塔', teahouse: '茶屋', castle: '天守閣', daibutsu: '大仏', riceTerrace: '棚田', tokyoTower: '東京タワー風タワー', lighthouse: '灯台', bell: '鐘楼', well: '屋根付き井戸', inari: '稲荷神社', jinja: '神社', graveyard: '墓地' };
  let jpCycleIdx = 0;
  // 0キーを押すたびに和風ランドマークの種類を切り替えて最寄りへ飛ぶ。
  function teleportToNearbyJapanese() {
    const type = JP_ORDER[jpCycleIdx % JP_ORDER.length];
    jpCycleIdx++;
    const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
    const c0x = Math.floor(px / STRUCT_CELL), c0z = Math.floor(pz / STRUCT_CELL);
    let best = null, bestD = Infinity;
    for (let r = 0; r <= 40 && !best; r++) {              // レアな建物用に広めに探索
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; // リング状に外へ
        const p = structurePlanForCell(c0x + dx, c0z + dz);
        if (!p || p.type !== type) continue;
        const b = structureBase(p); if (b == null) continue;      // 実際に建つ場所だけ
        const d = Math.hypot(p.x - px, p.z - pz);
        if (d < bestD) { bestD = d; best = { p, b }; }
      }
    }
    if (!best) { setDebugToast(`近くに${JP_LABEL[type]}が見つかりません（0でさらに次へ）`); return; }
    const { p, b } = best;
    if (type === 'daibutsu') {
      // 座像の全身が入るよう、正面へ下がって少し見上げる
      player.pos.set(p.x + 0.5, b + 10, p.z - Math.floor(p.d / 2) - 16 + 0.5);
      yaw = Math.PI;
      pitch = -0.22;
    } else {
      const flyY = type === 'tokyoTower' ? b + 32 : b + 6;
      player.pos.set(p.x + 0.5, flyY, p.z + 0.5);
    }
    player.vel.set(0, 0, 0); player.onGround = false;
    if (!DEBUG.fly) DEBUG.fly = true;
    regenWindow(Math.floor(player.pos.x), Math.floor(player.pos.z));
    setDebugToast(`${JP_LABEL[type]}へ移動: ${p.x}, ${p.z}`);
  }

  function teleportToNearbyLake() {
    const found = nearestLake(Math.floor(player.pos.x), Math.floor(player.pos.z));
    if (!found) { setDebugToast('近くに地下湖が見つかりません'); return; }
    const p = found.plan;
    player.pos.set(p.x + 0.5, p.midY + p.rV + 2, p.z + 0.5);
    player.vel.set(0, 0, 0); player.onGround = false;
    regenWindow(Math.floor(player.pos.x), Math.floor(player.pos.z));
    setDebugToast(`地下湖へ移動: ${p.x}, ${p.z}`);
  }

  function updateDebugHud(dt = 0) {
    if (dt) DEBUG.toastClock = Math.max(0, DEBUG.toastClock - dt);
    const show = DEBUG.fly || DEBUG.toastClock > 0;
    debugHud.classList.toggle('show', show);
    if (!show) return;
    const lines = [];
    if (DEBUG.fly) lines.push('DEBUG FLY: ON  F3解除 / F4洞窟 / F6地下遺跡 / F7村 / F8廃坑 / F9地下湖 / F10峡谷 / F11富士山 / 0和風建築(順送り) / Space上昇 / Shift下降');
    if (DEBUG.toastClock > 0 && DEBUG.toast) lines.push(DEBUG.toast);
    debugHud.textContent = lines.join('　');
  }
