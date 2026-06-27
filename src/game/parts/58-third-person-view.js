  /* ============== 三人称表示 ============== */
  const CAMERA_VIEW = { thirdPerson: false, distance: 5.2, height: 1.15 };
  const playerAvatar = new THREE.Group();
  playerAvatar.visible = false;
  scene.add(playerAvatar);
  const avatarMats = new Map();
  let avatarHeldKey = '';
  function avatarMat(color) {
    if (!avatarMats.has(color)) avatarMats.set(color, new THREE.MeshLambertMaterial({ color }));
    return avatarMats.get(color);
  }
  function avatarBox(parent, sx, sy, sz, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), avatarMat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  const avatarParts = {
    body: avatarBox(playerAvatar, 0.56, 0.78, 0.28, 0x2c77c9, 0, 0.95, 0),
    head: avatarBox(playerAvatar, 0.42, 0.42, 0.42, 0xd8a06c, 0, 1.58, -0.02),
    armL: avatarBox(playerAvatar, 0.16, 0.62, 0.18, 0xd8a06c, -0.38, 0.96, 0),
    armR: avatarBox(playerAvatar, 0.16, 0.62, 0.18, 0xd8a06c, 0.38, 0.96, 0),
    legL: avatarBox(playerAvatar, 0.2, 0.68, 0.2, 0x263f75, -0.16, 0.34, 0),
    legR: avatarBox(playerAvatar, 0.2, 0.68, 0.2, 0x263f75, 0.16, 0.34, 0),
    held: new THREE.Group(),
  };
  playerAvatar.add(avatarParts.held);
  avatarParts.held.position.set(0.48, 0.88, -0.24);
  function clearAvatarHeld() {
    while (avatarParts.held.children.length) {
      const c = avatarParts.held.children[0];
      avatarParts.held.remove(c);
      c.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
  }
  function rebuildAvatarHeld(id) {
    if (id === avatarHeldKey) return;
    avatarHeldKey = id;
    clearAvatarHeld();
    if (typeof id === 'string' && ITEMS[id]) {
      const def = ITEMS[id];
      const metal = id.includes('iron') ? 0xd8dde2 : id.includes('stone') ? 0x8a8f92 : 0xb5824a;
      avatarBox(avatarParts.held, 0.05, 0.46, 0.05, 0x7a4d24, 0, 0, 0);
      if (def.tool === 'pickaxe') avatarBox(avatarParts.held, 0.32, 0.06, 0.06, metal, 0, 0.2, 0);
      else if (def.tool === 'axe') avatarBox(avatarParts.held, 0.18, 0.2, 0.06, metal, -0.08, 0.18, 0);
      else if (def.tool === 'shovel') avatarBox(avatarParts.held, 0.14, 0.16, 0.06, metal, 0, 0.24, 0);
    } else if (typeof id === 'number' && TYPES[id]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), avatarMat(TYPES[id].color));
      m.castShadow = true;
      avatarParts.held.add(m);
    }
  }
  function toggleThirdPerson() {
    CAMERA_VIEW.thirdPerson = !CAMERA_VIEW.thirdPerson;
    resetMining();
  }
  function updatePlayerAvatar(dt, tg) {
    playerAvatar.visible = CAMERA_VIEW.thirdPerson && started;
    if (!playerAvatar.visible) return;
    const feetY = player.pos.y - EYE;
    playerAvatar.position.set(player.pos.x, feetY, player.pos.z);
    playerAvatar.rotation.y = yaw;
    const walking = Math.hypot(player.vel.x, player.vel.z) > 0.15;
    const phase = performance.now() * (walking ? 0.009 : 0.002);
    const swing = walking ? Math.sin(phase) * 0.45 : Math.sin(phase) * 0.08;
    avatarParts.armL.rotation.x = swing;
    avatarParts.armR.rotation.x = mouseHeld.left ? -1.05 + Math.sin(phase * 2) * 0.28 : -swing;
    avatarParts.legL.rotation.x = -swing;
    avatarParts.legR.rotation.x = swing;
    avatarParts.head.rotation.x = THREE.MathUtils.clamp(pitch * 0.35, -0.35, 0.35);
    const toolId = mouseHeld.left ? heldToolForTarget(tg) : null;
    rebuildAvatarHeld(toolId || HOTBAR[selected]);
  }
  function updateCameraView(dt, tg) {
    updatePlayerAvatar(dt, tg);
    if (!CAMERA_VIEW.thirdPerson) {
      camera.position.copy(player.pos);
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      return;
    }
    const target = new THREE.Vector3(player.pos.x, player.pos.y - 0.38, player.pos.z);
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(CAMERA_VIEW.distance);
    const lift = new THREE.Vector3(0, CAMERA_VIEW.height + Math.max(0, pitch) * 1.2, 0);
    camera.position.copy(target).add(back).add(lift);
    camera.lookAt(target.x, target.y + 0.45, target.z);
  }
