  /* ============== 一人称の手 / 持ち物表示（選択中のホットバーアイテムを持つ） ============== */
  const heldView = new THREE.Group();
  heldView.renderOrder = 1000;
  scene.add(heldView);
  const heldMats = new Map();
  let heldViewKey = '';
  let heldSwing = 0;
  let handSwingImpulse = 0; // 攻撃時のひと振り
  function triggerHandSwing() { handSwingImpulse = 1; }
  function heldMat(color) {
    // transparent:true で半透明パスに乗せ、renderOrder:1000 で水/ガラスより後に・depthTest:false で最前面に描く
    if (!heldMats.has(color)) heldMats.set(color, new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true }));
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
  function heldColorPair(id) {
    const metal = id.startsWith('diamond') ? 0x66e0ee : id.startsWith('iron') ? 0xd8dde2 : id.startsWith('stone') ? 0x8a8f92 : 0xb5824a;
    const dark = id.startsWith('diamond') ? 0x2f98a8 : id.startsWith('iron') ? 0xaab3ba : id.startsWith('stone') ? 0x62686c : 0x6d4c1b;
    return [metal, dark];
  }
  function makeHeldTool(id, def) {
    const g = new THREE.Group();
    const [metal, dark] = heldColorPair(id);
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
    } else if (def.tool === 'sword') {
      heldBox(g, 0.06, 0.42, 0.06, metal, -0.09, 0.3, 0, 0, 0, -0.42);
      heldBox(g, 0.02, 0.4, 0.02, 0xffffff, -0.065, 0.3, 0.032, 0, 0, -0.42);
      heldBox(g, 0.16, 0.05, 0.07, dark, 0.0, 0.09, 0, 0, 0, -0.42);
    } else if (def.tool === 'bow') {
      heldBox(g, 0.05, 0.18, 0.05, 0x7a4d24, -0.02, 0.32, 0, 0, 0, -0.7);
      heldBox(g, 0.05, 0.24, 0.05, 0x7a4d24, 0.02, 0.14, 0, 0, 0, -0.42);
      heldBox(g, 0.05, 0.18, 0.05, 0x7a4d24, 0.1, -0.03, 0, 0, 0, -0.18);
      heldBox(g, 0.012, 0.5, 0.012, 0xe8e4d6, 0.09, 0.15, 0.03, 0, 0, -0.42);
    }
    g.rotation.set(-0.55, 0.2, -0.25);
    g.position.set(0.10, 0.30, -0.34); // 拳より前・少し上に出して腕と重ならない位置へ
    g.scale.setScalar(1.5);            // 小さすぎて種類が分からなかったので拡大（位置はアンカーのまま）
    return g;
  }
  // 手持ちブロックは実際のブロックテクスチャを貼る（単色だと何を持っているか分からないため）。
  // 手元は最前面に描くので、depthTest を切ったライティング無しのマテリアルに作り替えて使う。
  const heldBlockMats = new Map();
  function heldBlockMaterial(blockType) {
    if (heldBlockMats.has(blockType)) return heldBlockMats.get(blockType);
    const ty = TYPES[blockType];
    const src = ty && ty.mats;
    const conv = (m) => new THREE.MeshBasicMaterial({
      map: m.map || null,
      color: m.map ? 0xffffff : ((ty && ty.color) || 0xffffff),
      alphaTest: m.alphaTest || 0,
      depthTest: false, depthWrite: false, transparent: true,
    });
    const out = Array.isArray(src) ? src.map(conv) : (src ? conv(src) : heldMat((ty && ty.color) || 0xffffff));
    heldBlockMats.set(blockType, out);
    return out;
  }
  const HELD_BLOCK_SIZE = 0.40; // 以前は 0.24。手元で何のブロックか判別できる大きさに
  function makeHeldBlock(blockType) {
    const g = new THREE.Group();
    g.position.set(0.10, 0.20, -0.10);
    const holder = new THREE.Group();
    holder.rotation.set(0.2, 0.7, 0.05);
    const mats = heldBlockMaterial(blockType);
    const K = HELD_BLOCK_SIZE;
    // 松明や階段のようなモデルブロックは実際の形で持つ（立方体だと何か分からない）
    const ty = TYPES[blockType];
    const boxes = (ty && ty.model) ? ty.model.filter(p => p.box).map(p => p.box) : null;
    if (boxes && boxes.length) {
      for (const b of boxes) {
        const m = new THREE.Mesh(new THREE.BoxGeometry((b[3] - b[0]) * K, (b[4] - b[1]) * K, (b[5] - b[2]) * K), mats);
        m.position.set(((b[0] + b[3]) / 2 - 0.5) * K, ((b[1] + b[4]) / 2 - 0.5) * K, ((b[2] + b[5]) / 2 - 0.5) * K);
        holder.add(m);
      }
    } else {
      holder.add(new THREE.Mesh(new THREE.BoxGeometry(K, K, K), mats));
    }
    g.add(holder);
    return g;
  }
  function makeHeldFood(id) {
    const g = new THREE.Group();
    const colors = { apple: 0xd43b2f, berries: 0x7a3ca8, bread: 0xc98d46, raw_meat: 0xd4747e, cooked_meat: 0x9a5a30, rotten_flesh: 0x7a8a3a };
    heldBox(g, 0.26, 0.26, 0.26, colors[id] || 0xd4747e, 0.07, 0.22, -0.07);
    return g;
  }
  const ARMOR_SLEEVE = { cloth_armor: 0x8a6f4a, iron_armor: 0xcfd4d9, diamond_armor: 0x5fd8e6 };
  function rebuildHeldView(sig, item, def, armorId) {
    if (sig === heldViewKey) return;
    heldViewKey = sig;
    clearHeldItem();
    const arm = new THREE.Group();
    arm.position.set(0.0, -0.02, 0.0);
    arm.rotation.set(-0.62, 0.18, -0.12);
    heldView.add(arm);
    // Minecraftの一人称腕に寄せた、指を作らないシンプルな四角い前腕。防具装備中は袖を防具色に。
    const sleeveColor = ARMOR_SLEEVE[armorId] || 0x2f78c8;
    heldBox(arm, 0.26, 0.42, 0.24, sleeveColor, 0, -0.19, 0.03); // sleeve
    heldBox(arm, 0.255, 0.52, 0.235, 0xd29a68, 0, 0.24, -0.02); // bare arm/hand
    if (ARMOR_SLEEVE[armorId]) heldBox(arm, 0.28, 0.1, 0.26, sleeveColor, 0, 0.02, 0.01); // 手首の防具カフ
    heldBox(arm, 0.035, 0.4, 0.02, 0xb77a4d, 0.095, 0.25, -0.145); // side shadow stripe
    let itemMesh = null;
    if (def && def.tool) itemMesh = makeHeldTool(item.id, def);
    else if (def && def.block != null) itemMesh = makeHeldBlock(def.block);
    else if (def && def.food) itemMesh = makeHeldFood(item.id);
    if (itemMesh) {
      // 手元は全部 depthTest 無しなので、同じ renderOrder だと半透明パスの距離順で腕が後に描かれ、
      // 道具が腕に隠れてしまう。持ち物は腕より必ず後に描く
      itemMesh.traverse(o => { o.renderOrder = 1010; });
      heldView.add(itemMesh);
    }
  }
  function updateHeldItemView(dt, tg) {
    const item = typeof selectedItem === 'function' ? selectedItem() : null;
    const def = item ? ITEM_DEFS[item.id] : null;
    const armorId = (typeof SAVE !== 'undefined' && SAVE.armor) ? SAVE.armor.id : '';
    const sig = `${item ? item.id : 'emptyHand'}|${armorId}`;
    rebuildHeldView(sig, item, def, armorId);
    handSwingImpulse = Math.max(0, handSwingImpulse - dt * 5);
    heldSwing += dt * (mouseHeld.left ? 10 : 2.2);
    const swing = (mouseHeld.left ? Math.sin(heldSwing) * 0.055 : Math.sin(heldSwing) * 0.018) + handSwingImpulse * -0.22;
    const bob = started ? Math.sin(performance.now() * 0.006) * 0.012 : 0;
    heldView.quaternion.copy(camera.quaternion);
    heldView.scale.setScalar(0.9);
    const offset = new THREE.Vector3(0.58 + swing, -0.48 + bob - Math.abs(swing) * 0.28, -0.9).applyQuaternion(camera.quaternion);
    heldView.position.copy(camera.position).add(offset);
    heldView.visible = started && !CAMERA_VIEW.thirdPerson && !isContainerOpen() && !(typeof SURVIVAL !== 'undefined' && SURVIVAL.dead);
  }
