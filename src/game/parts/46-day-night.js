  /* ============== 昼夜サイクル ============== */
  // 1周を約24分に（以前は12分で速すぎた）。ラベルは実際の明るさ(sunArc)と揃える。
  // sunArc は time 0.0〜0.5 で昼側(+)、0.5〜1.0 で夜側(-)。昼を長め・夜を約1/3にする。
  // 空は「昼の写真／夕焼けパノラマ／夜空パノラマ」の3枚を時間帯でクロスフェードする
  // （dayAmt/sunsetAmt/nightAmt を updateWeather が読んで各パノラマの不透明度に使う）。
  const DAY = {
    time: 0.15, speed: 1 / 1440, light: 1, label: '昼',
    dayAmt: 1, nightAmt: 0, sunsetAmt: 0, sunriseAmt: 0,
  };
  function updateDayNight(dt) {
    if (!started || RAVE.on) return;
    DAY.time = (DAY.time + dt * DAY.speed) % 1;
    const t = DAY.time;
    const sunArc = Math.sin(t * Math.PI * 2);
    const rising = Math.cos(t * Math.PI * 2) > 0; // cos>0 は太陽が昇る側（朝）、cos<0 は沈む側（夕）
    const golden = Math.max(0, 1 - Math.abs(sunArc) / 0.30); // 太陽が地平線近く=焼けの強さ
    DAY.dayAmt = Math.max(0, sunArc);            // 0=夜 1=正午
    DAY.nightAmt = Math.max(0, -sunArc);         // 0=昼 1=真夜中
    DAY.sunriseAmt = rising ? golden : 0;        // 朝焼け（朝日パノラマ）
    DAY.sunsetAmt = rising ? 0 : golden;         // 夕焼け（夕焼けパノラマ）
    DAY.light = THREE.MathUtils.clamp(0.13 + DAY.dayAmt * 0.97, 0.11, 1.1); // 夜をしっかり暗く
    DAY.label = (t >= 0.54 && t < 0.88) ? '夜' : (t >= 0.46 && t < 0.54) ? '夕方' : (t >= 0.88) ? '朝' : '昼';
    const angle = t * Math.PI * 2;
    SUN_OFFSET.set(Math.cos(angle) * 52, Math.max(14, Math.sin(angle) * 96), Math.sin(angle + 0.35) * 42);
  }
