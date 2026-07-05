  /* ============== 敵MOB（ゾンビ / スライム / スケルトン）と戦闘 ==============
   * - 夜の地上と、暗い地下（洞窟）にスポーンする。松明などの明かりの近くには湧かない。
   * - 左クリックで攻撃（武器でダメージ変化・クールダウン・ノックバックあり）。
   * - ゾンビは昼の日なたで燃える。スケルトンは矢を放つ。ドロップあり。 */
  const MOBS = [];
  const MOB_SURFACE_MAX = 20, MOB_CAVE_MAX = 10;
  const MOB_SPAWN_MIN_R = 16, MOB_SPAWN_MAX_R = 46, MOB_DESPAWN_R = 80;
  const MOB_DEFS = {
    zombie: { name: 'ゾンビ', hp: 20, speed: 1.85, damage: 3, attackRange: 1.5, attackCd: 1.25, drops: [['rotten_flesh', 0, 2]] },
    slime: { name: 'スライム', hp: 8, speed: 1.5, damage: 2, attackRange: 1.15, attackCd: 1.0, drops: [['slime_ball', 1, 2]] },
    skeleton: { name: 'スケルトン', hp: 16, speed: 1.6, damage: 3, attackRange: 17, attackCd: 2.4, drops: [['bone', 1, 2], ['coal', 0, 1]] },
  };
  const mobMatCache = new Map();
  function mobMat(color) {
    if (!mobMatCache.has(color)) mobMatCache.set(color, new THREE.MeshLambertMaterial({ color }));
    return mobMatCache.get(color);
  }
  function mobBox(parent, sx, sy, sz, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mobMat(color));
    m.castShadow = false; m.receiveShadow = true; m.position.set(x, y, z); parent.add(m);
    return m;
  }
  function makeZombie() {
    const g = new THREE.Group();
    mobBox(g, 0.5, 0.72, 0.28, 0x3f7a3c, 0, 0.92, 0);                 // 胴（ボロシャツ）
    mobBox(g, 0.5, 0.2, 0.3, 0x2c5c8a, 0, 0.42, 0);                   // ズボン上
    const head = mobBox(g, 0.44, 0.44, 0.44, 0x57a052, 0, 1.5, 0);    // 緑の頭
    mobBox(head, 0.06, 0.06, 0.02, 0x1a1a1a, -0.1, 0.05, -0.23);
    mobBox(head, 0.06, 0.06, 0.02, 0x1a1a1a, 0.1, 0.05, -0.23);
    mobBox(head, 0.16, 0.04, 0.02, 0x2c3a28, 0, -0.1, -0.23);
    const armL = mobBox(g, 0.14, 0.6, 0.16, 0x57a052, -0.34, 1.1, -0.18);
    const armR = mobBox(g, 0.14, 0.6, 0.16, 0x57a052, 0.34, 1.1, -0.18);
    armL.rotation.x = armR.rotation.x = -1.35;                        // 前ならえのゾンビ腕
    const legL = mobBox(g, 0.16, 0.42, 0.18, 0x2c5c8a, -0.13, 0.21, 0);
    const legR = mobBox(g, 0.16, 0.42, 0.18, 0x2c5c8a, 0.13, 0.21, 0);
    g.userData.limbs = { legL, legR };
    return g;
  }
  function makeSlime() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.66, 0.82), new THREE.MeshLambertMaterial({ color: 0x4ca044, transparent: true, opacity: 0.85 }));
    body.position.y = 0.38; g.add(body);
    mobBox(g, 0.09, 0.09, 0.03, 0x101510, -0.16, 0.5, -0.42);
    mobBox(g, 0.09, 0.09, 0.03, 0x101510, 0.16, 0.5, -0.42);
    mobBox(g, 0.12, 0.05, 0.03, 0x1c3318, 0, 0.32, -0.42);
    g.userData.body = body;
    return g;
  }
  function makeSkeleton() {
    const g = new THREE.Group();
    mobBox(g, 0.42, 0.66, 0.2, 0xd9d4c4, 0, 0.95, 0);                  // 肋骨っぽい胴
    mobBox(g, 0.46, 0.06, 0.24, 0xb8b2a0, 0, 0.78, 0);
    mobBox(g, 0.46, 0.06, 0.24, 0xb8b2a0, 0, 0.95, 0);
    const head = mobBox(g, 0.42, 0.42, 0.42, 0xe8e4d6, 0, 1.5, 0);
    mobBox(head, 0.08, 0.08, 0.02, 0x141414, -0.1, 0.04, -0.22);
    mobBox(head, 0.08, 0.08, 0.02, 0x141414, 0.1, 0.04, -0.22);
    mobBox(head, 0.14, 0.05, 0.02, 0x3a362c, 0, -0.11, -0.22);
    const armL = mobBox(g, 0.11, 0.56, 0.12, 0xd9d4c4, -0.3, 1.12, -0.1);
    const armR = mobBox(g, 0.11, 0.56, 0.12, 0xd9d4c4, 0.3, 1.12, -0.1);
    armL.rotation.x = armR.rotation.x = -0.9;
    mobBox(g, 0.05, 0.7, 0.05, 0x6d4c1b, -0.3, 1.2, -0.42);            // 弓
    const legL = mobBox(g, 0.12, 0.44, 0.12, 0xd9d4c4, -0.12, 0.22, 0);
    const legR = mobBox(g, 0.12, 0.44, 0.12, 0xd9d4c4, 0.12, 0.22, 0);
    g.userData.limbs = { legL, legR };
    return g;
  }
  const MOB_MAKERS = { zombie: makeZombie, slime: makeSlime, skeleton: makeSkeleton };

  /* --- 地形ヘルパー --- */
  // refY 付近で立てる地面の高さを探す（見つからなければ null）
  function mobGroundY(x, z, refY) {
    for (let y = Math.min(CHUNK_Y_MAX, Math.ceil(refY) + 2); y >= Math.max(CHUNK_Y_MIN, Math.floor(refY) - 4); y--) {
      if (isSolid(x, y, z) && !isSolid(x, y + 1, z) && !isSolid(x, y + 2, z)) return y;
    }
    return null;
  }
  // 頭上がブロックで塞がっているか（=空が見えない暗い場所か）。
  // heightAt は峡谷や洞窟のくり抜きを反映しないため、実ブロックを上へ走査して判定する。
  function isCoveredFromSky(x, y, z) {
    const top = Math.min(CHUNK_Y_MAX, y + 48);
    for (let yy = y + 1; yy <= top; yy++) if (isSolid(x, yy, z)) return true;
    return false;
  }

  /* --- スポーン --- */
  let mobSpawnClock = 4;
  function mobCounts() {
    let surface = 0, cave = 0;
    for (const m of MOBS) (m.userData.cave ? cave++ : surface++);
    return { surface, cave };
  }
  function spawnMobAt(kind, x, y, z, cave) {
    const g = MOB_MAKERS[kind]();
    const def = MOB_DEFS[kind];
    g.position.set(x + 0.5, y + 1, z + 0.5);
    const u = g.userData;
    u.kind = kind;
    u.hp = def.hp;
    u.maxHp = def.hp;
    u.cave = !!cave;
    u.attackCd = 0;
    u.phase = Math.random() * Math.PI * 2;
    u.kb = null;         // ノックバック {x,z,t}
    u.burn = 0;
    u.hurtT = 0;
    scene.add(g);
    MOBS.push(g);
  }
  function canSpawnSurfaceMobAt(x, z) {
    if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 8)) return false;
    const h = heightAt(x, z), top = topTypeAt(x, z, h);
    if (top === WATER || typeof waterFeatureAt === 'function' && waterFeatureAt(x, z, h)) return false;
    if (hasBlock(x, h + 1, z) || hasBlock(x, h + 2, z)) return false;
    if (nearPlacedLight(x, h + 1, z, 8)) return false;
    return true;
  }
  function trySpawnMobs() {
    if (!started || SURVIVAL.dead || (typeof RAVE !== 'undefined' && RAVE.on)) return;
    const counts = mobCounts();
    const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
    const surfaceH = heightAt(px, pz);
    const underground = py < surfaceH - 6;
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2, r = rnd(MOB_SPAWN_MIN_R + 2, MOB_SPAWN_MAX_R);
      const x = Math.floor(player.pos.x + Math.cos(a) * r), z = Math.floor(player.pos.z + Math.sin(a) * r);
      if (Math.hypot(x - player.pos.x, z - player.pos.z) < MOB_SPAWN_MIN_R) continue;
      if (underground && counts.cave < MOB_CAVE_MAX && Math.random() < 0.7) {
        // 洞窟スポーン: プレイヤーの高さ付近の空洞を探す。
        // 「地形高さより深い」だけでなく「頭上が塞がって空が見えない」ことも必須。
        // これで峡谷の底や谷底のような、昼間は明るい窪地には湧かない。
        const gy = mobGroundY(x, z, py + rnd(-6, 6));
        if (gy == null || gy >= heightAt(x, z) - 6) continue;
        if (!isCoveredFromSky(x, gy + 2, z)) continue;
        if (nearPlacedLight(x, gy + 1, z, 8)) continue;
        const roll = Math.random();
        spawnMobAt(roll < 0.45 ? 'slime' : roll < 0.75 ? 'skeleton' : 'zombie', x, gy, z, true);
        counts.cave++;
        continue;
      }
      // 地上スポーン: 夜のみ
      if (DAY.label !== '夜' || counts.surface >= MOB_SURFACE_MAX) continue;
      if (!canSpawnSurfaceMobAt(x, z)) continue;
      const h = heightAt(x, z);
      const swamp = typeof biomeAt === 'function' && biomeAt(x, z).id === 'swamp';
      const roll = Math.random();
      const kind = swamp && roll < 0.5 ? 'slime' : roll < 0.6 ? 'zombie' : roll < 0.85 ? 'skeleton' : 'slime';
      spawnMobAt(kind, x, h, z, false);
      counts.surface++;
    }
  }

  /* --- スケルトンの矢 --- */
  const ARROWS = [];
  const arrowGeo = new THREE.BoxGeometry(0.06, 0.06, 0.5);
  const arrowMat = new THREE.MeshLambertMaterial({ color: 0xcabb9a });
  function shootArrow(from, target) {
    const mesh = new THREE.Mesh(arrowGeo, arrowMat);
    mesh.position.copy(from);
    const dir = target.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    const speed = 16;
    const vel = dir.multiplyScalar(speed);
    vel.y += dist * 0.35; // 距離に応じて山なりに
    vel.x += rnd(-0.8, 0.8); vel.z += rnd(-0.8, 0.8); // 命中は完璧ではない
    mesh.lookAt(mesh.position.clone().add(vel));
    scene.add(mesh);
    ARROWS.push({ mesh, vel, life: 3.0, fromPlayer: false });
    thock(220);
  }
  // プレイヤーの弓（右クリック）。矢を1本消費して視線方向へ撃つ
  const PLAYER_BOW = { cd: 0 };
  function shootPlayerArrow() {
    if (PLAYER_BOW.cd > 0 || SURVIVAL.dead) return false;
    if (!hasItems([['arrow', 1]])) {
      if (typeof setDebugToast === 'function') setDebugToast('矢がない！（丸石+棒+繊維でクラフト）', 1.8);
      thock(90);
      return false;
    }
    takeItems([['arrow', 1]]);
    PLAYER_BOW.cd = 0.6;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const mesh = new THREE.Mesh(arrowGeo, arrowMat);
    mesh.position.copy(camera.position).addScaledVector(dir, 0.6);
    const vel = dir.multiplyScalar(26);
    mesh.lookAt(mesh.position.clone().add(vel));
    scene.add(mesh);
    ARROWS.push({ mesh, vel, life: 3.0, fromPlayer: true });
    damageSelectedTool(1);
    if (typeof triggerHandSwing === 'function') triggerHandSwing();
    thock(280);
    return true;
  }
  // 矢がMOB/動物に当たったか（プレイヤーの矢のみ）
  function arrowHitTarget(p) {
    for (const m of MOBS) {
      if (Math.abs(p.x - m.position.x) < 0.7 && Math.abs(p.z - m.position.z) < 0.7 && p.y > m.position.y - 0.2 && p.y < m.position.y + 1.9) return m;
    }
    if (typeof ANIMALS !== 'undefined') {
      for (const a of ANIMALS) {
        if (Math.abs(p.x - a.position.x) < 0.7 && Math.abs(p.z - a.position.z) < 0.7 && p.y > a.position.y - 0.2 && p.y < a.position.y + 1.4) return a;
      }
    }
    return null;
  }
  function updateArrows(dt) {
    for (let i = ARROWS.length - 1; i >= 0; i--) {
      const a = ARROWS[i];
      a.life -= dt;
      a.vel.y -= 13 * dt;
      a.mesh.position.addScaledVector(a.vel, dt);
      a.mesh.lookAt(a.mesh.position.clone().add(a.vel));
      const p = a.mesh.position;
      if (a.fromPlayer) {
        const hit = a.vel.lengthSq() > 1 ? arrowHitTarget(p) : null;
        if (hit) {
          const dir = hit.position.clone().sub(player.pos); dir.y = 0; dir.normalize();
          if (hit.userData.kind && MOB_DEFS[hit.userData.kind]) damageMobBy(hit, 5, dir, 3.5);
          else if (typeof damageAnimal === 'function') damageAnimal(hit, 5, dir);
          a.life = 0;
        }
      } else {
        const hitPlayer = Math.abs(p.x - player.pos.x) < 0.55 && Math.abs(p.z - player.pos.z) < 0.55 && p.y > player.pos.y - 1.7 && p.y < player.pos.y + 0.4;
        if (hitPlayer && !SURVIVAL.dead) {
          damagePlayer(3, 'スケルトンの矢');
          a.life = 0;
        }
      }
      if (a.life > 0 && isSolid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) {
        a.life = Math.min(a.life, 0.4);
        a.vel.set(0, 0, 0);
      }
      if (a.life <= 0) { scene.remove(a.mesh); ARROWS.splice(i, 1); }
    }
  }

  /* --- MOB 更新 --- */
  function dropMobLoot(m) {
    const def = MOB_DEFS[m.userData.kind];
    if (!def) return;
    for (const [id, lo, hi] of def.drops) {
      const n = lo + (Math.random() * (hi - lo + 1) | 0);
      if (n > 0) spawnItemDrop(Math.floor(m.position.x), Math.floor(m.position.y) + 1, Math.floor(m.position.z), id, n);
    }
  }
  function killMob(m, byPlayer = false) {
    burst(m.position.x - 0.5, m.position.y, m.position.z - 0.5, 0xcc3333);
    // ドロップと討伐数はプレイヤーが倒したときだけ（朝の日光で燃え尽きた分は対象外）
    if (byPlayer) {
      dropMobLoot(m);
      SAVE.stats.kills = (SAVE.stats.kills || 0) + 1;
      markSaveDirty();
      if (typeof progressEvent === 'function') progressEvent('kill', m.userData.kind);
    }
    scene.remove(m);
    const i = MOBS.indexOf(m);
    if (i >= 0) MOBS.splice(i, 1);
    thock(140);
  }
  function updateMob(m, dt) {
    const u = m.userData, def = MOB_DEFS[u.kind];
    const dx = player.pos.x - m.position.x, dz = player.pos.z - m.position.z;
    const dist = Math.hypot(dx, dz);
    const dy = Math.abs(player.pos.y - m.position.y);
    u.attackCd = Math.max(0, u.attackCd - dt);
    u.hurtT = Math.max(0, u.hurtT - dt);
    u.phase += dt * (u.kind === 'slime' ? 5.2 : 7.0);
    // 昼にゾンビが燃える（空が見える場所のみ。日陰や屋根の下では燃えない）
    if (u.kind === 'zombie' && !u.cave && DAY.label !== '夜') {
      u.burn += dt;
      if (u.burn > 0.5) {
        u.burn = 0;
        if (!isCoveredFromSky(Math.floor(m.position.x), Math.floor(m.position.y), Math.floor(m.position.z))) {
          u.hp -= 2;
          burst(m.position.x - 0.5, m.position.y + 0.6, m.position.z - 0.5, 0xff7a26);
          if (u.hp <= 0) { killMob(m); return true; }
        }
      }
    }
    // ノックバック
    if (u.kb && u.kb.t > 0) {
      u.kb.t -= dt;
      const nx = m.position.x + u.kb.x * dt, nz = m.position.z + u.kb.z * dt;
      const gy = mobGroundY(Math.floor(nx), Math.floor(nz), m.position.y);
      if (gy != null) { m.position.x = nx; m.position.z = nz; m.position.y = Math.max(m.position.y - 8 * dt, gy + 1); }
      return false;
    }
    // 追跡AI
    const chaseRange = u.kind === 'skeleton' ? 22 : 24;
    const wantClose = u.kind !== 'skeleton';
    let moveDir = null;
    if (dist < chaseRange && dy < 10 && !SURVIVAL.dead) {
      if (wantClose) moveDir = Math.atan2(dx, dz);
      else if (dist > 13) moveDir = Math.atan2(dx, dz);        // スケルトンは距離を詰めすぎない
      else if (dist < 7) moveDir = Math.atan2(-dx, -dz);       // 近すぎたら離れる
      m.rotation.y = Math.atan2(dx, dz);
    } else {
      // ふらふら歩き
      if (u.wanderT == null || (u.wanderT -= dt) <= 0) { u.wanderT = rnd(1.5, 4); u.wanderDir = Math.random() * Math.PI * 2; }
      if (Math.random() < 0.6) moveDir = u.wanderDir;
      m.rotation.y = u.wanderDir || 0;
    }
    if (moveDir != null) {
      const hop = u.kind === 'slime' ? Math.max(0, Math.sin(u.phase)) : 1; // スライムは跳ねている間だけ進む
      const spd = def.speed * (dist < 20 ? 1 : 0.55) * hop;
      const nx = m.position.x + Math.sin(moveDir) * spd * dt, nz = m.position.z + Math.cos(moveDir) * spd * dt;
      const gy = mobGroundY(Math.floor(nx), Math.floor(nz), m.position.y);
      if (gy != null && Math.abs(gy + 1 - m.position.y) < 1.5) {
        m.position.x = nx; m.position.z = nz;
        m.position.y += ((gy + 1) - m.position.y) * Math.min(1, dt * 10);
      }
    }
    // 見た目アニメーション
    if (u.kind === 'slime') {
      const s = Math.sin(u.phase);
      m.position.y += Math.max(0, s) * 0.4 * dt * 4;
      m.scale.set(1 + s * 0.08, 1 - s * 0.1, 1 + s * 0.08);
    } else if (u.limbs) {
      const sw = moveDir != null ? Math.sin(u.phase) * 0.55 : 0;
      u.limbs.legL.rotation.x = sw;
      u.limbs.legR.rotation.x = -sw;
    }
    // 被弾フラッシュ（少し赤く縮む）
    const hurtScale = u.hurtT > 0 ? 1 - u.hurtT * 0.35 : 1;
    if (u.kind !== 'slime') m.scale.setScalar(hurtScale);
    // 攻撃
    if (!SURVIVAL.dead && u.attackCd <= 0) {
      if (u.kind === 'skeleton') {
        if (dist < def.attackRange && dist > 3 && dy < 8) {
          u.attackCd = def.attackCd;
          shootArrow(m.position.clone().add(new THREE.Vector3(0, 1.4, 0)), player.pos.clone().add(new THREE.Vector3(0, -0.4, 0)));
        }
      } else if (dist < def.attackRange && dy < 2.2) {
        u.attackCd = def.attackCd;
        damagePlayer(def.damage, MOB_DEFS[u.kind].name);
      }
    }
    return false;
  }
  function updateHostileMobs(dt) {
    if (typeof RAVE !== 'undefined' && RAVE.on) {
      // 会場モード中は敵を全て片付ける
      for (let i = MOBS.length - 1; i >= 0; i--) { scene.remove(MOBS[i]); MOBS.splice(i, 1); }
      for (let i = ARROWS.length - 1; i >= 0; i--) { scene.remove(ARROWS[i].mesh); ARROWS.splice(i, 1); }
      return;
    }
    mobSpawnClock -= dt;
    if (mobSpawnClock <= 0) { trySpawnMobs(); mobSpawnClock = 3.0; }
    for (let i = MOBS.length - 1; i >= 0; i--) {
      const m = MOBS[i];
      const dist = Math.hypot(m.position.x - player.pos.x, m.position.z - player.pos.z);
      if (dist > MOB_DESPAWN_R) { scene.remove(m); MOBS.splice(i, 1); continue; }
      // 地上MOBは朝になったら順次消える（ゾンビは燃えて消える）
      if (!m.userData.cave && DAY.label !== '夜' && m.userData.kind !== 'zombie' && Math.random() < dt * 0.25) {
        burst(m.position.x - 0.5, m.position.y + 0.4, m.position.z - 0.5, 0xdddddd);
        scene.remove(m); MOBS.splice(i, 1); continue;
      }
      if (updateMob(m, dt)) continue; // killMob済み
    }
    updateArrows(dt);
  }
  function hostileNear(pos, r) {
    for (const m of MOBS) {
      if (Math.hypot(m.position.x - pos.x, m.position.z - pos.z) <= r && Math.abs(m.position.y - pos.y) < 10) return true;
    }
    return false;
  }

  /* --- プレイヤーの近接攻撃 --- */
  const PLAYER_ATTACK = { cd: 0 };
  function updatePlayerAttack(dt) {
    PLAYER_ATTACK.cd = Math.max(0, PLAYER_ATTACK.cd - dt);
    PLAYER_BOW.cd = Math.max(0, PLAYER_BOW.cd - dt);
  }
  // 敵MOBへのダメージ共通処理（近接/矢の両方から呼ぶ）
  function damageMobBy(m, damage, dir, kbPower = 6.5) {
    const u = m.userData;
    u.hp -= damage;
    u.hurtT = 0.35;
    if (dir) u.kb = { x: dir.x * kbPower, z: dir.z * kbPower, t: 0.22 };
    burst(m.position.x - 0.5, m.position.y + 0.7, m.position.z - 0.5, 0xcc4444);
    thock(190);
    if (u.hp <= 0) killMob(m, true);
  }
  function pickMeleeTarget() {
    const origin = camera.position, dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let best = null;
    const consider = (g, radius, heightOff) => {
      const center = g.position.clone(); center.y += heightOff;
      const to = center.sub(origin);
      const along = to.dot(dir);
      if (along < 0.2 || along > 3.4) return;
      const miss = to.addScaledVector(dir, -along).length();
      if (miss > radius) return;
      if (!best || along < best.dist) best = { target: g, dist: along };
    };
    for (const m of MOBS) consider(m, 0.95, 0.9);
    if (typeof ANIMALS !== 'undefined') for (const a of ANIMALS) consider(a, 0.9, 0.5);
    return best ? best.target : null;
  }
  function tryMeleeAttack() {
    if (PLAYER_ATTACK.cd > 0 || SURVIVAL.dead) return false;
    const target = pickMeleeTarget();
    if (typeof triggerHandSwing === 'function') triggerHandSwing();
    if (!target) return false;
    PLAYER_ATTACK.cd = 0.45;
    const def = selectedItemDef();
    const damage = def && def.damage ? def.damage : 1;
    const u = target.userData;
    const dir = target.position.clone().sub(player.pos); dir.y = 0; dir.normalize();
    if (u.kind && MOB_DEFS[u.kind]) {
      damageMobBy(target, damage, dir);
    } else if (typeof damageAnimal === 'function') {
      damageAnimal(target, damage, dir);
    }
    if (def && (def.cat === 'weapon' || def.cat === 'tool')) damageSelectedTool(1);
    return true;
  }
