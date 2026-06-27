  /* ============== 会場BGM：Suno生成mp3のみ再生（自前シンセ曲は鳴らさない） ============== */
  const SYNTH_VOL = 0.42; // 自前シンセのマスター音量（mp3が鳴る時は0へ落とす）
  const VENUE_MP3_ONLY = true;
  const MUSIC = {
    enabled: true, max: 12, ready: false, avail: {}, // avail[kind] = ['music/forest-1.mp3', ...]（存在するものだけ）
    el: null, src: null, fadeGain: null, distGain: null,
    useWA: (location.protocol !== 'file:'), // file://では fetch/createMediaElementSource が使えないので素のelement出力にする
    fade: 0, dist: 1, // element出力時の音量係数（fade×dist）
  };
  function isMusicResponse(r) {
    if (!r || !r.ok) return false;
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('audio/') || ct.includes('mpeg') || ct.includes('octet-stream')) return true;
    if (ct.includes('text/html')) return false; // ViteのSPAフォールバックは存在しないmp3にも200+HTMLを返すことがある
    const len = Number(r.headers.get('content-length') || 0);
    return len > 4096;
  }
  // ある会場のmp3を1から連番で調べる（最初の欠番で打ち切り）。404は握りつぶす。後から足したファイルもここで拾う。
  async function probeMusicKind(kind) {
    const urls = [];
    for (let n = 1; n <= MUSIC.max; n++) {
      const url = `music/${kind}-${n}.mp3`;
      try { const r = await fetch(url, { method: 'HEAD', cache: 'no-store' }); if (isMusicResponse(r)) urls.push(url); else break; }
      catch (e) { break; }
    }
    MUSIC.avail[kind] = urls;
    return urls;
  }
  // 全会場を走査。起動時に1回。`rescanMusic()` でいつでも再走査できる（ファイル追加後、リロード不要）。
  async function probeMusic() {
    if (!MUSIC.useWA) { MUSIC.ready = true; return; } // file://はfetch不可。走査せず楽観再生（applyTrackがURLを組み立てerrorで判定）
    await Promise.all(RAVE_KEY_BINDINGS.map(b => probeMusicKind(b.kind)));
    MUSIC.ready = true;
  }
  probeMusic();
  window.rescanMusic = probeMusic; // コンソールから手動で再走査したいとき用（mp3を足した後、リロード不要）
  // その会場で選べる曲数（mp3が多ければそちらに合わせ、Q/Eで全mp3に届く）
  function venueTrackCount(kind) {
    const synth = (SONGS[kind] || SONGS.classic).length;
    if (!MUSIC.enabled) return VENUE_MP3_ONLY ? 0 : synth;
    const avail = MUSIC.avail[kind];
    if (avail) return VENUE_MP3_ONLY ? avail.length : Math.max(synth, avail.length);
    return MUSIC.useWA && VENUE_MP3_ONLY ? (MUSIC.ready ? 0 : synth) : synth;
  }
  // idx(0始まり)の曲を現在の会場にセット。mp3が無ければ無音（自前シンセ曲へは戻さない）
  function applyTrack(kind, idx) {
    const songs = SONGS[kind] || SONGS.classic;
    RAVE.song = songs[idx % songs.length];
    RAVE.songNo = idx + 1;
    RAVE.bpm = (songs[idx] && songs[idx].bpm) || RAVE_VENUES[kind].bpm; // mp3のBPMは曲番号=SONGS順に一致（SUNO_PROMPTS基準）
    let url = null;
    if (MUSIC.enabled) {
      const avail = MUSIC.avail[kind];
      if (avail && avail.length) url = idx < avail.length ? avail[idx] : null; // 走査で見つかった分は確定
      else if ((!MUSIC.useWA || !MUSIC.ready) && idx < songs.length) url = `music/${kind}-${idx + 1}.mp3`; // 走査前/file://のみ楽観的に試す。失敗しても無音
    }
    RAVE.mp3Url = url;
  }
  function ensureMusicNodes() {
    if (!MUSIC.useWA || !actx || MUSIC.fadeGain) return;
    MUSIC.fadeGain = actx.createGain(); MUSIC.fadeGain.gain.value = 0.0001; // フェード用
    MUSIC.distGain = actx.createGain(); MUSIC.distGain.gain.value = 1;      // 会場からの距離で減衰
    MUSIC.fadeGain.connect(MUSIC.distGain); MUSIC.distGain.connect(actx.destination);
  }
  function applyMusicElVolume() { if (!MUSIC.useWA && MUSIC.el) { try { MUSIC.el.volume = Math.max(0, Math.min(1, MUSIC.fade * MUSIC.dist)); } catch (e) {} } }
  function setMusicDist(v) { // 距離減衰（WebAudio経路はゲイン、element経路はvolume）
    MUSIC.dist = v;
    if (MUSIC.useWA) { if (MUSIC.distGain && actx) MUSIC.distGain.gain.setTargetAtTime(v, actx.currentTime, 0.12); }
    else applyMusicElVolume();
  }
  // ビジュアル同期用の拍クロックをmp3の頭に合わせて0へ。自前スケジューラはこの時刻基準で回り続ける。
  function resyncBeatClock() {
    if (!actx) return;
    const now = actx.currentTime + 0.04;
    RAVE.audioStart = now; RAVE.nextNote = now; RAVE.step = 0;
    RAVE.acidPrev = null; RAVE.acidStep = -99; RAVE.reactionBar = -1;
  }
  function muteSynth(mute) {
    if (!RAVE.master || !actx) return;
    const now = actx.currentTime;
    RAVE.master.gain.cancelScheduledValues(now);
    RAVE.master.gain.setTargetAtTime((VENUE_MP3_ONLY || mute || RAVE.muted) ? 0.0001 : SYNTH_VOL, now, 0.05); // mp3以外の会場曲は鳴らさない
  }
  // Mキーの全体ミュート。シンセ・mp3どちらの出力もまとめて切替える。
  function setRaveMuted(m) {
    RAVE.muted = m;
    muteSynth(true);
    if (actx && MUSIC.fadeGain) MUSIC.fadeGain.gain.setTargetAtTime(m ? 0.0001 : 0.92, actx.currentTime, 0.04);
    if (!MUSIC.useWA) { MUSIC.fade = m ? 0 : 0.92; applyMusicElVolume(); if (MUSIC.el) MUSIC.el.muted = m; }
    if (RAVE.on) markDj(m ? 'MUTE' : 'UNMUTE');
  }
  function stopMusicTrack(fade) {
    const el = MUSIC.el, src = MUSIC.src;
    MUSIC.el = null; MUSIC.src = null;
    if (!el) return;
    const cleanup = () => { try { el.pause(); } catch (e) {} try { src && src.disconnect(); } catch (e) {} };
    if (fade && actx && MUSIC.fadeGain) {
      const now = actx.currentTime;
      MUSIC.fadeGain.gain.cancelScheduledValues(now);
      MUSIC.fadeGain.gain.setValueAtTime(Math.max(0.0001, MUSIC.fadeGain.gain.value), now);
      MUSIC.fadeGain.gain.linearRampToValueAtTime(0.0001, now + 0.4);
      setTimeout(cleanup, 460);
    } else cleanup();
  }
  function onMusicFail() { stopMusicTrack(false); RAVE.mp3Url = null; muteSynth(true); resyncBeatClock(); refreshRaveIndicator(); } // mp3が無い/再生失敗 → 無音
  function startMusicTrack(url) {
    if (!url) { muteSynth(true); return; }
    if (actx && actx.state === 'suspended') actx.resume();
    ensureMusicNodes();
    stopMusicTrack(false);
    const el = new Audio(url);
    el.loop = false; el.preload = 'auto'; // ループは手動（ループ毎に拍クロックを再同期してビジュアルのズレを抑える）
    el.addEventListener('ended', () => { try { el.currentTime = 0; el.play().catch(() => {}); } catch (e) {} resyncBeatClock(); });
    el.addEventListener('error', onMusicFail);
    MUSIC.el = el;
    if (MUSIC.useWA && actx) { // http(s)：WebAudioに通してフェード/距離減衰/ミックスを効かせる
      let src;
      try { src = actx.createMediaElementSource(el); } catch (e) { onMusicFail(); return; }
      src.connect(MUSIC.fadeGain); MUSIC.src = src;
      const now = actx.currentTime;
      MUSIC.fadeGain.gain.cancelScheduledValues(now);
      MUSIC.fadeGain.gain.setValueAtTime(0.0001, now);
      MUSIC.fadeGain.gain.linearRampToValueAtTime(RAVE.muted ? 0.0001 : 0.92, now + 0.5);
    } else { // file://：fetch/MediaElementSourceが使えないので素のelement出力
      MUSIC.fade = RAVE.muted ? 0 : 0.92; el.muted = RAVE.muted; applyMusicElVolume();
    }
    el.play().then(() => { muteSynth(true); resyncBeatClock(); }).catch(onMusicFail);
  }
  function raveOff() {
    if (!RAVE.on) return;
    stopMusicTrack(true);
    scene.remove(RAVE.group);
    disposeRaveGroup(RAVE.group);
    const s = RAVE.saved;
    sun.intensity = s.sun; hemi.intensity = s.hemi; scene.fog = s.fog; scene.background = s.bg; sky.visible = s.sky; clouds.visible = s.clouds;
    if (RAVE.master && actx) { try { RAVE.master.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.15); } catch (e) {} }
    RAVE.on = false; RAVE.group = null; RAVE.kind = ''; raveInd.style.display = 'none'; RAVE.hype = 0; updateVenueDock(); updateHypeMeter();
  }
  function raveToggle(kind = 'classic') {
    initAudio();
    if (RAVE.on && RAVE.kind === kind) { raveOff(); return; }
    if (RAVE.on) raveOff();
    const cfg = RAVE_VENUES[kind];
    RAVE.kind = kind;
    const si = Math.floor(Math.random() * venueTrackCount(kind));
    applyTrack(kind, si);
    RAVE.group = buildRaveVenue(kind);
    const fx = Math.round(player.pos.x), fz = Math.round(player.pos.z), fy = Math.floor(player.pos.y - EYE);
    RAVE.group.position.set(fx, fy, fz); scene.add(RAVE.group);
    RAVE.saved = { sun: sun.intensity, hemi: hemi.intensity, fog: scene.fog, bg: scene.background.clone(), sky: sky.visible, clouds: clouds.visible };
    sun.intensity = 0.18; hemi.intensity = 0.22;
    const mood = {
      classic: { bg: 0x07050f, fog: 0x0a0612 },
      neon:    { bg: 0x120307, fog: 0x26080a },
      forest:  { bg: 0x03111f, fog: 0x05203a },
      laser:   { bg: 0x140c03, fog: 0x261506 },
      future:  { bg: 0x08051a, fog: 0x190a33 },
      bass:    { bg: 0x020903, fog: 0x06200c },
      chill:   { bg: 0x080a16, fog: 0x111832 },
      dub:     { bg: 0x0a0012, fog: 0x1c0026 },
    }[kind] || { bg: 0x07050f, fog: 0x0a0612 };
    scene.fog = new THREE.Fog(mood.fog, 8, 38); scene.background = new THREE.Color(mood.bg);
    sky.visible = false; clouds.visible = false;
    if (actx) {
      if (actx.state === 'suspended') actx.resume();
      const fx = RAVE_FX[kind] || RAVE_FX.classic, now = actx.currentTime;
      const out = actx.createGain(); out.gain.setValueAtTime(0.0001, now); out.gain.exponentialRampToValueAtTime(VENUE_MP3_ONLY || RAVE.muted || RAVE.mp3Url ? 0.0001 : SYNTH_VOL, now + 0.4);
      // ── マスターチェイン（本格的なミックス/マスタリング） ──
      const mHP = actx.createBiquadFilter(); mHP.type = 'highpass'; mHP.frequency.value = 30; mHP.Q.value = 0.5; // 不要な超低域を除去
      const mLowMid = actx.createBiquadFilter(); mLowMid.type = 'peaking'; mLowMid.frequency.value = 290; mLowMid.Q.value = 0.9; mLowMid.gain.value = -2.2; // 低中域の濁りを軽く抜く
      const mAir = actx.createBiquadFilter(); mAir.type = 'highshelf'; mAir.frequency.value = 9000; mAir.gain.value = 3.2; // 高域の空気感
      const glue = actx.createDynamicsCompressor(); // 全体をまとめるグルーコンプ
      glue.threshold.value = -15; glue.knee.value = 18; glue.ratio.value = 2.2; glue.attack.value = 0.012; glue.release.value = 0.22;
      const sat = makeShaper(0.55); // 倍音を足して密度を出すサチュレーション
      const limiter = actx.createDynamicsCompressor(); // ブリックウォール風リミッターで音圧とグルー
      limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.05;
      const djFilter = actx.createBiquadFilter(); djFilter.type = 'lowpass'; djFilter.frequency.value = 16000; djFilter.Q.value = 0.8;
      const distGain = actx.createGain(); distGain.gain.value = 1; RAVE.distGain = distGain; // 会場からの距離で音量を絞る
      out.connect(mHP); mHP.connect(mLowMid); mLowMid.connect(mAir); mAir.connect(glue);
      glue.connect(sat); sat.connect(djFilter); djFilter.connect(limiter); limiter.connect(distGain); distGain.connect(actx.destination);
      RAVE.master = out;
      RAVE.djFilter = djFilter;
      const kb = actx.createGain(); kb.connect(makeShaper(3)).connect(out); RAVE.kickBus = kb;
      // ── ステレオリバーブ（左右で無相関なIRで広がりを出す） ──
      const rev = actx.createConvolver(); rev.buffer = makeReverbIR(fx.revLen, fx.revDecay);
      const revGain = actx.createGain(); revGain.gain.value = fx.revAmt; rev.connect(revGain).connect(out); RAVE.reverb = rev;
      // ── ピンポンステレオディレイ（左右を行き来する本格的なディレイ） ──
      const dlyTime = 60 / RAVE.bpm * fx.dlyMul;
      const dL = actx.createDelay(1.0), dR = actx.createDelay(1.0); dL.delayTime.value = dlyTime; dR.delayTime.value = dlyTime;
      const fbL = actx.createGain(), fbR = actx.createGain(); fbL.gain.value = fx.dlyFb; fbR.gain.value = fx.dlyFb;
      const dhp = actx.createBiquadFilter(); dhp.type = 'highpass'; dhp.frequency.value = 320;
      const panL = actx.createStereoPanner(), panR = actx.createStereoPanner(); panL.pan.value = -0.85; panR.pan.value = 0.85;
      dL.connect(fbL).connect(dR); dR.connect(fbR).connect(dL); // 左右クロスフィードバックでピンポン
      dL.connect(panL).connect(dhp); dR.connect(panR).connect(dhp); dhp.connect(out); RAVE.delay = dL;
      const duck = actx.createGain(); duck.gain.value = 1; duck.connect(out); RAVE.duck = duck; RAVE.duckDepth = fx.duck;
      RAVE.audioStart = now + 0.12; RAVE.nextNote = RAVE.audioStart; RAVE.step = 0; RAVE.acidPrev = null; RAVE.acidStep = -99;
    }
    RAVE.hype = 0.18; RAVE.hypeMaxUntil = 0; RAVE.hypeCooldownUntil = 0;
    RAVE.on = true; raveInd.style.display = 'block'; refreshRaveIndicator();
    updateVenueDock(); updateHypeMeter();
    // mp3があれば会場BGMとして再生。無ければ自前シンセには戻さず無音。
    if (MUSIC.enabled && RAVE.mp3Url) startMusicTrack(RAVE.mp3Url); else { stopMusicTrack(false); muteSynth(true); }
    // 後から足したmp3も拾えるよう、開くたびにこの会場を裏で再走査（次の選曲/Q・Eに反映）
    if (MUSIC.enabled) probeMusicKind(kind);
  }
  function refreshRaveIndicator() {
    if (!RAVE.on) return;
    const cfg = RAVE_VENUES[RAVE.kind];
    const track = RAVE.mp3Url ? `♪${RAVE.songNo}` : 'MP3なし';
    raveInd.textContent = `${cfg.label} ${track}  ${RAVE_KEY_BINDINGS.map(v => v.key).join('/')}  DJ Q/E/J/K/L`;
  }
  function switchRaveSong(delta) {
    if (!RAVE.on || !actx) return;
    const count = venueTrackCount(RAVE.kind); // mp3が多ければ全mp3を巡回（laser-4/5, future-4 等も届く）
    if (count <= 0) {
      applyTrack(RAVE.kind, 0);
      stopMusicTrack(false);
      muteSynth(true);
      markDj('NO MP3');
      refreshRaveIndicator();
      return;
    }
    const idx = ((RAVE.songNo || 1) - 1 + delta + count) % count;
    applyTrack(RAVE.kind, idx);
    const now = actx.currentTime;
    RAVE.audioStart = now + 0.08;
    RAVE.nextNote = RAVE.audioStart;
    RAVE.step = 0;
    RAVE.acidPrev = null; RAVE.acidStep = -99;
    RAVE.reactionBar = -1;
    RAVE.djLoopUntil = 0;
    if (RAVE.delay) RAVE.delay.delayTime.setTargetAtTime(60 / RAVE.bpm * ((RAVE_FX[RAVE.kind] || RAVE_FX.classic).dlyMul), now, 0.05);
    // mp3を切替。無ければ自前シンセには戻さず無音。
    if (MUSIC.enabled && RAVE.mp3Url) startMusicTrack(RAVE.mp3Url); else { stopMusicTrack(false); muteSynth(true); }
    markDj(delta > 0 ? 'NEXT TRACK' : 'PREV TRACK');
    addCrowdHype(0.12, delta > 0 ? 'NEXT MIX' : 'BACK MIX');
    launchCrowdReaction(0.48, true);
    refreshRaveIndicator();
  }
  function djFilterSweep() {
    if (!RAVE.on || !actx || !RAVE.djFilter) return;
    const now = actx.currentTime, beatLen = 60 / RAVE.bpm;
    RAVE.djFilter.frequency.cancelScheduledValues(now);
    RAVE.djFilter.Q.cancelScheduledValues(now);
    RAVE.djFilter.frequency.setValueAtTime(420, now);
    RAVE.djFilter.frequency.exponentialRampToValueAtTime(12500, now + beatLen * 4);
    RAVE.djFilter.Q.setValueAtTime(10, now);
    RAVE.djFilter.Q.linearRampToValueAtTime(0.8, now + beatLen * 4);
    RAVE.djEnergyUntil = performance.now() + beatLen * 4000;
    markDj('FILTER SWEEP');
    addCrowdHype(0.1, 'FILTER');
    flashScreen(0.62, 0.34);
  }
  function djCrashHit() {
    if (!RAVE.on || !actx) return;
    const now = actx.currentTime + 0.015;
    vCrash(now, RAVE.kind === 'chill' ? 0.16 : 0.28, RAVE.kind === 'bass' ? 0.5 : 1.2, RAVE.kind === 'chill' ? 5200 : 8800);
    if (RAVE.kind !== 'chill') vSubDrop(now, RAVE.kind === 'bass' ? 120 : 92, RAVE.kind === 'future' ? 38 : 32, 0.42, 0.55);
    launchCrowdReaction(1.0, true);
    launchFireworks(6);
    launchShockwave(0.9);
    flashScreen(0.92, 0.62);
    RAVE.djEnergyUntil = performance.now() + 1700;
    markDj('CRASH');
    addCrowdHype(0.16, 'CRASH');
  }
  function djLoopRoll() {
    if (!RAVE.on || !actx) return;
    const now = actx.currentTime, beatLen = 60 / RAVE.bpm;
    RAVE.djLoopStep = Math.max(0, RAVE.step - (RAVE.step % 4));
    RAVE.djLoopUntil = now + beatLen * 2;
    RAVE.djEnergyUntil = performance.now() + beatLen * 2000;
    markDj('LOOP ROLL');
    addCrowdHype(0.11, 'LOOP');
    launchShockwave(0.62);
  }
  function playerVenueLocal() {
    if (!RAVE.group) return null;
    return new THREE.Vector3(player.pos.x - RAVE.group.position.x, player.pos.y - EYE - RAVE.group.position.y, player.pos.z - RAVE.group.position.z);
  }
  function playerOnDanceFloor(local) {
    return local && local.y > -0.35 && local.y < 2.2 && Math.hypot(local.x, local.z) < RAVE.radius * 0.9;
  }
  function launchCrowdReaction(power = 0.75, fromPlayer = false) {
    if (!RAVE.on || !actx) return;
    RAVE.reactionBeat = (actx.currentTime - RAVE.audioStart) / (60 / RAVE.bpm);
    RAVE.reactionPower = Math.max(RAVE.reactionPower || 0, power);
    RAVE.reactionFromPlayer = fromPlayer;
    if (power >= 0.9) launchShockwave(power * 0.75);
  }
  function reactionAmountForDancer(d, beat, di) {
    if (RAVE.reactionBeat < -100) return 0;
    const dist = Math.hypot(d.position.x, d.position.z);
    const age = beat - RAVE.reactionBeat - dist * 0.035 - (di % 5) * 0.045;
    if (age < 0 || age > 4.2) return 0;
    return Math.sin(age / 4.2 * Math.PI) * (RAVE.reactionPower || 0);
  }
  function applyCrowdReaction(d, ud, aL, aR, beat, di) {
    const wave = reactionAmountForDancer(d, beat, di);
    if (wave <= 0) return;
    const len = Math.max(0.001, Math.hypot(d.position.x, d.position.z));
    d.position.x += d.position.x / len * wave * 0.7;
    d.position.z += d.position.z / len * wave * 0.7;
    d.position.y += Math.sin(wave * Math.PI) * 0.2 + wave * 0.45;
    setArms(aL, aR, 2.75, 0.1, -2.75, 0.1);
    setElbows(ud, -0.18, -0.18);
    ud.head.rotation.x = -0.22 * wave;
  }
  function updateCheerLights(beat, cfg) {
    const age = beat - RAVE.reactionBeat;
    for (const spark of RAVE.cheers) {
      const t = age - spark.userData.seed * 0.12;
      if (t < 0 || t > 5.6) { spark.visible = false; continue; }
      const fade = Math.sin(t / 5.6 * Math.PI) * (RAVE.reactionPower || 0);
      const a = spark.userData.angle + beat * 0.08;
      const r = spark.userData.radius + t * (1.1 + RAVE.reactionPower * 0.55);
      spark.visible = true;
      spark.position.set(Math.cos(a) * r, 1.0 + t * 0.25 + fade * 0.8, Math.sin(a) * r);
      spark.scale.setScalar(0.7 + fade * 2.2);
      spark.material.opacity = Math.min(0.9, fade);
      spark.material.color.setHSL((cfg.hue + t * 0.04 + spark.userData.seed) % 1, 1, 0.55);
    }
    if (age > 6) RAVE.reactionPower *= 0.94;
  }
  // 花火の火花/ロケットのジオメトリは共有（1度だけ生成）。毎回作り直すと打ち上げ時に大量生成して
  // フレームが詰まり音が途切れる＆破棄漏れでGPUメモリが増え続けるため、共有して使い回す。
  const FW_SPARK_GEOS = [], FW_SHARED_GEOS = new Set();
  let FW_ROCKET_GEO = null, FW_TRAIL_GEO = null;
  function fwEnsureGeos() {
    if (FW_ROCKET_GEO) return;
    FW_ROCKET_GEO = new THREE.SphereGeometry(0.09, 10, 8); FW_SHARED_GEOS.add(FW_ROCKET_GEO);
    FW_TRAIL_GEO = new THREE.BoxGeometry(0.07, 1, 0.07); FW_SHARED_GEOS.add(FW_TRAIL_GEO); // 上昇の尾（縦に伸縮）
    for (let s = 0; s < 3; s++) { const g = new THREE.SphereGeometry(0.045 + s * 0.012, 8, 6); FW_SPARK_GEOS.push(g); FW_SHARED_GEOS.add(g); }
  }
  const FW_SPARKS = 56, FW_MAX_SHELLS = 20; // 1発の火花数（花火大会級に密）/ 同時に存在できる花火の上限（暴走防止）
  const FW_PER_FRAME = 2; // 1フレームに新規生成する花火の最大数（生成スパイク＝音の途切れ防止）
  const FW_UPZ = new THREE.Vector3(0, 0, 1), _fwTmp = new THREE.Vector3();
  // いろんな種類の花火：shape=火花の飛び方 / colors=配色 / grav・drag・life・scale・twinkle=挙動
  const FW_TYPES = [
    { name: 'peony',   shape: 'sphere', speed: [5, 8],     grav: 3.0, drag: 0.985, life: 2.2, scale: 2.4, twinkle: false, colors: 'single',  trail: false }, // 牡丹（定番の球）
    { name: 'chrys',   shape: 'sphere', speed: [4.5, 7],   grav: 4.4, drag: 0.97,  life: 2.7, scale: 2.0, twinkle: false, colors: 'single',  trail: true },  // 菊（尾を引く）
    { name: 'willow',  shape: 'dome',   speed: [3, 5.5],   grav: 5.6, drag: 0.992, life: 3.3, scale: 1.8, twinkle: false, colors: 'warm',    trail: true },  // 柳（金色で垂れる）
    { name: 'ring',    shape: 'ring',   speed: [6.5, 7.5], grav: 2.4, drag: 0.985, life: 2.1, scale: 2.2, twinkle: false, colors: 'single',  trail: false }, // 環
    { name: 'palm',    shape: 'palm',   speed: [6, 9],     grav: 4.2, drag: 0.97,  life: 2.5, scale: 2.8, twinkle: false, colors: 'warm',    trail: true },  // 椰子
    { name: 'crackle', shape: 'sphere', speed: [4, 7],     grav: 3.0, drag: 0.97,  life: 2.3, scale: 1.6, twinkle: true,  colors: 'single',  trail: false }, // 椰子の後のパチパチ
    { name: 'double',  shape: 'sphere', speed: [5, 8],     grav: 3.0, drag: 0.985, life: 2.3, scale: 2.2, twinkle: false, colors: 'dual',    trail: false }, // 二色
    { name: 'rainbow', shape: 'sphere', speed: [5, 8],     grav: 3.0, drag: 0.985, life: 2.3, scale: 2.4, twinkle: false, colors: 'rainbow', trail: false }, // 虹色
  ];
  function launchFireworks(count = 4) {
    if (!RAVE.group) return;
    fwEnsureGeos();
    if (!RAVE.fwQueue) RAVE.fwQueue = [];
    // 一斉生成は音が途切れるので、数フレームに時間差で打ち上げる（花火大会らしいバラけた連発にもなる）
    const cap = FW_MAX_SHELLS * 2;
    let d = RAVE.fwQueue.length ? RAVE.fwQueue[RAVE.fwQueue.length - 1] : 0;
    for (let i = 0; i < count && RAVE.fwQueue.length < cap; i++) {
      d += rnd(0.04, 0.15);
      RAVE.fwQueue.push(d);
    }
  }
  function spawnFireworkShell() {
    const cfg = RAVE_VENUES[RAVE.kind] || RAVE_VENUES.classic;
      const shell = new THREE.Group();
      const angle = Math.random() * Math.PI * 2;
      const radius = RAVE.radius * rnd(0.1, 0.8);     // 横に散らしつつ手前寄り＝大きく見せる
      const type = FW_TYPES[Math.floor(Math.random() * FW_TYPES.length)];
      const baseHue = (cfg.hue + rnd(-0.5, 0.5) + 1) % 1; // 会場色に縛られず色とりどりに
      const hue2 = (baseHue + rnd(0.3, 0.55)) % 1;
      const burstAt = rnd(1.35, 2.05);     // 上昇時間を長く＝高く打ち上がる
      const peakY = rnd(18, 32);           // 夜空の破裂高度（大玉が見やすい高さ帯）
      const origin = new THREE.Vector3(Math.cos(angle) * radius, 0.4, Math.sin(angle) * radius);
      shell.position.copy(origin);
      shell.userData = { age: 0, burstAt, peakY, burst: false, origin, baseHue, type };
      // 上昇するロケット（破裂時はフラッシュ兼用）
      const rocketMat = emissiveMat(new THREE.Color().setHSL(baseHue, 1, 0.72).getHex(), 0.95); rocketMat.fog = false;
      const rocket = new THREE.Mesh(FW_ROCKET_GEO, rocketMat); rocket.userData.role = 'rocket'; shell.add(rocket);
      // 上昇の尾
      const trailMat = emissiveMat(new THREE.Color().setHSL(baseHue, 1, 0.6).getHex(), 0.6); trailMat.fog = false;
      const trail = new THREE.Mesh(FW_TRAIL_GEO, trailMat); trail.userData.role = 'trail'; shell.add(trail);
      // ring/palm 用の傾いた基底
      const nrm = new THREE.Vector3(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize();
      const ua = new THREE.Vector3(0, 1, 0).cross(nrm); if (ua.lengthSq() < 1e-3) ua.set(1, 0, 0); ua.normalize();
      const va = new THREE.Vector3().crossVectors(nrm, ua).normalize();
      for (let p = 0; p < FW_SPARKS; p++) {
        let hue;
        if (type.colors === 'dual') hue = (p % 2) ? hue2 : baseHue;
        else if (type.colors === 'rainbow') hue = (baseHue + p / FW_SPARKS) % 1;
        else if (type.colors === 'warm') hue = 0.06 + Math.random() * 0.08;
        else hue = (baseHue + rnd(-0.03, 0.03) + 1) % 1;
        const light = (type.name === 'willow' || type.name === 'palm') ? 0.62 : 0.58;
        const mat = emissiveMat(new THREE.Color().setHSL(hue, 1, light).getHex(), 0); mat.fog = false; // 空の花火は霧で消さない
        const spark = new THREE.Mesh(FW_SPARK_GEOS[p % 3], mat);
        const sp = rnd(type.speed[0], type.speed[1]) * 2.1;  // 開きを大きく＝大玉に
        let v;
        if (type.shape === 'ring') {
          const a = p / FW_SPARKS * Math.PI * 2;
          v = new THREE.Vector3().copy(ua).multiplyScalar(Math.cos(a)).addScaledVector(va, Math.sin(a)).addScaledVector(nrm, rnd(-0.12, 0.12)).multiplyScalar(sp);
        } else if (type.shape === 'palm') {
          const fronds = 6, a = Math.floor(p / (FW_SPARKS / fronds)) / fronds * Math.PI * 2;
          v = new THREE.Vector3(Math.cos(a) * 0.6, rnd(0.6, 1.0), Math.sin(a) * 0.6).normalize().multiplyScalar(sp * rnd(0.8, 1.1));
        } else if (type.shape === 'dome') {
          const theta = Math.random() * Math.PI * 2, phi = Math.acos(rnd(-0.1, 1));
          v = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).multiplyScalar(sp);
        } else {
          const theta = Math.random() * Math.PI * 2, phi = Math.acos(rnd(-1, 1));
          v = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).multiplyScalar(sp);
        }
        spark.userData.vel = v; spark.userData.tw = Math.random() * 6.28;
        if (type.trail) { _fwTmp.copy(v).normalize(); spark.quaternion.setFromUnitVectors(FW_UPZ, _fwTmp); }
        spark.visible = false;
        shell.add(spark);
      }
      RAVE.group.add(shell);
      RAVE.fireworks.push(shell);
  }
  function launchShockwave(power = 1) {
    if (!RAVE.group) return;
    const cfg = RAVE_VENUES[RAVE.kind] || RAVE_VENUES.classic;
    const hue = (cfg.hue + rnd(-0.08, 0.16) + 1) % 1;
    const color = new THREE.Color().setHSL(hue, 1, 0.58).getHex();
    const wave = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 96), emissiveMat(color, 0.75));
    wave.rotation.x = Math.PI / 2;
    wave.position.y = 0.18;
    wave.userData.age = 0;
    wave.userData.power = power;
    wave.userData.maxRadius = RAVE.radius * (1.25 + power * 0.35);
    RAVE.group.add(wave);
    RAVE.shockwaves.push(wave);
  }
  function updateShockwaves(dt) {
    for (let i = RAVE.shockwaves.length - 1; i >= 0; i--) {
      const w = RAVE.shockwaves[i], u = w.userData;
      u.age += dt;
      const t = u.age / (0.9 + u.power * 0.32);
      if (t >= 1) {
        RAVE.group.remove(w);
        w.geometry.dispose();
        w.material.dispose();
        RAVE.shockwaves.splice(i, 1);
        continue;
      }
      const r = 0.9 + u.maxRadius * (1 - Math.pow(1 - t, 2));
      w.scale.set(r, r, r);
      w.material.opacity = (1 - t) * 0.72;
    }
  }
  function updateFireworks(dt) {
    // 打ち上げ待ち行列を消化（1フレーム最大 FW_PER_FRAME 発・上限内のみ＝生成スパイク防止）
    if (RAVE.fwQueue && RAVE.fwQueue.length) {
      for (let q = 0; q < RAVE.fwQueue.length; q++) RAVE.fwQueue[q] -= dt;
      let spawned = 0;
      while (RAVE.fwQueue.length && RAVE.fwQueue[0] <= 0 && spawned < FW_PER_FRAME && RAVE.fireworks.length < FW_MAX_SHELLS) {
        RAVE.fwQueue.shift(); spawnFireworkShell(); spawned++;
      }
    }
    for (let i = RAVE.fireworks.length - 1; i >= 0; i--) {
      const fw = RAVE.fireworks[i], u = fw.userData, type = u.type;
      u.age += dt;
      const rocket = fw.children[0], trail = fw.children[1];
      if (!u.burst) {
        const t = u.age / u.burstAt;                         // 0→1 で減速しながらピーク高度へ
        const ny = u.origin.y + u.peakY * (1 - (1 - t) * (1 - t)), dy = ny - fw.position.y;
        fw.position.set(u.origin.x + Math.sin(u.age * 7 + u.baseHue * 9) * 0.08, ny, u.origin.z + Math.cos(u.age * 6 + u.baseHue * 11) * 0.08);
        rocket.scale.setScalar(1); rocket.material.opacity = Math.max(0.2, 1 - t * 0.3);
        const len = Math.min(7, Math.max(0.3, dy / Math.max(dt, 1e-3)) * 0.14); // 上昇速度に応じて尾を伸ばす
        trail.scale.set(1, len, 1); trail.position.y = -len * 0.5; trail.material.opacity = (1 - t) * 0.7;
        if (u.age >= u.burstAt) {
          u.burst = true; u.burstAge = 0; trail.visible = false;
          for (let s = 2; s < fw.children.length; s++) fw.children[s].visible = true;
        }
      } else {
        u.burstAge += dt;
        const fade = Math.max(0, 1 - u.burstAge / type.life);
        const fl = Math.max(0, 1 - u.burstAge / 0.22);       // 破裂の閃光
        rocket.material.opacity = fl * 0.9; rocket.scale.setScalar(1 + fl * 7);
        if (u.burstAge > 0.22) rocket.visible = false;
        for (let s = 2; s < fw.children.length; s++) {
          const spark = fw.children[s], v = spark.userData.vel;
          spark.position.addScaledVector(v, dt);
          v.y -= dt * type.grav * 0.78; v.multiplyScalar(type.drag);  // 重力やや弱め＝大きく丸く開く
          let op = fade;
          if (type.twinkle) op = fade * (0.35 + 0.65 * Math.max(0, Math.sin(u.burstAge * 32 + spark.userData.tw))); // パチパチ
          spark.material.opacity = op;
          const sc = 0.9 + fade * type.scale * 1.5;
          if (type.trail) { _fwTmp.copy(v).normalize(); spark.quaternion.setFromUnitVectors(FW_UPZ, _fwTmp); spark.scale.set(sc * 0.55, sc * 0.55, sc * (1.4 + (1 - fade) * 2.2)); }
          else spark.scale.setScalar(sc);
        }
        if (fade <= 0.02) {
          RAVE.group.remove(fw);
          for (const child of fw.children) child.material.dispose(); // ジオメトリは共有なので破棄しない
          RAVE.fireworks.splice(i, 1);
        }
      }
    }
  }
  function updateRaveBeatObjects(beat, env, currentBar) {
    const chorus = isChorusBar(currentBar), build = isBuildBar(currentBar);
    for (const m of RAVE.noteBlocks) {
      const seed = m.userData.fxSeed || 0;
      const wave = Math.max(env, Math.max(0, Math.sin((beat * 1.6 - seed) * Math.PI)) ** 4 * (chorus ? 0.95 : 0.55));
      m.scale.set(1 + wave * 0.08, 1 + wave * 1.45, 1 + wave * 0.08);
      m.position.y = m.userData.basePos.y + wave * 0.24;
      if (m.material.emissive) m.material.emissive.setHSL((RAVE_VENUES[RAVE.kind].hue + seed * 0.13 + beat * 0.04) % 1, 1, 0.08 + wave * 0.42);
    }
    for (const m of RAVE.specialObjects) {
      const role = m.userData.fxRole, seed = m.userData.fxSeed || 0, basePos = m.userData.basePos, baseScale = m.userData.baseScale;
      if (!role || !basePos || !baseScale) continue;
      if (role === 'futureIsland') {
        const lift = Math.sin(beat * 0.85 + seed) * 0.16 + (chorus ? env * 0.42 : 0);
        m.position.y = basePos.y + lift;
        m.scale.setScalar(baseScale.x * (1 + env * 0.08 + (build ? 0.05 : 0)));
      } else if (role === 'bassRib' || role === 'bassRibTop' || role === 'bassRoof' || role === 'bassWall') {
        const wave = Math.max(0, Math.sin(beat * 2.4 - seed * 0.75)) ** 3;
        if (m.material.color) m.material.color.setHSL(0.32 + wave * 0.05, 1, role === 'bassWall' || role === 'bassRoof' ? 0.05 + wave * 0.13 : 0.22 + wave * 0.42);
        if (m.material.emissive) m.material.emissive.setHSL(0.33, 1, 0.02 + wave * 0.35);
        m.scale.copy(baseScale);
        if (role === 'bassRibTop') m.scale.z = baseScale.z * (1 + wave * 1.4);
      } else if (role === 'chillMoon' || role === 'chillLamp') {
        const glow = 0.5 + 0.5 * Math.sin(beat * 0.45 + seed);
        m.scale.setScalar(baseScale.x * (1 + glow * (role === 'chillMoon' ? 0.08 : 0.18)));
        m.position.y = basePos.y + (role === 'chillMoon' ? Math.sin(beat * 0.22 + seed) * 0.12 : glow * 0.05);
        if (m.material.opacity !== undefined) m.material.opacity = role === 'chillMoon' ? 0.42 + glow * 0.35 : 0.35 + glow * 0.5;
      } else if (role === 'gate' || role === 'gateBeam') {
        const pulse = env * 0.35 + (chorus ? 0.12 : 0);
        m.scale.setScalar(baseScale.x * (1 + pulse));
      } else if (role === 'starfield') {                  // 星空：拍でまたたき、ドロップで一斉に明るく
        const tw = 0.5 + 0.5 * Math.sin(beat * 2.5 + seed);
        m.material.opacity = 0.4 + tw * 0.4 + env * 0.2 + (chorus ? 0.1 : 0);
        m.material.size = 0.13 * (1 + env * 0.6 + (chorus ? 0.3 : 0));
        m.rotation.y = beat * 0.04;
      } else if (role === 'nightStars') {                 // 会場の夜空：星ごとにまたたき、サビで一斉に明るく
        const u = m.material.uniforms;
        if (u) { u.uTime.value = beat; u.uEnv.value = env + (chorus ? 0.3 : 0); u.uOpacity.value = 0.85 + (chorus ? 0.15 : 0); }
      } else if (role === 'tranceBeam') {                 // 中央の光の柱：拍とサビで太く明るく脈動
        const surge = env * 0.18 + (chorus ? 0.22 : 0) + (build ? 0.1 : 0);
        m.scale.set(baseScale.x * (1 + surge), baseScale.y, baseScale.z * (1 + surge));
        m.material.opacity = 0.08 + env * 0.18 + (chorus ? 0.16 : 0);
      }
    }
  }
  function raveUpdate(dt) {
    if (!RAVE.on || !actx) return;
    const sw = SWING[RAVE.kind] || 0;
    while (RAVE.nextNote < actx.currentTime + 0.2) { // 先読みを広めに取り、フレームが詰まっても音が途切れにくくする
      const loopActive = RAVE.djLoopUntil && RAVE.nextNote < RAVE.djLoopUntil;
      const playStep = loopActive ? RAVE.djLoopStep + (RAVE.step % 4) : RAVE.step;
      const s16 = ((playStep % 16) + 16) % 16, six = SIXTEENTH();
      // スウィング：オフの16分(奇数)だけ後ろへずらす。頭拍/キック(偶数)は動かさないのでグリッドは保たれる
      const shift = (s16 % 2 === 1) ? sw * six : 0;
      // ベロシティ：頭拍を強く・裏拍を弱く＋微ランダム。打ち込みの硬さを抜いて生っぽくする
      const acc = s16 % 4 === 0 ? 1.05 : (s16 === 4 || s16 === 12) ? 1.0 : (s16 % 2 === 0 ? 0.97 : 0.9);
      RAVE.vel = acc * (1 + rnd(-0.07, 0.07));
      // 最終サビの転調：1サイクルおきに、ビルド〜サビ(12-23小節)を半音2つ上げる（対象ジャンルのみ）
      const tb = Math.floor(playStep / 16), sec = tb % 32; RAVE.cycle = Math.floor(tb / 32);
      const lift = (KEYCHANGE[RAVE.kind] && RAVE.cycle % 2 === 1 && sec >= 12 && sec < 24) ? 2 : 0;
      RAVE.pitchMul = lift ? Math.pow(2, lift / 12) : 1;
      if (!VENUE_MP3_ONLY) scheduleStep(playStep, RAVE.nextNote + shift);
      RAVE.nextNote += six; RAVE.step++;
    }
    RAVE.vel = 1; RAVE.pitchMul = 1; // スケジュール外（DJ操作/プレイヤーダンス等）の発音は等倍に戻す
    // 会場から離れるほど音量を下げる（水平距離ベース）
    if (RAVE.group) {
      const dx = player.pos.x - RAVE.group.position.x, dz = player.pos.z - RAVE.group.position.z;
      const dist = Math.hypot(dx, dz), near = RAVE.radius + 2, far = near + 24;
      const vol = Math.max(0, Math.min(1, 1 - (dist - near) / (far - near)));
      if (RAVE.distGain) RAVE.distGain.gain.setTargetAtTime(vol, actx.currentTime, 0.12);
      if (MUSIC.el) setMusicDist(vol); // mp3 BGMも距離で減衰（WebAudio/element両対応）
    }
    const cfg = RAVE_VENUES[RAVE.kind], beat = (actx.currentTime - RAVE.audioStart) / (60 / RAVE.bpm);
    const currentBar = Math.max(0, Math.floor(beat / 4)), section = sectionBeat(currentBar);
    if (currentBar !== RAVE.reactionBar) {
      if (section === 16 || section === 28) {
        launchCrowdReaction(section === 28 ? 1.0 : 0.85);
        addCrowdHype(section === 28 ? 0.18 : 0.14);
        launchFireworks(section === 28 ? 9 : 5); // ドロップで大連発（ドラマ演出）
      } else if (isChorusBar(currentBar) && currentBar % 4 === 0) {
        launchCrowdReaction(0.48);
        addCrowdHype(0.06);
      }
      RAVE.reactionBar = currentBar;
    }
    const ph = beat - Math.floor(beat), env = Math.pow(1 - ph, 2.2);
    const playerLocal = playerVenueLocal();
    const playerPresent = playerOnDanceFloor(playerLocal);
    const maxing = performance.now() < RAVE.hypeMaxUntil;
    if (playerPresent) RAVE.hype = THREE.MathUtils.clamp(RAVE.hype + dt * 0.015, 0, 1);
    RAVE.hype = THREE.MathUtils.clamp(RAVE.hype - dt * (isChorusBar(currentBar) ? 0.006 : 0.018), 0, 1);
    const hypeBoost = (RAVE.hype || 0) * 0.18 + (maxing ? 0.35 : 0);
    const djBoost = (performance.now() < RAVE.djEnergyUntil ? 0.28 : 0) + hypeBoost;
    updateHypeMeter();
    RAVE.lights.forEach((L, i) => {
      const hue = (cfg.hue + beat * 0.07 + i / Math.max(1, RAVE.lights.length)) % 1;
      L.color.setHSL(hue, 1, 0.5); L.children[0].material.color.copy(L.color);
      L.intensity = 5 + env * 22 + djBoost * 26;
      const a = beat * 0.5 + i * Math.PI * 2 / Math.max(1, RAVE.lights.length);
      L.position.set(Math.cos(a) * RAVE.radius * 0.68, 5.2, Math.sin(a) * RAVE.radius * 0.68);
    });
    RAVE.spots.forEach((S, i) => {
      S.color.setHSL((cfg.hue + beat * 0.11 + i * 0.5) % 1, 1, 0.55); S.intensity = 7 + env * 15 + djBoost * 18;
      const sw = Math.sin(beat * 0.7 + i * Math.PI) * RAVE.radius * 0.75;
      S.target.position.set(sw, 0, Math.cos(beat * 0.5 + i) * RAVE.radius * 0.75);
    });
    const strobeOn = RAVE.kind === 'classic' ? (Math.floor(beat) % 2 === 0) : RAVE.kind === 'neon' ? true : RAVE.kind === 'laser' ? (Math.floor(beat) % 4 === 0) : RAVE.kind === 'future' ? ph < 0.18 : RAVE.kind === 'bass' ? Math.floor(beat * 2) % 4 === 0 : RAVE.kind === 'dub' ? Math.floor(beat * 2) % 2 === 0 : false;
    RAVE.strobe.intensity = ph < 0.06 && strobeOn ? 50 : djBoost * 28;
    for (const m of RAVE.tiles) {
      if (RAVE.kind === 'neon') {
        const lane = m.userData.check ? 0.05 : 0.13;
        m.material.color.setHSL(lane, 1, 0.12 + env * (m.userData.check ? 0.42 : 0.22));
      } else if (RAVE.kind === 'forest') {
        m.material.color.setHSL((0.55 + m.userData.ij * 0.025 + beat * 0.035) % 1, 0.85, 0.13 + env * 0.24);
      } else if (RAVE.kind === 'laser') {
        m.material.color.setHSL(m.userData.check ? 0.12 : 0, m.userData.check ? 0.85 : 0, m.userData.check ? 0.62 + env * 0.25 : 0.06 + env * 0.16);
      } else if (RAVE.kind === 'future') {
        m.material.color.setHSL((0.76 + m.userData.ij * 0.035 + beat * 0.08) % 1, 0.95, 0.12 + env * 0.34);
      } else if (RAVE.kind === 'bass') {
        m.material.color.setHSL((0.31 + m.userData.ij * 0.01 + beat * 0.02) % 1, 0.95, 0.07 + env * 0.28);
      } else if (RAVE.kind === 'chill') {
        m.material.color.setHSL((0.62 + Math.sin(beat * 0.12 + m.userData.ij) * 0.05) % 1, 0.55, 0.1 + env * 0.12);
      } else if (RAVE.kind === 'dub') {
        m.material.color.setHSL((0.84 + m.userData.ij * 0.02 + beat * 0.05) % 1, 0.95, 0.07 + env * 0.36);
      } else {
        const hue = (cfg.hue + m.userData.ij * 0.06 + beat * 0.12) % 1;
        m.material.color.setHSL(hue, 0.95, 0.12 + 0.42 * env);
      }
      const wave = Math.max(0, Math.sin((beat * 0.55 - m.userData.ij * 0.13) * Math.PI)) ** 6;
      m.scale.setScalar(1 + env * 0.04 + djBoost * 0.08 + wave * (isChorusBar(currentBar) ? 0.13 : 0.07));
    }
    RAVE.lasers.forEach((m, i) => {
      m.material.color.setHSL((cfg.hue + beat * 0.2 + i * 0.18) % 1, 1, 0.55);
      m.rotation.y = beat * 0.6 + i * (Math.PI * 2 / Math.max(1, RAVE.lasers.length));
      m.rotation.z = Math.sin(beat * 0.9 + i) * 0.5;
      m.material.opacity = 0.22 + env * 0.58;
    });
    RAVE.rings.forEach((r, i) => {
      r.material.color.setHSL((cfg.hue + beat * 0.12 + i * 0.17) % 1, 1, 0.56);
      r.rotation.z += dt * (0.4 + i * 0.12);
      r.scale.setScalar(1 + env * 0.12);
    });
    RAVE.pulses.forEach((m, i) => {
      if (m.material.emissive) m.material.emissive.setHSL((cfg.hue + beat * 0.1 + i * 0.2) % 1, 1, 0.16 + env * 0.35);
      else m.material.color.setHSL((cfg.hue + beat * 0.1 + i * 0.2) % 1, 1, 0.35 + env * 0.25);
    });
    updateRaveBeatObjects(beat, env, currentBar);
    updateCheerLights(beat, cfg);
    updateFireworks(dt);
    updateShockwaves(dt);
    updateVenueSky(dt);
    if (RAVE.mirror) RAVE.mirror.rotation.y += dt * 1.5;
    const k = RAVE.kind;
    const crowdHype = Math.max(0, Math.sin(beat * Math.PI / 4)) ** 12;
    const playerActive = RAVE.playerPose && performance.now() < RAVE.playerPoseUntil && playerPresent;
    for (let di = 0; di < RAVE.dancers.length; di++) {
      const d = RAVE.dancers[di], isDJ = di === 0, ud = d.userData;
      const previousFrame = captureDancerFrame(d);
      const aL = ud.armL, aR = ud.armR, entry = isDJ ? null : updateDancerEntrance(d, dt, beat);
      if (entry && entry.waiting) continue;
      const home = isDJ ? (ud.home || d.position) : entry ? entry.home : updateDancerHome(d, k, beat);
      const facing = isDJ ? 0 : entry ? entry.facing : Math.atan2(-home.x, -home.z);
      const bd = beat + ud.beatOffset, pe = Math.abs(Math.sin(bd * Math.PI));
      // 前フレームの踊りのポーズが残らないよう関節を初期化
      ud.elbowL.rotation.set(0, 0, 0); ud.elbowR.rotation.set(0, 0, 0);
      ud.legL.rotation.set(0, 0, 0); ud.legR.rotation.set(0, 0, 0);
      ud.kneeL.rotation.set(0, 0, 0); ud.kneeR.rotation.set(0, 0, 0);
      ud.head.rotation.set(0, 0, 0); ud.hips.rotation.set(0, 0, 0);
      if (entry) {
        const entryMove = k === 'chill' ? 'sidestep' : entry.progress < 0.78 ? 'runningman' : 'shuffle';
        MOVES[entryMove](d, aL, aR, { home, facing, bd: bd * 1.35, pe, amp: ud.amp, dt, spin: ud.spin, sideX: ud.sideX, sideZ: ud.sideZ, ud });
        ud.head.rotation.y = Math.sin(beat * 1.7 + ud.moveSeed * 5) * 0.25 * (1 - entry.progress);
        smoothDancerFrame(d, previousFrame, 1 - Math.exp(-dt * 8));
        continue;
      }
      const playerDist = playerLocal ? Math.hypot(home.x - playerLocal.x, home.z - playerLocal.z) : 999;
      if (!isDJ && playerActive && playerDist < 4.8) {
        const pf = Math.atan2(playerLocal.x - home.x, playerLocal.z - home.z);
        const poseMove = MOVES[RAVE.playerPose] ? RAVE.playerPose : 'handsup';
        MOVES[poseMove](d, aL, aR, { home, facing: pf, bd: bd * 1.25, pe, amp: ud.amp * 1.08, dt, spin: ud.spin, sideX: ud.sideX, sideZ: ud.sideZ, ud });
        d.position.x += (playerLocal.x - home.x) * 0.06;
        d.position.z += (playerLocal.z - home.z) * 0.06;
        applyCrowdReaction(d, ud, aL, aR, beat, di);
        smoothDancerFrame(d, previousFrame, 1 - Math.exp(-dt * 10));
        continue;
      }
      if (k === 'neon') {
        // ユーロビート: 全員同期のパラパラ風・高速振付＋同期ジャンプ（あえて揃える）
        d.position.set(home.x, home.y + Math.abs(Math.sin(beat * Math.PI)) * 0.3, home.z);
        d.rotation.set(0, facing, 0);
        const pose = beat * Math.PI;
        aL.rotation.z = -1.6 - Math.sin(pose) * 0.65; aL.rotation.x = Math.sin(pose * 0.5) * 1.0;
        aR.rotation.z = 1.6 + Math.sin(pose + Math.PI) * 0.65; aR.rotation.x = Math.sin(pose * 0.5 + Math.PI) * 1.0;
        setElbows(ud, -0.6 - Math.abs(Math.sin(pose)) * 0.5, -0.6 - Math.abs(Math.sin(pose + Math.PI)) * 0.5);
        if (!isDJ && playerPresent && playerDist < 4.5) {
          const pf = Math.atan2(playerLocal.x - home.x, playerLocal.z - home.z);
          d.rotation.y += angleDelta(d.rotation.y, pf) * 0.35;
          ud.head.rotation.y = angleDelta(d.rotation.y, pf) * 0.45;
        }
        applyCrowdReaction(d, ud, aL, aR, beat, di);
        smoothDancerFrame(d, previousFrame, 1 - Math.exp(-dt * 8));
        continue;
      }
      // 各NPCは得意ジャンル(ペルソナ)を持ち、会場の雰囲気に個性を混ぜて踊りを切り替える
      const persona = DANCER_PERSONAS[ud.persona];
      const venuePool = MOVE_POOL[k] || MOVE_POOL.classic;
      const pool = ud.behavior === 'battle' ? BATTLE_MOVES : (persona ? persona.concat(venuePool) : venuePool);
      const idx = Math.floor(beat / (ud.behavior === 'battle' ? 4 : 8) + ud.moveSeed * 9);
      let name;
      if (isDJ) name = 'bounce';
      else if (ud.signature && idx % 3 === 0) name = ud.signature; // 自分の得意技(シグネチャー)を定期的に挟む
      else name = pool[((idx % pool.length) + pool.length) % pool.length];
      const mbd = bd * (ud.tempoMul || 1), mpe = Math.abs(Math.sin(mbd * Math.PI)); // 踊りのテンポは個体差
      MOVES[name](d, aL, aR, { home, facing, bd: mbd, pe: mpe, amp: ud.amp, dt, spin: ud.spin, sideX: ud.sideX, sideZ: ud.sideZ, ud });
      if (!isDJ && k !== 'chill' && crowdHype > 0.08 && ud.behavior !== 'stroll') {
        const wave = crowdHype * (0.65 + ud.amp * 0.35);
        d.position.y += wave * 0.18;
        aL.rotation.z -= wave * 0.65;
        aR.rotation.z += wave * 0.65;
      }
      if (!isDJ && playerPresent && playerDist < 4.5) {
        const pf = Math.atan2(playerLocal.x - home.x, playerLocal.z - home.z);
        d.rotation.y += angleDelta(d.rotation.y, pf) * 0.28;
        ud.head.rotation.y = angleDelta(d.rotation.y, pf) * 0.42;
      }
      applyCrowdReaction(d, ud, aL, aR, beat, di);
      smoothDancerFrame(d, previousFrame, 1 - Math.exp(-dt * (ud.behavior === 'battle' ? 9 : 6)));
    }
  }

  // 画面右上のレイブ表示
  const raveInd = document.createElement('div');
  raveInd.textContent = '🔊 RAVE ON';
  raveInd.style.cssText = 'position:fixed;right:12px;top:12px;z-index:10;color:#fff;font-weight:700;font-size:14px;padding:6px 12px;border-radius:8px;background:linear-gradient(90deg,#ff0066,#7a00ff);box-shadow:0 0 16px rgba(255,0,120,.7);display:none;pointer-events:none;';
  document.body.appendChild(raveInd);
