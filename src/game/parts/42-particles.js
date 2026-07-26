  /* ============== 破壊パーティクル ============== */
  const pGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const pPool = [];
  for (let i = 0; i < 80; i++) {
    const m = new THREE.Mesh(pGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    m.visible = false; m.castShadow = false; scene.add(m);
    pPool.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
  }
  /* --- 液体の演出用パーティクル（滝のしぶき・溶岩の火花と煙） ---
   * 破壊用の pPool とは別プール。混ぜると滝のそばで採掘したときに破片が出なくなる。
   * 重力はひと粒ずつ指定できる（煙は上へ流したいので負の重力を渡す）。 */
  const fxGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  const FX_POOL = [];
  for (let i = 0; i < 64; i++) {
    const m = new THREE.Mesh(fxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 1 }));
    m.visible = false; m.castShadow = false; scene.add(m);
    FX_POOL.push({ mesh: m, vel: new THREE.Vector3(), life: 0, maxLife: 1, grav: 20, fade: false });
  }
  let fxIdx = 0;
  function spawnFx(x, y, z, color, vel, life, scale = 1, grav = 20, fade = false) {
    const p = FX_POOL[fxIdx++ % FX_POOL.length];
    p.mesh.material.color.setHex(color);
    p.mesh.material.opacity = 1;
    p.mesh.position.set(x, y, z);
    p.vel.copy(vel);
    p.mesh.scale.setScalar(scale);
    p.life = life; p.maxLife = life; p.grav = grav; p.fade = fade;
    p.mesh.visible = true;
    return p;
  }
  function updateFxParticles(dt) {
    for (const p of FX_POOL) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.fade) p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) p.mesh.visible = false;
    }
  }
  function fxActiveCount() { let n = 0; for (const p of FX_POOL) if (p.life > 0) n++; return n; }

  let pIdx = 0;
  function burst(x, y, z, color) {
    for (let i = 0; i < 9; i++) {
      const p = pPool[pIdx++ % pPool.length];
      p.mesh.material.color.setHex(color);
      p.mesh.position.set(x + 0.5 + rnd(-0.3, 0.3), y + 0.5 + rnd(-0.3, 0.3), z + 0.5 + rnd(-0.3, 0.3));
      p.vel.set(rnd(-2.5, 2.5), rnd(1.5, 4.5), rnd(-2.5, 2.5));
      p.mesh.scale.setScalar(rnd(0.5, 1.3));
      p.life = 0.45 + Math.random() * 0.3; p.mesh.visible = true;
    }
  }
