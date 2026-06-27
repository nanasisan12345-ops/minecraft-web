  /* ============== 雲 ============== */
  const cloudTex = (() => {
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'); g.clearRect(0, 0, N, N);
    // 端でループしても継ぎ目が出ないよう、はみ出し分を反対側にも描画
    const puff = (x, y, r, a) => {
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${a})`);
      grd.addColorStop(0.55, `rgba(255,255,255,${a * 0.5})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    };
    // 大きめの綿雲(積雲)：いくつもの粒を重ねて“もこもこの塊”にする
    const cumulus = (cx, cy, scale) => {
      const lobes = 6 + (Math.random() * 6 | 0);
      for (let j = 0; j < lobes; j++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * 18 * scale;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.6;
        const r = (9 + Math.random() * 16) * scale;
        for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) puff(x + dx, y + dy, r, 0.85);
      }
    };
    for (let i = 0; i < 7; i++) cumulus(Math.random() * N, Math.random() * N, 0.7 + Math.random() * 0.9);
    // 薄いちぎれ雲を散らして単調さを消す
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * N, y = Math.random() * N, r = 6 + Math.random() * 12;
      for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) puff(x + dx, y + dy, r, 0.4);
    }
    const t = new THREE.CanvasTexture(c); // 既定の線形フィルタでなめらかな雲に
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.2, 2.2);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  })();
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(900, 900),
    new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
  clouds.rotation.x = Math.PI / 2; clouds.position.y = 90; clouds.visible = false; scene.add(clouds); // 実写パノラマに置き換え（頭上の手描き雲は不使用）
