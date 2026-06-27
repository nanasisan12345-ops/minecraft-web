  /* ============== ターゲット枠 ============== */
  const highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.003, 1.003, 1.003)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }));
  highlight.visible = false; scene.add(highlight);
