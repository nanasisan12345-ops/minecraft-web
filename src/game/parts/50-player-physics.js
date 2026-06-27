  /* ============== プレイヤー & 物理 ============== */
  // 音楽会場のテストをしやすいよう、原点周辺は木や草花のない平地にして固定スポーンする。
  const spawnPt = { x: 0, z: 0 };
  const spawnX = spawnPt.x + 0.5, spawnZ = spawnPt.z + 0.5;
  const spawnY = heightAt(spawnPt.x, spawnPt.z) + 3;
  const player = { pos: new THREE.Vector3(spawnX, spawnY, spawnZ), vel: new THREE.Vector3(), onGround: false };
  let yaw = 0, pitch = 0;
  const EYE = 1.6, HALF = 0.3, TOP_H = 0.2;
  const WALK = 4.6, SPRINT = 6.3, GRAVITY = 30, JUMP = 9, REACH = 6;

  function bodyCollides(px, py, pz) {
    const x0 = Math.floor(px - HALF), x1 = Math.floor(px + HALF);
    const y0 = Math.floor(py - EYE), y1 = Math.floor(py + TOP_H);
    const z0 = Math.floor(pz - HALF), z1 = Math.floor(pz + HALF);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (isSolid(x, y, z)) return true;
    return false;
  }
  function moveAxis(axis, d) {
    if (d === 0) return false;
    const old = player.pos[axis]; player.pos[axis] += d;
    if (bodyCollides(player.pos.x, player.pos.y, player.pos.z)) {
      player.pos[axis] = old;
      if (axis !== 'y' && player.onGround) {
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
  function overlapsPlayer(x, y, z) {
    const p = player.pos;
    return (x + 1 > p.x - HALF && x < p.x + HALF && z + 1 > p.z - HALF && z < p.z + HALF && y + 1 > p.y - EYE && y < p.y + TOP_H);
  }
