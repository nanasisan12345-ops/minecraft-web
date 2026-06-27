  /* ============== ライト（太陽＋空のフィル光） ============== */
  const hemi = new THREE.HemisphereLight(0xcfe7f5, 0x55503f, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.15);
  const SUN_OFFSET = new THREE.Vector3(48, 90, 32);
  const SKY_ROT_Y = 2.7; // 実写パノラマのベイク太陽を SUN_DIR の方位に合わせる回転（要レンダ確認で微調整）
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 180;
  const SD = 34;
  sun.shadow.camera.left = -SD; sun.shadow.camera.right = SD;
  sun.shadow.camera.top = SD; sun.shadow.camera.bottom = -SD;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const TORCH_LIGHTS = [];
  for (let i = 0; i < 10; i++) {
    const l = new THREE.PointLight(0xffb24a, 0, 9, 1.8);
    l.visible = false;
    scene.add(l);
    TORCH_LIGHTS.push(l);
  }
  let torchLightClock = 0;
  function updateTorchLights(dt) {
    if (!started || typeof TORCH === 'undefined') {
      for (const l of TORCH_LIGHTS) l.visible = false;
      return;
    }
    torchLightClock -= dt;
    if (torchLightClock > 0) return;
    torchLightClock = 0.18;
    const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
    const found = [];
    for (let x = px - 13; x <= px + 13; x++) for (let z = pz - 13; z <= pz + 13; z++) for (let y = Math.max(1, py - 8); y <= py + 7; y++) {
      const type = world.get(key(x, y, z));
      if (type !== TORCH && type !== GLOW_CRYSTAL && type !== LANTERN && type !== LAVA) continue;
      found.push({ x, y, z, type, d: Math.hypot(x + 0.5 - player.pos.x, y + 0.5 - player.pos.y, z + 0.5 - player.pos.z) });
    }
    found.sort((a, b) => a.d - b.d);
    for (let i = 0; i < TORCH_LIGHTS.length; i++) {
      const l = TORCH_LIGHTS[i], f = found[i];
      if (!f) { l.visible = false; l.intensity = 0; continue; }
      l.visible = true;
      l.position.set(f.x + 0.5, f.y + 0.55, f.z + 0.5);
      if (f.type === GLOW_CRYSTAL) {
        l.color.setHex(0x61e8ff);
        l.distance = 8;
        l.intensity = 0.82 + Math.sin(performance.now() * 0.0038 + i) * 0.07;
      } else if (f.type === LANTERN) {
        l.color.setHex(0xffc265);
        l.distance = 11;
        l.intensity = 1.1 + Math.sin(performance.now() * 0.004 + i) * 0.05;
      } else if (f.type === LAVA) {
        l.color.setHex(0xff7a26);
        l.distance = 10;
        l.intensity = 1.15 + Math.sin(performance.now() * 0.005 + i) * 0.12;
      } else {
        l.color.setHex(0xffb24a);
        l.distance = 9;
        l.intensity = 1.05 + Math.sin(performance.now() * 0.006 + i) * 0.08;
      }
    }
  }
