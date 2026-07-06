  /* ============== 昼夜サイクル ============== */
  // 1周を約24分に（以前は12分で速すぎた）。ラベルは実際の明るさ(sunArc)と揃える。
  // sunArc は time 0.0〜0.5 で昼側(+)、0.5〜1.0 で夜側(-)。昼を長め・夜を約1/3にする。
  const DAY = { time: 0.15, speed: 1 / 1440, light: 1, label: '昼' };
  function updateDayNight(dt) {
    if (!started || RAVE.on) return;
    DAY.time = (DAY.time + dt * DAY.speed) % 1;
    const t = DAY.time;
    const sunArc = Math.sin(t * Math.PI * 2);
    DAY.light = THREE.MathUtils.clamp(0.24 + Math.max(0, sunArc) * 0.86, 0.18, 1.1);
    DAY.label = (t >= 0.54 && t < 0.88) ? '夜' : (t >= 0.46 && t < 0.54) ? '夕方' : (t >= 0.88) ? '朝' : '昼';
    const angle = t * Math.PI * 2;
    SUN_OFFSET.set(Math.cos(angle) * 52, Math.max(14, Math.sin(angle) * 96), Math.sin(angle + 0.35) * 42);
  }
