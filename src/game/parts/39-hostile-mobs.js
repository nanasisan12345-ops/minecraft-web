  /* ============== 敵MOB（ゾンビ / スライム / スケルトン）と戦闘 ==============
   * - 夜の地上と、暗い地下（洞窟）にスポーンする。松明などの明かりの近くには湧かない。
   * - 左クリックで攻撃（武器でダメージ変化・クールダウン・ノックバックあり）。
   * - ゾンビは昼の日なたで燃える。スケルトンは矢を放つ。ドロップあり。 */
  const MOBS = [];
  // 本家寄りに少なめ・湧きすぎないように。1回のスポーン試行で湧く上限も制限する。
  const MOB_SURFACE_MAX = 8, MOB_CAVE_MAX = 6;
  const MOB_SPAWN_PER_CYCLE = 2;   // 1スポーンサイクルで湧かせる最大数
  const MOB_SPAWN_MIN_R = 20, MOB_SPAWN_MAX_R = 48, MOB_DESPAWN_R = 72;
  const MOB_DEFS = {
    zombie: { name: 'ゾンビ', hp: 20, speed: 1.85, damage: 3, attackRange: 1.5, attackCd: 1.25, drops: [['rotten_flesh', 0, 2]] },
    slime: { name: 'スライム', hp: 8, speed: 1.5, damage: 2, attackRange: 1.15, attackCd: 1.0, drops: [['slime_ball', 1, 2]] },
    skeleton: { name: 'スケルトン', hp: 16, speed: 1.6, damage: 3, attackRange: 17, attackCd: 2.4, drops: [['bone', 1, 2], ['coal', 0, 1]] },
    creeper: { name: 'クリーパー', hp: 20, speed: 1.75, damage: 0, attackRange: 3, attackCd: 0, drops: [['gunpowder', 1, 2]] },
  };

  /* --- 爆発（クリーパー / TNT 共通） --- */
  // 中心(cx,cy,cz)を球状に破壊し、距離に応じてプレイヤーにダメージ。
  function explodeAt(cx, cy, cz, power = 3) {
    // プレイヤーへのダメージ（距離で減衰。防具は damagePlayer 側で軽減）
    const pdx = player.pos.x - (cx + 0.5), pdy = (player.pos.y - 0.9) - (cy + 0.5), pdz = player.pos.z - (cz + 0.5);
    const pd = Math.hypot(pdx, pdy, pdz);
    if (pd < power * 2.2 && !SURVIVAL.dead) {
      const dmg = Math.round((1 - pd / (power * 2.2)) * (power * 6));
      if (dmg > 0) {
        damagePlayer(dmg, '爆発');
        // 爆風で少し吹き飛ばす
        const kb = (1 - pd / (power * 2.2)) * 8;
        if (pd > 0.01) { player.vel.x += (pdx / pd) * kb; player.vel.z += (pdz / pd) * kb; player.vel.y += 4; player.onGround = false; }
      }
    }
    // ブロック破壊（球状。水/溶岩と範囲外は残す。外周はランダムに残す）
    const R = Math.ceil(power);
    const touched = [];
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
      const dd = Math.hypot(dx, dy, dz);
      if (dd > power + 0.4) continue;
      const x = cx + dx, y = cy + dy, z = cz + dz;
      if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) continue;
      const t = blockAt(x, y, z);
      if (t === undefined || t === WATER || t === LAVA || TYPES[t].unbreakable) continue; // 岩盤は爆発でも壊れない
      if (t === TNT) { igniteTNT(x, y, z, rnd(0.1, 0.4)); continue; }   // 連鎖爆発
      if (dd > power - 0.8 && Math.random() < 0.45) continue;   // 外縁はまばらに残す
      if (Math.random() < 0.3) for (const [id, n] of blockDrops(t)) spawnItemDrop(x, y, z, id, n); // 3割だけ回収できる
      if (typeof clearCropAt === 'function') clearCropAt(x, y, z);
      setEdit(key(x, y, z), -1); setBlock(x, y, z, null);
      if (typeof rsOnBlockChanged === 'function') rsOnBlockChanged(x, y, z, -1); // RS部品の登録解除/回路の再評価
      touched.push([x, y, z]);
    }
    if (touched.length) { saveEditsSoon(); for (const [x, y, z] of touched) requestEditedBlockRebuild(x, y, z); }
    // 派手なパーティクル
    for (let k = 0; k < 26; k++) burst(cx + rnd(-power, power), cy + rnd(-1, power), cz + rnd(-power, power), k % 2 ? 0xff8a26 : 0x555555);
    if (typeof playExplosionSound === 'function') playExplosionSound(power / 3);
  }
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
  function makeCreeper() {
    const g = new THREE.Group();
    const green = 0x5aa83c, dark = 0x3f7a2a;
    const body = mobBox(g, 0.42, 0.78, 0.42, green, 0, 0.9, 0);
    const head = mobBox(g, 0.46, 0.46, 0.46, green, 0, 1.5, 0);
    // 点滅は個体ごとに独立させたいので、共有マテリアルではなく専用インスタンスにする
    body.material = new THREE.MeshLambertMaterial({ color: green });
    head.material = new THREE.MeshLambertMaterial({ color: green });
    mobBox(head, 0.1, 0.1, 0.03, 0x0f1a0d, -0.11, 0.04, -0.23);   // 目
    mobBox(head, 0.1, 0.1, 0.03, 0x0f1a0d, 0.11, 0.04, -0.23);
    mobBox(head, 0.08, 0.18, 0.03, 0x0f1a0d, 0, -0.12, -0.23);    // 口の縦
    mobBox(head, 0.2, 0.08, 0.03, 0x0f1a0d, -0.09, -0.2, -0.23);  // 口の横
    mobBox(head, 0.2, 0.08, 0.03, 0x0f1a0d, 0.09, -0.2, -0.23);
    mobBox(g, 0.16, 0.06, 0.42, dark, 0, 0.5, 0);                 // 体の模様
    const legFL = mobBox(g, 0.18, 0.3, 0.18, dark, -0.12, 0.15, -0.12);
    const legFR = mobBox(g, 0.18, 0.3, 0.18, dark, 0.12, 0.15, -0.12);
    const legBL = mobBox(g, 0.18, 0.3, 0.18, dark, -0.12, 0.15, 0.12);
    const legBR = mobBox(g, 0.18, 0.3, 0.18, dark, 0.12, 0.15, 0.12);
    g.userData.limbs = { legL: legFL, legR: legFR, legBL, legBR };
    g.userData.body = body; g.userData.head = head;
    g.userData.baseMats = [body.material, head.material];
    return g;
  }
  const MOB_MAKERS = { zombie: makeZombie, slime: makeSlime, skeleton: makeSkeleton, creeper: makeCreeper };

  /* --- 地形ヘルパー --- */
  // refY 付近で立てる地面の高さを探す（見つからなければ null）
  function mobGroundY(x, z, refY) {
    for (let y = Math.min(CHUNK_Y_MAX, Math.ceil(refY) + 2); y >= Math.max(CHUNK_Y_MIN, Math.floor(refY) - 4); y--) {
      if (isSolid(x, y, z) && !isSolid(x, y + 1, z) && !isSolid(x, y + 2, z)) return y;
    }
    return null;
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
    return true;
  }
  // 本家準拠の湧き光量ゲート: 湧きセルの blocklight=0 が必須。空(sky)が差す明るい場所は
  // 夜のみ許可（暗い屋内・洞窟は昼夜問わず可）。ワーカーが焼いた実ライトを使い、
  // データ未取得（未メッシュ）のチャンクは保守的に湧かせない。
  function spawnLightAllows(x, y, z) {
    const L = (typeof bakedLightAt === 'function') ? bakedLightAt(x, y, z) : null;
    if (!L) return false;
    if (L.blk > 0) return false;
    if (L.sky > 7 && DAY.label !== '夜') return false;
    return true;
  }
  function trySpawnMobs() {
    if (!started || SURVIVAL.dead || (typeof RAVE !== 'undefined' && RAVE.on)) return;
    const counts = mobCounts();
    const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
    const surfaceH = heightAt(px, pz);
    const underground = py < surfaceH - 6;
    let spawned = 0;                                       // このサイクルで湧かせた数（上限あり）
    for (let tries = 0; tries < 12 && spawned < MOB_SPAWN_PER_CYCLE; tries++) {
      const a = Math.random() * Math.PI * 2, r = rnd(MOB_SPAWN_MIN_R + 2, MOB_SPAWN_MAX_R);
      const x = Math.floor(player.pos.x + Math.cos(a) * r), z = Math.floor(player.pos.z + Math.sin(a) * r);
      if (Math.hypot(x - player.pos.x, z - player.pos.z) < MOB_SPAWN_MIN_R) continue;
      if (underground && counts.cave < MOB_CAVE_MAX && Math.random() < 0.7) {
        // 洞窟スポーン: プレイヤーの高さ付近の空洞の床を探す。
        // 湧きセル（床の1つ上）のブロック光=0 が必須。松明を並べれば blocklight で止まる。
        const gy = mobGroundY(x, z, py + rnd(-6, 6));
        if (gy == null || gy >= heightAt(x, z) - 6) continue;
        if (!spawnLightAllows(x, gy + 1, z)) continue;
        const roll = Math.random();
        const kind = roll < 0.4 ? 'slime' : roll < 0.65 ? 'skeleton' : roll < 0.85 ? 'zombie' : 'creeper';
        spawnMobAt(kind, x, gy, z, true);
        counts.cave++; spawned++;
        continue;
      }
      // 地上スポーン: 明るさで判定（空が差す露天は夜のみ／暗ければ日陰・屋内でも湧く）。
      if (counts.surface >= MOB_SURFACE_MAX) continue;
      if (!canSpawnSurfaceMobAt(x, z)) continue;
      const h = heightAt(x, z);
      if (!spawnLightAllows(x, h + 1, z)) continue;
      const swamp = typeof biomeAt === 'function' && biomeAt(x, z).id === 'swamp';
      const roll = Math.random();
      const kind = swamp && roll < 0.4 ? 'slime' : roll < 0.4 ? 'zombie' : roll < 0.62 ? 'skeleton' : roll < 0.82 ? 'creeper' : 'slime';
      spawnMobAt(kind, x, h, z, false);
      counts.surface++; spawned++;
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
    // 無限: 矢を1本以上持っていれば消費しない（C11）
    if (enchLevel(typeof selectedItem === 'function' ? selectedItem() : null, 'infinity') <= 0) takeItems([['arrow', 1]]);
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
      // 討伐XP（本家準拠: ゾンビ/スケルトン/クリーパー=5、スライム=2）
      const xp = m.userData.kind === 'slime' ? 2 : 5;
      if (typeof spawnXpOrb === 'function') spawnXpOrb(Math.floor(m.position.x), Math.floor(m.position.y), Math.floor(m.position.z), xp);
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
    // 日光による焼失（本家と同じ）。朝〜昼に、空が見える場所にいるゾンビ/スケルトンは
    // 炎に包まれて数秒で燃え尽きる。屋根や洞窟など日陰にいれば生き延びる。
    if ((u.kind === 'zombie' || u.kind === 'skeleton') && !u.cave && (DAY.label === '朝' || DAY.label === '昼')) {
      // 本家準拠: 昼に「空が直に当たる（skylight>=14）」場所のゾンビ/スケルトンだけ燃える。
      // 屋根の下・日陰・洞窟（sky<14）は燃えない。光データ未取得なら燃やさない（保守的）。
      const L = (typeof bakedLightAt === 'function') ? bakedLightAt(Math.floor(m.position.x), Math.floor(m.position.y), Math.floor(m.position.z)) : null;
      const exposed = !!L && L.sky >= 14;
      if (exposed) {
        u.burn += dt;
        // 燃えている間は継続的に炎の粒子を上げる
        if (Math.random() < dt * 12) burst(m.position.x - 0.5, m.position.y + 0.4 + Math.random() * 0.9, m.position.z - 0.5, Math.random() < 0.5 ? 0xff7a26 : 0xffd24a);
        if (u.burn > 0.4) {
          u.burn = 0;
          u.hp -= 3;                                  // ゾンビ20/スケルトン16 → 約2〜3秒で焼死
          if (u.hp <= 0) {
            for (let k = 0; k < 3; k++) burst(m.position.x - 0.5, m.position.y + 0.5, m.position.z - 0.5, 0xff7a26);
            killMob(m);                               // 日光で死ぬのでドロップ無し（プレイヤー撃破ではない）
            return true;
          }
        }
      } else if (Math.random() < dt * 0.3) {
        // 日陰で生き残った個体も、昼のうちに少しずつどこかへ立ち去る（溜まりすぎ防止）
        burst(m.position.x - 0.5, m.position.y + 0.4, m.position.z - 0.5, 0xdddddd);
        const idx = MOBS.indexOf(m); if (idx >= 0) MOBS.splice(idx, 1); scene.remove(m);
        return true;
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
    // クリーパー: 近づくと導火線に着火して膨らみ、逃げれば止まる。限界で爆発。
    if (u.kind === 'creeper') {
      const close = dist < def.attackRange && dy < 3;
      if (close && !SURVIVAL.dead) {
        if ((u.fuse || 0) <= 0 && typeof playFuseSound === 'function') playFuseSound();
        u.fuse = (u.fuse || 0) + dt;
        // 白く点滅しながら膨らむ
        const flash = 0.5 + 0.5 * Math.sin(u.fuse * 22);
        const sc = 1 + Math.min(0.5, u.fuse * 0.34);
        m.scale.setScalar(sc);
        if (u.baseMats) for (const mat of u.baseMats) mat.emissive && mat.emissive.setRGB(flash * 0.9, flash * 0.5, flash * 0.5), mat.emissiveIntensity = flash * 0.9;
        if (u.fuse >= 1.5) {
          explodeAt(Math.floor(m.position.x), Math.floor(m.position.y), Math.floor(m.position.z), 3);
          dropMobLoot(m);                 // 火薬を落とす
          SAVE.stats.kills = (SAVE.stats.kills || 0) + 0; // 自爆は撃破数に含めない
          scene.remove(m);
          const idx = MOBS.indexOf(m); if (idx >= 0) MOBS.splice(idx, 1);
          return true;
        }
        return false;
      } else {
        // 離れたら導火線リセット
        if (u.fuse > 0) { u.fuse = 0; m.scale.setScalar(1); if (u.baseMats) for (const mat of u.baseMats) mat.emissiveIntensity = 0; }
      }
    }
    // 被弾フラッシュ（少し赤く縮む）
    const hurtScale = u.hurtT > 0 ? 1 - u.hurtT * 0.35 : 1;
    if (u.kind !== 'slime' && u.kind !== 'creeper') m.scale.setScalar(hurtScale);
    // 攻撃
    if (!SURVIVAL.dead && u.attackCd <= 0) {
      if (u.kind === 'skeleton') {
        if (dist < def.attackRange && dist > 3 && dy < 8) {
          u.attackCd = def.attackCd;
          shootArrow(m.position.clone().add(new THREE.Vector3(0, 1.4, 0)), player.pos.clone().add(new THREE.Vector3(0, -0.4, 0)));
        }
      } else if (u.kind !== 'creeper' && dist < def.attackRange && dy < 2.2) {
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
    if (mobSpawnClock <= 0) { trySpawnMobs(); mobSpawnClock = 5.0; }
    const daytime = DAY.label === '昼' || DAY.label === '朝';
    for (let i = MOBS.length - 1; i >= 0; i--) {
      const m = MOBS[i];
      const dist = Math.hypot(m.position.x - player.pos.x, m.position.z - player.pos.z);
      if (dist > MOB_DESPAWN_R) { scene.remove(m); MOBS.splice(i, 1); continue; }
      // 朝〜昼、燃えない地上MOB（スライム/クリーパー）は静かに消える（ゾンビ/スケルトンは updateMob 内で焼失）。
      const k = m.userData.kind;
      if (!m.userData.cave && daytime && (k === 'slime' || k === 'creeper') && Math.random() < (k === 'slime' ? dt * 0.5 : dt * 0.15)) {
        burst(m.position.x - 0.5, m.position.y + 0.4, m.position.z - 0.5, 0xdddddd);
        scene.remove(m); MOBS.splice(i, 1); continue;
      }
      if (updateMob(m, dt)) continue; // killMob済み（焼失・立ち去り含む）
    }
    updateArrows(dt);
    updateTNT(dt);
  }

  /* --- TNT（着火すると導火線→爆発。爆発で隣のTNTも連鎖する） --- */
  const ACTIVE_TNT = [];
  const tntPrimeGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
  function igniteTNT(x, y, z, fuse = 2.5) {
    if (blockAt(x, y, z) !== TNT) return false;
    setEdit(key(x, y, z), -1); saveEditsSoon(); setBlock(x, y, z, null); requestEditedBlockRebuild(x, y, z);
    const mat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
    const mesh = new THREE.Mesh(tntPrimeGeo, mat);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    scene.add(mesh);
    ACTIVE_TNT.push({ mesh, mat, x, y, z, fuse, t0: fuse });
    if (typeof playFuseSound === 'function') playFuseSound();
    return true;
  }
  function updateTNT(dt) {
    for (let i = ACTIVE_TNT.length - 1; i >= 0; i--) {
      const t = ACTIVE_TNT[i];
      t.fuse -= dt;
      const elapsed = t.t0 - t.fuse;
      const flash = t.fuse < 0.6 ? 1 : 0.5 + 0.5 * Math.sin(elapsed * 20);
      t.mat.emissive.setRGB(flash, flash, flash); t.mat.emissiveIntensity = flash;
      t.mesh.position.y = t.y + 0.5 + Math.abs(Math.sin(elapsed * 6)) * 0.08;
      if (Math.random() < dt * 8) burst(t.x + rnd(0.2, 0.8), t.y + 1, t.z + rnd(0.2, 0.8), 0xffffff);
      if (t.fuse <= 0) {
        scene.remove(t.mesh); t.mat.dispose();
        ACTIVE_TNT.splice(i, 1);
        explodeAt(t.x, t.y, t.z, 3.5);
      }
    }
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
    const held = typeof selectedItem === 'function' ? selectedItem() : null;
    // ダメージ増加N: +0.5N+0.5（C11）
    const damage = (def && def.damage ? def.damage : 1) + enchDamageBonus(held);
    const u = target.userData;
    // 火属性N: 命中で 4N 秒燃やす
    const fire = enchFireSeconds(held);
    if (fire > 0) u.burn = Math.max(u.burn || 0, fire);
    const dir = target.position.clone().sub(player.pos); dir.y = 0; dir.normalize();
    if (u.kind && MOB_DEFS[u.kind]) {
      damageMobBy(target, damage, dir);
    } else if (typeof damageAnimal === 'function') {
      damageAnimal(target, damage, dir);
    }
    if (def && (def.cat === 'weapon' || def.cat === 'tool')) damageSelectedTool(1);
    return true;
  }
