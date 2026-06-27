  /* ============== 蛍（夜の屋外パーティクル） ============== */
  const FIREFLY_N = 44;
  function makeFireflyTex() {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(224,255,150,0.7)');
    grd.addColorStop(1, 'rgba(180,255,80,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 16, 16);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const fireflyGeo = new THREE.BufferGeometry();
  const fireflyPos = new Float32Array(FIREFLY_N * 3);
  const fireflyCol = new Float32Array(FIREFLY_N * 3);
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
  fireflyGeo.setAttribute('color', new THREE.BufferAttribute(fireflyCol, 3));
  const fireflyData = [];
  for (let i = 0; i < FIREFLY_N; i++) {
    fireflyData.push({ ax: rnd(-15, 15), az: rnd(-15, 15), phase: Math.random() * 6.28, sp: rnd(0.3, 0.9), yoff: rnd(0.8, 3.2), blink: Math.random() * 6.28, blinkSp: rnd(1.6, 3.2) });
  }
  const fireflyMat = new THREE.PointsMaterial({
    size: 0.5, map: makeFireflyTex(), vertexColors: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1,
  });
  const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
  fireflies.frustumCulled = false;
  fireflies.visible = false;
  scene.add(fireflies);

  let fireflyAmount = 0;
  function fireflyBiomeOk() {
    const b = biomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z)).id;
    return b === 'plains' || b === 'forest' || b === 'swamp' || b === 'jungle';
  }
  function updateFireflies(dt) {
    const ravePaused = typeof RAVE !== 'undefined' && RAVE.on;
    const night = typeof DAY !== 'undefined' ? THREE.MathUtils.clamp((0.6 - DAY.light) / 0.4, 0, 1) : 0;
    const ground = heightAt(Math.floor(player.pos.x), Math.floor(player.pos.z));
    const aboveGround = player.pos.y > ground - 2;
    const target = (!started || ravePaused || !aboveGround || !fireflyBiomeOk()) ? 0 : night;
    fireflyAmount += (target - fireflyAmount) * Math.min(1, dt * 1.5);
    if (fireflyAmount < 0.02) { fireflies.visible = false; return; }
    fireflies.visible = true;
    const baseX = player.pos.x, baseZ = player.pos.z;
    for (let i = 0; i < FIREFLY_N; i++) {
      const d = fireflyData[i];
      d.phase += dt * d.sp; d.blink += dt * d.blinkSp;
      d.ax += Math.cos(d.phase * 0.7) * dt * 0.4; d.az += Math.sin(d.phase * 0.5) * dt * 0.4;
      d.ax = THREE.MathUtils.clamp(d.ax, -17, 17); d.az = THREE.MathUtils.clamp(d.az, -17, 17);
      const fx = baseX + d.ax + Math.cos(d.phase) * 1.4;
      const fz = baseZ + d.az + Math.sin(d.phase * 0.8) * 1.4;
      const gy = heightAt(Math.floor(fx), Math.floor(fz));
      const fy = gy + d.yoff + Math.sin(d.phase * 1.7) * 0.5;
      fireflyPos[i * 3] = fx; fireflyPos[i * 3 + 1] = fy; fireflyPos[i * 3 + 2] = fz;
      const b = (0.35 + 0.65 * Math.max(0, Math.sin(d.blink))) * fireflyAmount;
      fireflyCol[i * 3] = b * 0.78; fireflyCol[i * 3 + 1] = b; fireflyCol[i * 3 + 2] = b * 0.3;
    }
    fireflyGeo.attributes.position.needsUpdate = true;
    fireflyGeo.attributes.color.needsUpdate = true;
  }
