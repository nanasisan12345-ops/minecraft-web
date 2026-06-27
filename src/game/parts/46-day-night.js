  /* ============== 昼夜サイクル ============== */
  const DAY = { time: 0.18, speed: 1 / 720, light: 1, label: '昼' };
  function updateDayNight(dt) {
    if (!started || RAVE.on) return;
    DAY.time = (DAY.time + dt * DAY.speed) % 1;
    const sunArc = Math.sin(DAY.time * Math.PI * 2);
    DAY.light = THREE.MathUtils.clamp(0.24 + Math.max(0, sunArc) * 0.86, 0.18, 1.1);
    DAY.label = DAY.time < 0.23 || DAY.time > 0.78 ? '夜' : DAY.time < 0.33 ? '朝' : DAY.time > 0.68 ? '夕方' : '昼';
    const angle = DAY.time * Math.PI * 2;
    SUN_OFFSET.set(Math.cos(angle) * 52, Math.max(14, Math.sin(angle) * 96), Math.sin(angle + 0.35) * 42);
  }
