  /* ============== プレイヤー & 物理 ============== */
  // 音楽会場のテストをしやすいよう、原点周辺は木や草花のない平地にして固定スポーンする。
  const spawnPt = { x: 0, z: 0 };
  const spawnX = spawnPt.x + 0.5, spawnZ = spawnPt.z + 0.5;
  const spawnY = heightAt(spawnPt.x, spawnPt.z) + 3;
  const player = { pos: new THREE.Vector3(spawnX, spawnY, spawnZ), vel: new THREE.Vector3(), onGround: false };
  let yaw = 0, pitch = 0;
  const EYE = 1.6, HALF = 0.3, TOP_H = 0.2;
  const WALK = 4.6, SPRINT = 6.3, GRAVITY = 30, JUMP = 9, REACH = 6;
  // 水中（C9）: 重力1/4・沈降は最大2.2/s・Spaceで浮上2.0/s・水平は歩きの50%（泳ぎダッシュで1.5倍）。
  // 水面で頭が出ている間だけ、Space で小さく跳ねられる。
  const WATER_GRAVITY = 0.25, WATER_SINK_MAX = -2.2, WATER_RISE = 2.0;
  const WATER_MOVE = 0.5, WATER_SPRINT = 1.5, WATER_HOP = 4.2;

  function blockCollisionHeight(type) {
    const def = TYPES[type];
    if (!def || def.solid === false) return 0;
    return def.collisionHeight || 1;
  }
  function blockCollisionBoxes(type) {
    const def = TYPES[type];
    if (!def || def.solid === false) return [];
    return def.collisionBoxes || [[0, 0, 0, 1, blockCollisionHeight(type), 1]];
  }
  function bodyCollides(px, py, pz) {
    const x0 = Math.floor(px - HALF), x1 = Math.floor(px + HALF);
    const y0 = Math.floor(py - EYE), y1 = Math.floor(py + TOP_H);
    const z0 = Math.floor(pz - HALF), z1 = Math.floor(pz + HALF);
    for (let x = x0; x <= x1; x++) for (let y = y0 - 1; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      for (const b of blockCollisionBoxes(blockAt(x, y, z))) {
        if (x + b[3] > px - HALF && x + b[0] < px + HALF && z + b[5] > pz - HALF && z + b[2] < pz + HALF && y + b[4] > py - EYE && y + b[1] < py + TOP_H) return true;
      }
    }
    return false;
  }
  function bodyHitsTallObstacle(px, py, pz, maxStep = 1.05) {
    const x0 = Math.floor(px - HALF), x1 = Math.floor(px + HALF);
    const y0 = Math.floor(py - EYE), y1 = Math.floor(py + TOP_H);
    const z0 = Math.floor(pz - HALF), z1 = Math.floor(pz + HALF);
    for (let x = x0; x <= x1; x++) for (let y = y0 - 1; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      for (const b of blockCollisionBoxes(blockAt(x, y, z))) {
        const h = b[4] - b[1];
        if (h > maxStep && x + b[3] > px - HALF && x + b[0] < px + HALF && z + b[5] > pz - HALF && z + b[2] < pz + HALF && y + b[4] > py - EYE && y + b[1] < py + TOP_H) return true;
      }
    }
    return false;
  }
  function moveAxis(axis, d) {
    if (d === 0) return false;
    const old = player.pos[axis]; player.pos[axis] += d;
    if (bodyCollides(player.pos.x, player.pos.y, player.pos.z)) {
      const tallObstacle = bodyHitsTallObstacle(player.pos.x, player.pos.y, player.pos.z);
      player.pos[axis] = old;
      if (axis !== 'y' && player.onGround && !tallObstacle) {
        const oldY = player.pos.y;
        player.pos.y += 1.05;
        player.pos[axis] = old + d;
        if (!bodyCollides(player.pos.x, player.pos.y, player.pos.z)) return false;
        player.pos[axis] = old;
        player.pos.y = oldY;
      }
      return true;
    }
    return false;
  }
  // プレイヤーのAABBがはしごブロックと重なっているか（重なっている間は登れる）
  function playerOnLadder() {
    if (typeof LADDER === 'undefined') return false;
    const p = player.pos;
    const x0 = Math.floor(p.x - HALF), x1 = Math.floor(p.x + HALF);
    const y0 = Math.floor(p.y - EYE), y1 = Math.floor(p.y + TOP_H);
    const z0 = Math.floor(p.z - HALF), z1 = Math.floor(p.z + HALF);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const t = blockAt(x, y, z);
      if (t !== undefined && t >= LADDER && t < LADDER + 4) return true;
    }
    return false;
  }
  // 水セルか（自然の海/川/湖の暗黙ブロックと、C8のシム水セルの両方）
  function isWaterCell(x, y, z) {
    if (blockAt(x, y, z) === WATER) return true;
    return typeof liquidTypeAt === 'function' ? liquidTypeAt(x, y, z) === WATER : false;
  }
  // 目線（=カメラ位置）が水中か。酸素・青い霧・採掘減速の判定に使う
  function playerHeadInWater() {
    const p = player.pos;
    return isWaterCell(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
  }
  // AABBのどこか（足元〜頭）が水中か。泳ぎの物理はこちらで切り替える
  function playerBodyInWater() {
    const p = player.pos;
    const x0 = Math.floor(p.x - HALF), x1 = Math.floor(p.x + HALF);
    const y0 = Math.floor(p.y - EYE), y1 = Math.floor(p.y + TOP_H);
    const z0 = Math.floor(p.z - HALF), z1 = Math.floor(p.z + HALF);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      if (isWaterCell(x, y, z)) return true;
    }
    return false;
  }
  // 水中の鉛直運動: Space で浮上（頭が出ていれば小さく跳ねる）、沈降は上限つき。
  // 沈降上限で落下速度が消えるので、着水すると落下ダメージも無効になる。
  function applyWaterPhysics(wantUp) {
    if (wantUp) player.vel.y = playerHeadInWater() ? WATER_RISE : Math.max(player.vel.y, WATER_HOP);
    if (player.vel.y < WATER_SINK_MAX) player.vel.y = WATER_SINK_MAX;
  }
  function overlapsPlayer(x, y, z, type = null) {
    const p = player.pos;
    const boxes = type == null ? [[0, 0, 0, 1, 1, 1]] : blockCollisionBoxes(type);
    for (const b of boxes) {
      if (x + b[3] > p.x - HALF && x + b[0] < p.x + HALF && z + b[5] > p.z - HALF && z + b[2] < p.z + HALF && y + b[4] > p.y - EYE && y + b[1] < p.y + TOP_H) return true;
    }
    return false;
  }
