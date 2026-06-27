  /* ============== 敵Mob（夜の小型スライム） ============== */
  const HOSTILES = [];
  const HOSTILE_MAX = 10, HOSTILE_SPAWN_R = 46, HOSTILE_DESPAWN_R = 86;
  const hostileGeo = new THREE.BoxGeometry(0.72, 0.56, 0.72);
  const hostileEyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.03);
  const hostileMat = new THREE.MeshLambertMaterial({ color: 0x4ca044, transparent: true, opacity: 0.88 });
  const hostileEyeMat = new THREE.MeshLambertMaterial({ color: 0x101510 });
  let hostileSpawnClock = 4;
  function makeHostileSlime() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(hostileGeo, hostileMat);
    body.position.y = 0.32; g.add(body);
    const e1 = new THREE.Mesh(hostileEyeGeo, hostileEyeMat), e2 = new THREE.Mesh(hostileEyeGeo, hostileEyeMat);
    e1.position.set(-0.15, 0.43, -0.37); e2.position.set(0.15, 0.43, -0.37);
    g.add(e1, e2);
    g.userData.kind = 'slime';
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.hitCooldown = 0;
    return g;
  }
  function canSpawnHostileAt(x, z) {
    if (inSpawnClearing(x, z, SPAWN_CLEAR_R + 12)) return false;
    const h = heightAt(x, z), top = topTypeAt(x, z, h);
    if (top === WATER || top === SAND) return false;
    if (typeof waterFeatureAt === 'function' && waterFeatureAt(x, z, h)) return false;
    if (world.has(key(x, h + 1, z)) || structureAffectsColumn(x, z, 1)) return false;
    return true;
  }
  function spawnHostileNearPlayer() {
    if (!started || RAVE.on || !DAY || DAY.label !== '夜' || HOSTILES.length >= HOSTILE_MAX) return;
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2, r = rnd(18, HOSTILE_SPAWN_R);
      const x = Math.floor(player.pos.x + Math.cos(a) * r), z = Math.floor(player.pos.z + Math.sin(a) * r);
      if (!canSpawnHostileAt(x, z)) continue;
      const h = heightAt(x, z), mob = makeHostileSlime();
      mob.position.set(x + 0.5, h + 1, z + 0.5);
      scene.add(mob); HOSTILES.push(mob);
      return;
    }
  }
  function updateHostileMobs(dt) {
    hostileSpawnClock -= dt;
    if (hostileSpawnClock <= 0) { spawnHostileNearPlayer(); hostileSpawnClock = rnd(3.5, 8.0); }
    for (let i = HOSTILES.length - 1; i >= 0; i--) {
      const m = HOSTILES[i], u = m.userData;
      const dx = player.pos.x - m.position.x, dz = player.pos.z - m.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > HOSTILE_DESPAWN_R || DAY.label !== '夜') {
        scene.remove(m); HOSTILES.splice(i, 1); continue;
      }
      const dir = Math.atan2(dx, dz), speed = dist < 26 ? 1.35 : 0.55;
      const nx = m.position.x + Math.sin(dir) * speed * dt, nz = m.position.z + Math.cos(dir) * speed * dt;
      const h = heightAt(Math.floor(nx), Math.floor(nz));
      if (canSpawnHostileAt(Math.floor(nx), Math.floor(nz)) && Math.abs(h + 1 - m.position.y) < 1.5) {
        m.position.x = nx; m.position.z = nz;
      }
      u.phase += dt * (dist < 14 ? 8 : 4);
      m.position.y = heightAt(Math.floor(m.position.x), Math.floor(m.position.z)) + 1 + Math.max(0, Math.sin(u.phase)) * 0.13;
      m.scale.set(1 + Math.sin(u.phase) * 0.06, 1 - Math.sin(u.phase) * 0.08, 1 + Math.sin(u.phase) * 0.06);
      m.rotation.y = dir + Math.PI;
      u.hitCooldown = Math.max(0, u.hitCooldown - dt);
      if (dist < 1.05 && u.hitCooldown <= 0) {
        damagePlayer(2);
        u.hitCooldown = 1.1;
      }
    }
  }
