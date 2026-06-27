  /* ============== 破壊パーティクル ============== */
  const pGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const pPool = [];
  for (let i = 0; i < 80; i++) {
    const m = new THREE.Mesh(pGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    m.visible = false; m.castShadow = false; scene.add(m);
    pPool.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
  }
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
