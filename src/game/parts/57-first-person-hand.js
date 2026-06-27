  /* ============== 一人称の手 / 持ち物表示 ============== */
  const heldView = new THREE.Group();
  heldView.renderOrder = 1000;
  scene.add(heldView);
  const heldMats = new Map();
  let heldViewKey = '';
  let heldSwing = 0;
  function heldMat(color) {
    if (!heldMats.has(color)) heldMats.set(color, new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false }));
    return heldMats.get(color);
  }
  function heldBox(parent, sx, sy, sz, color, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), heldMat(color));
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.renderOrder = 1000;
    parent.add(m);
    return m;
  }
  function clearHeldItem() {
    while (heldView.children.length) {
      const c = heldView.children[0];
      heldView.remove(c);
      c.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
  }
  function makeHeldTool(id) {
    const g = new THREE.Group();
    const def = ITEMS[id] || {};
    const metal = id.includes('iron') ? 0xd8dde2 : id.includes('stone') ? 0x8a8f92 : 0xb5824a;
    const dark = id.includes('iron') ? 0xaab3ba : id.includes('stone') ? 0x62686c : 0x6d4c1b;
    heldBox(g, 0.045, 0.5, 0.045, 0x7a4d24, 0.02, -0.04, 0, 0, 0, -0.42);
    if (def.tool === 'pickaxe') {
      heldBox(g, 0.3, 0.06, 0.06, metal, -0.03, 0.18, 0, 0, 0, -0.42);
      heldBox(g, 0.08, 0.14, 0.06, dark, -0.17, 0.16, 0, 0, 0, -0.42);
    } else if (def.tool === 'axe') {
      heldBox(g, 0.17, 0.2, 0.06, metal, -0.1, 0.17, 0, 0, 0, -0.42);
      heldBox(g, 0.06, 0.1, 0.06, dark, 0.0, 0.16, 0, 0, 0, -0.42);
    } else if (def.tool === 'shovel') {
      heldBox(g, 0.14, 0.16, 0.06, metal, -0.07, 0.2, 0, 0, 0, -0.42);
      heldBox(g, 0.07, 0.05, 0.06, dark, -0.07, 0.3, 0, 0, 0, -0.42);
    }
    g.rotation.set(-0.55, 0.2, -0.25);
    g.position.set(0.18, 0.18, -0.3);
    return g;
  }
  function heldToolForTarget(tg) {
    if (!tg) return null;
    const type = world.get(key(tg.block[0], tg.block[1], tg.block[2]));
    const tool = type == null ? null : blockPreferredTool(type);
    const held = tool ? bestTool(tool) : null;
    return held ? held.id : null;
  }
  function rebuildHeldView(id) {
    if (id === heldViewKey) return;
    heldViewKey = id;
    clearHeldItem();
    const arm = new THREE.Group();
    arm.position.set(0.0, -0.02, 0.0);
    arm.rotation.set(-0.62, 0.18, -0.12);
    heldView.add(arm);
    // Minecraftの一人称腕に寄せた、指を作らないシンプルな四角い前腕。
    heldBox(arm, 0.26, 0.42, 0.24, 0x2f78c8, 0, -0.19, 0.03); // sleeve
    heldBox(arm, 0.255, 0.52, 0.235, 0xd29a68, 0, 0.24, -0.02); // bare arm/hand
    heldBox(arm, 0.035, 0.4, 0.02, 0xb77a4d, 0.095, 0.25, -0.145); // side shadow stripe
    let item = null;
    if (typeof id === 'string' && ITEMS[id]) item = makeHeldTool(id);
    if (item) heldView.add(item);
  }
  function updateHeldItemView(dt, tg) {
    const toolId = mouseHeld.left ? heldToolForTarget(tg) : null;
    const id = toolId || 'emptyHand';
    rebuildHeldView(id);
    heldSwing += dt * (mouseHeld.left ? 10 : 2.2);
    const swing = mouseHeld.left ? Math.sin(heldSwing) * 0.055 : Math.sin(heldSwing) * 0.018;
    const bob = started ? Math.sin(performance.now() * 0.006) * 0.012 : 0;
    heldView.quaternion.copy(camera.quaternion);
    heldView.scale.setScalar(0.9);
    const offset = new THREE.Vector3(0.58 + swing, -0.48 + bob - Math.abs(swing) * 0.28, -0.9).applyQuaternion(camera.quaternion);
    heldView.position.copy(camera.position).add(offset);
    heldView.visible = started && !CAMERA_VIEW.thirdPerson && !craftPanel.classList.contains('show');
  }
