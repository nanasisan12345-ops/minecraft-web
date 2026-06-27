  /* ============== 小型レイブ会場 ============== */
  const RAVE = {
    on: false, kind: '', group: null,
    lights: [], spots: [], lasers: [], tiles: [], dancers: [], rings: [], pulses: [], cheers: [], fireworks: [], shockwaves: [], noteBlocks: [], specialObjects: [], entryObstacles: [], meteors: [], meteorNext: 0, skyFwNext: 0, mirror: null, strobe: null,
    bpm: 128, audioStart: 0, nextNote: 0, step: 0, vel: 1, pitchMul: 1, cycle: 0, acidPrev: null, acidStep: -99, master: null, noiseBuf: null, saved: {}, radius: 6,
    reverb: null, delay: null, duck: null, duckDepth: 0.4, kickBus: null, djFilter: null,
    reactionBeat: -999, reactionPower: 0, reactionBar: -1, muted: false,
    playerPose: null, playerPoseUntil: 0, playerPoseLabel: '',
    djLabel: '', djLabelUntil: 0, djLoopUntil: 0, djLoopStep: 0, djEnergyUntil: 0,
    hype: 0, hypeMaxUntil: 0, hypeCooldownUntil: 0,
    combo: 0, comboUntil: 0,
  };
  const RAVE_VENUES = {
    classic: { label: 'WAREHOUSE RAVE', bpm: 132, hue: 0.60, w: 9,  d: 7,  tile: 1.35, shape: 'square', dancers: 13, lasers: 8, lights: 3, spots: 2 },
    neon:    { label: 'EUROBEAT ROAD',  bpm: 156, hue: 0.03, w: 7,  d: 13, tile: 1.08, shape: 'runway', dancers: 12, lasers: 2, lights: 5, spots: 4 },
    forest:  { label: 'TRANCE DOME',    bpm: 138, hue: 0.53, w: 11, d: 11, tile: 1.08, shape: 'circle', dancers: 14, lasers: 8, lights: 7, spots: 4 },
    laser:   { label: 'DANCE FLOOR',    bpm: 124, hue: 0.12, w: 8,  d: 8,  tile: 1.3,  shape: 'checker', dancers: 16, lasers: 1, lights: 8, spots: 2 },
    future:  { label: 'FUTURE BASS SKY', bpm: 150, hue: 0.78, w: 10, d: 8,  tile: 1.18, shape: 'diamond', dancers: 12, lasers: 3, lights: 6, spots: 3 },
    bass:    { label: 'DRUM BASS TUNNEL', bpm: 174, hue: 0.30, w: 7,  d: 14, tile: 1.04, shape: 'runway', dancers: 14, lasers: 7, lights: 3, spots: 4 },
    chill:   { label: 'LOFI HOUSE LOUNGE', bpm: 112, hue: 0.66, w: 10, d: 8,  tile: 1.24, shape: 'circle', dancers: 9,  lasers: 0, lights: 3, spots: 1 },
    dub:     { label: 'DUBSTEP LAB',      bpm: 140, hue: 0.85, w: 9,  d: 9,  tile: 1.25, shape: 'checker', dancers: 15, lasers: 8, lights: 4, spots: 3 },
  };
  const venueDock = document.getElementById('venueDock');
  const hypeMeter = document.getElementById('hypeMeter');
  const hypeFill = hypeMeter.querySelector('.hype-fill');
  const hypeValue = hypeMeter.querySelector('.hype-value');
  const comboLine = hypeMeter.querySelector('.combo-line');
  const screenPulse = document.getElementById('screenPulse');
  const vibeToast = document.getElementById('vibeToast');
  RAVE_KEY_BINDINGS.forEach(v => {
    const cfg = RAVE_VENUES[v.kind];
    const chip = document.createElement('div');
    chip.className = 'venue-chip';
    chip.dataset.kind = v.kind;
    chip.title = `${v.key}: ${cfg.label}`;
    chip.innerHTML = `<b>${v.key}</b><span>${cfg.label}</span>`;
    chip.addEventListener('mousedown', e => e.stopPropagation());
    chip.addEventListener('click', e => { e.stopPropagation(); raveToggle(v.kind); });
    venueDock.appendChild(chip);
  });
  function updateVenueDock() {
    [...venueDock.children].forEach(chip => chip.classList.toggle('on', RAVE.on && chip.dataset.kind === RAVE.kind));
  }
  function updateHypeMeter() {
    const value = Math.round(THREE.MathUtils.clamp(RAVE.hype || 0, 0, 1) * 100);
    const comboActive = RAVE.combo > 1 && performance.now() < RAVE.comboUntil;
    hypeMeter.style.display = RAVE.on ? 'block' : 'none';
    hypeMeter.classList.toggle('max', RAVE.on && performance.now() < RAVE.hypeMaxUntil);
    hypeMeter.classList.toggle('combo', RAVE.on && comboActive);
    hypeFill.style.width = `${value}%`;
    hypeValue.textContent = `${value}%`;
    comboLine.textContent = comboActive ? `GROOVE x${Math.min(9, RAVE.combo)}` : '';
  }
  function addCrowdHype(amount, label = '') {
    if (!RAVE.on) return;
    const prev = RAVE.hype || 0;
    if (label) {
      RAVE.combo = performance.now() < RAVE.comboUntil ? Math.min(9, RAVE.combo + 1) : 1;
      RAVE.comboUntil = performance.now() + 5200;
      markDj(label);
      showVibe(RAVE.combo >= 6 ? 'GROOVE FEVER' : label);
    }
    const mult = 1 + Math.max(0, RAVE.combo - 1) * 0.075;
    RAVE.hype = THREE.MathUtils.clamp(prev + amount * mult, 0, 1);
    if (prev < 0.98 && RAVE.hype >= 1 && performance.now() > RAVE.hypeCooldownUntil) triggerHypeMax();
    updateHypeMeter();
  }
  function showVibe(text) {
    vibeToast.textContent = text;
    vibeToast.classList.remove('show');
    void vibeToast.offsetWidth;
    vibeToast.classList.add('show');
    clearTimeout(showVibe._timer);
    showVibe._timer = setTimeout(() => vibeToast.classList.remove('show'), 760);
  }
  function flashScreen(hue = 0.86, power = 0.5) {
    screenPulse.style.background = `radial-gradient(circle at 50% 55%, hsla(${hue * 360},100%,72%,${power}), transparent 46%), linear-gradient(90deg, hsla(${((hue + .18) % 1) * 360},100%,55%,${power * .28}), transparent)`;
    screenPulse.style.opacity = Math.min(0.9, power);
    clearTimeout(flashScreen._timer);
    flashScreen._timer = setTimeout(() => { screenPulse.style.opacity = 0; }, 55);
  }
  function triggerHypeMax() {
    if (!RAVE.on || !actx) return;
    const now = actx.currentTime + 0.012;
    RAVE.hypeMaxUntil = performance.now() + 4200;
    RAVE.hypeCooldownUntil = performance.now() + 9000;
    RAVE.djEnergyUntil = performance.now() + 4200;
    markDj('HYPE MAX');
    showVibe('HYPE MAX');
    flashScreen(0.9, 0.82);
    launchCrowdReaction(1.25, true);
    launchShockwave(1.4);
    launchFireworks(16); // グランドフィナーレ級の大連発
    vCrash(now, RAVE.kind === 'chill' ? 0.2 : 0.34, RAVE.kind === 'bass' ? 0.48 : 1.25, 9600);
    if (RAVE.kind !== 'chill') vSubDrop(now, RAVE.kind === 'bass' ? 118 : 88, 30, 0.5, 0.65);
  }
  function raveStatsText() {
    if (!RAVE.on) return '';
    const cfg = RAVE_VENUES[RAVE.kind];
    const crowd = RAVE.dancers.slice(1);
    const total = crowd.length;
    const arrived = crowd.filter(d => d.visible && !d.userData.entering).length;
    const entering = crowd.filter(d => d.visible && d.userData.entering).length;
    const crowdText = entering ? `入場 ${arrived}/${total} +${entering}` : `入場 ${arrived}/${total}`;
    const now = performance.now();
    const pose = RAVE.playerPose && now < RAVE.playerPoseUntil ? `　　参加: ${RAVE.playerPoseLabel}` : '';
    const dj = RAVE.djLabel && now < RAVE.djLabelUntil ? `　　DJ: ${RAVE.djLabel}` : '';
    return `　　会場: ${cfg.label} ♪${RAVE.songNo || 1} BPM ${Math.round(RAVE.bpm)} ${crowdText}${pose}${dj}`;
  }
  function triggerPlayerDance(danceKey) {
    if (!RAVE.on) return;
    RAVE.playerPose = danceKey.move;
    RAVE.playerPoseLabel = `${danceKey.key}:${danceKey.label}`;
    RAVE.playerPoseUntil = performance.now() + 1650;
    const local = playerVenueLocal();
    if (local && Math.hypot(local.x, local.z) < RAVE.radius + 2) launchCrowdReaction(0.56, true);
    if (playerOnDanceFloor(local)) addCrowdHype(0.08, 'DANCE');
  }
  function markDj(label) {
    RAVE.djLabel = label;
    RAVE.djLabelUntil = performance.now() + 2200;
  }
  // 会場ごとのFX設定（リバーブ・ディレイ・サイドチェインの深さ）
  const RAVE_FX = {
    classic: { revLen: 2.6, revDecay: 2.2, revAmt: 0.9, dlyMul: 0.75, dlyFb: 0.28, duck: 0.66 },
    neon:    { revLen: 1.4, revDecay: 2.8, revAmt: 0.6, dlyMul: 0.75, dlyFb: 0.32, duck: 0.46 },
    forest:  { revLen: 3.4, revDecay: 1.8, revAmt: 1.1, dlyMul: 0.75, dlyFb: 0.42, duck: 0.72 },
    laser:   { revLen: 1.8, revDecay: 2.4, revAmt: 0.7, dlyMul: 0.5,  dlyFb: 0.22, duck: 0.44 },
    future:  { revLen: 2.2, revDecay: 2.6, revAmt: 0.75, dlyMul: 0.375, dlyFb: 0.34, duck: 0.74 },
    bass:    { revLen: 1.1, revDecay: 2.0, revAmt: 0.45, dlyMul: 0.375, dlyFb: 0.2,  duck: 0.62 },
    chill:   { revLen: 2.8, revDecay: 2.1, revAmt: 0.85, dlyMul: 0.75,  dlyFb: 0.36, duck: 0.34 },
    dub:     { revLen: 1.5, revDecay: 2.2, revAmt: 0.55, dlyMul: 0.5,   dlyFb: 0.24, duck: 0.4 },
  };
  const SIXTEENTH = () => 60 / RAVE.bpm / 4;
  // グルーヴ：会場ごとのスウィング量（オフの16分を「16分×この割合」だけ後ろへずらしてハネを出す）。
  // 4つ打ち系（テクノ/ユーロ/トランス/dubのハーフタイム）はストレート、ハウス/ディスコ/Lo-Fi/DnBはハネさせる。
  const SWING = { classic: 0, neon: 0, forest: 0, laser: 0.18, future: 0.07, bass: 0.12, chill: 0.24, dub: 0 };
  // 最終サビの転調：1サイクル(32小節)おきに、ビルド〜サビ(12-23小節)を半音2つ上げて“盛り上がる転調”を出す。
  // 転調が映えるジャンルだけ有効（トランス/ユーロ/フューチャーベース/ディスコ）。テクノ/DnB/Lo-Fi/dubはストレート維持。
  const KEYCHANGE = { neon: true, forest: true, future: true, laser: true };

  function emissiveMat(hex, opacity = 1) {
    return new THREE.MeshBasicMaterial({ color: hex, transparent: opacity < 1, opacity, fog: true, blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: opacity >= 1 });
  }
  function raveNoise() {
    if (RAVE.noiseBuf) return RAVE.noiseBuf;
    const len = actx.sampleRate, b = actx.createBuffer(1, len, actx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return RAVE.noiseBuf = b;
  }
  // 疑似コンボリューションリバーブ用の減衰ノイズIR
  function makeReverbIR(seconds, decay) {
    const rate = actx.sampleRate, len = Math.max(1, Math.floor(rate * seconds));
    const buf = actx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  // ソフトサチュレーション（倍音を足して迫力/密度を出す）。カーブはkごとにキャッシュして使い回す
  const _shaperCurves = {};
  function shaperCurve(k) {
    if (_shaperCurves[k]) return _shaperCurves[k];
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return _shaperCurves[k] = c;
  }
  function makeShaper(k) {
    const ws = actx.createWaveShaper(); ws.curve = shaperCurve(k); ws.oversample = '2x'; return ws;
  }
  // リバーブ/ディレイへ送る
  function sendTo(node, target, amt) {
    if (!target || !amt) return;
    const g = actx.createGain(); g.gain.value = amt; node.connect(g).connect(target);
  }
  // サイドチェイン：キックでベース/パッドを瞬間的に沈め、ポンプ感を出す
  function duckTrigger(t, amt) {
    if (!RAVE.duck) return;
    const d = Math.min(0.96, RAVE.duckDepth * amt), beatLen = 60 / RAVE.bpm;
    RAVE.duck.gain.cancelScheduledValues(t);
    RAVE.duck.gain.setValueAtTime(1 - d, t + 0.004);
    RAVE.duck.gain.setTargetAtTime(1, t + 0.02, beatLen * 0.16); // 指数回復で“ポンプ感”（ブレス）を強める
  }
  function vKick(t, base = 46, gain = 1.0, dur = 0.32) {
    gain *= (RAVE.vel || 1);
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * 4.4, t); o.frequency.exponentialRampToValueAtTime(base, t + 0.07);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(RAVE.kickBus); o.start(t); o.stop(t + dur + 0.02);
    const c = actx.createOscillator(), cg = actx.createGain();
    c.type = 'triangle'; c.frequency.setValueAtTime(1500, t); c.frequency.exponentialRampToValueAtTime(320, t + 0.02);
    cg.gain.setValueAtTime(gain * 0.55, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    c.connect(cg).connect(RAVE.kickBus); c.start(t); c.stop(t + 0.04);
    // ノイズの“ビーター”トランジェントを足して、小型スピーカーでもキックが抜ける
    const n = actx.createBufferSource(); n.buffer = raveNoise();
    const nf = actx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 2400;
    const ng = actx.createGain(); ng.gain.setValueAtTime(gain * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    n.connect(nf).connect(ng).connect(RAVE.kickBus); n.start(t); n.stop(t + 0.03);
    duckTrigger(t, gain);
  }
  function vHat(t, open, bright = 7000, gain = 0.3) {
    gain *= (RAVE.vel || 1);
    const s = actx.createBufferSource(); s.buffer = raveNoise();
    const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = bright;
    const g = actx.createGain(); const dur = open ? 0.16 : 0.035;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const pan = actx.createStereoPanner(); pan.pan.value = rnd(-0.55, 0.55); // ハットを左右に散らして広がりを出す
    s.connect(hp).connect(g).connect(pan).connect(RAVE.master); s.start(t); s.stop(t + dur + 0.02);
  }
  function vClap(t, gainBase = 0.45, band = 1600, rev = 0.12) {
    gainBase *= (RAVE.vel || 1);
    const g = actx.createGain(); g.connect(RAVE.master); sendTo(g, RAVE.reverb, rev);
    for (let k = 0; k < 3; k++) {
      const s = actx.createBufferSource(); s.buffer = raveNoise();
      const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = band; bp.Q.value = 1.2;
      const eg = actx.createGain(); const tt = t + k * 0.012;
      eg.gain.setValueAtTime(0.0, tt); eg.gain.linearRampToValueAtTime(gainBase, tt + 0.002); eg.gain.exponentialRampToValueAtTime(0.001, tt + 0.12);
      const cp = actx.createStereoPanner(); cp.pan.value = (k - 1) * 0.35; // 3連の拍を左右に散らして広いクラップに
      s.connect(bp).connect(eg).connect(cp).connect(g); s.start(tt); s.stop(tt + 0.14);
    }
  }
  function vSnare(t, gain = 0.4, rev = 0.18) {
    gain *= (RAVE.vel || 1);
    const tn = actx.createOscillator(), tg = actx.createGain();
    tn.type = 'triangle'; tn.frequency.setValueAtTime(330, t); tn.frequency.exponentialRampToValueAtTime(180, t + 0.08);
    tg.gain.setValueAtTime(gain * 0.6, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    tn.connect(tg).connect(RAVE.master); tn.start(t); tn.stop(t + 0.13);
    const s = actx.createBufferSource(); s.buffer = raveNoise();
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const g = actx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    s.connect(bp).connect(g).connect(RAVE.master); sendTo(g, RAVE.reverb, rev); s.start(t); s.stop(t + 0.16);
  }
  function vBass(t, f, opt = {}) {
    const wave = opt.wave || 'sawtooth', cut = opt.cut || 500, dur = opt.dur || 0.2, gain = (opt.gain || 0.26) * (RAVE.vel || 1), q = opt.q || 6;
    f *= (RAVE.pitchMul || 1); // 最終サビの転調
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = q;
    if (opt.env) { lp.frequency.setValueAtTime(cut * opt.env, t); lp.frequency.exponentialRampToValueAtTime(cut, t + dur * 0.6); }
    else lp.frequency.value = cut;
    const g = actx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.setValueAtTime(gain, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    // サチュレーションで倍音を足し、サブだけに頼らず小型スピーカーでも太く聞こえるベースに
    const drive = makeShaper(opt.drive != null ? opt.drive : 1.25);
    lp.connect(drive).connect(g).connect(RAVE.duck);
    const o = actx.createOscillator(); o.type = wave; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + dur + 0.03);
    if (opt.detune) { const o2 = actx.createOscillator(); o2.type = wave; o2.frequency.value = f; o2.detune.value = opt.detune; o2.connect(lp); o2.start(t); o2.stop(t + dur + 0.03); }
    if (opt.sub !== false) {
      const s = actx.createOscillator(), sg = actx.createGain(); s.type = 'sine'; s.frequency.value = f;
      sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(gain * 0.85, t + 0.012); sg.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(sg).connect(RAVE.duck); s.start(t); s.stop(t + dur + 0.03);
    }
  }
  function vSuper(t, f, opt = {}) {
    const n = opt.voices || 5, det = opt.detune || 14, dur = opt.dur || 0.4, gain = (opt.gain || 0.05) * (RAVE.vel || 1), type = opt.type || 'sawtooth';
    f *= (RAVE.pitchMul || 1); // 最終サビの転調
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = opt.q || 1;
    lp.frequency.setValueAtTime(opt.cutStart || opt.cut || 3000, t);
    if (opt.cutEnd) lp.frequency.exponentialRampToValueAtTime(opt.cutEnd, t + dur * 0.55);
    const g = actx.createGain(); const atk = opt.atk || 0.02;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + atk);
    g.gain.setValueAtTime(gain, t + Math.max(atk, dur * 0.55)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const dest = opt.duck === false ? RAVE.master : RAVE.duck;
    lp.connect(g).connect(dest);
    sendTo(g, RAVE.reverb, opt.rev || 0); sendTo(g, RAVE.delay, opt.dly || 0);
    const spread = opt.spread !== undefined ? opt.spread : 0.72; // ユニゾンを左右に広げてステレオの厚みを出す
    for (let i = 0; i < n; i++) {
      const o = actx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = (i - (n - 1) / 2) * det + rnd(-3, 3);
      if (n > 1 && spread > 0) { const p = actx.createStereoPanner(); p.pan.value = ((i / (n - 1)) * 2 - 1) * spread; o.connect(p).connect(lp); }
      else o.connect(lp);
      o.start(t); o.stop(t + dur + 0.04);
    }
  }
  function vChord(t, freqs, opt = {}) { for (const f of freqs) vSuper(t, f, opt); }
  function vStab(t, freqs, rev = 0.2) {
    freqs = freqs.map(x => x * (RAVE.pitchMul || 1)); // 最終サビの転調
    const lp = actx.createBiquadFilter(), g = actx.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.14); lp.Q.value = 5;
    g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.13 * (RAVE.vel || 1), t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    lp.connect(g).connect(RAVE.duck); sendTo(g, RAVE.reverb, rev);
    for (const f of freqs) { const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = rnd(-8, 8); o.connect(lp); o.start(t); o.stop(t + 0.2); }
  }
  function vTom(t, f = 150, gainBase = 0.2) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(42, f * 0.48), t + 0.11);
    g.gain.setValueAtTime(gainBase, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(RAVE.master); o.start(t); o.stop(t + 0.17);
  }
  function vNoiseHit(t, tone = 900, gainBase = 0.16, dur = 0.08, rev = 0.25) {
    const s = actx.createBufferSource(); s.buffer = raveNoise();
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = tone; bp.Q.value = 5;
    const g = actx.createGain(); g.gain.setValueAtTime(gainBase, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(bp).connect(g).connect(RAVE.master); sendTo(g, RAVE.reverb, rev); s.start(t); s.stop(t + dur + 0.02);
  }
  function vRiser(t, dur) {
    const s = actx.createBufferSource(); s.buffer = raveNoise(); s.loop = true;
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    s.connect(bp).connect(g).connect(RAVE.master); sendTo(g, RAVE.reverb, 0.3); s.start(t); s.stop(t + dur + 0.08);
  }
  function vCrash(t, gainBase = 0.2, dur = 1.2, bright = 7200) {
    const s = actx.createBufferSource(); s.buffer = raveNoise();
    const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = bright;
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = bright * 1.2; bp.Q.value = 0.8;
    const g = actx.createGain();
    g.gain.setValueAtTime(gainBase, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(hp).connect(bp).connect(g).connect(RAVE.master); sendTo(g, RAVE.reverb, 0.38);
    s.start(t); s.stop(t + dur + 0.04);
  }
  function vRide(t, gainBase = 0.055, bright = 8800) {
    const s = actx.createBufferSource(); s.buffer = raveNoise();
    const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = bright;
    const g = actx.createGain();
    g.gain.setValueAtTime(gainBase, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    s.connect(hp).connect(g).connect(RAVE.master);
    s.start(t); s.stop(t + 0.25);
  }
  function vSubDrop(t, start = 92, end = 34, gainBase = 0.42, dur = 0.75) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(start, t);
    o.frequency.exponentialRampToValueAtTime(end, t + dur);
    g.gain.setValueAtTime(gainBase, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(RAVE.duck); o.start(t); o.stop(t + dur + 0.04);
  }
  function vVocalChop(t, f, opt = {}) {
    f *= (RAVE.pitchMul || 1); // 最終サビの転調
    const dur = opt.dur || 0.1, gain = opt.gain || 0.045;
    const g = actx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(RAVE.master); sendTo(g, RAVE.delay, opt.dly || 0.16); sendTo(g, RAVE.reverb, opt.rev || 0.12);
    for (const formant of [760, 1320, 2450]) {
      const o = actx.createOscillator(), bp = actx.createBiquadFilter();
      o.type = opt.type || 'square'; o.frequency.value = f;
      bp.type = 'bandpass'; bp.frequency.value = formant * (opt.tone || 1); bp.Q.value = 7;
      o.connect(bp).connect(g); o.start(t); o.stop(t + dur + 0.03);
    }
  }
  function vWobble(t, f, opt = {}) {
    f *= (RAVE.pitchMul || 1); // 最終サビの転調
    const dur = opt.dur || 0.22, gain = opt.gain || 0.22, cut = opt.cut || 420;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = opt.q || 10; lp.frequency.value = cut;
    const lfo = actx.createOscillator(), lg = actx.createGain();
    lfo.frequency.value = opt.rate || 6; lg.gain.value = opt.depth || 260;
    lfo.connect(lg).connect(lp.frequency);
    const g = actx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    lp.connect(g).connect(RAVE.duck);
    for (const det of [0, opt.detune || 7]) {
      const o = actx.createOscillator(); o.type = opt.wave || 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.04);
    }
    lfo.start(t); lfo.stop(t + dur + 0.04);
  }
  // dubstep の“うねる”グロウル・ベース：1音を長く保持し、テンポ同期したサインLFOで
  // レゾナント・ローパスと音量ゲート（0↔最大）を同位相に揺らして、クリックなしで滑らかに刻む。
  // 歪みは1段の軽めにし、その後トーン用ローパスでジャリ付き（高域ノイズ）を除去。
  function vDubWobble(t, f, opt = {}) {
    const dur = opt.dur || 0.5, gain = opt.gain || 0.3;
    const cut = opt.cut || 480, depth = opt.depth || 520, q = opt.q || 10;
    const lfoHz = opt.lfoHz || 6;
    const pre = actx.createGain();                                   // 歪み前のミックス点
    const env = actx.createGain();                                   // ノート全体のエンベロープ
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + 0.01);
    env.gain.setValueAtTime(1, Math.max(t + 0.06, t + dur - 0.05)); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const outG = actx.createGain(); outG.gain.value = gain;
    // ── うねりの音色：レゾナント・ローパス（サインLFOで掃引）──
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = q; lp.frequency.value = cut;
    const fltLfo = actx.createOscillator(); fltLfo.type = 'sine'; fltLfo.frequency.value = lfoHz;
    const fltLfoG = actx.createGain(); fltLfoG.gain.value = depth; fltLfo.connect(fltLfoG).connect(lp.frequency);
    // ── 音量ゲート：サインLFOで 0↔1（滑らかに刻む＝クリックなし）──
    const amp = actx.createGain(); amp.gain.value = 0.5;
    const ampLfo = actx.createOscillator(); ampLfo.type = 'sine'; ampLfo.frequency.value = lfoHz;
    const ampLfoG = actx.createGain(); ampLfoG.gain.value = 0.5; ampLfo.connect(ampLfoG).connect(amp.gain);
    // ── 軽めの歪み → トーン用ローパス（ジャリ付きを除去）──
    const dist = makeShaper(opt.drive != null ? opt.drive : 2.2);
    const tone = actx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600; tone.Q.value = 0.5;
    lp.connect(amp); amp.connect(dist).connect(tone).connect(pre);
    // 喋るフォルマント（軽く重ねる）
    const formant = actx.createBiquadFilter(); formant.type = 'bandpass'; formant.frequency.value = 800; formant.Q.value = 2.2;
    const fLfo = actx.createOscillator(); fLfo.type = 'sine'; fLfo.frequency.value = Math.max(0.6, lfoHz / 6);
    const fLfoG = actx.createGain(); fLfoG.gain.value = 600; fLfo.connect(fLfoG).connect(formant.frequency);
    const fmix = actx.createGain(); fmix.gain.value = 0.4;
    tone.connect(formant).connect(fmix).connect(pre);
    pre.connect(env).connect(outG).connect(RAVE.duck);
    for (const det of [-9, 9]) { const o = actx.createOscillator(); o.type = opt.wave || 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.06); }
    // サブ：歪み/フォルマントは通さず低域を保つが、ゲート（同じLFO）で一緒に刻む
    const subGate = actx.createGain(); subGate.gain.value = 0.5; ampLfoG.connect(subGate.gain);
    const sub = actx.createOscillator(); sub.type = 'sine'; sub.frequency.value = f; const subg = actx.createGain(); subg.gain.value = 0.9;
    sub.connect(subg).connect(subGate).connect(pre); sub.start(t); sub.stop(t + dur + 0.06);
    fltLfo.start(t); fltLfo.stop(t + dur + 0.06);
    ampLfo.start(t); ampLfo.stop(t + dur + 0.06);
    fLfo.start(t); fLfo.stop(t + dur + 0.06);
  }
  // アシッド（303風）：レゾナントなローパス＋エンベロープ＋連続ノート間のグライド（スライド）。Charlotte de Witte風テクノ用。
  function vAcid(t, f, opt = {}) {
    const dur = opt.dur || 0.18, gain = (opt.gain || 0.05) * (RAVE.vel || 1);
    const o = actx.createOscillator(); o.type = opt.wave || 'sawtooth';
    if (opt.glideFrom) { o.frequency.setValueAtTime(opt.glideFrom, t); o.frequency.exponentialRampToValueAtTime(f, t + (opt.glide || 0.05)); } // 前の音から滑らかに移動
    else o.frequency.setValueAtTime(f, t);
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = opt.q || 12;
    const c0 = opt.cutStart || 400, c1 = opt.cutEnd || 3000;
    lp.frequency.setValueAtTime(c0, t); lp.frequency.exponentialRampToValueAtTime(c1, t + dur * 0.5); lp.frequency.exponentialRampToValueAtTime(Math.max(180, c0 * 0.8), t + dur); // 開いて閉じるフィルターエンベロープ
    const sat = makeShaper(opt.drive || 1.6); // 倍音を足してアシッドらしい主張を出す
    const g = actx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(lp).connect(sat).connect(g).connect(opt.duck === false ? RAVE.master : RAVE.duck);
    sendTo(g, RAVE.reverb, opt.rev || 0); sendTo(g, RAVE.delay, opt.dly || 0);
    o.start(t); o.stop(t + dur + 0.04);
  }
  // リースベース：複数のデチューンしたノコギリ波をゆっくり動くフィルターに通し、歪ませた“うなる/しゃべる”低音。Pendulum風DnB用。
  function vReese(t, f, opt = {}) {
    const dur = opt.dur || 0.2, gain = (opt.gain || 0.3) * (RAVE.vel || 1);
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = opt.q || 8;
    const c0 = opt.cutStart || 240, c1 = opt.cutEnd || 900;
    lp.frequency.setValueAtTime(c0, t); lp.frequency.linearRampToValueAtTime(c1, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(c0, t + dur); // ゆっくり開閉してうなる
    const sat = makeShaper(opt.drive || 2.2); // 歪みでニューロらしい凶悪な倍音
    const g = actx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.setValueAtTime(gain, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    lp.connect(sat).connect(g).connect(RAVE.duck); sendTo(g, RAVE.reverb, opt.rev || 0);
    for (const det of [-14, -6, 7, 15]) { const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.04); } // デチューン重ねがリースの肝
    const s = actx.createOscillator(), sg = actx.createGain(); s.type = 'sine'; s.frequency.value = f; // サブで低域を支える
    sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(gain * 0.7, t + 0.01); sg.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(sg).connect(RAVE.duck); s.start(t); s.stop(t + dur + 0.04);
  }
  // 音名テーブル（Hz） — コード構成音
  const Am = [220, 261.63, 329.63], F = [174.61, 220, 261.63], C = [261.63, 329.63, 392], G = [196, 246.94, 293.66];
  const Dm = [146.83, 174.61, 220], Em = [164.81, 196, 246.94], Bb = [233.08, 293.66, 349.23];
  const Emaj = [164.81, 207.65, 246.94], Dmaj = [146.83, 185.00, 220];
  const Cmaj7 = [261.63, 329.63, 392, 493.88], Am7 = [220, 261.63, 329.63, 392], Dm7 = [146.83, 174.61, 220, 261.63];
  const G7 = [196, 246.94, 293.66, 349.23], Fmaj7 = [174.61, 220, 261.63, 329.63], Em7 = [164.81, 196, 246.94, 293.66];
  const ROOT = { A: 55, F: 43.65, C: 65.41, G: 49, D: 73.42, E: 41.20, Bb: 58.27 }; // ベース基音(低Hz)
  // ユーロビートのリードメロディ（曲ごと・小節×16分音符, 0=休み）
  const EUMEL1 = [
    [880, 0, 659.25, 0, 783.99, 0, 659.25, 0, 587.33, 0, 523.25, 0, 659.25, 0, 587.33, 0],
    [783.99, 0, 659.25, 0, 523.25, 0, 587.33, 0, 659.25, 0, 587.33, 0, 523.25, 0, 440, 0],
    [659.25, 0, 783.99, 0, 880, 0, 783.99, 0, 1046.5, 0, 880, 0, 783.99, 0, 659.25, 0],
    [587.33, 0, 659.25, 0, 783.99, 0, 880, 0, 987.77, 0, 880, 0, 659.25, 0, 587.33, 0],
  ];
  const EUMEL2 = [
    [587.33, 0, 698.46, 0, 880, 0, 698.46, 0, 587.33, 0, 523.25, 0, 440, 0, 523.25, 0],
    [466.16, 0, 587.33, 0, 698.46, 0, 587.33, 0, 932.33, 0, 698.46, 0, 587.33, 0, 466.16, 0],
    [349.23, 0, 523.25, 0, 698.46, 0, 523.25, 0, 880, 0, 698.46, 0, 523.25, 0, 440, 0],
    [523.25, 0, 659.25, 0, 783.99, 0, 1046.5, 0, 783.99, 0, 659.25, 0, 523.25, 0, 587.33, 0],
  ];
  const EUMEL3 = [
    [880, 0, 659.25, 0, 523.25, 0, 659.25, 0, 880, 0, 1046.5, 0, 880, 0, 659.25, 0],
    [783.99, 0, 587.33, 0, 493.88, 0, 587.33, 0, 783.99, 0, 587.33, 0, 493.88, 0, 440, 0],
    [698.46, 0, 523.25, 0, 440, 0, 523.25, 0, 698.46, 0, 880, 0, 698.46, 0, 523.25, 0],
    [830.61, 0, 659.25, 0, 493.88, 0, 659.25, 0, 830.61, 0, 659.25, 0, 830.61, 0, 880, 0],
  ];
  // ディスコのファンキーベース／スタブ（1=基音, 2=オクターブ上, 0=休み）
  const DBASS1 = [1, 0, 2, 0, 1, 1, 0, 2, 1, 0, 2, 0, 1, 2, 1, 0], DSTAB1 = [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0];
  const DBASS2 = [1, 0, 1, 2, 0, 1, 0, 2, 1, 0, 1, 2, 0, 2, 0, 1], DSTAB2 = [0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0];
  const DBASS3 = [1, 1, 0, 2, 1, 0, 2, 0, 1, 1, 0, 2, 1, 0, 2, 0], DSTAB3 = [1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1];
  const FCHOP1 = [0, 659.25, 0, 783.99, 987.77, 0, 783.99, 0, 659.25, 0, 523.25, 0, 587.33, 783.99, 0, 987.77];
  const FCHOP2 = [0, 783.99, 0, 1046.5, 1174.66, 0, 1046.5, 0, 880, 0, 698.46, 0, 783.99, 1046.5, 0, 1318.51];
  const DNB1 = [1, 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 2, 0, 1, 0, 2], DNB2 = [1, 0, 0, 2, 0, 1, 0, 0, 2, 0, 1, 0, 0, 2, 1, 0];
  const DNBHIT = [1, 0, 1, 0, 2, 0, 1, 1, 0, 1, 2, 0, 1, 0, 1, 0];
  const HOUSEBASS1 = [1, 0, 0, 1, 0, 2, 0, 1, 0, 1, 0, 2, 1, 0, 1, 0], HOUSEBASS2 = [1, 0, 2, 0, 1, 0, 0, 1, 0, 2, 0, 1, 1, 0, 0, 2];
  // ============== 作曲レイヤー（キー/スケール/主旋律フック） ==============
  // MIDIノート番号 → 周波数(Hz)
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // スケール（ルートからの半音オフセット）
  const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };
  // スケール度数 → 周波数。degは0=ルート、7=1オクターブ上のルート…と続く（負やオクターブ跨ぎもOK）
  function degToFreq(keyMidi, scaleName, deg) {
    const sc = SCALES[scaleName] || SCALES.minor;
    const oct = Math.floor(deg / 7), idx = ((deg % 7) + 7) % 7;
    return mtof(keyMidi + oct * 12 + sc[idx]);
  }
  function leadFreq(sg, deg) { return degToFreq(sg.key, sg.scale, deg); }
  // パッドにadd9とオクターブを足してトランスらしい広がりのある響きにする
  function padVoicing(chordFreqs) {
    return [...chordFreqs, chordFreqs[0] * 2, chordFreqs[0] * Math.pow(2, 14 / 12)];
  }
  // アップリフティング・トランスの主旋律フック（8小節 × 16分音符, 数字=スケール度数 / .=休符）。
  // i–VI–III–VII 進行に乗る“歌える”オリジナル旋律。前半=問い、後半=オクターブ上の応えで盛り上げる。
  const TRANCE_LEAD = [
    "4...7.6.4.......", // 1小節目(i):   E A G E
    "5...4...2...4...", // 2小節目(VI):  F E C E
    "6...4...2.......", // 3小節目(III): G E C(伸ばす)
    "3...1...3...4...", // 4小節目(VII): D B D E
    "7...9.8.7.......", // 5小節目(i):   A C B A（オクターブ上）
    "9...7...5...7...", // 6小節目(VI):  C A F A
    "6.4.6.7.9.......", // 7小節目(III): G E G A C（駆け上がり）
    "8...7.4.3...4...", // 8小節目(VII): B A E D E（解決して頭へ戻る）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // forest 2曲目用【スカスカ＆低め】。半音符ペースの持続音だけ・オクターブ上げ無しで“漂う”キャラ。
  const TRANCE_LEAD2 = [
    "0.......2.......", // i:   E … G（root→min3を長く）
    "4.......2.......", // VI:  B … G
    "5.......4.......", // III: C … B
    "2.......0.......", // VII: G … E
    "4.......5.......", // i:   B … C
    "2.......4.......", // VI:  G … B
    "5.......4.......", // III: C … B
    "2...0...........", // VII: G E（余白で頭へ戻る）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // forest 3曲目用【ぎっしり＆高め】（進行は Am F Dm G）。16分連打のオクターブ上アルペジオで“忙しい”キャラ。
  const TRANCE_LEAD3 = [
    "7.9.7.9.7.9.7.9.", // i:   A C を高速往復
    "6.7.9.7.6.7.9.7.", // VI:  G A C を刻む
    "9.7.5.7.9.7.5.7.", // iv:  C A F A（Dm 上を走る）
    "4.6.7.9.7.6.4.6.", // VII: E G A C 駆け上がり
    "7.9.8.9.7.9.8.9.", // i:   A C B C 高所で刻む
    "9.7.9.7.6.7.9.7.", // VI:  C A C G A
    "7.9.7.5.7.9.7.5.", // iv:  A C A F（Dm）
    "6.7.9.7.6.4.2...", // VII: G A C…E C 下りて頭へ
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // dubstep（Skrillex風）。低音グロウルのリフ（度数）＋小節ごとに変わるワブル速度＋金属スクリーチのアクセント。
  const DUB_RIFF = [..."0..0.3..0.2.3..5"].map(c => (c === '.' ? null : +c));   // 低音リフ（ドロップで半小節ごとに音程を変える）
  const DUB_WPB = [4, 8, 4, 6, 8, 4, 6, 3];                                     // 半小節ごとの「1拍あたりの刻み回数」＝うねり速度（喋るように変化）
  const DUB_SCREECH = [..."....5.......7..."].map(c => (c === '.' ? null : +c)); // ドロップの金属的な叫び（高域）
  const DUB_RIFF2 = [..."0..3.0..5.0.2..3"].map(c => (c === '.' ? null : +c));   // dub 2曲目: 動きのある別グロウルリフ
  const DUB_SCREECH2 = [..."......7.....5..."].map(c => (c === '.' ? null : +c)); // dub 2曲目: 叫びの位置違い
  const DUB_RIFF3 = [..."0..0.5..3.0.2..0"].map(c => (c === '.' ? null : +c));   // dub 3曲目: 5th跳躍を効かせた別リフ
  const DUB_SCREECH3 = [..."....7.......3..."].map(c => (c === '.' ? null : +c)); // dub 3曲目: 叫びの音程違い
  // techno（Charlotte de Witte風）。歌メロではなく、暗く催眠的に回り続けるアシッド・フック（2小節ループ）。
  // 数字=スケール度数 / .=休符。root/min7/5th/min6/min3 を中心に、ローリングして緊張を保つ。
  const TECHNO_RIFF = [
    "0.0.7.0.0.3.0.4.", // root・root・oct・root … 5th(4=完全5度) でじわっと上がる
    "0.0.7.0.6.0.2.0.", // root・root・oct・min7・min3 と暗く回る
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // techno 2曲目用【スカスカ＆催眠的】。音を間引いて空間を作る、ミニマルで“間”の効いた別リフ。
  const TECHNO_RIFF2 = [
    "0.......7.......", // root … oct を長く放置
    "0...3.......4...", // root … min3 … 5th（隙間で緊張を保つ）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // techno 3曲目用【ぎっしり＆速い】。16分をほぼ全部埋めて転がり続ける、アグレッシブな別リフ。
  const TECHNO_RIFF3 = [
    "0.0.0.7.0.3.4.3.", // root連打→oct→min3→5th と畳みかける
    "0.7.0.4.6.4.2.0.", // root↔oct→5th→min7→min3→root と忙しく回る
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // eurobeat（Dave Rodgers風）。EUMELの16分の上に重ねる、サビで歌い上げるアンセム・トップライン（4小節・ロングトーン主体）。
  // 数字=スケール度数 / .=休符。A5〜C6あたりの“歌える”音域で、問い→答え→盛り上げ→頭へ戻る。
  const EURO_HOOK = [
    "7...9...8...7...", // A5 C6 B5 A5（提示）
    "6...7...5.......", // G5 A5 F5（答えて落ち着く）
    "7...9...8...9...", // A5 C6 B5 C6（一段持ち上げ）
    "8...7...6...7...", // B5 A5 G5 A5（ターンして頭へ）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // eurobeat 2曲目用。低めから駆け上がる別アンセム・トップライン。
  const EURO_HOOK2 = [
    "5...7...8...7...", // F5 A5 B5 A5（下から提示）
    "9...8...7.......", // C6 B5 A5（高みで答える）
    "5...7...9...8...", // F5 A5 C6 B5（一段持ち上げ）
    "7...6...5...7...", // A5 G5 F5 A5（ターンして頭へ）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // eurobeat 3曲目用。高音を保って煽る別トップライン。
  const EURO_HOOK3 = [
    "8...9...7...8...", // B5 C6 A5 B5（提示）
    "6...7...9.......", // G5 A5 C6（持ち上げて答える）
    "8...7...9...8...", // B5 A5 C6 B5（揺らす）
    "9...7...6...7...", // C6 A5 G5 A5（解決して頭へ）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // disco house（Daft Punk風）。フィルターのかかったボコーダー風ボイスで反復する“喋る”ボーカル・チョップ・リフ（2小節ループ）。
  // メジャー度数。root-3rd-5th のアルペジオ反復（"Around the World"系）→ 下って root に解決。
  const DISCO_VOX = [
    "0..2.4..0..2.4..", // C E G C E G（root-3rd-5th を回す）
    "5..4.2..0..0....", // A G E C C（下って解決）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // disco 2曲目用。上から下りてくる別ボーカル・チョップ。
  const DISCO_VOX2 = [
    "4..2.0..4..2.0..", // E C C(下) … 回す
    "2..4.5..4..2....", // C E G E C（持ち上げて解決）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // disco 3曲目用。跳ねて上下する別ボーカル・チョップ。
  const DISCO_VOX3 = [
    "0..4.2..5..4.2..", // C G E A G E（跳ねる）
    "4..2.0..2..0....", // E C C G C（下って解決）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // future bass（Flume風）。既存のchopの上で、ドロップに答えるデチューン強めの“ワンキー”なリード・トップライン（2小節ループ）。
  // メジャー度数。シンコペーションして上下する、明るくほろ苦い応答フレーズ。
  const FLUME_LEAD = [
    "4...5.4.2...4...", // G A G E … G（提示）
    "5...7.5.4.......", // A C A G（一段上げて余韻）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // future 2曲目用。低めから問いかける別リード。
  const FLUME_LEAD2 = [
    "2...4.2.0...2...", // E G E C … E（やわらかい提示）
    "4...5.4.2.......", // G A G E（上げて余韻）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // future 3曲目用。高めで跳ねる別リード。
  const FLUME_LEAD3 = [
    "5...4.5.7...5...", // A G A C … A（提示）
    "4...2.4.5.......", // G E G A（下げて余韻）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // drum & bass（Pendulum風）。低域のリースの上に乗る、ドロップで高域に伸びる歌うアンセム・リード（4小節・ロングトーン→動き）。
  // マイナー度数。各小節で長音を張ってから旋律的に answer する、"Watercolour"系の soaring topline。
  const DNB_LEAD = [
    "4.......7.6.4...", // E5(伸ばし) … A5 G5 E5
    "5.......4...2...", // F5(伸ばし) … E5 C5
    "7.......6.4.....", // A5(伸ばし) … G5 E5
    "3...4...5...4...", // D5 E5 F5 E5（ターンして頭へ）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // dnb 2曲目用。長音→上下する別 soaring リード。
  const DNB_LEAD2 = [
    "5.......7.5.4...", // F5(伸ばし) … A5 F5 E5
    "2.......4...5...", // C5(伸ばし) … E5 F5
    "6.......7.6.....", // G5(伸ばし) … A5 G5
    "4...2...4...5...", // E5 C5 E5 F5（ターンして頭へ）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // dnb 3曲目用。高域を張る別 soaring リード。
  const DNB_LEAD3 = [
    "7.......9.7.6...", // A5(伸ばし) … C6 A5 G5
    "4.......5...7...", // E5(伸ばし) … F5 A5
    "5.......6.4.....", // F5(伸ばし) … G5 E5
    "2...4...5...4...", // C5 E5 F5 E5（ターンして頭へ）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // lo-fi（Nujabes風）。ジャズ/ソウルなローズの旋律（メジャー・ペンタトニック主体・4小節）。隙間を活かしてゆったり歌う。
  // メジャー度数の C D E G A（=ペンタ）中心。EDM系のドロップ専用ではなく、イントロ以外は常に流れるメインの旋律。
  const LOFI_MEL = [
    "4...2.4.5.......", // G E G A（やわらかく上がって余白）
    "2...1...0.......", // E D C（落ち着く）
    "5...4.2.1...2...", // A G E D … E（ソウルフルに回す）
    "1...0.......0...", // D C … C（余白を取って解決）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // lo-fi 2曲目用。ペンタ内でやさしく上下する別旋律。
  const LOFI_MEL2 = [
    "2...4.5.4.......", // E G A G（ふわっと上がる）
    "1...2...4.......", // D E G（持ち上げて余白）
    "5...7.5.4...2...", // A C A G … E（ソウルフルに回す）
    "2...1.......0...", // E D … C（余白を取って解決）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // lo-fi 3曲目用。少し高めから歌い出す別旋律。
  const LOFI_MEL3 = [
    "4...5.7.5.......", // G A C A（高めに開く）
    "4...2...1.......", // G E D（下りて余白）
    "2...4.5.7...5...", // E G A C … A（ソウルフルに回す）
    "4...2.......0...", // G E … C（余白を取って解決）
  ].map(row => [...row].map(c => (c === '.' ? null : +c)));
  // 各ジャンルの曲リスト（会場を出すたびにランダムで1曲選ぶ）。
  // 曲ごとに BPM・ベース/リード音色・リズム密度まで変えて差を大きくする。
  const SONGS = {
    classic: [
      // Charlotte de Witte風ダークテクノ。key=アシッド・フックの基準MIDI、scale=スケール、lead=催眠リフ
      { bpm: 130, root: 55, alt: 82.41, key: 57, scale: 'minor', arr: 'peak',  lead: TECHNO_RIFF, stabA: Am, stabB: F, bw: 'sawtooth', bcut: 240, roll: false }, // A minor（peak-time）
      { bpm: 140, root: 73.42, alt: 110, key: 50, scale: 'minor', arr: 'rave',  lead: TECHNO_RIFF3, stabA: Dm, stabB: Bb, bw: 'square', bcut: 320, roll: true },   // D minor（ハード・アシッド）
      { bpm: 122, root: 82.41, alt: 61.74, key: 52, scale: 'minor', arr: 'hypno', lead: TECHNO_RIFF2, stabA: Em, stabB: C, bw: 'sawtooth', bcut: 190, roll: false }, // E minor（ミニマル/ダブ）
    ],
    neon: [
      // Dave Rodgers風スーパーユーロビート。mel=既存の16分メロ、key/scale/hook=サビのアンセム・トップライン
      { bpm: 158, key: 69, scale: 'minor', arr: 'super', hook: EURO_HOOK, prog: [{ n: Am, r: ROOT.A }, { n: F, r: ROOT.F }, { n: C, r: ROOT.C }, { n: G, r: ROOT.G }], mel: EUMEL1, lw: 'sawtooth', lcut: 4200 }, // A minor（Dave Rodgers系）
      { bpm: 145, key: 62, scale: 'minor', arr: 'night', hook: EURO_HOOK3, prog: [{ n: Dm, r: ROOT.D }, { n: Bb, r: ROOT.Bb }, { n: F, r: ROOT.F }, { n: C, r: ROOT.C }], mel: EUMEL2, lw: 'triangle', lcut: 3000 },   // D minor（メロディアス・ナイト）
      { bpm: 175, key: 69, scale: 'minor', arr: 'power', hook: EURO_HOOK2, prog: [{ n: Am, r: ROOT.A }, { n: G, r: ROOT.G }, { n: F, r: ROOT.F }, { n: Emaj, r: ROOT.E }], mel: EUMEL3, lw: 'sawtooth', lcut: 5400 }, // A minor（アグレッシブ）
    ],
    forest: [
      // Armin van Buuren風アップリフティング・トランス。key=度数0のMIDI、scale=スケール、lead=主旋律フック
      { bpm: 138, key: 69, scale: 'minor', arr: 'anthem',  lead: TRANCE_LEAD, prog: [{ n: Am, r: ROOT.A }, { n: F, r: ROOT.F }, { n: C, r: ROOT.C }, { n: G, r: ROOT.G }], pw: 'sawtooth', arpEvery: 2 }, // A minor: Am F C G（Armin系アンセム）
      { bpm: 124, key: 64, scale: 'minor', arr: 'emotive', lead: TRANCE_LEAD2, prog: [{ n: Em, r: ROOT.E }, { n: C, r: ROOT.C }, { n: G, r: ROOT.G }, { n: Dmaj, r: ROOT.D }], pw: 'triangle', arpEvery: 2 }, // E minor: Em C G D（Above&Beyond系エモ/プログレ）
      { bpm: 145, key: 69, scale: 'minor', arr: 'driving', lead: TRANCE_LEAD3, prog: [{ n: Am, r: ROOT.A }, { n: F, r: ROOT.F }, { n: Dm, r: ROOT.D }, { n: G, r: ROOT.G }], pw: 'sawtooth', arpEvery: 1 }, // A minor: Am F Dm G（テック/プログレ・トランス）
    ],
    laser: [
      // Daft Punk風フィルターディスコハウス。key/scale/vox=ボコーダー風の反復ボーカル・チョップ・リフ
      { bpm: 124, key: 72, scale: 'major', arr: 'french', vox: DISCO_VOX, prog: [{ n: Cmaj7, r: ROOT.C }, { n: Am7, r: ROOT.A }, { n: Dm7, r: ROOT.D }, { n: G7, r: ROOT.G }], bass: DBASS1, stab: DSTAB1, bw: 'sawtooth', bcut: 700 }, // C major（Daft Punk系）
      { bpm: 114, key: 72, scale: 'major', arr: 'nu',     vox: DISCO_VOX2, prog: [{ n: Fmaj7, r: ROOT.F }, { n: Em7, r: ROOT.E }, { n: Dm7, r: ROOT.D }, { n: G7, r: ROOT.G }], bass: DBASS2, stab: DSTAB2, bw: 'square', bcut: 560 },   // C major（ヌーディスコ）
      { bpm: 130, key: 72, scale: 'major', arr: 'funk',   vox: DISCO_VOX3, prog: [{ n: Am7, r: ROOT.A }, { n: Dm7, r: ROOT.D }, { n: G7, r: ROOT.G }, { n: Cmaj7, r: ROOT.C }], bass: DBASS3, stab: DSTAB3, bw: 'sawtooth', bcut: 950 }, // C major（ファンキーハウス）
    ],
    future: [
      // Flume風フューチャーベース。chop=既存の声ネタ、key/scale/lead=ドロップで答えるワンキーなリード
      { bpm: 148, key: 72, scale: 'major', arr: 'flume',   lead: FLUME_LEAD, prog: [{ n: Am7, r: ROOT.A }, { n: Fmaj7, r: ROOT.F }, { n: Cmaj7, r: ROOT.C }, { n: G7, r: ROOT.G }], chop: FCHOP1, bw: 'sawtooth' }, // C major（Flume系）
      { bpm: 156, key: 65, scale: 'major', arr: 'kawaii',  lead: FLUME_LEAD3, prog: [{ n: Dm7, r: ROOT.D }, { n: Bb, r: ROOT.Bb }, { n: Fmaj7, r: ROOT.F }, { n: Cmaj7, r: ROOT.C }], chop: FCHOP2, bw: 'square' },   // F major（カワイイ・フューチャー）
      { bpm: 140, key: 67, scale: 'major', arr: 'melodic', lead: FLUME_LEAD2, prog: [{ n: Em7, r: ROOT.E }, { n: Cmaj7, r: ROOT.C }, { n: G7, r: ROOT.G }, { n: Dmaj, r: ROOT.D }], chop: FCHOP1, bw: 'sawtooth' }, // G major（メロディック）
    ],
    bass: [
      // Pendulum風ドラムンベース。key/scale/lead=ドロップで高域に伸びるアンセム・リード
      { bpm: 172, key: 69, scale: 'minor', arr: 'neuro',  lead: DNB_LEAD, prog: [{ n: Am, r: ROOT.A }, { n: F, r: ROOT.F }, { n: C, r: ROOT.C }, { n: G, r: ROOT.G }], bass: DNB1, hits: DNBHIT, bw: 'sawtooth', bcut: 420 }, // A minor（Pendulum系ニューロ）
      { bpm: 178, key: 64, scale: 'minor', arr: 'jump',   lead: DNB_LEAD2, prog: [{ n: Em, r: ROOT.E }, { n: C, r: ROOT.C }, { n: G, r: ROOT.G }, { n: Dmaj, r: ROOT.D }], bass: DNB2, hits: DNBHIT, bw: 'square', bcut: 520 },   // E minor（ジャンプアップ）
      { bpm: 166, key: 62, scale: 'minor', arr: 'liquid', lead: DNB_LEAD3, prog: [{ n: Dm, r: ROOT.D }, { n: Bb, r: ROOT.Bb }, { n: F, r: ROOT.F }, { n: C, r: ROOT.C }], bass: DNB1, hits: DNBHIT, bw: 'sawtooth', bcut: 360 }, // D minor（リキッド）
    ],
    chill: [
      // Nujabes風ローファイ。key/scale/lead=ジャズ/ソウルなローズの旋律（常に流れるメインの旋律）
      { bpm: 110, key: 60, scale: 'major', arr: 'jazzy',   lead: LOFI_MEL, prog: [{ n: Fmaj7, r: ROOT.F }, { n: Em7, r: ROOT.E }, { n: Dm7, r: ROOT.D }, { n: Cmaj7, r: ROOT.C }], bass: HOUSEBASS1, bw: 'triangle' }, // C major（Nujabes系）
      { bpm: 116, key: 60, scale: 'major', arr: 'boombap', lead: LOFI_MEL3, prog: [{ n: Cmaj7, r: ROOT.C }, { n: G7, r: ROOT.G }, { n: Am7, r: ROOT.A }, { n: Fmaj7, r: ROOT.F }], bass: HOUSEBASS2, bw: 'sawtooth' }, // C major（J Dilla系ブーンバップ）
      { bpm: 100, key: 60, scale: 'major', arr: 'sleepy',  lead: LOFI_MEL2, prog: [{ n: Am7, r: ROOT.A }, { n: Dm7, r: ROOT.D }, { n: G7, r: ROOT.G }, { n: Cmaj7, r: ROOT.C }], bass: HOUSEBASS1, bw: 'triangle' }, // C major / Am（眠いアンビエント）
    ],
    dub: [
      // Skrillex風dubstep（140BPM・ハーフタイム）。lead=低音グロウルのリフ、screech=金属スクリーチ
      { bpm: 140, key: 64, scale: 'minor', arr: 'brostep', lead: DUB_RIFF, screech: DUB_SCREECH, prog: [{ n: Em, r: ROOT.E }, { n: C, r: ROOT.C }, { n: G, r: ROOT.G }, { n: Dmaj, r: ROOT.D }], bw: 'sawtooth' }, // E minor（Skrillex系）
      { bpm: 150, key: 69, scale: 'minor', arr: 'riddim',  lead: DUB_RIFF2, screech: DUB_SCREECH2, prog: [{ n: Am, r: ROOT.A }, { n: F, r: ROOT.F }, { n: G, r: ROOT.G }, { n: Em, r: ROOT.E }], bw: 'square' },  // A minor（反復ヘヴィなリディム）
      { bpm: 136, key: 62, scale: 'minor', arr: 'melodic', lead: DUB_RIFF3, screech: DUB_SCREECH3, prog: [{ n: Dm, r: ROOT.D }, { n: Bb, r: ROOT.Bb }, { n: F, r: ROOT.F }, { n: C, r: ROOT.C }], bw: 'sawtooth' }, // D minor（メロディック・ドラムステップ）
    ],
  };

  function sectionBeat(bar) {
    return bar % 32;
  }
  function sectionEnergy(bar) {
    const b = sectionBeat(bar);
    if (b < 4) return 0.72;
    if (b < 8) return 0.95;
    if (b < 10) return 0.42;
    if (b < 12) return 0.68;
    if (b < 16) return 1.12;
    if (b < 24) return 1.34;
    if (b < 26) return 0.5;
    if (b < 28) return 0.75;
    if (b < 31) return 1.18;
    return 1.42;
  }
  function isBreakBar(bar) {
    const b = sectionBeat(bar);
    return b === 8 || b === 9 || b === 24 || b === 25;
  }
  function isBuildBar(bar) {
    const b = sectionBeat(bar);
    return (b >= 12 && b < 16) || b >= 28;
  }
  function isChorusBar(bar) {
    const b = sectionBeat(bar);
    return b >= 16 && b < 24;
  }
  function isDropStart(s, bar) {
    const b = sectionBeat(bar);
    return s === 0 && (b === 16 || b === 28);
  }
  function isBreakStart(s, bar) {
    const b = sectionBeat(bar);
    return s === 0 && (b === 8 || b === 24);
  }
  function isFillStep(s, bar) {
    return (bar % 4 === 3 || sectionBeat(bar) === 23 || sectionBeat(bar) === 31) && s >= 12;
  }
  function stepArrangementFx(kind, s, bar, t) {
    const b = sectionBeat(bar), build = isBuildBar(bar), chorus = isChorusBar(bar);
    if (isDropStart(s, bar)) {
      const big = b === 16 ? 1 : 1.18;
      vCrash(t, (kind === 'chill' ? 0.11 : kind === 'bass' ? 0.16 : 0.22) * big, kind === 'bass' ? 0.55 : 1.3, kind === 'chill' ? 5200 : 8200);
      if (kind !== 'chill' && kind !== 'laser') vSubDrop(t, kind === 'bass' ? 118 : 92, kind === 'future' ? 38 : 32, kind === 'bass' ? 0.52 : 0.38, kind === 'bass' ? 0.52 : 0.72);
    }
    if (isBreakStart(s, bar)) vCrash(t, kind === 'chill' ? 0.075 : 0.12, kind === 'bass' ? 0.42 : 1.5, kind === 'chill' ? 4200 : 6200);
    if (build && s === 0) vRiser(t, 60 / RAVE.bpm * (b >= 28 ? 4 : 2.5));
    if (build && (s === 12 || s === 14)) vNoiseHit(t, 3000 + s * 230, kind === 'bass' ? 0.085 : 0.05, 0.035, 0.1);
    if (chorus && s % 4 === 2 && kind !== 'chill') vRide(t, kind === 'bass' ? 0.045 : 0.06, kind === 'forest' ? 9400 : 10200);
    if (chorus && kind === 'chill' && (s === 2 || s === 10)) vRide(t, 0.025, 6400);
  }

  // ── ダークテクノ（重いキック＋うねるオフビートのサブ＋暗いスタブ）
  function stepTechno(s, bar, t) {
    const sg = RAVE.song, energy = sectionEnergy(bar), breakBar = isBreakBar(bar), build = isBuildBar(bar), chorus = isChorusBar(bar), section = sectionBeat(bar);
    const arr = sg.arr || 'peak'; // peak=Charlotte de Witte系 / rave=ハード・アシッド / hypno=ミニマル・ダブテクノ
    if (!breakBar && (s % 4 === 0 || (chorus && s === 10))) vKick(t, 42, 1.05 * energy, 0.34);
    else if (s === 14) vKick(t, 42, 0.55, 0.18);
    if ((s === 4 || s === 12) && !breakBar && arr !== 'hypno') vClap(t, 0.4 * energy, 1500, 0.18); // hypnoはクラップ無しで催眠的に
    if (s % 4 === 2 && !breakBar) vHat(t, true, 7800 + (build ? 1800 : 0), (arr === 'hypno' ? 0.15 : 0.22) * energy);
    if ((s % 2 === 1 || ((build || arr === 'rave') && s % 2 === 0)) && !breakBar) vHat(t, false, 9000, arr === 'hypno' ? 0.06 : build ? 0.09 : 0.12); // raveは16分の刻みハット
    if (arr === 'hypno' && !breakBar && (s === 0 || s === 8)) vBass(t, sg.root, { wave: 'triangle', cut: 150, q: 2, dur: 0.5, gain: 0.3 * energy, env: 1.2, drive: 0.8 }); // 深いロングサブ
    if (!breakBar && s % 4 === 2) vBass(t, sg.root, { wave: sg.bw, cut: sg.bcut * (build ? 1.35 : 1), q: 7, dur: 0.22, gain: 0.3 * energy, env: 1.8 });
    else if (s === 7 || s === 15) vBass(t, sg.alt, { wave: sg.bw, cut: sg.bcut * 0.9, dur: 0.14, gain: 0.22, env: 1.6 });
    else if (sg.roll && s % 2 === 1 && arr !== 'hypno') vBass(t, sg.root, { wave: sg.bw, cut: sg.bcut * 0.75, dur: 0.1, gain: 0.2, sub: false });
    else if (!sg.roll && s % 2 === 1 && arr !== 'hypno') vBass(t, sg.root, { wave: sg.bw, cut: 180, dur: 0.12, gain: 0.16, sub: false });
    if (chorus && (s === 1 || s === 9 || s === 13)) vWobble(t, sg.root, { wave: sg.bw, cut: 280 + s * 18, rate: s === 13 ? 11 : 7, depth: 180, dur: 0.16, gain: 0.12, sub: false });
    if (s === 0 || (build && s === 8) || (chorus && s === 6)) vStab(t, bar % 4 < 2 ? sg.stabA : sg.stabB, breakBar ? 0.52 : 0.35);
    if (chorus && (s === 3 || s === 10 || s === 13)) vSuper(t, (bar % 4 < 2 ? sg.stabA : sg.stabB)[s % 3] * 2, { voices: 3, detune: 9, dur: 0.08, gain: 0.026, cut: 2800, dly: 0.12, rev: 0.18, duck: false });
    if (s === 6 || s === 11) vNoiseHit(t, s === 6 ? 1500 : 3200, 0.12, 0.07, 0.3);
    if (isFillStep(s, bar)) vTom(t, 120 + (s - 12) * 22, 0.12);
    if (bar % 4 === 3 && s === 8) vRiser(t, 60 / RAVE.bpm * (build ? 3 : 2));
    // 催眠的アシッド・フック（Charlotte de Witte風）：イントロ(0-7)以外で登場。
    // ブレイクはリバーブ深めの伸ばし、ビルドで明るく、ドロップで全開のレゾナント・アシッドに。
    if (sg.lead) {
      const deg = sg.lead[bar % 2][s], gstep = bar * 16 + s;
      if (deg != null) {
        const f = leadFreq(sg, deg) * (chorus ? 2 : 1);
        const im = section < 8 ? 0.5 : 1; // イントロから催眠アシッドの“顔”を出す（控えめ）
        let lg, cut, q, dur, rev;
        if (chorus)       { lg = 0.05;  cut = 4200; q = 12; dur = 0.14; rev = 0.16; }
        else if (build)   { lg = 0.04;  cut = 3000; q = 10; dur = 0.16; rev = 0.2; }
        else if (breakBar){ lg = 0.034; cut = 1600; q = 6;  dur = 0.5;  rev = 0.42; }
        else              { lg = 0.032; cut = 2200; q = 9;  dur = 0.2;  rev = 0.24; }
        if (arr === 'hypno') { dur *= 1.7; rev += 0.12; cut *= 0.78; }       // 伸ばして深い催眠アシッド
        else if (arr === 'rave') { dur *= 0.7; cut *= 1.18; q += 2; }        // 短く明るく刻むレイヴ・アシッド
        // 直前のノートが2ステップ以内なら、そこからスライド（303らしいグライド）
        const gap = gstep - RAVE.acidStep;
        const glideFrom = (RAVE.acidPrev && gap >= 1 && gap <= 2) ? RAVE.acidPrev : 0;
        vAcid(t, f, { wave: 'sawtooth', dur, gain: lg * im * Math.max(0.7, energy), cutStart: cut * 0.55, cutEnd: cut, q, dly: 0.16, rev, glideFrom, glide: 0.05, drive: arr === 'rave' ? 2.2 : chorus ? 1.8 : 1.5 });
        RAVE.acidPrev = f; RAVE.acidStep = gstep;
      }
    }
  }
  // ── ユーロビート（16分オクターブ走りベース＋スーパーソウのリード）
  function stepEurobeat(s, bar, t) {
    const sg = RAVE.song, ch = sg.prog[bar % 4], energy = sectionEnergy(bar), breakBar = isBreakBar(bar), build = isBuildBar(bar), chorus = isChorusBar(bar);
    const arr = sg.arr || 'super'; // super=Dave Rodgers系 / night=メロディアス・ナイト / power=アグレッシブ
    if (!breakBar && (s % 4 === 0 || (build && s === 14) || (arr === 'power' && s === 10))) vKick(t, 50, (s === 14 ? 0.55 : 1.0) * energy * (arr === 'power' ? 1.08 : 1), 0.26);
    if ((s === 4 || s === 12) && !breakBar) vClap(t, (arr === 'night' ? 0.24 : arr === 'power' ? 0.42 : 0.34) * energy, 2300, arr === 'night' ? 0.2 : 0.1);
    if (!breakBar) vHat(t, s % 4 === 2, 8200 + (build ? 1600 : 0), (s % 4 === 2 ? 0.26 : 0.16) * energy);
    if (arr === 'power' && !breakBar && s % 2 === 1) vHat(t, false, 9400, 0.08 * energy); // powerは追加の16分ハット
    // ベース：super/power=16分のオクターブ走り、night=8分のゆったり走り（曲の質感を大きく変える芯）
    const ebStep = arr === 'night' ? (s % 2 === 0) : true;
    if ((!breakBar || s % 4 === 2) && ebStep) vBass(t, s % 2 ? ch.r * 2 : ch.r, { wave: 'sawtooth', cut: (arr === 'power' ? 1500 : arr === 'night' ? 950 : 1200) + energy * 350, q: 4, dur: arr === 'night' ? 0.2 : 0.12, gain: (arr === 'night' ? 0.2 : 0.22) * energy, sub: s % 2 === 0, drive: arr === 'power' ? 1.7 : 1.25 });
    if ((s % 4 === 2 || (build && s % 4 === 0) || (arr === 'power' && s % 2 === 0)) && !breakBar) vStab(t, ch.n, 0.16); // powerはスタブ増量
    const mel = sg.mel[bar % 4][s];
    // EUMELの16分メロ：nightは声数少なめ・長め・リバーブ多めで“歌”を息づかせ、powerは明るく硬く
    if (mel && (!breakBar || s % 4 === 0)) vSuper(t, mel * (chorus || bar % 8 >= 4 ? 2 : 1), { voices: chorus ? 8 : (arr === 'night' ? 5 : 6), detune: chorus ? 22 : 16, dur: breakBar ? 0.28 : (arr === 'night' ? 0.22 : 0.16), gain: (breakBar ? 0.035 : chorus ? 0.072 : (arr === 'night' ? 0.05 : 0.06)) * energy, type: sg.lw, cut: sg.lcut + (build || chorus ? 1600 : 0) + (arr === 'power' ? 1200 : 0), dly: 0.18, rev: breakBar ? 0.22 : (arr === 'night' ? 0.22 : 0.1), duck: false });
    if (chorus && (s === 5 || s === 13)) vSuper(t, ch.n[(s + bar) % ch.n.length] * 4, { voices: 4, detune: 14, dur: 0.1, gain: 0.035, type: 'sawtooth', cut: 5200, dly: 0.12, rev: 0.12, duck: false });
    if (chorus && (s === 3 || s === 11)) vVocalChop(t, ch.n[(bar + s) % ch.n.length] * 4, { dur: 0.09, gain: 0.032, tone: 1.08, dly: 0.12, rev: 0.1 });
    if (bar % 8 === 7 && s >= 8 && s % 2 === 0) vSnare(t, 0.3, 0.15);
    if (isFillStep(s, bar)) vNoiseHit(t, 2800 + s * 150, 0.06, 0.035, 0.08);
    // Dave Rodgers風アンセム・トップライン：サビ(ドロップ)で歌い上げる持続系リード。
    // EUMELの速い16分の上に、歌えるロングトーンのフックを重ねて“スーパーユーロビート感”を出す（ビルドでは予告的に頭拍のみ）。
    if (sg.hook && (chorus || (build && s % 4 === 0))) {
      const deg = sg.hook[bar % 4][s];
      if (deg != null) {
        const f = leadFreq(sg, deg);
        vSuper(t, f, { voices: arr === 'power' ? 8 : 7, detune: 20, type: 'sawtooth', dur: 60 / RAVE.bpm * (chorus ? 1.1 : 0.5), gain: (chorus ? (arr === 'power' ? 0.066 : 0.06) : 0.038) * energy, cutStart: 2600, cutEnd: chorus ? (arr === 'night' ? 8400 : 7200) : 5200, atk: 0.01, dly: 0.18, rev: arr === 'night' ? 0.3 : 0.18, duck: false, spread: 0.85 });
        // 2回目以降のドロップは3度上のハモリで“最終サビ”を厚く
        if (chorus && RAVE.cycle >= 1) vSuper(t, leadFreq(sg, deg + 2), { voices: 5, detune: 18, type: 'sawtooth', dur: 60 / RAVE.bpm * 1.1, gain: 0.034 * energy, cutStart: 2600, cutEnd: 7200, atk: 0.01, dly: 0.18, rev: 0.22, duck: false, spread: 0.92 });
      }
    }
  }
  // ── アップリフティング・トランス（Armin van Buuren風）
  //   ローリングのオフビート・ゲートベース＋add9の大きなパッド＋
  //   イントロ→ブレイクで静かに登場→ビルド→ドロップで全開、と戻ってくる主旋律フック
  function stepTrance(s, bar, t) {
    const sg = RAVE.song, ch = sg.prog[bar % 4], energy = sectionEnergy(bar);
    const breakBar = isBreakBar(bar), build = isBuildBar(bar), chorus = isChorusBar(bar), section = sectionBeat(bar);
    const beatLen = 60 / RAVE.bpm;
    const arr = sg.arr || 'anthem'; // anthem=Armin系 / emotive=Above&Beyond系 / driving=テック・プログレ
    // ── ドラム（アレンジごとに密度とノリを変える）──
    if (!breakBar) {
      if (s % 4 === 0) vKick(t, 46, (arr === 'emotive' ? 0.78 : 0.92) * energy, 0.3);
      if (arr === 'driving') {
        if (s % 2 === 0) vHat(t, false, 10800, 0.05 * energy);                       // 16分の刻みハット
        if (s % 4 === 2) vHat(t, true, 9800 + (build ? 1200 : 0), 0.17 * energy);
        if (s === 4 || s === 12) vClap(t, 0.3 * energy, 1700, 0.1);                  // バックビートのクラップ
      } else if (arr === 'emotive') {
        if (s % 4 === 2) vHat(t, true, 8600, 0.13 * energy);                         // オフビートのオープンハットのみ＝空間広め
        if (s === 12 && (chorus || build)) vClap(t, 0.16 * energy, 1500, 0.2);       // たまに柔らかいクラップ
      } else { // anthem（従来）
        if (s === 4 || s === 12) vSnare(t, 0.26 * energy, 0.3);
        if (s % 4 === 2) vHat(t, true, 9500 + (build ? 1200 : 0), 0.2 * energy);
        if ((chorus || build) && s % 2 === 1) vHat(t, false, 11200, 0.05 * energy);
      }
    }
    // ── ベース（アレンジごとに役割を変える）──
    if (!breakBar) {
      if (arr === 'driving') { // レゾナントなローリング16分ベース（テック・プログレ）
        if (s % 2 === 1 || s % 4 === 2) vBass(t, ch.r, { wave: 'sawtooth', cut: 300 * (build ? 1.6 : 1), q: 9, dur: 0.12, gain: 0.24 * energy, env: 1.7 });
      } else if (arr === 'emotive') { // 温かいトライアングルのサステインベース＋軽い裏拍
        if (s === 0 || s === 8) vBass(t, ch.r, { wave: 'triangle', cut: 260, q: 3, dur: 0.55, gain: 0.26 * energy, env: 1.2, drive: 0.85 });
        if ((s === 4 || s === 12) && (chorus || build)) vBass(t, ch.r, { wave: 'sawtooth', cut: 320, q: 5, dur: 0.16, gain: 0.14 * energy, env: 1.5 });
      } else { // anthem：オフビートのローリング・ゲートベース（従来）
        if (s % 4 === 2) vBass(t, ch.r, { wave: 'sawtooth', cut: 320 * (build ? 1.6 : 1), q: 6, dur: 0.16, gain: 0.28 * energy, env: 1.5 });
        if (chorus && (s === 7 || s === 15)) vBass(t, ch.r, { wave: 'sawtooth', cut: 360, q: 6, dur: 0.1, gain: 0.16, env: 1.4, sub: false });
      }
    }
    // ── add9の大きなパッド（emotiveは厚く長く）──
    if (s === 0) vChord(t, padVoicing(ch.n), { voices: 6, detune: arr === 'emotive' ? 22 : 18, type: sg.pw, dur: beatLen * (breakBar ? 8 : 4), gain: (breakBar ? 0.046 : 0.03) * energy * (arr === 'emotive' ? 1.5 : 1), cutStart: breakBar ? 320 : 600, cutEnd: build ? 3800 : 2600, atk: breakBar ? 0.24 : (arr === 'emotive' ? 0.3 : 0.12), rev: arr === 'emotive' ? 0.52 : 0.4, spread: 0.85 });
    if (chorus && s === 8 && arr !== 'emotive') vChord(t, ch.n.map(f => f * 2), { voices: 5, detune: 14, type: sg.pw, dur: beatLen * 2, gain: 0.028, cutStart: 1200, cutEnd: 4800, atk: 0.04, rev: 0.32, dly: 0.24, duck: false, spread: 0.7 });
    // ── アルペジオ（emotiveは旋律に専念して省略）──
    if (arr !== 'emotive' && s % (sg.arpEvery || 2) === 0 && !breakBar) {
      const an = ch.n[s % ch.n.length] * (s % (ch.n.length * 2) >= ch.n.length ? 2 : 1);
      vSuper(t, an, { voices: 4, detune: 12, type: sg.pw, dur: arr === 'driving' ? 0.09 : build ? 0.11 : 0.18, gain: (chorus ? 0.02 : 0.042) * energy, cut: chorus ? 5200 : build ? 5200 : 3600, dly: 0.28, rev: 0.25, duck: false, spread: 0.5 });
    }
    // ── 主旋律（曲の“顔”）：イントロから常に鳴らし、各曲をメロディで識別できるようにする。
    //    セクションが進むほど大きく明るく（イントロは控えめ→ブレイク→ビルド→ドロップで全開）。
    if (sg.lead) {
      const deg = sg.lead[bar % 8][s];
      if (deg != null) {
        const f = leadFreq(sg, deg);
        const im = section < 8 ? 0.5 : 1; // イントロは主旋律を控えめに（土台は残しつつ顔は見せる）
        if (arr === 'emotive') { // 親密なプラック（ディレイ深め・リバーブ多め）
          const eg = chorus ? 0.07 : build ? 0.055 : 0.045;
          vSuper(t, f, { voices: 3, detune: 10, type: 'triangle', dur: beatLen * 0.85, gain: eg * im * Math.max(0.75, energy), cutStart: 1100, cutEnd: chorus ? 3600 : 2600, atk: 0.004, dly: 0.32, rev: 0.42, duck: false, spread: 0.6 });
        } else if (arr === 'driving') { // タイトでアシッド寄りの刻みリード
          const dg = chorus ? 0.072 : build ? 0.055 : 0.045;
          vSuper(t, f, { voices: 5, detune: 12, type: 'sawtooth', dur: beatLen * 0.42, gain: dg * im * Math.max(0.75, energy), cutStart: chorus ? 5200 : 3600, cutEnd: chorus ? 7600 : 5200, q: 3, atk: 0.004, dly: 0.16, rev: 0.14, duck: false, spread: 0.5 });
          if (chorus && RAVE.cycle >= 1) vSuper(t, leadFreq(sg, deg + 2), { voices: 3, detune: 14, type: 'sawtooth', dur: beatLen * 0.42, gain: dg * 0.5 * Math.max(0.75, energy), cutStart: 5200, cutEnd: 7600, q: 3, atk: 0.004, dly: 0.16, rev: 0.18, duck: false, spread: 0.7 });
        } else { // anthem：7声スーパーソウの大旋律（従来）
          let lg, cut, dur, rev, atk;
          if (chorus)     { lg = 0.085; cut = 7400; dur = beatLen * 1.05; rev = 0.2;  atk = 0.008; }
          else if (build) { lg = 0.062; cut = 6000; dur = beatLen * 0.95; rev = 0.26; atk = 0.02; }
          else            { lg = 0.05;  cut = 4200; dur = beatLen * 1.7;  rev = 0.34; atk = 0.06; }
          vSuper(t, f, { voices: 7, detune: 18, type: 'sawtooth', dur, gain: lg * im * Math.max(0.75, energy), cutStart: cut * 0.7, cutEnd: cut, atk, dly: 0.2, rev, duck: false, spread: 0.82 });
          if (chorus && RAVE.cycle >= 1) vSuper(t, leadFreq(sg, deg + 2), { voices: 5, detune: 16, type: 'sawtooth', dur, gain: lg * 0.55 * Math.max(0.75, energy), cutStart: cut * 0.7, cutEnd: cut, atk, dly: 0.2, rev: rev + 0.06, duck: false, spread: 0.92 });
        }
      }
    }
    // ビルドのライザー
    if ((bar % 8 === 7 && s === 12) || (build && s === 8)) vRiser(t, beatLen * (build ? 1.2 : 0.75));
  }
  // ── ディスコハウス（ファンキーベース＋7thコードのスタブ）
  function stepDisco(s, bar, t) {
    const sg = RAVE.song, ch = sg.prog[bar % 4], energy = sectionEnergy(bar), breakBar = isBreakBar(bar), chorus = isChorusBar(bar), build = isBuildBar(bar), section = sectionBeat(bar);
    const arr = sg.arr || 'french'; // french=Daft Punk系 / nu=ヌーディスコ / funk=ファンキーハウス
    if (!breakBar && s % 4 === 0) vKick(t, 52, 0.95 * energy, 0.28);
    if ((s === 4 || s === 12) && !breakBar) vClap(t, (arr === 'nu' ? 0.46 : 0.36) * energy, 1700, arr === 'nu' ? 0.2 : 0.14); // nuはクラップ前面
    if (s % 4 === 2 && !breakBar) vHat(t, true, 6500 + (chorus ? 1600 : 0) + (arr === 'nu' ? 1400 : 0), 0.2 * energy);
    if ((s % 2 === 1 || (chorus && s % 4 === 0) || (arr === 'funk' && s % 2 === 0)) && !breakBar) vHat(t, false, 8000, (chorus ? 0.09 : 0.12) * energy); // funkは16分の刻みハット
    const b = sg.bass[s];
    if (b && !breakBar) { // ベースの質感をアレンジで根本から変える＝曲の芯
      if (arr === 'french') vBass(t, b === 2 ? ch.r * 2 : ch.r, { wave: sg.bw, cut: 280 + (Math.sin(bar * 0.39) * 0.5 + 0.5) * 1000, q: 9, dur: 0.16, gain: 0.26 * energy, env: 1.6 });       // ゆっくり開閉するフィルター掃引（フレンチ・ハウス）
      else if (arr === 'nu') vBass(t, b === 2 ? ch.r * 2 : ch.r, { wave: sg.bw, cut: sg.bcut * (chorus ? 1.6 : 1.3) + 200, q: 4, dur: 0.16, gain: 0.27 * energy, env: 2.4, drive: 1.5 }); // 明るく太いクリーン（ヌーディスコ）
      else vBass(t, b === 2 ? ch.r * 2 : ch.r, { wave: sg.bw, cut: sg.bcut * (chorus ? 1.35 : 1), q: 6, dur: 0.1, gain: 0.26 * energy, env: 2.6 });                                          // funk：短く刻むスタッカート
    }
    if (arr === 'nu' && !breakBar && s % 4 === 2) vRide(t, 0.045, 8200); // nuはオフビートのライドでキラっと
    if ((sg.stab[s] || (chorus && s % 4 === 2)) && !breakBar) vChord(t, ch.n, { voices: chorus ? 5 : 3, detune: chorus ? 14 : 8, dur: 0.18, gain: 0.045 * energy, cut: chorus ? 4200 : 3000, dly: 0.16, rev: 0.18 });
    if (chorus && (s === 3 || s === 10 || s === 15)) vSuper(t, ch.n[(s + bar) % ch.n.length] * 2, { voices: 3, detune: 10, dur: 0.12, gain: 0.032, cut: 3600, dly: 0.12, rev: 0.12, duck: false });
    if (chorus && (s === 0 || s === 8)) vRide(t, 0.055, 7600);
    if ((bar % 4 === 3 && s === 14) || (build && s >= 12 && s % 2 === 0)) vSnare(t, 0.3, 0.2);
    // Daft Punk風ボコーダー・ボーカルチョップのフック：サビ(ドロップ)で前面に反復、ビルドで予告的に頭拍のみ。
    // root-3rd-5th を回すキャッチーなリフを、母音フォルマントの“喋る”声で鳴らす（小節ごとにtoneを動かして声色変化）。
    if (sg.vox) { // ボーカルチョップのリフ＝曲の顔。イントロから反復して各曲を識別できるようにする（"Around the World"系）
      const deg = sg.vox[bar % 2][s];
      const lvl = chorus ? 1 : section >= 8 ? 0.8 : 0.55;
      if (deg != null) vVocalChop(t, leadFreq(sg, deg), { dur: chorus ? 0.13 : 0.1, gain: (chorus ? 0.05 : 0.03) * energy * lvl, tone: (arr === 'nu' ? 1.12 : 1) + (bar % 4) * 0.03, dly: 0.18, rev: 0.14, type: 'sawtooth' });
    }
    // funk：ドロップで裏拍に短いボーカルチョップを足してチョッパー感を出す
    if (arr === 'funk' && sg.vox && chorus && (s === 6 || s === 14)) {
      const d = sg.vox[bar % 2][s];
      if (d != null) vVocalChop(t, leadFreq(sg, d) * 2, { dur: 0.08, gain: 0.03 * energy, tone: 1.15, dly: 0.12, rev: 0.1, type: 'sawtooth' });
    }
  }
  function stepFutureBass(s, bar, t) {
    const sg = RAVE.song, ch = sg.prog[bar % 4], half = s >= 8 ? 2 : 1, energy = sectionEnergy(bar), breakBar = isBreakBar(bar), chorus = isChorusBar(bar), build = isBuildBar(bar), section = sectionBeat(bar);
    const arr = sg.arr || 'flume'; // flume=Flume系 / kawaii=明るく跳ねるカワイイ / melodic=エモい・メロディック
    if (!breakBar && (s === 0 || s === 8 || (chorus && s === 11))) vKick(t, 47, (s === 0 ? 1.05 : 0.8) * energy, 0.3);
    if ((s === 4 || s === 12) && !breakBar) vSnare(t, 0.34 * energy, 0.28);
    if (!breakBar && (s % 2 === 1 || (chorus && s % 4 === 2) || (arr === 'kawaii' && s % 2 === 0))) vHat(t, s % 4 === 3, 9800 + (build ? 1800 : 0) + (arr === 'kawaii' ? 1500 : 0), (s % 4 === 3 ? 0.17 : 0.09) * energy); // kawaiiは16分のキラキラハット
    // フューチャーベースの主役＝デチューン・コードstab。kawaii=オクターブ上のベル/明るく、melodic=長く温かくリバーブ多め
    if (s === 0 || s === 8) vChord(t, arr === 'kawaii' ? ch.n.map(f => f * 2) : ch.n, { voices: chorus ? 10 : 8, detune: chorus ? 28 : 22, type: arr === 'kawaii' ? 'triangle' : sg.bw, dur: 60 / RAVE.bpm * (breakBar ? 3.5 : (arr === 'melodic' ? 3 : 2.2)), gain: (chorus ? 0.07 : 0.055) * energy, cutStart: breakBar ? 400 : 700, cutEnd: chorus ? (arr === 'kawaii' ? 7200 : 5600) : 4200, atk: breakBar ? 0.16 : (arr === 'melodic' ? 0.1 : 0.04), rev: arr === 'melodic' ? 0.4 : 0.28, dly: 0.16 });
    if (!breakBar && (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14 || (chorus && s === 13))) vBass(t, ch.r * half, { wave: 'sawtooth', cut: chorus ? 700 : 460, q: 7, dur: chorus ? 0.22 : 0.18, gain: 0.3 * energy, env: 2.4 });
    const chop = sg.chop[s];
    if (chop && (!breakBar || s % 4 === 0)) vSuper(t, chop * (chorus && s > 7 ? 2 : 1), { voices: chorus ? 7 : 5, detune: chorus ? 24 : 18, type: 'square', dur: chorus ? 0.1 : 0.12, gain: 0.042 * energy, cut: chorus ? 6800 : 5200, dly: 0.22, rev: 0.2, duck: false });
    if (chop && chorus && (s === 1 || s === 5 || s === 9 || s === 13)) vVocalChop(t, chop * 2, { dur: 0.12, gain: 0.038, tone: 1 + (s % 3) * 0.06, dly: 0.2, rev: 0.16 });
    if (chorus && (s === 3 || s === 11)) vWobble(t, ch.r * (s > 8 ? 2 : 1), { cut: 520, rate: s === 11 ? 12 : 8, depth: 320, dur: 0.18, gain: 0.18, wave: 'square' });
    if (bar % 8 === 7 && s >= 12 && s % 2 === 0) vNoiseHit(t, 4200, 0.09, 0.05, 0.22);
    if (build && s >= 12) vNoiseHit(t, 5200 + s * 120, 0.04, 0.03, 0.16);
    // Flume風の“ワンキー”なリード・トップライン：ドロップで前面に、ビルドで予告的に頭拍のみ。
    // chopの隙間に答えるよう、デチューン強め・明るいフィルター掃引のスーパーソウで歌わせる。
    if (sg.lead) { // リード・トップライン＝曲の顔。イントロから鳴らして各曲を識別できるようにする
      const deg = sg.lead[bar % 2][s];
      const lvl = chorus ? 1 : section >= 8 ? 0.75 : 0.5;
      if (deg != null) {
        vSuper(t, leadFreq(sg, deg), { voices: 6, detune: chorus ? 28 : 20, type: arr === 'kawaii' ? 'square' : 'sawtooth', dur: chorus ? (arr === 'melodic' ? 0.26 : 0.2) : 0.14, gain: (chorus ? 0.055 : 0.035) * energy * lvl, cutStart: 1400, cutEnd: chorus ? 7600 : 5200, atk: 0.012, dly: 0.22, rev: arr === 'melodic' ? 0.34 : 0.22, duck: false, spread: 0.9 });
        // 2回目以降のドロップは3度上のハモリを重ねる
        if (chorus && RAVE.cycle >= 1) vSuper(t, leadFreq(sg, deg + 2), { voices: 4, detune: 24, type: arr === 'kawaii' ? 'square' : 'sawtooth', dur: 0.2, gain: 0.03 * energy, cutStart: 1400, cutEnd: 7600, atk: 0.012, dly: 0.22, rev: 0.28, duck: false, spread: 0.95 });
      }
    }
  }
  function stepDrumBass(s, bar, t) {
    const sg = RAVE.song, ch = sg.prog[bar % 4], energy = sectionEnergy(bar), breakBar = isBreakBar(bar), chorus = isChorusBar(bar), build = isBuildBar(bar), section = sectionBeat(bar);
    const arr = sg.arr || 'neuro'; // neuro=Pendulum系リース / jump=跳ねるジャンプアップ / liquid=滑らかリキッド
    const kickPattern = chorus ? (s === 0 || s === 3 || s === 7 || s === 10 || s === 14) : (s === 0 || s === 7 || s === 10);
    if (!breakBar && kickPattern) vKick(t, 48, (s === 0 ? 1.0 : 0.72) * energy, 0.23);
    if ((s === 4 || s === 12) && !breakBar) vSnare(t, (arr === 'liquid' ? 0.34 : arr === 'jump' ? 0.5 : 0.44) * energy, arr === 'liquid' ? 0.16 : 0.08); // liquidは柔らか・jumpはパンチ
    if (!breakBar) vHat(t, s % 2 === 1 || (chorus && s % 4 === 2), 10500 + (chorus ? 1300 : 0), (s % 2 === 1 ? 0.14 : 0.055) * energy);
    if (!breakBar && sg.hits[s] === 2) vNoiseHit(t, 2400, 0.1 * energy, 0.045, 0.08);
    else if (!breakBar && sg.hits[s]) vNoiseHit(t, 6500, 0.055 * energy, 0.025, 0.04);
    const b = sg.bass[s];
    if (b && !breakBar) {
      const bf = b === 2 ? ch.r * 2 : ch.r;
      if (chorus && arr !== 'liquid' && (s === 3 || s === 6 || s === 11 || s === 14)) vWobble(t, bf, { wave: sg.bw, cut: sg.bcut + 180, rate: 10 + (s % 3) * 2, depth: 420, q: 12, dur: 0.14, gain: 0.28 * energy });
      else if (chorus) { // ドロップの主役ベースをアレンジで変える
        if (arr === 'jump') vWobble(t, bf, { wave: 'square', cut: sg.bcut + 120, rate: 6, depth: 520, q: 10, dur: 0.16, gain: 0.3 * energy });        // 跳ねる単純ワブル
        else if (arr === 'liquid') vBass(t, bf, { wave: 'triangle', cut: sg.bcut * 0.85, q: 3, dur: 0.16, gain: 0.3 * energy, env: 1.6, drive: 0.9 }); // 滑らかな丸いサブ
        else vReese(t, bf, { dur: 0.16, gain: 0.32 * energy, cutStart: sg.bcut * 0.7, cutEnd: sg.bcut + 700, q: 9, drive: 2.4 });                      // neuro：歪んだリース
      }
      else vBass(t, bf, { wave: sg.bw, cut: sg.bcut + (s % 4) * 110, q: 9, dur: 0.13, gain: 0.34 * energy, env: 2.9 });
    }
    if (s === 0) vChord(t, ch.n, { voices: chorus ? 6 : 4, detune: chorus ? 18 : 10, type: 'sawtooth', dur: 60 / RAVE.bpm * (breakBar ? 5 : 3.5), gain: (breakBar ? 0.04 : 0.026) * energy, cutStart: breakBar ? 220 : 350, cutEnd: chorus ? 2600 : 1800, atk: breakBar ? 0.18 : 0.08, rev: 0.18 });
    if (chorus && (s === 2 || s === 6 || s === 13)) vSuper(t, ch.n[(s + bar) % ch.n.length] * 2, { voices: 2, detune: 8, type: 'square', dur: 0.06, gain: 0.025, cut: 3600, rev: 0.08, duck: false });
    if ((bar % 4 === 3 && s === 15) || (build && s === 12)) vRiser(t, 60 / RAVE.bpm * 0.75);
    // Pendulum風アンセム・リード：ドロップで高域に伸びる歌うトップライン（低域のリースの上に乗る）。ビルドは予告的に頭拍のみ。
    if (sg.lead) { // soaring リード＝曲の顔。イントロから鳴らして各曲を識別できるようにする
      const deg = sg.lead[bar % 4][s];
      const lvl = chorus ? 1 : section >= 8 ? 0.72 : 0.48;
      if (deg != null) {
        vSuper(t, leadFreq(sg, deg), { voices: 7, detune: 20, type: 'sawtooth', dur: 60 / RAVE.bpm * (chorus ? 1.3 : 0.6), gain: (chorus ? (arr === 'liquid' ? 0.066 : 0.055) : 0.034) * energy * lvl, cutStart: 1800, cutEnd: chorus ? 7800 : 5200, atk: 0.012, dly: 0.2, rev: arr === 'liquid' ? 0.36 : 0.26, duck: false, spread: 0.85 }); // liquidはリードを前へ・残響多め
        // 2回目以降のドロップは3度上のハモリを重ねる（Pendulum風の厚いアンセム）
        if (chorus && RAVE.cycle >= 1) vSuper(t, leadFreq(sg, deg + 2), { voices: 5, detune: 18, type: 'sawtooth', dur: 60 / RAVE.bpm * 1.3, gain: 0.032 * energy, cutStart: 1800, cutEnd: 7800, atk: 0.012, dly: 0.2, rev: 0.32, duck: false, spread: 0.92 });
      }
    }
  }
  function stepLofiHouse(s, bar, t) {
    const sg = RAVE.song, ch = sg.prog[bar % 4], energy = sectionEnergy(bar), breakBar = isBreakBar(bar), chorus = isChorusBar(bar), build = isBuildBar(bar), section = sectionBeat(bar);
    const arr = sg.arr || 'jazzy'; // jazzy=Nujabes系 / boombap=J Dilla系ヘッドノッド / sleepy=眠い・アンビエント
    if (!breakBar && s % 4 === 0) vKick(t, 50, (arr === 'boombap' ? 0.95 : arr === 'sleepy' ? 0.6 : 0.82) * energy, 0.32);
    if (arr === 'boombap') { if ((s === 4 || s === 12) && !breakBar) vSnare(t, 0.3 * energy, 0.12); } // boombapは効いたスネア
    else if ((s === 4 || s === 12) && !breakBar) vClap(t, (arr === 'sleepy' ? 0.12 : 0.22) * energy, 1350, arr === 'sleepy' ? 0.32 : 0.24);
    if (s % 4 === 2 && !breakBar) vHat(t, true, 5600 + (chorus ? 900 : 0), (arr === 'sleepy' ? 0.08 : 0.13) * energy);
    if ((s % 2 === 1 || (chorus && s === 10)) && !breakBar && arr !== 'sleepy') vHat(t, false, 7200, 0.055 * energy); // sleepyはハット間引いて空気感
    if (arr === 'boombap' && !breakBar && (s === 6 || s === 14)) vHat(t, false, 7600, 0.06 * energy);                // boombapはゴーストノート
    const b = sg.bass[s];
    if (b && !breakBar) vBass(t, b === 2 ? ch.r * 2 : ch.r, { wave: sg.bw, cut: chorus ? 860 : 620, q: 3, dur: arr === 'sleepy' ? 0.28 : 0.2, gain: (arr === 'boombap' ? 0.26 : arr === 'sleepy' ? 0.17 : 0.2) * energy, env: arr === 'boombap' ? 1.9 : 1.5 });
    if (s === 0 || s === 8) vChord(t, ch.n, { voices: chorus ? 5 : 4, detune: chorus ? 11 : 7, type: 'triangle', dur: 60 / RAVE.bpm * (breakBar ? 4 : 2.6), gain: (chorus ? 0.048 : 0.04) * energy, cutStart: breakBar ? 500 : 900, cutEnd: chorus ? 3400 : 2600, atk: breakBar ? 0.3 : 0.16, rev: 0.34, dly: 0.22, duck: false });
    if ((s === 3 || s === 7 || s === 10 || s === 14) && (!breakBar || s === 10)) vSuper(t, ch.n[(s + bar) % ch.n.length] * (chorus ? 3 : 2), { voices: chorus ? 3 : 2, detune: 5, type: 'triangle', dur: chorus ? 0.22 : 0.16, gain: 0.03 * energy, cut: chorus ? 3200 : 2400, dly: 0.24, rev: 0.28, duck: false });
    if (chorus && (s === 5 || s === 13)) vVocalChop(t, ch.n[(bar + s) % ch.n.length] * 2, { dur: 0.16, gain: 0.018, tone: 0.78, dly: 0.26, rev: 0.3, type: 'triangle' });
    if (bar % 8 === 7 && s === 12) vTom(t, 140, 0.12);
    if (build && s >= 12 && s % 2 === 0) vNoiseHit(t, 1800 + s * 80, 0.035, 0.05, 0.24);
    // Nujabes風のジャズ/ソウルなローズの旋律：イントロ頭(section<4)以外は常に流す。サビで少し前へ、ブレイクは控えめに。
    // やわらかいトライアングルにディレイ/リバーブを深めにかけて“隙間で歌う”ローファイの主旋律にする。
    if (sg.lead && section >= 4) {
      const deg = sg.lead[bar % 4][s];
      if (deg != null) vSuper(t, leadFreq(sg, deg), { voices: 3, detune: 7, type: 'triangle', dur: 60 / RAVE.bpm * (breakBar ? 1.4 : (arr === 'sleepy' ? 1.2 : 0.95)), gain: (breakBar ? 0.022 : chorus ? 0.044 : 0.036) * Math.max(0.7, energy) * (arr === 'sleepy' ? 0.85 : 1), cutStart: 1400, cutEnd: chorus ? 3400 : 2600, atk: 0.03, dly: 0.26, rev: arr === 'sleepy' ? 0.44 : 0.32, duck: false, spread: 0.5 }); // sleepyは長く柔らかく残響多め
    }
  }
  // ── dubstep（Skrillex風）：140BPMのハーフタイム（キック=1拍/スネア=3拍）＋
  //    ドロップで“喋る”ワブル/グロウル・ベース（小節ごとに速度が変わる）＋金属スクリーチ
  function stepDubstep(s, bar, t) {
    const sg = RAVE.song, ch = sg.prog[bar % 4], energy = sectionEnergy(bar);
    const breakBar = isBreakBar(bar), build = isBuildBar(bar), chorus = isChorusBar(bar), section = sectionBeat(bar);
    const beatLen = 60 / RAVE.bpm;
    const arr = sg.arr || 'brostep'; // brostep=Skrillex系 / riddim=反復ヘヴィ / melodic=メロディック・ドラムステップ
    // ハーフタイムのドラム（140でもどっしり重い）
    if (!breakBar && (s === 0 || (chorus && s === 7))) vKick(t, 44, (s === 0 ? 1.1 : 0.6) * energy, 0.3);
    if (s === 8 && !breakBar) vSnare(t, 0.52 * energy, 0.12); // 3拍目の大きなスネア
    if (s % 2 === 1 && !breakBar) vHat(t, s === 3 || s === 11, 9000 + (build ? 1500 : 0), (s === 11 ? 0.16 : 0.08) * energy);
    // 暗いパッド（melodicは明るく厚く）
    if (s === 0) vChord(t, padVoicing(ch.n), { voices: 5, detune: 16, type: sg.bw, dur: beatLen * (breakBar ? 8 : 4), gain: (breakBar ? 0.045 : 0.022) * energy * (arr === 'melodic' ? 1.4 : 1), cutStart: 300, cutEnd: build ? 2600 : (arr === 'melodic' ? 2200 : 1400), atk: breakBar ? 0.2 : 0.06, rev: 0.26, spread: 0.7 });
    if (chorus && !breakBar) {
      // ── ドロップ：うねるワブル/グロウル・ベース（dubstepの主役）──
      // 半小節(2拍)ごとに1音を長く保持し、テンポ同期LFOで刻む。小節ごとにうねり速度を変える
      if (s === 0 || s === 8) {
        const deg = sg.lead[s] != null ? sg.lead[s] : 0;
        const bf = degToFreq(sg.key, sg.scale, deg) * 0.25; // 2オクターブ下の重低音
        const half = bar * 2 + (s === 8 ? 1 : 0);           // 半小節ごとに刻み速度を変える
        const wpb = arr === 'riddim' ? 6 : DUB_WPB[half % DUB_WPB.length]; // riddimは一定のトリプレット感で反復
        vDubWobble(t, bf, { wave: sg.bw, dur: beatLen * 2, gain: (arr === 'melodic' ? 0.28 : 0.36) * energy, cut: arr === 'riddim' ? 420 : 520, depth: arr === 'riddim' ? 520 : 660, q: 13, lfoHz: (RAVE.bpm / 60) * wpb });
      }
      // 金属的なスクリーチ・リード＋ボイスチョップ（melodicは控えめ）
      const sc = sg.screech[s];
      if (sc != null && arr !== 'melodic') {
        const f = degToFreq(sg.key, sg.scale, sc) * 2;
        vWobble(t, f, { wave: 'square', cut: 1800, rate: 13, depth: 950, q: 8, dur: beatLen * 0.5, gain: (arr === 'riddim' ? 0.07 : 0.1) * energy });
        vVocalChop(t, f, { dur: 0.12, gain: 0.03, tone: 1.2, dly: 0.16, rev: 0.12 });
      }
      // melodic：ドロップに歌うスーパーソウのトップラインを重ねる（メロディック・ドラムステップ）
      if (arr === 'melodic') {
        const deg = sg.lead[s];
        if (deg != null) vSuper(t, degToFreq(sg.key, sg.scale, deg) * 2, { voices: 6, detune: 22, type: 'sawtooth', dur: beatLen * 0.5, gain: 0.05 * energy, cutStart: 1600, cutEnd: 6800, atk: 0.01, dly: 0.22, rev: 0.3, duck: false, spread: 0.85 });
      }
    } else if (!breakBar) {
      // イントロ/ビルド：シンプルなサブと刻み
      if (s % 4 === 0) vBass(t, ch.r, { wave: sg.bw, cut: build ? 640 : 360, q: 6, dur: 0.22, gain: 0.26 * energy, env: 1.6 });
      if (build && s % 2 === 0) vBass(t, ch.r * 2, { wave: sg.bw, cut: 820, q: 6, dur: 0.1, gain: 0.16, env: 1.4, sub: false });
    }
    // ビルドのライザー＋スネアロール
    if (build && s === 0) vRiser(t, beatLen * (section >= 28 ? 4 : 2.5));
    if (build && s >= 8 && s % 2 === 0) vSnare(t, 0.2 + (s - 8) * 0.03, 0.1);
    if (isFillStep(s, bar)) vNoiseHit(t, 3000 + s * 150, 0.08, 0.04, 0.1);
  }
  function scheduleStep(step, t) {
    const k = RAVE.kind, s = step % 16, bar = Math.floor(step / 16);
    stepArrangementFx(k, s, bar, t);
    if (k === 'neon') stepEurobeat(s, bar, t);
    else if (k === 'forest') stepTrance(s, bar, t);
    else if (k === 'laser') stepDisco(s, bar, t);
    else if (k === 'future') stepFutureBass(s, bar, t);
    else if (k === 'bass') stepDrumBass(s, bar, t);
    else if (k === 'chill') stepLofiHouse(s, bar, t);
    else if (k === 'dub') stepDubstep(s, bar, t);
    else stepTechno(s, bar, t);
  }

  function makeDancer(hue) {
    const g = new THREE.Group();
    const skinTones = [0xf8d2b4, 0xf0c8a0, 0xc88452, 0x8f5838, 0x5a351f];
    const hairTones = [0x201612, 0x4b2514, 0xc89a42, 0xeeeeee, 0xff2266, 0x33ccff, 0xb866ff];
    const shirt = new THREE.Color().setHSL((hue + rnd(-0.08, 0.08) + 1) % 1, rnd(0.55, 0.95), rnd(0.42, 0.64));
    const pants = new THREE.Color().setHSL((hue + rnd(0.25, 0.6)) % 1, rnd(0.35, 0.75), rnd(0.22, 0.46));
    const skin = new THREE.Color(skinTones[Math.floor(Math.random() * skinTones.length)]);
    const hair = new THREE.Color(hairTones[Math.floor(Math.random() * hairTones.length)]);
    const accent = new THREE.Color().setHSL((hue + rnd(0.08, 0.28)) % 1, 0.95, 0.58);
    const shoe = new THREE.Color().setHSL(Math.random(), 0.35, 0.08);
    const mat = c => new THREE.MeshPhongMaterial({ color: c, emissive: (c.clone ? c : new THREE.Color(c)).clone().multiplyScalar(0.18), shininess: 22 });
    const glowMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
    const cyl = (rt, rb, h, c) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 12), mat(c));
    const sph = (r, c) => new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), mat(c));
    // 腰（脚のルート）
    const hips = new THREE.Group(); hips.position.y = 0.94; g.add(hips);
    hips.add(cyl(0.2, 0.18, 0.18, pants)); // 骨盤
    const makeLeg = sx => {
      const hip = new THREE.Group(); hip.position.set(sx * 0.12, -0.05, 0); hips.add(hip);
      const thigh = cyl(0.1, 0.085, 0.46, pants); thigh.position.y = -0.23; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
      const shin = cyl(0.075, 0.06, 0.44, pants); shin.position.y = -0.22; knee.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.26), mat(shoe)); foot.position.set(0, -0.44, 0.06); knee.add(foot);
      hip.userData.knee = knee; return hip;
    };
    const legL = makeLeg(-1), legR = makeLeg(1);
    // 胴・首・頭
    const torso = cyl(0.2, 0.26, 0.6, shirt); torso.position.y = 1.25; g.add(torso);
    if (Math.random() < 0.55) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.012, 6, 28), mat(accent));
      band.rotation.x = Math.PI / 2; band.position.y = rnd(1.15, 1.38); g.add(band);
    }
    const neck = cyl(0.06, 0.06, 0.1, skin); neck.position.y = 1.6; g.add(neck);
    const headG = new THREE.Group(); headG.position.y = 1.74; g.add(headG);
    headG.add(sph(0.17, skin));
    const hairStyle = Math.floor(Math.random() * 5);
    if (hairStyle === 0) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hair)); headG.add(cap);
    } else if (hairStyle === 1) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(hair)); headG.add(cap);
      for (const sx of [-1, 1]) { const bun = sph(0.065, hair); bun.position.set(sx * 0.15, 0.14, 0); headG.add(bun); }
    } else if (hairStyle === 2) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 6, 24), mat(accent));
      band.rotation.x = Math.PI / 2; band.position.y = 0.16; headG.add(band);
    } else if (hairStyle === 3) {
      const brim = cyl(0.21, 0.21, 0.035, accent); brim.position.y = 0.31; headG.add(brim);
      const hat = cyl(0.13, 0.15, 0.12, hair); hat.position.y = 0.38; headG.add(hat);
    } else {
      for (let i = -1; i <= 1; i++) { const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.17, 5), mat(hair)); spike.position.set(i * 0.055, 0.31, 0); headG.add(spike); }
    }
    // 腕（肩→上腕→肘→前腕→手）
    const makeArm = sx => {
      const sh = new THREE.Group(); sh.position.set(sx * 0.26, 1.48, 0); g.add(sh);
      const up = cyl(0.065, 0.055, 0.4, skin); up.position.y = -0.2; sh.add(up);
      const el = new THREE.Group(); el.position.y = -0.4; sh.add(el);
      const fore = cyl(0.055, 0.045, 0.38, skin); fore.position.y = -0.19; el.add(fore);
      el.add((() => { const h = sph(0.065, skin); h.position.y = -0.4; return h; })());
      if (Math.random() < 0.38) {
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 8), glowMat(accent));
        stick.rotation.z = Math.PI / 2; stick.position.set(sx * 0.09, -0.42, 0.02); el.add(stick);
      }
      sh.userData.elbow = el; return sh;
    };
    const armL = makeArm(-1), armR = makeArm(1);
    g.userData.armL = armL; g.userData.armR = armR;
    g.userData.elbowL = armL.userData.elbow; g.userData.elbowR = armR.userData.elbow;
    g.userData.legL = legL; g.userData.legR = legR;
    g.userData.kneeL = legL.userData.knee; g.userData.kneeR = legR.userData.knee;
    g.userData.head = headG; g.userData.hips = hips; g.userData.torso = torso;
    g.userData.phase = Math.random() * Math.PI * 2; g.userData.spin = rnd(-0.6, 0.6);
    // テンポは曲に同期。拍のオフセットだけずらして“合ってるけどバラバラ”に
    g.userData.beatOffset = Math.random() < 0.5 ? 0 : 0.5; g.userData.amp = rnd(0.8, 1.25); g.userData.moveSeed = Math.random();
    const ang = Math.random() * Math.PI * 2; g.userData.sideX = Math.cos(ang); g.userData.sideZ = Math.sin(ang);
    // 個性：得意ジャンル(ペルソナ)・シグネチャー技・踊りのテンポ倍率（半速/等速/倍速）
    g.userData.persona = PERSONA_WEIGHTS[Math.floor(Math.random() * PERSONA_WEIGHTS.length)];
    const pp = DANCER_PERSONAS[g.userData.persona];
    g.userData.signature = pp && pp.length ? pp[Math.floor(Math.random() * pp.length)] : null;
    g.userData.tempoMul = [0.5, 1, 1, 1, 2][Math.floor(Math.random() * 5)];
    return g;
  }
  function raveResetLists() {
    for (const k of ['lights', 'spots', 'lasers', 'tiles', 'dancers', 'rings', 'pulses', 'cheers', 'fireworks', 'fwQueue', 'shockwaves', 'noteBlocks', 'specialObjects', 'entryObstacles', 'meteors']) RAVE[k] = [];
    RAVE.mirror = null; RAVE.strobe = null;
  }
  function addEntryObstacle(x, z, w, d, h = 0.9) {
    RAVE.entryObstacles.push({ x, z, w, d, h });
  }
  // ジャンルごとに使う踊りの種類（NPCが時間とともにランダムに切り替える）
  const MOVE_POOL = {
    classic: ['headbang', 'stomp', 'moonwalk', 'mjkick', 'twist', 'runningman', 'shuffle'],
    forest:  ['handsup', 'sway', 'mjspin', 'moonwalk', 'spin', 'charleston', 'wavecircle'],
    laser:   ['point', 'mjspin', 'mjkick', 'moonwalk', 'spin', 'sidestep', 'runningman', 'robot'],
    future:  ['handsup', 'jumpclap', 'mjspin', 'moonwalk', 'sway', 'sidestep', 'shuffle'],
    bass:    ['headbang', 'stomp', 'mjkick', 'moonwalk', 'runningman', 'jumpclap', 'shuffle'],
    chill:   ['sway', 'mjlean', 'moonwalk', 'twist', 'charleston', 'sidestep', 'wavecircle'],
    dub:     ['headbang', 'stomp', 'robot', 'mjkick', 'mjspin', 'point'],
  };
  // NPCごとの「得意ジャンル」。会場の雰囲気にこの個性を混ぜて踊る。null=何でも屋(会場プールのみ)
  const DANCER_PERSONAS = {
    breaker:   ['toprock', 'footwork', 'breakfreeze', 'spin'], // ブレイクダンサー
    mj:        ['moonwalk', 'mjkick', 'mjspin', 'mjlean', 'point'],        // マイケル風
    raver:     ['handsup', 'jumpclap', 'bounce', 'wavecircle'],            // 手を上げて飛び跳ねる系
    groover:   ['sway', 'twist', 'charleston', 'sidestep'],                // 落ち着いてノる系
    popper:    ['robot', 'twist', 'mjspin', 'wavecircle'],                 // ロボット/ポップ系
    freestyle: null,                                                       // 何でも屋
  };
  // ペルソナの出現重み（grooverが多め、breaker/mjは少数で目立たせる）
  const PERSONA_WEIGHTS = ['groover', 'groover', 'groover', 'raver', 'raver', 'popper', 'mj', 'mj', 'breaker', 'freestyle'];
  const BATTLE_MOVES = ['point', 'shuffle', 'jumpclap', 'spin', 'robot', 'mjspin', 'breakfreeze'];
  const armLimit = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const setArms = (aL, aR, lz, lx, rz, rx) => {
    aL.rotation.z = armLimit(-lz, -2.45, 0.9); aL.rotation.x = armLimit(lx, -1.15, 1.15);
    aR.rotation.z = armLimit(-rz, -0.9, 2.45); aR.rotation.x = armLimit(rx, -1.15, 1.15);
  };
  const setElbows = (u, l, r) => { u.elbowL.rotation.x = armLimit(l, -1.25, -0.05); u.elbowR.rotation.x = armLimit(r, -1.25, -0.05); };
  // 脚：股関節と膝の前後曲げ(rotation.x)
  const setLegs = (u, lh, lk, rh, rk) => { u.legL.rotation.x = lh; u.kneeL.rotation.x = lk; u.legR.rotation.x = rh; u.kneeR.rotation.x = rk; };
  const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  function captureDancerFrame(d) {
    const u = d.userData;
    u.prevFrame = u.prevFrame || {
      pos: new THREE.Vector3(),
      rot: new THREE.Euler(),
      armL: new THREE.Euler(), armR: new THREE.Euler(), elbowL: new THREE.Euler(), elbowR: new THREE.Euler(),
      legL: new THREE.Euler(), legR: new THREE.Euler(), kneeL: new THREE.Euler(), kneeR: new THREE.Euler(),
      head: new THREE.Euler(), hips: new THREE.Euler(),
    };
    const f = u.prevFrame;
    f.pos.copy(d.position); f.rot.copy(d.rotation);
    f.armL.copy(u.armL.rotation); f.armR.copy(u.armR.rotation); f.elbowL.copy(u.elbowL.rotation); f.elbowR.copy(u.elbowR.rotation);
    f.legL.copy(u.legL.rotation); f.legR.copy(u.legR.rotation); f.kneeL.copy(u.kneeL.rotation); f.kneeR.copy(u.kneeR.rotation);
    f.head.copy(u.head.rotation); f.hips.copy(u.hips.rotation);
    return f;
  }
  function smoothEuler(target, previous, amount) {
    target.x = previous.x + angleDelta(previous.x, target.x) * amount;
    target.y = previous.y + angleDelta(previous.y, target.y) * amount;
    target.z = previous.z + angleDelta(previous.z, target.z) * amount;
  }
  function smoothDancerFrame(d, previous, amount) {
    const u = d.userData;
    d.position.lerpVectors(previous.pos, d.position, amount);
    smoothEuler(d.rotation, previous.rot, amount);
    smoothEuler(u.armL.rotation, previous.armL, amount); smoothEuler(u.armR.rotation, previous.armR, amount);
    smoothEuler(u.elbowL.rotation, previous.elbowL, amount); smoothEuler(u.elbowR.rotation, previous.elbowR, amount);
    smoothEuler(u.legL.rotation, previous.legL, amount); smoothEuler(u.legR.rotation, previous.legR, amount);
    smoothEuler(u.kneeL.rotation, previous.kneeL, amount); smoothEuler(u.kneeR.rotation, previous.kneeR, amount);
    smoothEuler(u.head.rotation, previous.head, amount); smoothEuler(u.hips.rotation, previous.hips, amount);
  }
  // 各踊り。c = { home, facing, bd(個別ビート), pe(個別の拍エンベロープ), amp, dt, spin, sideX, sideZ, ud }
  const MOVES = {
    bounce(d, aL, aR, c) {                       // その場で大きくジャンプ、腕を上げてポンプ
      const u = c.ud;
      d.position.set(c.home.x, c.home.y + c.pe * 0.42 * c.amp, c.home.z);
      d.rotation.set(0, c.facing, Math.sin(c.bd * Math.PI) * 0.08);
      const r = 2.2 + Math.sin(c.bd * Math.PI * 2) * 0.5;
      setArms(aL, aR, r, 0, -r, 0); setElbows(u, -0.5, -0.5);
      const tuck = c.pe * 0.7; setLegs(u, tuck * 0.3, tuck, tuck * 0.3, tuck);
    },
    headbang(d, aL, aR, c) {                     // 前傾で激しく縦ノリ、頭を振る
      const u = c.ud;
      d.position.set(c.home.x, c.home.y + c.pe * 0.1, c.home.z);
      d.rotation.set(0.18 + c.pe * 0.18, c.facing, Math.sin(c.bd * 0.5) * 0.1);
      u.head.rotation.x = c.pe * 0.5;
      const pump = 0.3 + c.pe * 0.4;
      setArms(aL, aR, pump, -0.5 - c.pe * 0.5, -pump, -0.5 - c.pe * 0.5); setElbows(u, -1.2, -1.2);
      const k = 0.15 + c.pe * 0.2; setLegs(u, 0, k, 0, k);
    },
    stomp(d, aL, aR, c) {                        // 左右の脚を交互に踏みしめる
      const u = c.ud, lean = Math.sin(c.bd * Math.PI), L = Math.max(0, lean), R = Math.max(0, -lean);
      d.position.set(c.home.x, c.home.y + Math.abs(lean) * 0.18, c.home.z);
      d.rotation.set(0, c.facing, lean * 0.16);
      setArms(aL, aR, 0.6 + c.pe * 0.3, lean * 0.4, -0.6 - c.pe * 0.3, -lean * 0.4); setElbows(u, -0.6, -0.6);
      setLegs(u, -L * 0.7, L * 1.0, -R * 0.7, R * 1.0);
    },
    twist(d, aL, aR, c) {                        // 上半身と腰を逆にひねるツイスト
      const u = c.ud, tw = Math.sin(c.bd * Math.PI * 2);
      d.position.set(c.home.x, c.home.y + c.pe * 0.12, c.home.z);
      d.rotation.set(0, c.facing + tw * 0.5, 0); u.hips.rotation.y = -tw * 0.4;
      setArms(aL, aR, 1.5, tw * 0.6, -1.5, -tw * 0.6); setElbows(u, -1.0, -1.0);
      setLegs(u, 0, 0.2, 0, 0.2);
    },
    spin(d, aL, aR, c) {                         // その場でぐるぐる回る
      const u = c.ud; u._spin = (u._spin || 0) + c.dt * (c.spin < 0 ? -5 : 5);
      d.position.set(c.home.x, c.home.y + c.pe * 0.2, c.home.z);
      d.rotation.set(0, c.facing + u._spin, 0);
      setArms(aL, aR, 1.9, 0, -1.9, 0); setElbows(u, -0.3, -0.3); setLegs(u, 0.1, 0.15, 0.1, 0.15);
    },
    handsup(d, aL, aR, c) {                       // 両手を高く上げて飛び跳ねる
      const u = c.ud, s = Math.sin(c.bd * 0.8);
      d.position.set(c.home.x, c.home.y + c.pe * 0.3 * c.amp, c.home.z);
      d.rotation.set(0, c.facing, s * 0.18);
      setArms(aL, aR, 2.7, s * 0.4, -2.7, s * 0.4); setElbows(u, -0.2, -0.2);
      const k = 0.1 + c.pe * 0.15; setLegs(u, 0, k, 0, k);
    },
    sway(d, aL, aR, c) {                          // 大きく左右に揺れて体重移動
      const u = c.ud, s = Math.sin(c.bd * 0.6);
      d.position.set(c.home.x + s * 0.3 * c.sideX, c.home.y + (Math.sin(c.bd * Math.PI * 0.5) * 0.5 + 0.5) * 0.1, c.home.z + s * 0.3 * c.sideZ);
      d.rotation.set(0, c.facing, s * 0.22); u.head.rotation.z = -s * 0.2;
      setArms(aL, aR, 2.5 + s * 0.3, s * 0.5, -2.5 + s * 0.3, s * 0.5); setElbows(u, -0.3 - Math.abs(s) * 0.3, -0.3 - Math.abs(s) * 0.3);
      setLegs(u, s > 0 ? -s * 0.2 : 0, Math.max(0, s) * 0.3, s < 0 ? s * 0.2 : 0, Math.max(0, -s) * 0.3);
    },
    point(d, aL, aR, c) {                         // 天を指すディスコポイント＋ホップ
      const u = c.ud, up = Math.floor(c.bd) % 2 === 0, h = Math.abs(Math.sin(c.bd * Math.PI)), shuf = Math.sin(c.bd * Math.PI) * 0.25;
      d.position.set(c.home.x + shuf * c.sideX, c.home.y + h * 0.2, c.home.z + shuf * c.sideZ);
      d.rotation.set(0, c.facing + Math.sin(c.bd * Math.PI) * 0.3, (up ? 1 : -1) * 0.16);
      if (up) { setArms(aL, aR, 0.4, 0.2, -2.5, -1.0); setElbows(u, -0.3, -0.1); setLegs(u, 0.3, 0.1, -0.2, 0.4); }
      else { setArms(aL, aR, 2.5, -1.0, -0.4, 0.2); setElbows(u, -0.1, -0.3); setLegs(u, -0.2, 0.4, 0.3, 0.1); }
    },
    jumpclap(d, aL, aR, c) {                      // ジャンプして手を前で打ち合わせる
      const u = c.ud, j = Math.abs(Math.sin(c.bd * Math.PI));
      d.position.set(c.home.x, c.home.y + j * 0.45 * c.amp, c.home.z);
      d.rotation.set(0, c.facing, 0);
      const close = 1.2 - j * 0.8; setArms(aL, aR, close, 1.4, -close, 1.4); setElbows(u, -1.3, -1.3);
      const tuck = j * 0.8; setLegs(u, tuck * 0.3, tuck, tuck * 0.3, tuck);
    },
    sidestep(d, aL, aR, c) {                      // 横にシャッフルして移動
      const u = c.ud, off = Math.sin(c.bd * Math.PI), L = Math.max(0, off), R = Math.max(0, -off);
      d.position.set(c.home.x + off * 0.5 * c.sideX, c.home.y + Math.abs(off) * 0.14, c.home.z + off * 0.5 * c.sideZ);
      d.rotation.set(0, c.facing, off * 0.18);
      setArms(aL, aR, 1.4, off * 0.5, -1.4, -off * 0.5); setElbows(u, -0.5, -0.5);
      setLegs(u, -L * 0.5, L * 0.3, -R * 0.5, R * 0.3);
    },
    runningman(d, aL, aR, c) {                    // ランニングマン（脚を交互に蹴り上げて滑る）
      const u = c.ud, ph = c.bd * Math.PI, s = Math.sin(ph);
      d.position.set(c.home.x, c.home.y + Math.abs(Math.cos(ph)) * 0.08, c.home.z);
      d.rotation.set(0.08, c.facing, 0);
      const L = Math.max(0, s), R = Math.max(0, -s);
      setLegs(u, -L * 1.0, L * 1.0, -R * 1.0, R * 1.0);
      setArms(aL, aR, 0.5, s * 0.8, -0.5, -s * 0.8); setElbows(u, -1.4, -1.4);
    },
    charleston(d, aL, aR, c) {                    // チャールストン（膝を内外にひねる）
      const u = c.ud, s = Math.sin(c.bd * Math.PI * 2);
      d.position.set(c.home.x, c.home.y + Math.abs(s) * 0.08, c.home.z);
      d.rotation.set(0, c.facing, 0);
      u.legL.rotation.z = s * 0.5; u.legR.rotation.z = s * 0.5;
      setLegs(u, 0.2, 0.3 + Math.abs(s) * 0.2, 0.2, 0.3 + Math.abs(s) * 0.2);
      setArms(aL, aR, 0.8, -s * 0.6, -0.8, s * 0.6); setElbows(u, -0.8, -0.8);
    },
    shuffle(d, aL, aR, c) {
      const u = c.ud, step = Math.sin(c.bd * Math.PI * 4), slide = Math.sin(c.bd * Math.PI * 2);
      d.position.set(c.home.x + slide * 0.28 * c.sideX, c.home.y + Math.abs(step) * 0.08, c.home.z + slide * 0.28 * c.sideZ);
      d.rotation.set(0, c.facing + slide * 0.24, 0);
      setLegs(u, Math.max(0, step) * 0.55, Math.abs(step) * 0.35, Math.max(0, -step) * 0.55, Math.abs(step) * 0.35);
      setArms(aL, aR, 0.9 + slide * 0.45, -step * 0.45, -0.9 + slide * 0.45, step * 0.45); setElbows(u, -0.7, -0.7);
    },
    robot(d, aL, aR, c) {
      const u = c.ud, tick = Math.floor(c.bd * 4), pose = tick % 4, snap = Math.sin(c.bd * Math.PI * 8) > 0 ? 1 : -1;
      d.position.set(c.home.x, c.home.y + (pose % 2) * 0.05, c.home.z);
      d.rotation.set(0, c.facing + (pose - 1.5) * 0.18, snap * 0.04);
      u.head.rotation.y = snap * 0.32;
      setArms(aL, aR, pose < 2 ? 1.2 : 2.2, pose % 2 ? -0.8 : 0.2, pose < 2 ? -2.2 : -1.2, pose % 2 ? 0.2 : -0.8); setElbows(u, -1.55, -1.55);
      setLegs(u, pose === 0 ? 0.35 : 0, 0.25, pose === 2 ? 0.35 : 0, 0.25);
    },
    wavecircle(d, aL, aR, c) {
      const u = c.ud, s = Math.sin(c.bd * Math.PI * 0.8), w = Math.sin(c.bd * Math.PI * 2);
      d.position.set(c.home.x, c.home.y + (w * 0.5 + 0.5) * 0.13, c.home.z);
      d.rotation.set(0, c.facing + s * 0.35, s * 0.14);
      setArms(aL, aR, 2.4 + w * 0.45, s * 0.7, -2.4 + w * 0.45, -s * 0.7); setElbows(u, -0.25, -0.25);
      setLegs(u, 0.08 + Math.abs(s) * 0.18, 0.2, 0.08 + Math.abs(s) * 0.18, 0.2);
    },
    // ── マイケル・ジャクソン風の技 ──
    moonwalk(d, aL, aR, c) {                      // ムーンウォーク：歩く脚運びとは逆に後ろへ滑る
      const u = c.ud, ph = c.bd * Math.PI;
      const glide = Math.sin(c.bd * Math.PI * 0.5);                 // 前後にゆっくりスライド（home付近に留まる）
      d.position.set(c.home.x - glide * 0.6 * c.sideX, c.home.y, c.home.z - glide * 0.6 * c.sideZ);
      d.rotation.set(0, c.facing, 0);
      const s = Math.sin(ph), Lbend = Math.max(0, s), Rbend = Math.max(0, -s);
      setLegs(u, -Lbend * 0.12, Lbend * 1.35, -Rbend * 0.12, Rbend * 1.35); // 片脚を深く曲げて踵上げ→もう片脚で滑る
      setArms(aL, aR, 0.5, s * 0.55, -0.5, -s * 0.55); setElbows(u, -0.5, -0.5); // 腕は軽く前後に
      u.head.rotation.x = 0.08;
    },
    mjkick(d, aL, aR, c) {                        // 鋭いキック＋帽子を押さえるポーズ（交互の脚）
      const u = c.ud, side = Math.floor(c.bd) % 2 === 0, kick = Math.max(0, Math.sin(c.bd * Math.PI)), sharp = kick * kick;
      d.position.set(c.home.x, c.home.y + sharp * 0.08, c.home.z);
      d.rotation.set(0, c.facing, (side ? 1 : -1) * 0.06);
      if (side) setLegs(u, sharp * 1.25, 0.05, 0.1, 0.22); else setLegs(u, 0.1, 0.22, sharp * 1.25, 0.05);
      setArms(aL, aR, 0.3, -0.2, -2.2 - sharp * 0.3, 0.3); setElbows(u, -1.45, -0.3); // 左手は頭(帽子)、右手を鋭く上へ
      u.head.rotation.z = (side ? 1 : -1) * 0.12;
    },
    mjspin(d, aL, aR, c) {                        // 高速スピン → つま先立ちでフリーズポーズ
      const u = c.ud, cyc = c.bd % 2;
      if (cyc < 1.35) {                                            // スピン
        u._mjspin = (u._mjspin || 0) + c.dt * 15;
        d.position.set(c.home.x, c.home.y + 0.05, c.home.z);
        d.rotation.set(0, c.facing + u._mjspin, 0);
        setArms(aL, aR, 1.2, 0, -1.2, 0); setElbows(u, -1.2, -1.2);
        setLegs(u, 0.1, 0.15, 0.1, 0.15);
      } else {                                                     // つま先立ちで静止＋右手を天へ
        d.position.set(c.home.x, c.home.y + 0.13, c.home.z);
        d.rotation.set(0, c.facing + (u._mjspin || 0), 0.05);
        setArms(aL, aR, 0.2, 0.1, -2.7, -0.2); setElbows(u, -0.2, -0.1);
        setLegs(u, 0.04, 0.08, 0.04, 0.08);
        u.head.rotation.x = -0.15;
      }
    },
    mjlean(d, aL, aR, c) {                        // スムーズ・クリミナル風の前傾リーン
      const u = c.ud, lean = Math.sin(c.bd * Math.PI * 0.5) * 0.5 + 0.5;
      d.position.set(c.home.x, c.home.y + lean * 0.05, c.home.z);
      d.rotation.set(lean * 0.5, c.facing, 0);                     // 体を大きく前へ傾ける
      setArms(aL, aR, 0.2, 0.15, -0.2, 0.15); setElbows(u, -0.2, -0.2); // 腕は体側に揃える
      setLegs(u, 0.05, 0.05, 0.05, 0.05);
      u.head.rotation.x = -lean * 0.3;
    },
    // ── ブレイクダンス系 ──
    toprock(d, aL, aR, c) {                       // トップロック：立ちブレイクの導入ステップ＋腕の大振り
      const u = c.ud, s = Math.sin(c.bd * Math.PI), cross = Math.sin(c.bd * Math.PI * 0.5);
      d.position.set(c.home.x + cross * 0.2 * c.sideX, c.home.y + Math.abs(s) * 0.12, c.home.z + cross * 0.2 * c.sideZ);
      d.rotation.set(0.05, c.facing + cross * 0.3, s * 0.08);
      const L = Math.max(0, s), R = Math.max(0, -s);
      setLegs(u, -L * 0.5 + 0.1, L * 0.6, -R * 0.5 + 0.1, R * 0.6);
      u.legL.rotation.z = -s * 0.25; u.legR.rotation.z = -s * 0.25;  // 脚をクロス気味に
      setArms(aL, aR, 1.0 + s * 0.8, s * 0.9, -1.0 + s * 0.8, s * 0.9); setElbows(u, -1.0, -1.0); // 腕を体前で大きくスイング
    },
    footwork(d, aL, aR, c) {                      // フットワーク：しゃがんで前傾、手を床に付き脚を回す（6ステップ風）
      const u = c.ud, sp = (u._fw = (u._fw || 0) + c.dt * 6), s = Math.sin(c.bd * Math.PI * 2);
      d.position.set(c.home.x, c.home.y - 0.16, c.home.z);          // しゃがむ
      d.rotation.set(0.5, c.facing + sp, 0);                        // 前傾しながら回る
      setLegs(u, 0.9 + Math.max(0, s) * 0.45, 0.95, 0.9 + Math.max(0, -s) * 0.45, 0.95); // 膝を深く曲げる
      u.legL.rotation.z = 0.4; u.legR.rotation.z = -0.4;            // 開脚
      setArms(aL, aR, 0.4, 0.95, -0.4, 0.95); setElbows(u, -0.4, -0.4); // 手を床方向へ
      u.head.rotation.x = 0.3;
    },
    breakfreeze(d, aL, aR, c) {                   // フリーズ：横に傾けて片腕で支える静止ポーズ＋脚を持ち上げ
      const u = c.ud, hold = Math.sin(c.bd * Math.PI * 0.5), tilt = 0.6 + Math.max(0, hold) * 0.5;
      d.position.set(c.home.x, c.home.y + 0.05, c.home.z);
      d.rotation.set(0.2, c.facing, tilt);
      setArms(aL, aR, 0.1, 1.2, -2.4, -0.2); setElbows(u, -0.2, -0.2); // 片腕を床へ突っ張り、片腕を上げる
      setLegs(u, 0.8, 1.0, 0.3, 0.6); u.legR.rotation.z = -0.4;
      u.head.rotation.z = 0.3;
    },
  };
  function makeSign(text, color = '#00ddff', width = 3.2, height = 0.9) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = color; x.lineWidth = 12; x.strokeRect(10, 10, c.width - 20, c.height - 20);
    x.fillStyle = color; x.font = 'bold 48px Segoe UI, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending }));
  }
  function addBox(g, w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); g.add(m); return m;
  }
  function addCylinder(g, radiusTop, radiusBottom, height, radialSegments, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), mat);
    m.position.set(x, y, z); g.add(m); return m;
  }
  function trackRaveObject(m, role, seed = 0) {
    m.userData.fxRole = role;
    m.userData.fxSeed = seed;
    m.userData.basePos = m.position.clone();
    m.userData.baseScale = m.scale.clone();
    RAVE.specialObjects.push(m);
    return m;
  }
  function addNoteBlocks(grp, spanX, spanZ, kind) {
    const matFor = i => new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL((RAVE_VENUES[kind].hue + i * 0.11) % 1, 0.85, 0.42),
      emissive: new THREE.Color().setHSL((RAVE_VENUES[kind].hue + i * 0.11) % 1, 0.9, 0.08),
      shininess: 45,
    });
    const spots = [
      [-spanX / 2 - 0.62, -spanZ / 2 - 0.62], [0, -spanZ / 2 - 0.82], [spanX / 2 + 0.62, -spanZ / 2 - 0.62],
      [-spanX / 2 - 0.82, 0], [spanX / 2 + 0.82, 0],
      [-spanX / 2 - 0.62, spanZ / 2 + 0.62], [0, spanZ / 2 + 0.82], [spanX / 2 + 0.62, spanZ / 2 + 0.62],
    ];
    spots.forEach((p, i) => {
      const block = addBox(grp, 0.46, 0.34, 0.46, matFor(i), p[0], 0.18, p[1]);
      block.userData.noteIndex = i;
      trackRaveObject(block, 'noteBlock', i * 0.37);
      RAVE.noteBlocks.push(block);
    });
  }
  function addCheerLights(grp, spanX, spanZ, kind) {
    const hue = RAVE_VENUES[kind].hue;
    for (let i = 0; i < 28; i++) {
      const mat = emissiveMat(new THREE.Color().setHSL((hue + i * 0.045) % 1, 1, 0.58).getHex(), 0);
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.08 + (i % 3) * 0.025, 10, 8), mat);
      const a = i / 28 * Math.PI * 2;
      spark.position.set(Math.cos(a) * spanX * 0.2, 1.1, Math.sin(a) * spanZ * 0.2);
      spark.visible = false;
      spark.userData.angle = a;
      spark.userData.radius = 0.8 + (i % 5) * 0.22;
      spark.userData.seed = i * 0.31;
      grp.add(spark);
      RAVE.cheers.push(spark);
    }
  }
  function raveFloorCell(shape, i, j, w, d) {
    const cx = (w - 1) / 2, cz = (d - 1) / 2;
    if (shape === 'cross') return Math.abs(i - cx) <= 1 || Math.abs(j - cz) <= 1;
    if (shape === 'circle') return Math.hypot(i - cx, j - cz) <= Math.min(w, d) / 2 - 0.35;
    if (shape === 'diamond') return Math.abs(i - cx) + Math.abs(j - cz) <= Math.min(w, d) * 0.55;
    if (shape === 'runway') return true;
    if (shape === 'checker') return true;
    return true;
  }
  function raveDancerPoint(kind, spanX, spanZ) {
    if (kind === 'future') return new THREE.Vector3(rnd(-spanX * 0.36, spanX * 0.36), 0, rnd(-spanZ * 0.28, spanZ * 0.42));
    if (kind === 'bass') return Math.random() < 0.5
      ? new THREE.Vector3(rnd(-spanX * 0.48, -spanX * 0.18), 0, rnd(-spanZ * 0.44, spanZ * 0.44))
      : new THREE.Vector3(rnd(spanX * 0.18, spanX * 0.48), 0, rnd(-spanZ * 0.44, spanZ * 0.44));
    if (kind === 'chill') {
      const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * (Math.min(spanX, spanZ) / 2 - 2.1);
      return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    if (kind === 'laser') return new THREE.Vector3(rnd(-spanX * 0.42, spanX * 0.42), 0, rnd(-spanZ * 0.42, spanZ * 0.42));
    if (kind === 'neon') return Math.random() < 0.5
      ? new THREE.Vector3(rnd(-spanX * 0.62, -spanX * 0.42), 0, rnd(-spanZ * 0.35, spanZ * 0.35))
      : new THREE.Vector3(rnd(spanX * 0.42, spanX * 0.62), 0, rnd(-spanZ * 0.35, spanZ * 0.35));
    if (kind === 'forest') {
      const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * (Math.min(spanX, spanZ) / 2 - 2.0);
      return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    const a = Math.random() * Math.PI * 2, r = 1.1 + Math.random() * (Math.min(spanX, spanZ) / 2 - 1.6);
    return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  function updateDancerHome(d, kind, beat) {
    const u = d.userData, anchor = u.anchor || u.home || d.position, home = u.home || anchor.clone();
    u.home = home;
    if (u.behavior === 'battle') {
      const push = Math.max(0, Math.sin(beat * Math.PI * 2 + u.moveSeed * 7));
      home.x = anchor.x + u.battleSide * (0.18 + push * 0.28);
      home.z = anchor.z + Math.sin(beat * Math.PI + u.moveSeed * 5) * 0.18;
      return home;
    }
    if (u.behavior === 'spectator') {
      const sway = Math.sin(beat * 0.9 + u.moveSeed * 8);
      home.x = anchor.x + sway * 0.12;
      home.z = anchor.z + Math.cos(beat * 0.7 + u.moveSeed * 5) * 0.12;
      return home;
    }
    if (u.behavior === 'orbit') {
      const base = Math.atan2(anchor.z, anchor.x) + beat * 0.16 * (u.spin < 0 ? -1 : 1);
      const radius = Math.max(1.4, Math.hypot(anchor.x, anchor.z));
      home.x = Math.cos(base) * radius;
      home.z = Math.sin(base) * radius;
      return home;
    }
    if (u.behavior === 'walk') {
      home.x = anchor.x + Math.sin(beat * 0.48 + u.moveSeed * 8) * 0.7;
      home.z = anchor.z + Math.cos(beat * 0.36 + u.moveSeed * 6) * 0.45;
      return home;
    }
    if (u.behavior === 'train') {
      const angle = beat * 0.28 + u.trainIndex * 0.72 + u.moveSeed;
      const radius = RAVE.radius * 0.48;
      home.x = Math.cos(angle) * radius;
      home.z = Math.sin(angle) * radius;
      return home;
    }
    if (u.behavior === 'stroll') {
      home.x = anchor.x + Math.sin(beat * 0.18 + u.moveSeed * 9) * 0.45;
      home.z = anchor.z + Math.cos(beat * 0.14 + u.moveSeed * 5) * 0.35;
    }
    return home;
  }
  function assignDancerEntrance(d, target, index, spanX, spanZ, kind) {
    const side = Math.floor(Math.random() * 4), margin = kind === 'bass' ? rnd(12, 17) : kind === 'chill' ? rnd(8, 13) : rnd(10, 15);
    const gate = new THREE.Vector3(), from = new THREE.Vector3();
    if (side === 0) { gate.set(-spanX / 2 - 1.05, 0, rnd(-spanZ / 2, spanZ / 2)); from.set(-spanX / 2 - margin, 0, gate.z + rnd(-2.2, 2.2)); }
    else if (side === 1) { gate.set(spanX / 2 + 1.05, 0, rnd(-spanZ / 2, spanZ / 2)); from.set(spanX / 2 + margin, 0, gate.z + rnd(-2.2, 2.2)); }
    else if (side === 2) { gate.set(rnd(-spanX / 2, spanX / 2), 0, -spanZ / 2 - 1.05); from.set(gate.x + rnd(-2.2, 2.2), 0, -spanZ / 2 - margin); }
    else { gate.set(rnd(-spanX / 2, spanX / 2), 0, spanZ / 2 + 1.05); from.set(gate.x + rnd(-2.2, 2.2), 0, spanZ / 2 + margin); }
    const u = d.userData;
    const lateBias = Math.pow(Math.random(), 0.58);
    const delay = rnd(0.15, kind === 'chill' ? 8.5 : 7.2) * lateBias + (index % 3) * rnd(0.05, 0.38);
    const dist = Math.hypot(target.x - from.x, target.z - from.z);
    const speed = kind === 'chill' ? rnd(2.1, 3.2) : rnd(3.1, 4.8);
    u.entryFrom = from; u.entryGate = gate; u.entryTarget = target.clone(); u.entryClock = -delay;
    u.entryDur = THREE.MathUtils.clamp(dist / speed + rnd(-0.35, 0.85), kind === 'chill' ? 4.2 : 2.8, kind === 'chill' ? 8.2 : 6.7);
    u.entering = true; u.entrySide = side; u.entryWiggle = rnd(0.24, 0.62); u.entryJump = 0; u.entryJumpT = 1;
    d.position.copy(from); d.visible = false;
  }
  function lerpEntryPath(u, e) {
    const split = 0.46;
    if (e < split) return new THREE.Vector3().lerpVectors(u.entryFrom, u.entryGate, e / split);
    return new THREE.Vector3().lerpVectors(u.entryGate, u.entryTarget, (e - split) / (1 - split));
  }
  function entryObstacleAhead(localPos, dir) {
    if (!RAVE.group) return 0;
    const gx = RAVE.group.position.x, gy = RAVE.group.position.y, gz = RAVE.group.position.z;
    let boost = 0;
    for (const ahead of [0.42, 0.86, 1.28]) {
      const wx = Math.floor(gx + localPos.x + dir.x * ahead);
      const wz = Math.floor(gz + localPos.z + dir.z * ahead);
      const baseY = Math.floor(gy + localPos.y);
      if (isSolid(wx, baseY, wz)) boost = Math.max(boost, 0.62);
      if (isSolid(wx, baseY + 1, wz)) boost = Math.max(boost, 1.05);
      if (isSolid(wx, baseY + 2, wz)) boost = Math.max(boost, 1.35);
    }
    return boost;
  }
  function entryVenueObstacleAhead(localPos, dir) {
    let boost = 0;
    for (const ahead of [0.35, 0.72, 1.08]) {
      const px = localPos.x + dir.x * ahead, pz = localPos.z + dir.z * ahead;
      for (const o of RAVE.entryObstacles) {
        if (Math.abs(px - o.x) <= o.w / 2 + 0.28 && Math.abs(pz - o.z) <= o.d / 2 + 0.28) boost = Math.max(boost, o.h);
      }
    }
    return boost;
  }
  function updateDancerEntrance(d, dt, beat) {
    const u = d.userData;
    if (!u.entering) return null;
    u.entryClock += dt;
    if (u.entryClock < 0) { d.visible = false; return { waiting: true }; }
    d.visible = true;
    const raw = Math.min(1, u.entryClock / Math.max(0.1, u.entryDur));
    const e = raw * raw * (3 - raw * 2);
    const home = lerpEntryPath(u, e);
    const next = lerpEntryPath(u, Math.min(1, e + 0.035));
    const dx = next.x - home.x, dz = next.z - home.z;
    const len = Math.max(0.001, Math.hypot(dx, dz));
    const wig = Math.sin((beat * 2.2 + u.moveSeed * 5) * Math.PI) * u.entryWiggle * (1 - e);
    home.x += (-dz / len) * wig;
    home.z += (dx / len) * wig;
    const dir = { x: dx / len, z: dz / len };
    const obstacleJump = Math.max(entryObstacleAhead(home, dir), entryVenueObstacleAhead(home, dir));
    if (obstacleJump > 0 && (u.entryJumpT > 0.58 || obstacleJump > u.entryJump + 0.2)) { u.entryJump = obstacleJump; u.entryJumpT = 0; }
    else u.entryJump = Math.max(0, u.entryJump - dt * 1.9);
    u.entryJumpT = Math.min(1, u.entryJumpT + dt * 2.6);
    const plannedHop = Math.max(0, Math.sin(raw * Math.PI * 8 + u.moveSeed * 2.5)) * 0.16 * (1 - raw);
    home.y += Math.max(plannedHop, u.entryJump * Math.sin(u.entryJumpT * Math.PI));
    if (raw >= 1) {
      u.entering = false;
      d.position.copy(u.entryTarget);
      return null;
    }
    return { home, facing: Math.atan2(dx, dz), progress: raw };
  }
  // リアルな星空データを作る：等級分布（暗い星が大多数）・色温度・天の川の帯＋淡い星雲。
  // 返り値は ShaderMaterial 用の属性配列。星ごとに size/色/位相/またたき量を持たせる。
  function makeStarfield(R) {
    const MAIN = 1300, BAND = 520, NEB = 150, N = MAIN + BAND + NEB;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N), tw = new Float32Array(N);
    // 天の川の帯の基底（傾けた大円）
    const bn = new THREE.Vector3(0.32, 0.46, 0.83).normalize();
    const bu = new THREE.Vector3(1, 0, 0).cross(bn); if (bu.lengthSq() < 1e-4) bu.set(0, 0, 1); bu.normalize();
    const bv = new THREE.Vector3().crossVectors(bn, bu).normalize();
    const tmp = new THREE.Vector3();
    const starColor = () => {
      const t = Math.random();
      if (t < 0.50) return [0.74, 0.82, 1.0];   // 青白
      if (t < 0.78) return [1.0, 1.0, 0.97];    // 白
      if (t < 0.92) return [1.0, 0.92, 0.74];   // 黄
      return [1.0, 0.77, 0.6];                  // 橙
    };
    let k = 0;
    const put = (dir, bright, sz, twk) => {
      pos[k * 3] = dir.x * R; pos[k * 3 + 1] = dir.y * R + 4; pos[k * 3 + 2] = dir.z * R;
      const c = starColor();
      col[k * 3] = c[0] * bright; col[k * 3 + 1] = c[1] * bright; col[k * 3 + 2] = c[2] * bright;
      size[k] = sz; phase[k] = Math.random() * Math.PI * 2; tw[k] = twk; k++;
    };
    // 一様な星（上半球寄り）。等級はべき分布で暗い星を多く、明るい星はまれに大きく
    for (let i = 0; i < MAIN; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.98);
      tmp.set(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
      const mag = Math.pow(Math.random(), 3.2);
      put(tmp, 0.4 + mag * 0.6, 0.5 + mag * 3.0, 0.35 + mag * 0.5);
    }
    // 天の川の帯（密集した微光星）
    for (let i = 0; i < BAND; i++) {
      const a = Math.random() * Math.PI * 2, off = (Math.random() + Math.random() + Math.random() - 1.5) * 0.18;
      tmp.copy(bu).multiplyScalar(Math.cos(a)).addScaledVector(bv, Math.sin(a)).addScaledVector(bn, off).normalize();
      if (tmp.y < -0.15) tmp.y = -tmp.y * 0.4;
      const mag = Math.pow(Math.random(), 4.0);
      put(tmp, 0.42 + mag * 0.5, 0.4 + mag * 1.7, 0.5 + mag * 0.4);
    }
    // 天の川の淡いヘイズ（大きく淡い・ほぼまたたかない＝光る川の地）。明るめ＋青/ティール/紫で色付け
    const HAZE = [[0.24, 0.30, 0.46], [0.18, 0.36, 0.42], [0.36, 0.24, 0.48], [0.30, 0.34, 0.44], [0.22, 0.40, 0.40]];
    for (let i = 0; i < NEB; i++) {
      const a = Math.random() * Math.PI * 2, off = (Math.random() + Math.random() - 1.0) * 0.14;
      tmp.copy(bu).multiplyScalar(Math.cos(a)).addScaledVector(bv, Math.sin(a)).addScaledVector(bn, off).normalize();
      pos[k * 3] = tmp.x * R; pos[k * 3 + 1] = tmp.y * R + 4; pos[k * 3 + 2] = tmp.z * R;
      const hz = HAZE[Math.random() * HAZE.length | 0], v = 0.8 + Math.random() * 0.5;
      col[k * 3] = hz[0] * v; col[k * 3 + 1] = hz[1] * v; col[k * 3 + 2] = hz[2] * v;
      size[k] = 14 + Math.random() * 14; phase[k] = Math.random() * 6.28; tw[k] = 0.06; k++;
    }
    return { pos, col, size, phase, tw };
  }
  const STAR_VERT = `
    attribute vec3 aColor; attribute float aSize; attribute float aPhase; attribute float aTwinkle;
    uniform float uTime; uniform float uEnv; uniform float uPixel;
    varying vec3 vColor; varying float vTw;
    void main() {
      vColor = aColor;
      float s = 0.5 + 0.5 * sin(uTime * 2.5 + aPhase);
      vTw = 1.0 - aTwinkle * (1.0 - s) * 0.8;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (1.0 + uEnv * 0.5) * uPixel * (300.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`;
  const STAR_FRAG = `
    precision mediump float;
    uniform float uOpacity; varying vec3 vColor; varying float vTw;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float a = 1.0 - smoothstep(0.0, 0.5, d);
      a = pow(a, 2.2) * vTw * uOpacity;
      if (a < 0.004) discard;
      gl_FragColor = vec4(vColor * a, a);
    }`;
  // 深宇宙の素材テクスチャ（星雲/渦巻銀河/十字輝星）は1度だけ生成して共有（会場破棄でも捨てない）。
  const SKY_SHARED_TEX = new Set();
  let SKY_TEX = null;
  function ensureSkyTextures() {
    if (SKY_TEX) return SKY_TEX;
    const mk = (N) => { const c = document.createElement('canvas'); c.width = c.height = N; return [c, c.getContext('2d')]; };
    // 星雲（ふんわりした塊。白で描き、スプライト側で色を付ける）
    const [nc, ng] = mk(256); ng.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 150; i++) {
      const a = Math.random() * 6.28, r = Math.pow(Math.random(), 0.6) * 122, x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
      const rad = 12 + Math.random() * 46, al = 0.03 + Math.random() * 0.09;
      const grd = ng.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(255,255,255,${al})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
      ng.fillStyle = grd; ng.beginPath(); ng.arc(x, y, rad, 0, 6.28); ng.fill();
    }
    // 端を放射状にフェード（四角いスプライト境界を消して柔らかい雲に）
    ng.globalCompositeOperation = 'destination-in';
    const nmask = ng.createRadialGradient(128, 128, 30, 128, 128, 126);
    nmask.addColorStop(0, 'rgba(255,255,255,1)'); nmask.addColorStop(1, 'rgba(255,255,255,0)');
    ng.fillStyle = nmask; ng.fillRect(0, 0, 256, 256);
    ng.globalCompositeOperation = 'source-over';
    // カラフル星雲用テクスチャ（うねるフィラメント＝密度を抑え筋を出すので加算でも“板”にならず鮮やかに発色）
    const [bc, bg2] = mk(256); bg2.clearRect(0, 0, 256, 256); bg2.globalCompositeOperation = 'lighter';
    for (let f = 0; f < 5; f++) {
      let x = rnd(64, 192), y = rnd(64, 192), ang = rnd(0, 6.28);
      for (let i = 0; i < 70; i++) {
        ang += rnd(-0.55, 0.55); x += Math.cos(ang) * 3.4; y += Math.sin(ang) * 3.4;
        if (x < 8 || x > 248 || y < 8 || y > 248) break;
        const rad = 7 + Math.random() * 20, al = 0.018 + Math.random() * 0.05;
        const grd2 = bg2.createRadialGradient(x, y, 0, x, y, rad);
        grd2.addColorStop(0, `rgba(255,255,255,${al})`); grd2.addColorStop(1, 'rgba(255,255,255,0)');
        bg2.fillStyle = grd2; bg2.beginPath(); bg2.arc(x, y, rad, 0, 6.28); bg2.fill();
      }
    }
    for (let i = 0; i < 36; i++) { // 明るい芯の点（フィラメント中のホットスポット）
      const x = rnd(40, 216), y = rnd(40, 216), rad = 3 + Math.random() * 7;
      const grd2 = bg2.createRadialGradient(x, y, 0, x, y, rad);
      grd2.addColorStop(0, `rgba(255,255,255,${0.10 + Math.random() * 0.16})`); grd2.addColorStop(1, 'rgba(255,255,255,0)');
      bg2.fillStyle = grd2; bg2.beginPath(); bg2.arc(x, y, rad, 0, 6.28); bg2.fill();
    }
    bg2.globalCompositeOperation = 'destination-in';
    const bmask = bg2.createRadialGradient(128, 128, 20, 128, 128, 128);
    bmask.addColorStop(0, 'rgba(255,255,255,1)'); bmask.addColorStop(1, 'rgba(255,255,255,0)');
    bg2.fillStyle = bmask; bg2.fillRect(0, 0, 256, 256);
    bg2.globalCompositeOperation = 'source-over';
    // 渦巻銀河（明るいコア＋2本の腕）
    const [gc, gg] = mk(256); gg.clearRect(0, 0, 256, 256);
    let grd = gg.createRadialGradient(128, 128, 0, 128, 128, 46);
    grd.addColorStop(0, 'rgba(255,250,235,0.95)'); grd.addColorStop(1, 'rgba(255,238,205,0)');
    gg.fillStyle = grd; gg.fillRect(0, 0, 256, 256);
    gg.globalCompositeOperation = 'lighter';
    for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 1100; i++) {
      const t = i / 1100, ang = arm * Math.PI + t * 10, rad = t * 118, sc = (1 - t) * 6 + 1;
      const x = 128 + Math.cos(ang) * rad + rnd(-sc, sc), y = 128 + Math.sin(ang) * rad * 0.6 + rnd(-sc, sc);
      gg.fillStyle = `rgba(${200 + (Math.random() * 55 | 0)},${195 + (Math.random() * 50 | 0)},255,${(1 - t) * 0.5 * Math.random()})`;
      gg.fillRect(x, y, 1.4, 1.4);
    }
    gg.globalCompositeOperation = 'source-over';
    // 輝く星（中心グロー＋十字の光条）
    const [fc, fg] = mk(128); fg.clearRect(0, 0, 128, 128); fg.globalCompositeOperation = 'lighter';
    let fgrd = fg.createRadialGradient(64, 64, 0, 64, 64, 52);
    fgrd.addColorStop(0, 'rgba(255,255,255,1)'); fgrd.addColorStop(0.18, 'rgba(220,235,255,0.55)'); fgrd.addColorStop(1, 'rgba(170,205,255,0)');
    fg.fillStyle = fgrd; fg.fillRect(0, 0, 128, 128);
    const spike = (rot) => { fg.save(); fg.translate(64, 64); fg.rotate(rot); const lg = fg.createLinearGradient(0, -60, 0, 60); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.85)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); fg.fillStyle = lg; fg.fillRect(-1, -60, 2, 120); fg.restore(); };
    spike(0); spike(Math.PI / 2);
    const tex = o => { const t = new THREE.CanvasTexture(o); t.colorSpace = THREE.SRGBColorSpace; SKY_SHARED_TEX.add(t); return t; };
    SKY_TEX = { cloud: tex(nc), neb: tex(bc), galaxy: tex(gc), flare: tex(fc) };
    return SKY_TEX;
  }
  function makeSkySprite(map, color) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.renderOrder = -1; return s;
  }
  // 惑星テクスチャ（縞＋焼き込みの明暗で立体感。暗い会場でも見えるよう自発光のBasicで描く）
  function makePlanetTex(hue) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    for (let y = 0; y < 128; y++) {
      const band = 0.5 + 0.5 * Math.sin(y * 0.16 + Math.sin(y * 0.03) * 3);
      g.fillStyle = '#' + new THREE.Color().setHSL((hue + 1) % 1, 0.5, 0.24 + band * 0.26).getHexString();
      g.fillRect(0, y, 128, 1);
    }
    g.globalCompositeOperation = 'multiply';
    const grd = g.createLinearGradient(0, 0, 128, 0);
    grd.addColorStop(0, '#000'); grd.addColorStop(0.4, '#3a3a3a'); grd.addColorStop(0.72, '#ffffff'); grd.addColorStop(1, '#d6d6d6');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'source-over';
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // 深宇宙の演出：天の川のコア・カラフルな星雲・渦巻銀河・輝星・環のある惑星＋衛星
  function addDeepSpace(grp, hue) {
    const T = ensureSkyTextures();
    const dirUp = (minY = 0.12) => { const th = rnd(0, 6.28), ph = Math.acos(rnd(minY, 1)); return new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)); };
    // 天の川のコア（帯に沿った明るい塊）
    const bn = new THREE.Vector3(0.32, 0.46, 0.83).normalize();
    const bu = new THREE.Vector3(1, 0, 0).cross(bn).normalize();
    const bv = new THREE.Vector3().crossVectors(bn, bu).normalize();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, dir = new THREE.Vector3().copy(bu).multiplyScalar(Math.cos(a)).addScaledVector(bv, Math.sin(a)).addScaledVector(bn, rnd(-0.07, 0.07)).normalize();
      if (dir.y < 0) dir.y = -dir.y * 0.5;
      const warm = [0xefe2c8, 0xe8d2b0, 0xf0e6d0, 0xd8c4ff][i % 4]; // 暖白＋一部青み
      const s = makeSkySprite(T.cloud, warm);
      s.position.copy(dir).multiplyScalar(100); s.material.opacity = rnd(0.5, 0.72); s.material.rotation = rnd(0, 6.28);
      const sz = rnd(38, 60); s.scale.set(sz, sz * 0.4, 1); grp.add(s);
    }
    // 天の川の明るい芯（帯の中心に沿った密な光の川）
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, dir = new THREE.Vector3().copy(bu).multiplyScalar(Math.cos(a)).addScaledVector(bv, Math.sin(a)).addScaledVector(bn, rnd(-0.02, 0.02)).normalize();
      if (dir.y < 0) dir.y = -dir.y * 0.5;
      const s = makeSkySprite(T.cloud, [0xfff2da, 0xffe8c8, 0xf6ecff][i % 3]);
      s.position.copy(dir).multiplyScalar(99); s.material.opacity = rnd(0.6, 0.85); s.material.rotation = rnd(0, 6.28);
      const sz = rnd(20, 34); s.scale.set(sz, sz * 0.34, 1); grp.add(s);
    }
    // カラフルな星雲（フィラメント状テクスチャ＝重なっても白飛び/板にならず鮮やかに発色）
    const cols = [0xff3b6b, 0xc850ff, 0x7a5cff, 0x3a7bff, 0xff7a3a, 0x2fd0d0, 0xff49c0, 0x00e0a0];
    for (let i = 0; i < 11; i++) {
      const s = makeSkySprite(T.neb, cols[i % cols.length]);
      s.position.copy(dirUp(0.0)).multiplyScalar(rnd(96, 106)); s.material.opacity = rnd(0.4, 0.7); s.material.rotation = rnd(0, 6.28);
      const sz = rnd(30, 56); s.scale.set(sz, sz * rnd(0.55, 0.92), 1); grp.add(s);
    }
    // 渦巻銀河
    for (let i = 0; i < 4; i++) {
      const s = makeSkySprite(T.galaxy, [0xeaf0ff, 0xfff0e0, 0xe6e0ff][i % 3]);
      s.position.copy(dirUp(0.2)).multiplyScalar(100); s.material.opacity = rnd(0.55, 0.85); s.material.rotation = rnd(0, 6.28);
      const sz = rnd(5, 11); s.scale.set(sz, sz, 1); grp.add(s);
    }
    // 輝く星（十字の光条）
    for (let i = 0; i < 5; i++) {
      const s = makeSkySprite(T.flare, [0xbcd6ff, 0xffffff, 0xffe6c0][i % 3]);
      s.position.copy(dirUp(0.18)).multiplyScalar(89); s.material.opacity = rnd(0.7, 1.0);
      const sz = rnd(5, 9); s.scale.set(sz, sz, 1); grp.add(s);
    }
    // 環のある惑星
    const planet = new THREE.Mesh(new THREE.SphereGeometry(3.4, 28, 20), new THREE.MeshBasicMaterial({ map: makePlanetTex((hue + 0.5) % 1), fog: false }));
    planet.position.copy(dirUp(0.25)).multiplyScalar(72); planet.renderOrder = -1; grp.add(planet);
    const ringGrp = new THREE.Group(); ringGrp.position.copy(planet.position);
    for (const rg of [[4.4, 5.4, 0.5], [5.6, 6.0, 0.28], [6.2, 7.3, 0.42]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(rg[0], rg[1], 56), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((hue + 0.5) % 1, 0.4, 0.6).getHex(), transparent: true, opacity: rg[2], side: THREE.DoubleSide, depthWrite: false, fog: false }));
      ringGrp.add(ring);
    }
    ringGrp.rotation.set(1.15, 0.3, 0.2); grp.add(ringGrp);
    // 衛星（小さめの惑星）
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.9, 1.8), 20, 14), new THREE.MeshBasicMaterial({ map: makePlanetTex(rnd(0, 1)), fog: false }));
      m.position.copy(dirUp(0.2)).multiplyScalar(rnd(64, 82)); m.renderOrder = -1; grp.add(m);
    }
  }
  // 会場の“空”を作る：星空グラデーションドーム＋またたく星＋深宇宙＋流れ星プール（ドラマチックな夜空）。
  // すべて grp（RAVE.group）に追加するので会場を消すと自動で破棄される。フォグは効かせない＝遠くでも沈まない。
  function buildVenueSky(grp, kind, cfg) {
    const hue = cfg.hue;
    const col = (h, s, l) => '#' + new THREE.Color().setHSL((h + 1) % 1, s, l).getHexString();
    // —— グラデーションのスカイドーム（天頂=深い闇 / 地平線=会場色のグロー） ——
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256;
    const g = cv.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0.00, col(hue, 0.5, 0.01));      // 天頂：会場色を帯びた漆黒
    grd.addColorStop(0.42, col(hue, 0.5, 0.022));
    grd.addColorStop(0.50, col(hue + 0.03, 0.62, 0.052)); // 地平線：会場色のグロー
    grd.addColorStop(0.60, col(hue, 0.5, 0.02));
    grd.addColorStop(1.00, col(hue, 0.45, 0.01));
    g.fillStyle = grd; g.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(110, 32, 20),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -2; grp.add(dome);
    // —— リアルな星空（等級ばらつき・色温度・天の川・個別のまたたきをシェーダで） ——
    const sd = makeStarfield(90);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sd.pos, 3));
    sg.setAttribute('aColor', new THREE.BufferAttribute(sd.col, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(sd.size, 1));
    sg.setAttribute('aPhase', new THREE.BufferAttribute(sd.phase, 1));
    sg.setAttribute('aTwinkle', new THREE.BufferAttribute(sd.tw, 1));
    const starMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uEnv: { value: 0 }, uOpacity: { value: 0.9 }, uPixel: { value: renderer.getPixelRatio() } },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const stars = new THREE.Points(sg, starMat);
    stars.frustumCulled = false; stars.renderOrder = -1; grp.add(stars); trackRaveObject(stars, 'nightStars', 0);
    // —— 深宇宙（星雲・銀河・輝星・環のある惑星・衛星） ——
    addDeepSpace(grp, cfg.hue);
    // —— 流れ星プール（普段は不可視。updateVenueSkyで時々発火） ——
    RAVE.meteors = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.6), emissiveMat(0xcfe6ff, 0));
      m.visible = false; m.renderOrder = -1;
      m.userData = { vel: new THREE.Vector3(), life: 0, maxLife: 1 };
      grp.add(m); RAVE.meteors.push(m);
    }
    RAVE.meteorNext = rnd(1.5, 4.5); RAVE.skyFwNext = rnd(3, 7);
  }
  // 流れ星の発火/移動と、ドラマ用の自動打ち上げ花火
  function updateVenueSky(dt) {
    if (!RAVE.meteors || !RAVE.meteors.length) return;
    RAVE.meteorNext -= dt;
    if (RAVE.meteorNext <= 0) {
      RAVE.meteorNext = rnd(2.0, 6.5);
      const m = RAVE.meteors.find(x => !x.visible);
      if (m) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const vel = new THREE.Vector3(-side * rnd(20, 34), -rnd(8, 16), rnd(-6, 6));
        m.position.set(side * rnd(20, 42), rnd(28, 50), rnd(-50, 30));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vel.clone().normalize());
        m.userData.vel.copy(vel); m.userData.maxLife = rnd(0.7, 1.2); m.userData.life = m.userData.maxLife;
        m.visible = true;
      }
    }
    for (const m of RAVE.meteors) {
      if (!m.visible) continue;
      m.userData.life -= dt;
      if (m.userData.life <= 0) { m.visible = false; continue; }
      m.position.addScaledVector(m.userData.vel, dt);
      m.material.opacity = Math.sin((m.userData.life / m.userData.maxLife) * Math.PI) * 0.95;
    }
    RAVE.skyFwNext -= dt;
    if (RAVE.skyFwNext <= 0) { RAVE.skyFwNext = rnd(3.2, 6.5); launchFireworks(4 + (Math.random() * 5 | 0)); } // 花火大会級の連発
  }
  function buildRaveVenue(kind) {
    raveResetLists();
    const cfg = RAVE_VENUES[kind], grp = new THREE.Group();
    const TILE = cfg.tile, W = cfg.w, D = cfg.d, spanX = TILE * W, spanZ = TILE * D;
    const offX = -spanX / 2 + TILE / 2, offZ = -spanZ / 2 + TILE / 2;
    RAVE.radius = Math.max(spanX, spanZ) / 2;
    buildVenueSky(grp, kind, cfg);
    const tileGeo = new THREE.PlaneGeometry(TILE * 0.96, TILE * 0.96);
    for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
      if (!raveFloorCell(cfg.shape, i, j, W, D)) continue;
      let mat = emissiveMat(0x111111);
      if (kind === 'neon') mat = emissiveMat((i === Math.floor(W / 2) || j % 3 === 1) ? 0xffcc22 : 0x151515);
      if (kind === 'forest') mat = emissiveMat((i + j) % 2 ? 0x123b58 : 0x08162a);
      if (kind === 'laser') mat = emissiveMat((i + j) % 2 ? 0xffffff : 0x101010);
      if (kind === 'classic') mat = emissiveMat((i + j) % 3 ? 0x121217 : 0x23232b);
      if (kind === 'future') mat = emissiveMat((i + j) % 2 ? 0x25134a : 0x0c1028);
      if (kind === 'bass') mat = emissiveMat(j % 2 ? 0x071409 : 0x0d2614);
      if (kind === 'chill') mat = emissiveMat((i + j) % 2 ? 0x101425 : 0x1b1730);
      if (kind === 'dub') mat = emissiveMat((i + j) % 2 ? 0x2a0033 : 0x12001a);
      const m = new THREE.Mesh(tileGeo, mat);
      m.rotation.x = -Math.PI / 2; m.position.set(offX + i * TILE, 0.02, offZ + j * TILE);
      m.userData.ij = i + j; m.userData.kind = kind; m.userData.check = (i + j) % 2; grp.add(m); RAVE.tiles.push(m);
    }
    const dark = new THREE.MeshPhongMaterial({ color: 0x121218 });
    const metal = new THREE.MeshPhongMaterial({ color: 0x303038, shininess: 30 });
    const rim = addBox(grp, spanX + 1, 0.1, spanZ + 1, dark, 0, -0.06, 0);
    if (kind === 'forest') { rim.geometry.dispose(); rim.geometry = new THREE.CylinderGeometry(spanX / 2 + 0.45, spanX / 2 + 0.45, 0.12, 48); }
    if (kind === 'future') { rim.geometry.dispose(); rim.geometry = new THREE.CylinderGeometry(Math.min(spanX, spanZ) * 0.58, Math.min(spanX, spanZ) * 0.58, 0.14, 4); rim.rotation.y = Math.PI / 4; }
    if (kind === 'chill') { rim.geometry.dispose(); rim.geometry = new THREE.CylinderGeometry(Math.min(spanX, spanZ) * 0.52, Math.min(spanX, spanZ) * 0.52, 0.1, 64); }
    for (let i = 0; i < cfg.lights; i++) {
      const L = new THREE.PointLight(0xffffff, 1, 24, 1.6); L.position.set(0, 5.2, 0); grp.add(L);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), emissiveMat(0xffffff)); L.add(bulb);
      RAVE.lights.push(L);
    }
    for (let i = 0; i < cfg.spots; i++) {
      const S = new THREE.SpotLight(0xffffff, 2, 28, 0.34, 0.6, 1.2);
      S.position.set((i % 2 ? 1 : -1) * spanX / 3, 5.7, (i > 1 ? 1 : -1) * spanZ / 5); grp.add(S); grp.add(S.target);
      RAVE.spots.push(S);
    }
    RAVE.strobe = new THREE.PointLight(0xffffff, 0, 36, 1); RAVE.strobe.position.set(0, 5, 0); grp.add(RAVE.strobe);
    if (kind !== 'chill' && kind !== 'neon') {
      const battleRing = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.035, 8, 72), emissiveMat(kind === 'bass' ? 0x66ff88 : kind === 'future' ? 0xff66dd : 0xffdd66, 0.52));
      battleRing.rotation.x = Math.PI / 2; battleRing.position.y = 0.13; grp.add(battleRing); RAVE.rings.push(battleRing);
    }
    const laserGeo = new THREE.BoxGeometry(0.05, 0.05, Math.max(spanX, spanZ) * 1.45);
    for (let i = 0; i < cfg.lasers; i++) {
      const m = new THREE.Mesh(laserGeo, emissiveMat(0xff0066, 0.6));
      m.position.set(0, 5.4, 0); grp.add(m); RAVE.lasers.push(m);
    }
    if (kind === 'classic') {
      for (const z of [-spanZ / 2, spanZ / 2]) addBox(grp, spanX, 0.22, 0.22, metal, 0, 4.8, z);
      for (const x of [-spanX / 2, spanX / 2]) addBox(grp, 0.22, 4.8, 0.22, metal, x, 2.4, -spanZ / 2);
      for (const x of [-spanX * 0.32, spanX * 0.32]) for (const z of [spanZ / 2 - 0.9]) {
        addBox(grp, 0.8, 1.7, 0.75, dark, x, 0.85, z); addBox(grp, 0.44, 0.44, 0.08, emissiveMat(0x5500ff, 0.7), x, 1.25, z - 0.39);
      }
      // 倉庫の四隅コンクリ柱
      for (const x of [-spanX / 2 - 0.3, spanX / 2 + 0.3]) for (const z of [-spanZ / 2 - 0.3, spanZ / 2 + 0.3]) addBox(grp, 0.42, 4.8, 0.42, new THREE.MeshPhongMaterial({ color: 0x23232a }), x, 2.4, z);
      // 天井トラスから吊るすパーライト（拍で発光）
      for (const x of [-spanX * 0.3, 0, spanX * 0.3]) for (const z of [-spanZ * 0.28, spanZ * 0.28]) {
        addBox(grp, 0.22, 0.26, 0.22, new THREE.MeshPhongMaterial({ color: 0x15151c }), x, 4.55, z);
        const lens = addBox(grp, 0.16, 0.06, 0.16, emissiveMat(0x88bbff, 0.9), x, 4.38, z); RAVE.pulses.push(lens);
      }
      // 側面ストロボバー
      for (const x of [-spanX / 2 - 0.08, spanX / 2 + 0.08]) { const bar = addBox(grp, 0.1, 0.1, spanZ, emissiveMat(0x6699ff, 0.6), x, 3.6, 0); RAVE.pulses.push(bar); }
      // DJ後方のスピーカーウォール
      for (const sx of [-1, 1]) {
        const sub = addBox(grp, 0.9, 2.2, 0.7, new THREE.MeshPhongMaterial({ color: 0x101015, emissive: 0x0a0a14 }), sx * spanX * 0.34, 1.1, -spanZ / 2 + 0.5); RAVE.pulses.push(sub);
        for (const cy of [1.6, 1.05, 0.5]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16), emissiveMat(0x5588ff, 0.7)); c.rotation.x = Math.PI / 2; c.position.set(sx * spanX * 0.34, cy, -spanZ / 2 + 0.16); grp.add(c); RAVE.pulses.push(c); }
        addEntryObstacle(sx * spanX * 0.34, -spanZ / 2 + 0.5, 1.0, 0.9, 2.2);
      }
      const sign = makeSign('RAVE', '#66ddff', 3.4, 0.95); sign.position.set(0, 4.1, -spanZ / 2 + 0.12); grp.add(sign); RAVE.pulses.push(sign);
    }
    if (kind === 'neon') {
      const railMat = emissiveMat(0xff2244, 0.65);
      for (const x of [-spanX / 2 - 0.38, spanX / 2 + 0.38]) { const r = addBox(grp, 0.12, 0.16, spanZ + 1, railMat.clone(), x, 0.22, 0); RAVE.pulses.push(r); }
      for (let z = -5; z <= 5; z += 2.5) {
        const left = addBox(grp, 0.14, 3.0, 0.14, emissiveMat(0xff1133, 0.72), -spanX / 2, 1.5, z);
        const right = addBox(grp, 0.14, 3.0, 0.14, emissiveMat(0xffcc22, 0.72), spanX / 2, 1.5, z);
        const top = addBox(grp, spanX, 0.14, 0.14, emissiveMat(0xff8822, 0.65), 0, 3.0, z);
        RAVE.pulses.push(left, right, top);
      }
      // センターラインの破線（夜の道路）
      for (let z = -spanZ / 2 + 0.6; z <= spanZ / 2 - 0.6; z += 1.6) { const dash = addBox(grp, 0.16, 0.02, 0.7, emissiveMat(0xffffff, 0.7), 0, 0.04, z); RAVE.pulses.push(dash); }
      // 道路沿いの街灯（ポール＋発光ヘッド）
      for (const sx of [-1, 1]) for (let z = -spanZ / 2 + 1.2; z <= spanZ / 2 - 1.2; z += 3.4) {
        addBox(grp, 0.1, 2.6, 0.1, new THREE.MeshPhongMaterial({ color: 0x222026 }), sx * (spanX / 2 + 0.55), 1.3, z);
        const arm = addBox(grp, 0.5, 0.08, 0.08, new THREE.MeshPhongMaterial({ color: 0x222026 }), sx * (spanX / 2 + 0.32), 2.55, z);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), emissiveMat(0xffd060, 0.9)); lamp.position.set(sx * (spanX / 2 + 0.12), 2.5, z); grp.add(lamp); RAVE.pulses.push(lamp);
      }
      // オーバーヘッドの速度線ビーム
      for (let i = 0; i < 5; i++) { const beam = addBox(grp, 0.06, 0.06, spanZ * 0.9, emissiveMat(i % 2 ? 0xff3366 : 0x33ccff, 0.5), (i - 2) * spanX * 0.18, 3.3, 0); RAVE.pulses.push(beam); }
      // ゴール門（フィニッシュガントリー）＋夜景シルエット
      for (const sx of [-1, 1]) addBox(grp, 0.18, 3.4, 0.18, new THREE.MeshPhongMaterial({ color: 0x2a2530 }), sx * (spanX / 2 + 0.3), 1.7, -spanZ / 2 + 0.3);
      addBox(grp, spanX + 1.2, 0.3, 0.2, emissiveMat(0xffcc22, 0.5), 0, 3.4, -spanZ / 2 + 0.3);
      for (let i = 0; i < 9; i++) { const bld = addBox(grp, rnd(0.5, 1.0), rnd(1.0, 3.0), 0.2, new THREE.MeshPhongMaterial({ color: 0x0a0810, emissive: 0x140a1e }), -spanX * 0.55 + i * (spanX * 1.1 / 8), rnd(0.6, 1.6), spanZ / 2 + 0.6); RAVE.pulses.push(bld); }
      const sign = makeSign('EUROBEAT', '#ffcc22', 4.2, 1.0); sign.position.set(0, 3.85, -spanZ / 2 + 0.18); grp.add(sign); RAVE.pulses.push(sign);
    }
    if (kind === 'forest') {
      // ドーム＆星空は共通の深宇宙(buildVenueSky/addDeepSpace)に統合したので会場固有のものは置かない
      // —— 中央の光の柱（ゴッドレイ。拍とドロップで脈動） ——
      const pillarH = spanX / 2 + 1.6;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.7, pillarH, 22, 1, true), emissiveMat(0x66ddff, 0.1));
      pillar.material.side = THREE.DoubleSide; pillar.position.y = pillarH / 2; grp.add(pillar); trackRaveObject(pillar, 'tranceBeam', 0); RAVE.pulses.push(pillar);
      // —— 浮遊する回転リング ——
      for (let i = 0; i < 5; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(1.8 + i * 1.0, 0.04, 8, 110), emissiveMat(i % 2 ? 0x44aaff : 0xaa66ff, 0.55));
        r.rotation.x = Math.PI / 2; r.position.y = 0.9 + i * 0.62; r.userData.seed = i; grp.add(r); RAVE.rings.push(r);
      }
      // —— 結晶の柱（外周＋内周の二重配置で奥行き） ——
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2, crystal = new THREE.Mesh(new THREE.ConeGeometry(0.34, 2.2, 5), emissiveMat(i % 2 ? 0x55ddff : 0x9966ff, 0.5));
        crystal.position.set(Math.cos(a) * (spanX / 2 - 0.5), 1.1, Math.sin(a) * (spanZ / 2 - 0.5)); grp.add(crystal); RAVE.pulses.push(crystal);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i + 0.5) / 6 * Math.PI * 2, c2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.1, 5), emissiveMat(0x77ccff, 0.55));
        c2.position.set(Math.cos(a) * (spanX / 2 - 1.8), 0.55, Math.sin(a) * (spanZ / 2 - 1.8)); grp.add(c2); RAVE.pulses.push(c2);
      }
      // —— 浮遊グロウオーブ ——
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2, orb = new THREE.Mesh(new THREE.SphereGeometry(0.13 + (i % 3) * 0.04, 12, 8), emissiveMat(i % 2 ? 0x66ddff : 0xaa66ff, 0.6));
        orb.position.set(Math.cos(a) * spanX * 0.5, 2.6 + Math.sin(i * 1.3) * 0.5, Math.sin(a) * spanZ * 0.46); grp.add(orb); RAVE.pulses.push(orb);
      }
      // —— DJステージ（一段高い台）＋スピーカースタック ——
      const stage = addBox(grp, spanX * 0.55, 0.5, 1.8, new THREE.MeshPhongMaterial({ color: 0x12203a, emissive: 0x06122a, shininess: 20 }), 0, 0.25, -spanZ / 2 + 0.7);
      RAVE.pulses.push(stage); addEntryObstacle(0, -spanZ / 2 + 0.7, spanX * 0.55 + 0.3, 2.0, 0.5);
      for (const sx of [-1, 1]) {
        const stack = addBox(grp, 0.7, 1.8, 0.6, new THREE.MeshPhongMaterial({ color: 0x0a1428, emissive: 0x0a1838 }), sx * spanX * 0.32, 0.9, -spanZ / 2 + 0.7);
        RAVE.pulses.push(stack); addEntryObstacle(sx * spanX * 0.32, -spanZ / 2 + 0.7, 0.8, 0.8, 1.8);
        for (const cy of [1.35, 0.85]) { const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18), emissiveMat(0x66ddff, 0.8)); cone.rotation.x = Math.PI / 2; cone.position.set(sx * spanX * 0.32, cy, -spanZ / 2 + 0.4); grp.add(cone); RAVE.pulses.push(cone); }
      }
      // —— メインステージのトラスアーチ＋発光ビーズ（フェス感） ——
      const trussMat = new THREE.MeshPhongMaterial({ color: 0x2a2f3a, shininess: 30 });
      for (const sx of [-1, 1]) addBox(grp, 0.16, 4.4, 0.16, trussMat, sx * (spanX / 2 - 0.2), 2.2, -spanZ / 2 + 0.4);
      const archTop = new THREE.Mesh(new THREE.TorusGeometry(spanX / 2 - 0.2, 0.12, 8, 44, Math.PI), trussMat);
      archTop.position.set(0, 4.4, -spanZ / 2 + 0.4); grp.add(archTop);
      for (let i = 0; i <= 8; i++) {
        const t = i / 8 * Math.PI, bead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), emissiveMat(0x66ddff, 0.7));
        bead.position.set(-Math.cos(t) * (spanX / 2 - 0.2), 4.4 + Math.sin(t) * (spanX / 2 - 0.2), -spanZ / 2 + 0.4); grp.add(bead); RAVE.pulses.push(bead);
      }
      const sign = makeSign('TRANCE', '#66ffff', 3.6, 1.0); sign.position.set(0, 3.7, -spanZ / 2 + 0.45); grp.add(sign); RAVE.pulses.push(sign);
    }
    if (kind === 'laser') {
      const gold = new THREE.MeshPhongMaterial({ color: 0xffc04d, emissive: 0x221000, shininess: 80 });
      for (const x of [-spanX / 2 - 0.5, spanX / 2 + 0.5]) for (const z of [-spanZ / 2 - 0.5, spanZ / 2 + 0.5]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.6, 12), gold); col.position.set(x, 1.8, z); grp.add(col);
      }
      RAVE.mirror = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 2), new THREE.MeshPhongMaterial({ color: 0xf7f7ff, emissive: 0x333333, shininess: 140, flatShading: true }));
      RAVE.mirror.position.set(0, 4.6, 0); grp.add(RAVE.mirror);
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(1.4 + i * 1.0, 0.025, 6, 72), emissiveMat(0xffcc66, 0.4));
        r.rotation.x = Math.PI / 2; r.position.y = 4.35 - i * 0.24; r.userData.seed = i; grp.add(r); RAVE.rings.push(r);
      }
      // ミラーボールから放射するビーム
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2, beam = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.08, 5.2, 6), emissiveMat(i % 2 ? 0xffd866 : 0xffffff, 0.34));
        beam.position.set(0, 4.6, 0); beam.rotation.set(Math.PI / 2.6, a, 0); grp.add(beam); RAVE.pulses.push(beam);
      }
      // DJ後方のLEDピラミッド（Daft Punk風）
      const pyr = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.0, 4), emissiveMat(0xffcc66, 0.5)); pyr.rotation.y = Math.PI / 4; pyr.position.set(0, 1.0, -spanZ / 2 + 0.2); grp.add(pyr); RAVE.pulses.push(pyr);
      for (let r = 0; r < 4; r++) { const led = new THREE.Mesh(new THREE.TorusGeometry(0.35 + r * 0.32, 0.03, 6, 4), emissiveMat(0xfff0c0, 0.6)); led.rotation.set(0, Math.PI / 4, 0); led.position.set(0, 0.55 + r * 0.42, -spanZ / 2 + 0.34); grp.add(led); RAVE.pulses.push(led); }
      // 金縁プロセニアムフレーム
      const goldFrame = new THREE.MeshPhongMaterial({ color: 0xffc04d, emissive: 0x221000, shininess: 80 });
      for (const sx of [-1, 1]) addBox(grp, 0.16, 4.0, 0.16, goldFrame, sx * (spanX / 2 - 0.1), 2.0, -spanZ / 2 + 0.2);
      addBox(grp, spanX - 0.2, 0.18, 0.18, goldFrame, 0, 4.0, -spanZ / 2 + 0.2);
      // 吊りディスコライト
      for (const x of [-spanX * 0.28, spanX * 0.28]) for (const z of [-spanZ * 0.28, spanZ * 0.28]) { const db = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), new THREE.MeshPhongMaterial({ color: 0xf7f7ff, emissive: 0x444444, shininess: 120, flatShading: true })); db.position.set(x, 4.2, z); grp.add(db); RAVE.pulses.push(db); }
      const sign = makeSign('DANCE', '#ffdd77', 3.5, 1.0); sign.position.set(0, 3.55, -spanZ / 2 + 0.18); grp.add(sign); RAVE.pulses.push(sign);
    }
    if (kind === 'future') {
      const skyMat = emissiveMat(0xff88ff, 0.2);
      const mainFloat = addCylinder(grp, 2.4, 2.0, 0.22, 4, skyMat, 0, 0.34, 0.2);
      mainFloat.rotation.y = Math.PI / 4; RAVE.pulses.push(mainFloat); trackRaveObject(mainFloat, 'futureIsland', 0.2);
      for (const p of [[-spanX * 0.42, -spanZ * 0.22], [spanX * 0.42, -spanZ * 0.18], [-spanX * 0.22, spanZ * 0.38], [spanX * 0.24, spanZ * 0.36]]) {
        const island = addCylinder(grp, 0.72, 0.52, 0.16, 6, emissiveMat(0x66ddff, 0.24), p[0], 0.42, p[1]);
        island.userData.seed = p[0] + p[1]; RAVE.pulses.push(island); trackRaveObject(island, 'futureIsland', p[0] * 0.13 + p[1] * 0.21);
      }
      for (let i = 0; i < 5; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(1.2 + i * 0.75, 0.026, 6, 72), emissiveMat(i % 2 ? 0xff66dd : 0x66ddff, 0.42));
        r.rotation.x = Math.PI / 2; r.position.y = 0.9 + i * 0.38; r.userData.seed = i; grp.add(r); RAVE.rings.push(r);
      }
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, orb = new THREE.Mesh(new THREE.SphereGeometry(0.18 + (i % 3) * 0.05, 12, 8), emissiveMat(i % 2 ? 0xff66dd : 0x66ddff, 0.5));
        orb.position.set(Math.cos(a) * spanX * 0.52, 2.4 + Math.sin(i) * 0.45, Math.sin(a) * spanZ * 0.48); grp.add(orb); RAVE.pulses.push(orb);
      }
      for (const x of [-spanX * 0.35, spanX * 0.35]) {
        const wing = addBox(grp, 0.12, 2.9, spanZ * 0.78, emissiveMat(0x9955ff, 0.38), x, 1.45, 0);
        RAVE.pulses.push(wing);
      }
      // ふわふわの雲（複数の球を寄せて）
      for (const cp of [[-spanX * 0.4, 3.2, -spanZ * 0.3], [spanX * 0.42, 2.8, spanZ * 0.32], [spanX * 0.1, 3.6, -spanZ * 0.42]]) {
        const cloud = new THREE.Group();
        for (const o of [[0, 0, 0, 0.5], [0.45, -0.05, 0.1, 0.38], [-0.4, -0.05, -0.1, 0.34], [0.1, 0.12, 0.2, 0.3]]) { const puff = new THREE.Mesh(new THREE.SphereGeometry(o[3], 12, 8), emissiveMat(0xffd6ff, 0.5)); puff.position.set(o[0], o[1], o[2]); cloud.add(puff); }
        cloud.position.set(cp[0], cp[1], cp[2]); grp.add(cloud); cloud.children.forEach(p => RAVE.pulses.push(p)); trackRaveObject(cloud, 'futureIsland', cp[0] * 0.1 + cp[2] * 0.2);
      }
      // 中央の大きな浮遊クリスタル
      const bigCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), emissiveMat(0xff99ff, 0.5)); bigCrystal.position.set(0, 3.2, 0); grp.add(bigCrystal); RAVE.pulses.push(bigCrystal); trackRaveObject(bigCrystal, 'futureIsland', 1.3);
      // 虹アーチ（半円のリボン）
      for (let i = 0; i < 4; i++) { const arc = new THREE.Mesh(new THREE.TorusGeometry(2.4 + i * 0.5, 0.05, 6, 40, Math.PI), emissiveMat([0xff6699, 0xffcc66, 0x66ddff, 0xaa66ff][i], 0.42)); arc.position.set(0, 0.2, spanZ * 0.1); arc.rotation.set(0, 0, 0); grp.add(arc); RAVE.pulses.push(arc); }
      const sign = makeSign('FUTURE', '#ff88ff', 4.0, 1.0); sign.position.set(0, 3.7, -spanZ / 2 + 0.18); grp.add(sign); RAVE.pulses.push(sign);
    }
    if (kind === 'bass') {
      const ribMat = emissiveMat(0x44ff66, 0.42);
      const wallH = 3.9, wallY = wallH / 2, roofY = 3.95;
      trackRaveObject(addBox(grp, 0.22, wallH, spanZ + 1.8, new THREE.MeshPhongMaterial({ color: 0x050905, emissive: 0x001a08 }), -spanX / 2 - 0.62, wallY, 0), 'bassWall', -0.5);
      trackRaveObject(addBox(grp, 0.22, wallH, spanZ + 1.8, new THREE.MeshPhongMaterial({ color: 0x050905, emissive: 0x001a08 }), spanX / 2 + 0.62, wallY, 0), 'bassWall', 0.5);
      trackRaveObject(addBox(grp, spanX + 1.4, 0.16, spanZ + 1.8, new THREE.MeshPhongMaterial({ color: 0x030603, emissive: 0x001005 }), 0, roofY, 0), 'bassRoof', 0);
      for (let z = -spanZ / 2; z <= spanZ / 2; z += 1.25) {
        const left = addBox(grp, 0.1, roofY, 0.1, ribMat.clone(), -spanX / 2 - 0.35, roofY / 2, z);
        const right = addBox(grp, 0.1, roofY, 0.1, ribMat.clone(), spanX / 2 + 0.35, roofY / 2, z);
        const top = addBox(grp, spanX + 0.8, 0.1, 0.1, ribMat.clone(), 0, roofY, z);
        trackRaveObject(left, 'bassRib', z); trackRaveObject(right, 'bassRib', z + 0.35); trackRaveObject(top, 'bassRibTop', z + 0.7);
        RAVE.pulses.push(left, right, top);
      }
      for (const x of [-spanX / 2 - 0.85, spanX / 2 + 0.85]) for (const z of [-spanZ * 0.36, -spanZ * 0.12, spanZ * 0.12, spanZ * 0.36]) {
        const stack = addBox(grp, 0.55, 1.15, 0.42, new THREE.MeshPhongMaterial({ color: 0x050805, emissive: 0x00220b }), x, 0.58, z);
        const coneA = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 18), emissiveMat(0x113319, 0.75));
        const coneB = coneA.clone();
        coneA.rotation.x = Math.PI / 2; coneB.rotation.x = Math.PI / 2;
        coneA.position.set(x, 0.78, z - 0.22); coneB.position.set(x, 0.38, z - 0.22);
        grp.add(coneA, coneB); RAVE.pulses.push(stack, coneA, coneB);
        addEntryObstacle(x, z, 0.85, 0.9, 1.15);
      }
      // トンネルの奥行きフープ（受けて伸びる発光アーチ）
      for (let z = -spanZ / 2 + 1.0; z <= spanZ / 2 - 1.0; z += 2.0) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(spanX / 2 + 0.5, 0.06, 6, 24), emissiveMat(0x44ff88, 0.5));
        hoop.position.set(0, roofY / 2, z); grp.add(hoop); RAVE.pulses.push(hoop);
      }
      // 天井ストロボバー
      for (let z = -spanZ / 2 + 1.4; z <= spanZ / 2 - 1.4; z += 2.4) { const bar = addBox(grp, spanX * 0.9, 0.1, 0.1, emissiveMat(0x66ff88, 0.6), 0, roofY - 0.1, z); RAVE.pulses.push(bar); }
      // 背面の巨大サブウーファー壁
      for (const x of [-spanX * 0.28, 0, spanX * 0.28]) {
        const sub = addBox(grp, 0.85, 2.6, 0.5, new THREE.MeshPhongMaterial({ color: 0x040a05, emissive: 0x0a2210 }), x, 1.3, -spanZ / 2 + 0.45); RAVE.pulses.push(sub);
        for (const cy of [2.0, 1.4, 0.8]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), emissiveMat(0x44ff88, 0.7)); c.rotation.x = Math.PI / 2; c.position.set(x, cy, -spanZ / 2 + 0.2); grp.add(c); RAVE.pulses.push(c); }
      }
      addEntryObstacle(0, -spanZ / 2 + 0.45, spanX * 0.7, 0.7, 2.6);
      const sign = makeSign('DNB', '#66ff88', 3.0, 0.92); sign.position.set(0, 3.5, -spanZ / 2 + 0.55); grp.add(sign); RAVE.pulses.push(sign);
    }
    if (kind === 'chill') {
      const carpet = addCylinder(grp, Math.min(spanX, spanZ) * 0.36, Math.min(spanX, spanZ) * 0.36, 0.035, 64, emissiveMat(0x4050aa, 0.38), 0, 0.075, 0);
      RAVE.pulses.push(carpet);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(0.72, 24, 16), emissiveMat(0xd8ddff, 0.65));
      moon.position.set(spanX * 0.25, 3.4, -spanZ * 0.15); grp.add(moon); RAVE.pulses.push(moon); trackRaveObject(moon, 'chillMoon', 0.4);
      for (const p of [[-2.6, -1.5, 1.1, 0.42], [2.5, -1.2, 1.05, -0.35], [-1.8, 2.0, 0.9, 0.8]]) {
        const sofa = addBox(grp, 1.25, 0.32, 0.48, new THREE.MeshPhongMaterial({ color: 0x2d345f, emissive: 0x090d22 }), p[0], 0.23, p[1]);
        sofa.rotation.y = p[3]; RAVE.pulses.push(sofa);
        const back = addBox(grp, 1.25, 0.55, 0.16, new THREE.MeshPhongMaterial({ color: 0x252b52, emissive: 0x080b1d }), p[0], 0.5, p[1] - Math.cos(p[3]) * 0.24);
        back.rotation.y = p[3]; RAVE.pulses.push(back);
        addEntryObstacle(p[0], p[1], 1.45, 0.9, 0.75);
      }
      for (const p of [[-1.1, -0.25], [1.25, 0.55], [0.05, 1.55]]) {
        const table = addCylinder(grp, 0.34, 0.34, 0.08, 28, new THREE.MeshPhongMaterial({ color: 0x171b34, emissive: 0x050817 }), p[0], 0.29, p[1]);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), emissiveMat(0xb8c7ff, 0.75)); lamp.position.set(p[0], 0.54, p[1]); grp.add(lamp); RAVE.pulses.push(table, lamp); trackRaveObject(lamp, 'chillLamp', p[0] + p[1]);
      }
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2, lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.3, 10), emissiveMat(0x8899ff, 0.34));
        lamp.position.set(Math.cos(a) * spanX * 0.42, 1.15, Math.sin(a) * spanZ * 0.35); grp.add(lamp); RAVE.pulses.push(lamp); trackRaveObject(lamp, 'chillLamp', i * 0.9);
      }
      // 天井のフェアリーライト（暖色の小球が連なる。ゆっくり明滅）
      for (const sx of [-1, 1]) for (let i = 0; i <= 6; i++) {
        const t = i / 6, x = (sx) * spanX * 0.42, z = -spanZ * 0.42 + t * spanZ * 0.84;
        const sag = Math.sin(t * Math.PI) * 0.25, bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), emissiveMat(0xffcf8a, 0.85));
        bulb.position.set(x, 2.7 - sag, z); grp.add(bulb); RAVE.pulses.push(bulb); trackRaveObject(bulb, 'chillLamp', x + z);
      }
      // 観葉植物（鉢＋葉）
      for (const p of [[-spanX * 0.4, -spanZ * 0.36], [spanX * 0.4, spanZ * 0.34]]) {
        addCylinder(grp, 0.2, 0.16, 0.32, 10, new THREE.MeshPhongMaterial({ color: 0x4a2f1c }), p[0], 0.16, p[1]);
        for (let l = 0; l < 5; l++) { const a = l / 5 * Math.PI * 2, leaf = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.7, 5), new THREE.MeshPhongMaterial({ color: 0x2f6b3a, emissive: 0x0a1e10 })); leaf.position.set(p[0] + Math.cos(a) * 0.12, 0.7, p[1] + Math.sin(a) * 0.12); leaf.rotation.z = Math.cos(a) * 0.4; leaf.rotation.x = Math.sin(a) * 0.4; grp.add(leaf); }
        addEntryObstacle(p[0], p[1], 0.5, 0.5, 1.0);
      }
      // 背面の窓＋夜景シルエット
      addBox(grp, 2.6, 1.8, 0.08, new THREE.MeshPhongMaterial({ color: 0x101830, emissive: 0x0a1230 }), 0, 1.5, -spanZ / 2 + 0.12);
      for (let i = 0; i < 6; i++) { const bld = addBox(grp, rnd(0.3, 0.55), rnd(0.5, 1.3), 0.05, emissiveMat(0x2a3a6a, 0.5), -1.1 + i * 0.42, rnd(0.9, 1.4), -spanZ / 2 + 0.16); RAVE.pulses.push(bld); }
      // 本棚
      const shelf = addBox(grp, 1.2, 1.6, 0.3, new THREE.MeshPhongMaterial({ color: 0x3a2a1c }), -spanX * 0.42, 0.8, spanZ * 0.1); addEntryObstacle(-spanX * 0.42, spanZ * 0.1, 0.5, 1.3, 1.6);
      for (let r = 0; r < 4; r++) for (let b = 0; b < 5; b++) { const book = addBox(grp, 0.06, 0.3, 0.22, new THREE.MeshPhongMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.5, 0.4) }), -spanX * 0.42 - 0.45 + b * 0.18, 0.32 + r * 0.38, spanZ * 0.1 + 0.02); }
      const sign = makeSign('LOUNGE', '#b8c7ff', 3.4, 0.92); sign.position.set(0, 3.0, -spanZ / 2 + 0.2); grp.add(sign); RAVE.pulses.push(sign);
    }
    if (kind === 'dub') {
      // 巨大スピーカースタック（重低音の象徴）＋オーバーヘッドの金属トラスとストロボバー
      for (const x of [-spanX / 2 - 0.7, spanX / 2 + 0.7]) for (const z of [-spanZ * 0.3, 0, spanZ * 0.3]) {
        const stack = addBox(grp, 0.9, 2.0, 0.7, new THREE.MeshPhongMaterial({ color: 0x0a0010, emissive: 0x1a0026 }), x, 1.0, z);
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 20), emissiveMat(0xff33cc, 0.85));
        cone.rotation.z = Math.PI / 2; cone.position.set(x + (x < 0 ? 0.4 : -0.4), 1.15, z);
        grp.add(cone); RAVE.pulses.push(stack, cone); trackRaveObject(cone, 'noteBlock', x + z);
        addEntryObstacle(x, z, 1.0, 1.0, 0.9);
      }
      for (const z of [-spanZ / 2, spanZ / 2]) addBox(grp, spanX + 0.6, 0.18, 0.18, metal, 0, 4.6, z);
      for (const x of [-spanX / 2, spanX / 2]) addBox(grp, 0.18, 0.18, spanZ, metal, x, 4.6, 0);
      for (let i = 0; i < 4; i++) {
        const bar2 = addBox(grp, spanX * 0.88, 0.12, 0.12, emissiveMat(0xff33cc, 0.6), 0, 4.42, -spanZ / 2 + (i + 0.5) * spanZ / 4);
        RAVE.pulses.push(bar2);
      }
      // 背面の巨大サブウーファーウォール（3x2のスピーカーグリッド）
      for (let gx = -1; gx <= 1; gx++) for (let gy = 0; gy < 2; gy++) {
        const cab = addBox(grp, 1.0, 1.1, 0.5, new THREE.MeshPhongMaterial({ color: 0x0a0010, emissive: 0x1a0026 }), gx * 1.15, 0.6 + gy * 1.15, -spanZ / 2 + 0.45); RAVE.pulses.push(cab);
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 18), emissiveMat(0xff33cc, 0.8)); cone.rotation.x = Math.PI / 2; cone.position.set(gx * 1.15, 0.6 + gy * 1.15, -spanZ / 2 + 0.18); grp.add(cone); RAVE.pulses.push(cone); trackRaveObject(cone, 'noteBlock', gx + gy);
      }
      addEntryObstacle(0, -spanZ / 2 + 0.45, 3.6, 0.7, 2.3);
      // 工業パイプ（左右の壁沿い）
      for (const sx of [-1, 1]) { const pipe = addCylinder(grp, 0.1, 0.1, spanZ * 0.9, 10, new THREE.MeshPhongMaterial({ color: 0x3a2240, emissive: 0x12001a }), sx * (spanX / 2 + 0.15), 3.0, 0); pipe.rotation.x = Math.PI / 2; grp.add(pipe); }
      // ハザード灯（回転灯風ドーム）
      for (const x of [-spanX * 0.35, spanX * 0.35]) { const dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), emissiveMat(0xffaa22, 0.85)); dome.position.set(x, 4.3, 0); grp.add(dome); RAVE.pulses.push(dome); }
      // DJ後方のLEDスクリーンパネル
      for (const sx of [-1, 1]) { const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), emissiveMat(0xff33cc, 0.55)); screen.position.set(sx * spanX * 0.3, 1.6, -spanZ / 2 + 0.78); grp.add(screen); RAVE.pulses.push(screen); }
      const sign = makeSign('DUBSTEP', '#ff33cc', 4.0, 1.0); sign.position.set(0, 3.7, -spanZ / 2 + 0.18); grp.add(sign); RAVE.pulses.push(sign);
    }
    const gateColor = kind === 'bass' ? 0x66ff88 : kind === 'future' ? 0xff66dd : kind === 'chill' ? 0x9fb2ff : kind === 'laser' ? 0xffcc66 : kind === 'dub' ? 0xff33cc : 0x66ddff;
    const gatePts = [[-spanX / 2 - 0.95, 0], [spanX / 2 + 0.95, 0], [0, -spanZ / 2 - 0.95], [0, spanZ / 2 + 0.95]];
    gatePts.forEach((p, i) => {
      const gate = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 34), emissiveMat(gateColor, 0.58));
      gate.position.set(p[0], 0.18, p[1]); gate.rotation.x = Math.PI / 2; gate.userData.seed = i * 0.7;
      grp.add(gate); RAVE.rings.push(gate); trackRaveObject(gate, 'gate', i * 0.7);
      const beam = addCylinder(grp, 0.08, 0.22, 0.9, 16, emissiveMat(gateColor, 0.2), p[0], 0.45, p[1]);
      beam.userData.seed = i * 0.7 + 0.35; RAVE.pulses.push(beam); trackRaveObject(beam, 'gateBeam', i * 0.7 + 0.35);
    });
    addNoteBlocks(grp, spanX, spanZ, kind);
    addCheerLights(grp, spanX, spanZ, kind);
    const boothW = kind === 'neon' ? spanX * 0.75 : kind === 'forest' ? 2.1 : kind === 'laser' ? 2.8 : kind === 'bass' ? spanX * 0.64 : kind === 'future' ? 2.2 : kind === 'chill' ? 1.8 : 3.2;
    const boothY = kind === 'future' ? 0.82 : kind === 'chill' ? 0.34 : 0.5;
    const boothZ = kind === 'future' ? 0.2 : kind === 'chill' ? 0.15 : -spanZ / 2 + 0.82;
    const booth = addBox(grp, boothW, kind === 'chill' ? 0.55 : 0.95, kind === 'chill' ? 0.72 : 1.0, new THREE.MeshPhongMaterial({ color: kind === 'laser' ? 0x5a3810 : kind === 'bass' ? 0x071109 : kind === 'chill' ? 0x20264a : 0x15151c }), 0, boothY, boothZ);
    addEntryObstacle(0, boothZ, boothW + 0.6, kind === 'chill' ? 1.15 : 1.45, kind === 'chill' ? 0.72 : 1.05);
    if (kind === 'future') booth.rotation.y = Math.PI / 4;
    const panelColor = kind === 'neon' ? 0xffcc22 : kind === 'forest' ? 0x55ddff : kind === 'laser' ? 0xffcc66 : kind === 'future' ? 0xff66dd : kind === 'bass' ? 0x66ff88 : kind === 'chill' ? 0xb8c7ff : 0x00ddff;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(boothW * 0.82, 0.56), emissiveMat(panelColor));
    panel.position.set(0, boothY + 0.22, boothZ + 0.51); grp.add(panel); RAVE.pulses.push(panel);
    const dj = makeDancer(cfg.hue);
    dj.position.set(0, kind === 'future' ? 1.3 : kind === 'chill' ? 0.82 : 1.0, kind === 'future' ? 0.12 : kind === 'chill' ? 0.38 : -spanZ / 2 + 0.78);
    dj.userData.home = dj.position.clone(); dj.userData.anchor = dj.position.clone(); dj.userData.behavior = 'dj'; grp.add(dj); RAVE.dancers.push(dj);
    for (let i = 0; i < cfg.dancers; i++) {
      const d = makeDancer((cfg.hue + Math.random() * 0.35) % 1);
      const p = raveDancerPoint(kind, spanX, spanZ);
      if (i < 6 && kind !== 'chill' && kind !== 'neon') {
        const pair = Math.floor(i / 2), side = i % 2 === 0 ? -1 : 1;
        p.set(side * (1.05 + pair * 0.15), 0, (pair - 1) * 1.05);
        d.userData.behavior = 'battle'; d.userData.battleSide = side;
      } else if (i < 11 && kind !== 'chill' && kind !== 'neon') {
        const a = (i - 6) / 5 * Math.PI * 2 + 0.35;
        p.set(Math.cos(a) * 2.45, 0, Math.sin(a) * 2.05);
        d.userData.behavior = 'spectator';
      } else if (i % 7 === 0) {
        d.userData.behavior = 'train'; d.userData.trainIndex = i;
      } else if (kind === 'chill') {
        d.userData.behavior = 'stroll';
      } else if (kind === 'forest' || kind === 'future' || kind === 'laser') {
        d.userData.behavior = Math.random() < 0.55 ? 'orbit' : 'walk';
      } else {
        d.userData.behavior = 'walk';
      }
      d.rotation.y = Math.atan2(-p.x, -p.z); d.userData.home = p.clone(); d.userData.anchor = p.clone();
      assignDancerEntrance(d, p, i, spanX, spanZ, kind);
      grp.add(d); RAVE.dancers.push(d);
    }
    return grp;
  }
  // 会場のジオメトリ/マテリアル/テクスチャを破棄（出し直し時のGPUメモリリーク防止）。
  // 花火の共有ジオメトリだけは次の会場でも使い回すので破棄しない。
  function disposeRaveGroup(group) {
    group.traverse(obj => {
      if (obj.geometry && !FW_SHARED_GEOS.has(obj.geometry)) obj.geometry.dispose();
      const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      for (const m of mats) { if (m.map && !SKY_SHARED_TEX.has(m.map)) m.map.dispose(); m.dispose(); } // 共有の夜空テクスチャは破棄しない
    });
  }
