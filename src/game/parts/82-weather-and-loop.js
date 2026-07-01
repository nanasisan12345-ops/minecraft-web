  /* ============== 天候システム（ランダムに 快晴⇄晴れ⇄曇り⇄雨 が移り変わる） ============== */
  // Sky(大気散乱)・フォグ・太陽/環境光・雲・雨をまとめて制御。会場(RAVE)起動中は会場側が大気を支配するため停止。
  // フォグの far はワールド生成窓(WIN_R=72)の内側に収め、地形の切れ目を常に隠す。
  const WHITE = new THREE.Color(0xffffff);
  const WEATHER = {
    clear:  { label: '☀ 快晴', fog: 0xa3acbb, near: 38, far: 70, sun: 1.32, sunCol: 0xfff2da, hemi: 1.02, hSky: 0xd8edfb, hGnd: 0x5b5542, turb: 2.6, rayl: 2.85, mie: 0.004, cloud: 0.05, cloudCol: 0xffffff, gray: 0.0,  rain: 0, skyTop: 0x1f6fd4, skyMid: 0x4a93e6, skyHor: 0xcfe6f7, glow: 1.0,  hcloud: 0.5 },
    fair:   { label: '🌤 晴れ', fog: 0x9fa9b9, near: 36, far: 70, sun: 1.22, sunCol: 0xfff2da, hemi: 0.96, hSky: 0xd2e8fb, hGnd: 0x565040, turb: 3.4, rayl: 2.6,  mie: 0.005, cloud: 0.12, cloudCol: 0xffffff, gray: 0.0,  rain: 0, skyTop: 0x2a7ad8, skyMid: 0x5aa2ec, skyHor: 0xcbe6f8, glow: 0.92, hcloud: 0.95 },
    cloudy: { label: '☁ 曇り', fog: 0x9d9d9c, near: 32, far: 68, sun: 0.5,  sunCol: 0xe2e6ea, hemi: 0.72, hSky: 0xc4ccd2, hGnd: 0x4c4a44, turb: 10, rayl: 1.0, mie: 0.02,  cloud: 0.78, cloudCol: 0xdde3e6, gray: 0.3,  rain: 0, skyTop: 0x9aabb7, skyMid: 0xb2c2cd, skyHor: 0xccd5da, glow: 0.22, hcloud: 0.98 },
    rain:   { label: '🌧 雨', fog: 0x8f8f8e, near: 22, far: 60, sun: 0.32, sunCol: 0xc9cdd3, hemi: 0.62, hSky: 0x9aa4ac, hGnd: 0x41433f, turb: 14, rayl: 0.5, mie: 0.03,  cloud: 0.92, cloudCol: 0xb0b6bb, gray: 0.45, rain: 1, skyTop: 0x6f7e8a, skyMid: 0x84929c, skyHor: 0x9ba6ae, glow: 0.1,  hcloud: 0.98 },
  };
  const WEATHER_BAG = ['clear', 'clear', 'clear', 'fair', 'fair', 'fair', 'fair', 'cloudy', 'cloudy', 'cloudy', 'rain', 'rain'];
  const wCur = { fog: new THREE.Color(), sunCol: new THREE.Color(), hSky: new THREE.Color(), hGnd: new THREE.Color(), cloudCol: new THREE.Color(), skyTop: new THREE.Color(), skyMid: new THREE.Color(), skyHor: new THREE.Color(), near: 0, far: 0, sun: 0, hemi: 0, turb: 0, rayl: 0, mie: 0, cloud: 0, gray: 0, rain: 0, glow: 0, hcloud: 0 };
  const wTgt = { fog: new THREE.Color(), sunCol: new THREE.Color(), hSky: new THREE.Color(), hGnd: new THREE.Color(), cloudCol: new THREE.Color(), skyTop: new THREE.Color(), skyMid: new THREE.Color(), skyHor: new THREE.Color(), near: 0, far: 0, sun: 0, hemi: 0, turb: 0, rayl: 0, mie: 0, cloud: 0, gray: 0, rain: 0, glow: 0, hcloud: 0 };
  function setWeatherVals(o, w) {
    o.fog.set(w.fog); o.sunCol.set(w.sunCol); o.hSky.set(w.hSky); o.hGnd.set(w.hGnd); o.cloudCol.set(w.cloudCol);
    o.skyTop.set(w.skyTop); o.skyMid.set(w.skyMid); o.skyHor.set(w.skyHor);
    o.near = w.near; o.far = w.far; o.sun = w.sun; o.hemi = w.hemi; o.turb = w.turb; o.rayl = w.rayl; o.mie = w.mie; o.cloud = w.cloud; o.gray = w.gray; o.rain = w.rain; o.glow = w.glow; o.hcloud = w.hcloud;
  }
  let weatherState = 'fair', weatherLabel = WEATHER.fair.label, weatherClock = 0, weatherNext = rnd(25, 50);
  setWeatherVals(wCur, WEATHER.fair); setWeatherVals(wTgt, WEATHER.fair);
  function pickWeather() {
    let n; do { n = WEATHER_BAG[Math.floor(Math.random() * WEATHER_BAG.length)]; } while (n === weatherState && Math.random() < 0.85);
    weatherState = n; weatherLabel = WEATHER[n].label; setWeatherVals(wTgt, WEATHER[n]);
    weatherClock = 0; weatherNext = rnd(35, 85);
  }
  // 曇天/雨で空全体を灰色に沈める大ドーム（Skyシェーダの手前・地形(<34)の奥に置くので地形は隠れない）
  const skyTint = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x9aa4ac, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, fog: false }));
  skyTint.frustumCulled = false; scene.add(skyTint);
  // 雨パーティクル（カメラ周囲のローカル箱内を落下し、下端で上へ循環）
  const RAIN_N = 1100, RAIN_R = 20, RAIN_HH = 13, RAIN_LEN = 0.6;
  const rainPos = new Float32Array(RAIN_N * 6), rainDX = new Float32Array(RAIN_N), rainDY = new Float32Array(RAIN_N), rainDZ = new Float32Array(RAIN_N), rainV = new Float32Array(RAIN_N);
  for (let i = 0; i < RAIN_N; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * RAIN_R;
    rainDX[i] = Math.cos(a) * r; rainDZ[i] = Math.sin(a) * r; rainDY[i] = rnd(-RAIN_HH, RAIN_HH); rainV[i] = rnd(26, 40);
  }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xbcd2e6, transparent: true, opacity: 0, fog: true });
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  let lightning = 0, lightningNext = rnd(4, 10);
  function updateWeather(dt) {
    if (RAVE.on) { rain.visible = false; skyTint.visible = false; skyDome.visible = false; sunGlow.visible = false; photoSky.visible = false; photoOvercast.visible = false; updateEnvironmentAudio(dt, 0); return; } // 会場起動中は会場が大気を支配
    const dayLight = typeof DAY !== 'undefined' ? DAY.light : 1;
    skyDome.visible = true; sunGlow.visible = true; photoSky.visible = skyReady; // 写真の読込完了まで青いグラデ空を見せる
    if (started) { weatherClock += dt; if (weatherClock > weatherNext) pickWeather(); }
    const k = 1 - Math.exp(-dt / 7);
    wCur.fog.lerp(wTgt.fog, k); wCur.sunCol.lerp(wTgt.sunCol, k); wCur.hSky.lerp(wTgt.hSky, k); wCur.hGnd.lerp(wTgt.hGnd, k); wCur.cloudCol.lerp(wTgt.cloudCol, k);
    wCur.skyTop.lerp(wTgt.skyTop, k); wCur.skyMid.lerp(wTgt.skyMid, k); wCur.skyHor.lerp(wTgt.skyHor, k);
    for (const f of ['near', 'far', 'sun', 'hemi', 'turb', 'rayl', 'mie', 'cloud', 'gray', 'rain', 'glow', 'hcloud']) wCur[f] += (wTgt[f] - wCur[f]) * k;
    // 雷（雨が強いほど時々ピカッと光る）
    lightning = Math.max(0, lightning - dt * 3.2);
    if (wCur.rain > 0.55) { lightningNext -= dt; if (lightningNext <= 0) { lightning = 1; lightningNext = rnd(5, 16); playThunderSound(0.8 + Math.random() * 0.5); } }
    const flash = lightning * lightning;
    updateSkyDome(flash);
    // 実写パノラマ空：カメラ位置に追従（視点回転では動かない＝スカイボックス）。天候で晴れ↔曇りをクロスフェード＋全体の明るさ
    photoSky.position.copy(camera.position);
    photoOvercast.position.copy(camera.position);
    photoOvercast.rotation.y += dt * 0.0022; // 曇天パノラマは太陽が無いのでゆっくり流す（晴れは太陽整合のため固定）
    const overcastK = Math.min(1, wCur.gray * 1.7 + Math.max(0, wCur.cloud - 0.4) * 1.4); // 曇り/雨で曇天パノラマをかぶせる
    photoOvercast.visible = overcastK > 0.01;
    photoOvercast.material.opacity = overcastK * (1 - flash * 0.2);
    photoSky.material.color.setScalar(0.86 + 0.16 * wCur.glow).lerp(WHITE, flash * 0.5); // テクスチャ自体を明るく焼いたので等倍付近。曇天のみ少し沈める
    photoOvercast.material.color.setScalar(0.86 + 0.14 * wCur.glow).lerp(WHITE, flash * 0.5); // 曇天テクスチャを明るく保つ（雨でのみ少し沈む）
    scene.fog.color.copy(wCur.fog).lerp(WHITE, flash * 0.6); scene.fog.near = wCur.near; scene.fog.far = wCur.far;
    scene.background.copy(wCur.fog).lerp(WHITE, flash * 0.6);
    sun.intensity = wCur.sun * dayLight + flash * 1.6; sun.color.copy(wCur.sunCol);
    hemi.intensity = wCur.hemi * (0.42 + dayLight * 0.58) + flash * 1.2; hemi.color.copy(wCur.hSky); hemi.groundColor.copy(wCur.hGnd);
    const u = sky.material.uniforms; u.turbidity.value = wCur.turb; u.rayleigh.value = wCur.rayl; u.mieCoefficient.value = wCur.mie;
    clouds.material.opacity = wCur.cloud; clouds.material.color.copy(wCur.cloudCol);
    skyTint.visible = wCur.gray > 0.01; skyTint.material.opacity = wCur.gray * (1 - flash * 0.8); skyTint.position.copy(camera.position);
    skyTint.material.color.copy(wCur.fog).multiplyScalar(0.82).lerp(WHITE, flash * 0.7);
    rain.visible = wCur.rain > 0.03; rainMat.opacity = wCur.rain * 0.55;
    if (rain.visible) {
      rain.position.set(camera.position.x, camera.position.y, camera.position.z);
      const wind = 2.4, slant = 0.18;
      for (let i = 0; i < RAIN_N; i++) {
        rainDY[i] -= rainV[i] * dt; rainDX[i] += wind * dt;
        if (rainDY[i] < -RAIN_HH) { rainDY[i] += RAIN_HH * 2; const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * RAIN_R; rainDX[i] = Math.cos(a) * r; rainDZ[i] = Math.sin(a) * r; }
        if (rainDX[i] > RAIN_R) rainDX[i] -= RAIN_R * 2;
        const o = i * 6;
        rainPos[o] = rainDX[i]; rainPos[o + 1] = rainDY[i]; rainPos[o + 2] = rainDZ[i];
        rainPos[o + 3] = rainDX[i] - slant; rainPos[o + 4] = rainDY[i] - RAIN_LEN; rainPos[o + 5] = rainDZ[i];
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    photoSky.material.color.multiplyScalar(0.55 + dayLight * 0.45);
    photoOvercast.material.color.multiplyScalar(0.55 + dayLight * 0.45);
    updateEnvironmentAudio(dt, wCur.rain);
  }

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now(), dt = Math.min((now - prev) / 1000, 0.05); prev = now;

    if (started) {
      const f = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
      const s = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
      let mx = -Math.sin(yaw) * f + Math.cos(yaw) * s, mz = -Math.cos(yaw) * f - Math.sin(yaw) * s;
      const len = Math.hypot(mx, mz); if (len > 0) { mx /= len; mz /= len; }
      if (DEBUG.fly) {
        const up = (keys['Space'] ? 1 : 0) - ((keys['ShiftLeft'] || keys['ShiftRight']) ? 1 : 0);
        const spd = keys['ControlLeft'] || keys['ControlRight'] ? 24 : 12;
        player.vel.set(0, 0, 0);
        player.pos.x += mx * spd * dt;
        player.pos.z += mz * spd * dt;
        player.pos.y += up * spd * dt;
        player.onGround = true;
        updateSurvival(dt, len > 0.05 || up !== 0);
      } else {
        const spd = (keys['ShiftLeft'] || keys['ShiftRight']) ? SPRINT : WALK;
        player.vel.x = mx * spd; player.vel.z = mz * spd;
        player.vel.y -= GRAVITY * dt;
        if (keys['Space'] && player.onGround) {
          player.vel.y = JUMP; player.onGround = false;
        }
        moveAxis('x', player.vel.x * dt); moveAxis('z', player.vel.z * dt);
        player.onGround = false;
        const fallVel = player.vel.y;
        if (moveAxis('y', player.vel.y * dt)) { if (player.vel.y < 0) { player.onGround = true; applyFallDamage(fallVel); } player.vel.y = 0; }
        if (player.pos.y < CHUNK_Y_MIN - 40) damagePlayer(999);
        updateSurvival(dt, len > 0.05 || Math.abs(player.vel.y) > 0.1);
      }
    }

    // 無限ワールド：移動に応じて生成範囲（窓）を更新
    const pcol = Math.floor(player.pos.x), pcolz = Math.floor(player.pos.z);
    if (Math.max(Math.abs(pcol - winCX), Math.abs(pcolz - winCZ)) >= STEP) regenWindow(pcol, pcolz);

    updateCameraView(dt, null);

    // 太陽と影をプレイヤーに追従
    sun.target.position.copy(player.pos);
    sun.position.copy(player.pos).add(SUN_OFFSET);

    const tg = started ? pickTarget() : null;
    updateCameraView(dt, tg);
    sky.position.copy(camera.position);
    if (tg) { highlight.position.set(tg.block[0] + 0.5, tg.block[1] + 0.5, tg.block[2] + 0.5); highlight.visible = true; } else highlight.visible = false;
    updateMining(dt, tg);
    updateHeldItemView(dt, tg);

    for (const p of pPool) { if (p.life > 0) { p.life -= dt; p.vel.y -= 20 * dt; p.mesh.position.addScaledVector(p.vel, dt); if (p.life <= 0) p.mesh.visible = false; } }

    processWorldJob();
    processRebuildJob();
    processPlantJob();
    updateAnimals(dt);
    updateTravelers(dt);
    updateFireflies(dt);
    updateHostileMobs(dt);
    raveUpdate(dt);
    updateDayNight(dt);
    updateWeather(dt);
    updateTorchLights(dt);
    updateDebugHud(dt);

    cloudTex.offset.x += dt * 0.004;
    clouds.position.x = camera.position.x; clouds.position.z = camera.position.z;
    TX.water.offset.x += dt * 0.02; TX.water.offset.y -= dt * 0.03; // 水面の流れ

    const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
    const biomeLabel = biomeLabelAt(px, pz);
    const villageLabel = typeof villageLabelAt === 'function' ? villageLabelAt(px, pz) : '';
    stats.textContent = `XYZ ${player.pos.x.toFixed(1)} / ${player.pos.y.toFixed(1)} / ${player.pos.z.toFixed(1)}　　選択: ${currentPlaceName()}　　地形チャンク: ${terrainChunkCount()}　　バイオーム: ${biomeLabel}${villageLabel ? '　　村: ' + villageLabel : ''}${RAVE.on ? '' : '　　時間: ' + DAY.label + '　　天候: ' + weatherLabel}${raveStatsText()}`;
    renderer.render(scene, camera);
  }
  regenWindow(Math.floor(player.pos.x), Math.floor(player.pos.z)); // 初期生成
  animate();
  window.__mcReady = true;
