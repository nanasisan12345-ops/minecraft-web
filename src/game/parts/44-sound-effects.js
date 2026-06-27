  /* ============== 効果音 ============== */
  let actx = null;
  function initAudio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    ensureEnvironmentAudio();
  }
  function thock(freq) {
    if (!actx) return;
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.08);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.12);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.13);
  }

  const ENV = {
    ready: false, master: null, rainGain: null, musicGain: null, delay: null, delayFb: null, nextNote: 0, nextNature: 0, nextWind: 0, scale: [0, 2, 4, 7, 9],
    el: null, src: null, mp3Gain: null, mp3Tried: false, mp3Ok: false, mp3Urls: [], mp3ByTheme: {}, mp3Index: 0, mp3Theme: '', mp3NextAt: 0, mp3Max: 12,
  };
  const AMBIENT_THEMES = [
    { key: 'grass', legacy: 1 },  // 草原・昼
    { key: 'night', legacy: 2 },  // 夜・星空
    { key: 'rain', legacy: 3 },   // 雨の日
    { key: 'cave', legacy: 4 },   // 洞窟・地下
    { key: 'snow', legacy: 5 },   // 雪原
    { key: 'sunset', legacy: 6 }, // 夕方・冒険の終わり
    { key: 'modern', legacy: 7 }, // 少し現代風の街外れ
  ];
  function envNoiseBuffer(seconds = 2) {
    const len = Math.floor(actx.sampleRate * seconds), b = actx.createBuffer(1, len, actx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function ensureEnvironmentAudio() {
    if (!actx || ENV.ready) return;
    const master = actx.createGain(); master.gain.value = 0.0001; master.connect(actx.destination);
    const musicGain = actx.createGain(); musicGain.gain.value = 0.0001; musicGain.connect(master);
    const mp3Gain = actx.createGain(); mp3Gain.gain.value = 0.0001; mp3Gain.connect(master);
    const rainGain = actx.createGain(); rainGain.gain.value = 0.0001; rainGain.connect(master);
    const delay = actx.createDelay(2.0), delayFb = actx.createGain(), delayTone = actx.createBiquadFilter();
    delay.delayTime.value = 0.42; delayFb.gain.value = 0.34; delayTone.type = 'lowpass'; delayTone.frequency.value = 2600;
    delay.connect(delayTone).connect(delayFb).connect(delay); delay.connect(musicGain);
    const src = actx.createBufferSource(); src.buffer = envNoiseBuffer(2.5); src.loop = true;
    const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 850;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    src.connect(hp).connect(lp).connect(rainGain); src.start();
    ENV.ready = true; ENV.master = master; ENV.musicGain = musicGain; ENV.mp3Gain = mp3Gain; ENV.rainGain = rainGain; ENV.delay = delay; ENV.delayFb = delayFb; ENV.nextNote = actx.currentTime + rnd(2, 5); ENV.nextNature = actx.currentTime + rnd(4, 12); ENV.nextWind = actx.currentTime + rnd(8, 20);
    tryStartAmbientMp3();
  }
  async function probeAmbientMp3s() {
    const all = [], byTheme = {};
    for (const theme of AMBIENT_THEMES) {
      const urls = [];
      for (let n = 1; n <= ENV.mp3Max; n++) {
        const url = `music/ambient-${theme.key}-${n}.mp3`;
        try { const r = await fetch(url, { method: 'HEAD', cache: 'no-store' }); if (r.ok) urls.push(url); else break; }
        catch (e) { break; }
      }
      const legacyUrl = `music/ambient-${theme.legacy}.mp3`;
      try { const r = await fetch(legacyUrl, { method: 'HEAD', cache: 'no-store' }); if (r.ok) urls.push(legacyUrl); }
      catch (e) {}
      byTheme[theme.key] = urls;
      all.push(...urls);
    }
    ENV.mp3ByTheme = byTheme;
    ENV.mp3Urls = all;
    return all;
  }
  function ambientThemeForWorld(rainAmount = 0) {
    if (typeof player !== 'undefined' && typeof heightAt === 'function') {
      const x = Math.floor(player.pos.x), z = Math.floor(player.pos.z), ground = heightAt(x, z);
      if (player.pos.y < ground - 5) return 'cave';
      const biome = typeof biomeAt === 'function' ? biomeAt(x, z) : null;
      if (biome && biome.id === 'snowfield') return 'snow';
    }
    if (rainAmount > 0.55 || (typeof weatherState !== 'undefined' && weatherState === 'rain')) return 'rain';
    if (typeof wCur !== 'undefined' && wCur.glow < 0.35 && rainAmount < 0.2) return 'night';
    if (typeof wCur !== 'undefined' && wCur.glow > 0.35 && wCur.glow < 0.7 && Math.random() < 0.12) return 'sunset';
    return 'grass';
  }
  function ambientUrlsForTheme(theme) {
    const urls = ENV.mp3ByTheme[theme] || [];
    return urls.length ? urls : ENV.mp3Urls;
  }
  function scheduleNextAmbientMp3(shortDelay = false) {
    ENV.mp3Ok = false;
    ENV.mp3NextAt = performance.now() + (shortDelay ? rnd(8000, 18000) : rnd(65000, 180000));
  }
  function playAmbientMp3Theme(theme, idx = 0, attempts = 0) {
    const urls = ambientUrlsForTheme(theme);
    if (!ENV.el || !urls.length) return;
    if (attempts >= urls.length) { scheduleNextAmbientMp3(true); return; }
    ENV.mp3Theme = theme;
    ENV.mp3Index = ((idx % urls.length) + urls.length) % urls.length;
    const el = ENV.el;
    el.onended = () => scheduleNextAmbientMp3(false);
    el.onerror = () => playAmbientMp3Theme(theme, ENV.mp3Index + 1, attempts + 1);
    el.src = urls[ENV.mp3Index];
    el.currentTime = 0;
    el.play().then(() => { ENV.mp3Ok = true; }).catch(() => scheduleNextAmbientMp3(true));
  }
  async function tryStartAmbientMp3() {
    if (!actx || ENV.mp3Tried || ENV.el || location.protocol === 'file:') return;
    ENV.mp3Tried = true;
    const urls = await probeAmbientMp3s();
    if (!urls.length) return;
    const el = new Audio();
    el.loop = false; el.preload = 'auto'; el.volume = 1;
    try {
      const src = actx.createMediaElementSource(el);
      src.connect(ENV.mp3Gain);
      ENV.el = el; ENV.src = src;
      scheduleNextAmbientMp3(true);
    } catch (e) { ENV.mp3Ok = false; ENV.el = null; }
  }
  function envNote(t, freq, gain, dur, pan = 0) {
    const o = actx.createOscillator(), g = actx.createGain(), tone = actx.createBiquadFilter(), p = actx.createStereoPanner();
    o.type = 'triangle'; o.frequency.value = freq; tone.type = 'lowpass'; tone.frequency.value = 1800; tone.Q.value = 0.6; p.pan.value = pan;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(tone).connect(g).connect(p).connect(ENV.musicGain);
    g.connect(ENV.delay);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function playAmbientPhrase() {
    if (!actx || !ENV.ready) return;
    const t = actx.currentTime + 0.02, root = 220 * Math.pow(2, Math.floor(Math.random() * 3) / 12);
    const a = ENV.scale[Math.floor(Math.random() * ENV.scale.length)];
    const chord = [a, a + 7, a + 12 + ENV.scale[Math.floor(Math.random() * ENV.scale.length)]];
    for (let i = 0; i < chord.length; i++) envNote(t + i * rnd(0.04, 0.18), root * Math.pow(2, chord[i] / 12), 0.035 / (i + 1), rnd(2.2, 4.2), rnd(-0.45, 0.45));
  }
  function playBirdSound() {
    const t = actx.currentTime + 0.02, count = 2 + (Math.random() * 3 | 0);
    for (let i = 0; i < count; i++) {
      const o = actx.createOscillator(), g = actx.createGain(), p = actx.createStereoPanner();
      const st = t + i * rnd(0.08, 0.18), f = rnd(1300, 2600);
      o.type = 'sine'; o.frequency.setValueAtTime(f, st); o.frequency.exponentialRampToValueAtTime(f * rnd(1.18, 1.55), st + 0.08);
      g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(0.018, st + 0.018); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.18);
      p.pan.value = rnd(-0.8, 0.8);
      o.connect(g).connect(p).connect(ENV.master); o.start(st); o.stop(st + 0.2);
    }
  }
  function playCaveDrip() {
    const t = actx.currentTime + 0.02, o = actx.createOscillator(), g = actx.createGain(), p = actx.createStereoPanner();
    o.type = 'triangle'; o.frequency.setValueAtTime(rnd(620, 980), t); o.frequency.exponentialRampToValueAtTime(rnd(300, 430), t + 0.16);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.032, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    p.pan.value = rnd(-0.65, 0.65);
    o.connect(g).connect(p); p.connect(ENV.delay); p.connect(ENV.master); o.start(t); o.stop(t + 0.6);
  }
  function playWindGust(strength = 1) {
    const t = actx.currentTime + 0.02, src = actx.createBufferSource(), hp = actx.createBiquadFilter(), lp = actx.createBiquadFilter(), g = actx.createGain(), p = actx.createStereoPanner();
    src.buffer = envNoiseBuffer(1.8); hp.type = 'highpass'; hp.frequency.value = 260; lp.type = 'lowpass'; lp.frequency.value = 1200;
    p.pan.value = rnd(-0.45, 0.45);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035 * strength, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    src.connect(hp).connect(lp).connect(g).connect(p).connect(ENV.master); src.start(t); src.stop(t + 1.9);
  }
  function playNatureCue(rainAmount = 0) {
    const theme = ambientThemeForWorld(rainAmount);
    if (theme === 'cave') playCaveDrip();
    else if (theme === 'snow') playWindGust(0.7);
    else if (rainAmount < 0.25 && (theme === 'grass' || theme === 'sunset')) playBirdSound();
  }
  function playThunderSound(power = 1) {
    if (!actx) return;
    ensureEnvironmentAudio();
    const t = actx.currentTime + rnd(0.04, 0.22);
    const strike = actx.createBufferSource(), strikeHp = actx.createBiquadFilter(), strikeTone = actx.createBiquadFilter(), strikeG = actx.createGain();
    strike.buffer = envNoiseBuffer(0.28);
    strikeHp.type = 'highpass'; strikeHp.frequency.value = 900;
    strikeTone.type = 'bandpass'; strikeTone.frequency.value = rnd(1700, 2600); strikeTone.Q.value = 1.8;
    strikeG.gain.setValueAtTime(0.0001, t);
    strikeG.gain.linearRampToValueAtTime(0.18 * power, t + 0.012);
    strikeG.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    strike.connect(strikeHp).connect(strikeTone).connect(strikeG).connect(ENV.master);
    strike.start(t); strike.stop(t + 0.3);

    const rumble = actx.createBufferSource(), rumbleLp = actx.createBiquadFilter(), rumbleG = actx.createGain();
    rumble.buffer = envNoiseBuffer(2.8); rumbleLp.type = 'lowpass'; rumbleLp.frequency.value = 170; rumbleLp.Q.value = 0.9;
    const rt = t + rnd(0.18, 0.48);
    rumbleG.gain.setValueAtTime(0.0001, rt);
    rumbleG.gain.linearRampToValueAtTime(0.28 * power, rt + 0.18);
    rumbleG.gain.setValueAtTime(0.23 * power, rt + 0.7);
    rumbleG.gain.exponentialRampToValueAtTime(0.0001, rt + 2.6);
    rumble.connect(rumbleLp).connect(rumbleG).connect(ENV.master);
    rumble.start(rt); rumble.stop(rt + 2.8);

    for (let i = 0; i < 3; i++) {
      const o = actx.createOscillator(), g = actx.createGain();
      const st = rt + i * rnd(0.22, 0.38);
      o.type = 'sine';
      o.frequency.setValueAtTime(rnd(34, 64), st);
      o.frequency.exponentialRampToValueAtTime(rnd(22, 36), st + 0.55);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime((0.08 + i * 0.035) * power, st + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.9);
      o.connect(g).connect(ENV.master);
      o.start(st); o.stop(st + 1.0);
    }
  }
  function updateEnvironmentAudio(dt, rainAmount = 0) {
    if (!actx || !ENV.ready) return;
    const now = actx.currentTime;
    const outdoor = started && !(typeof RAVE !== 'undefined' && RAVE.on);
    ENV.master.gain.setTargetAtTime(outdoor ? 0.75 : 0.0001, now, 0.6);
    ENV.rainGain.gain.setTargetAtTime(outdoor ? Math.max(0.0001, rainAmount * 0.075) : 0.0001, now, 0.4);
    const mp3Active = ENV.mp3Ok && ENV.el && !ENV.el.paused && !ENV.el.ended;
    const theme = ambientThemeForWorld(rainAmount);
    if (!outdoor && mp3Active) { ENV.el.pause(); scheduleNextAmbientMp3(true); }
    if (outdoor && ENV.el && !mp3Active && ENV.mp3Urls.length && performance.now() >= ENV.mp3NextAt) playAmbientMp3Theme(theme);
    ENV.mp3Gain.gain.setTargetAtTime(outdoor && mp3Active ? (rainAmount < 0.75 ? 0.20 : 0.13) : 0.0001, now, 1.5);
    const generatedActive = !ENV.mp3Urls.length;
    ENV.musicGain.gain.setTargetAtTime(outdoor && generatedActive ? (rainAmount < 0.75 ? 0.24 : 0.15) : 0.0001, now, 1.5);
    if (outdoor && now >= ENV.nextNature) {
      playNatureCue(rainAmount);
      ENV.nextNature = now + rnd(12, 34);
    }
    if (outdoor && now >= ENV.nextWind) {
      if (rainAmount > 0.25 || ambientThemeForWorld(rainAmount) === 'snow') playWindGust(rainAmount > 0.6 ? 0.9 : 0.55);
      ENV.nextWind = now + rnd(20, 52);
    }
    if (outdoor && generatedActive && now >= ENV.nextNote) {
      playAmbientPhrase();
      ENV.nextNote = now + rnd(55, 150);
    }
  }
