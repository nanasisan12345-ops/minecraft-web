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
    if (DEBUG.fly) lines.push('DEBUG FLY: ON  F3解除 / F4洞窟 / F6地下遺跡 / F7村 / F8廃坑 / F9地下湖 / F10峡谷 / Space上昇 / Shift下降');
    if (DEBUG.toastClock > 0 && DEBUG.toast) lines.push(DEBUG.toast);
    debugHud.textContent = lines.join('　');
  }
