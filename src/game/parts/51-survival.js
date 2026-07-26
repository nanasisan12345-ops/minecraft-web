  /* ============== サバイバル基礎（体力・空腹・ダメージ・死亡/リスポーン） ============== */
  const SURVIVAL = {
    health: 20,
    hunger: 20,
    hurtFlash: 0,
    saturation: 5,    // 隠し満腹度。空腹より先に減る
    absorb: 0,        // 吸収ハート（金リンゴ）。通常HPより先に減る
    absorbClock: 0,
    hungerClock: 0,
    healClock: 0,
    invuln: 0,      // 被弾後の無敵時間
    dead: false,
    wasNight: false,
  };
  const survivalHud = document.createElement('div');
  survivalHud.id = 'survivalHud';
  document.body.appendChild(survivalHud);
  const deathScreen = document.createElement('div');
  deathScreen.id = 'deathScreen';
  deathScreen.innerHTML = `
    <h2>死んでしまった！</h2>
    <p class="death-detail"></p>
    <button id="respawnBtn">リスポーンする</button>
  `;
  document.body.appendChild(deathScreen);

  // セーブから体力/空腹/位置/時間を復元
  if (SAVE.player) {
    SURVIVAL.health = Number.isFinite(SAVE.player.hp) ? SAVE.player.hp : 20;
    SURVIVAL.hunger = Number.isFinite(SAVE.player.hunger) ? SAVE.player.hunger : 20;
    // 旧セーブには無いので既定値で読む
    SURVIVAL.saturation = Number.isFinite(SAVE.player.saturation) ? SAVE.player.saturation : 5;
    SURVIVAL.absorb = Number.isFinite(SAVE.player.absorb) ? SAVE.player.absorb : 0;
    SURVIVAL.absorbClock = SURVIVAL.absorb > 0 ? 120 : 0;
    if (Number.isFinite(SAVE.player.x) && Number.isFinite(SAVE.player.y) && Number.isFinite(SAVE.player.z)) {
      player.pos.set(SAVE.player.x, SAVE.player.y, SAVE.player.z);
    }
    if (Number.isFinite(SAVE.player.yaw)) yaw = SAVE.player.yaw;
    if (Number.isFinite(SAVE.player.pitch)) pitch = SAVE.player.pitch;
    if (SURVIVAL.health <= 0) SURVIVAL.health = 20; // 死亡中に閉じた場合は復活させる
  }
  if (Number.isFinite(SAVE.time)) DAY.time = SAVE.time;
  // 保存直前にプレイヤーの動的な値をSAVEへ回収する（33-save-state から呼ばれる）
  function collectSaveState() {
    SAVE.player = {
      x: player.pos.x, y: player.pos.y, z: player.pos.z,
      yaw, pitch,
      hp: SURVIVAL.health, hunger: SURVIVAL.hunger, saturation: SURVIVAL.saturation, absorb: SURVIVAL.absorb,
    };
    SAVE.time = DAY.time;
    SAVE.selected = selected;
    if (typeof collectDropsForSave === 'function') collectDropsForSave();
    if (typeof collectXpForSave === 'function') collectXpForSave();
  }

  function respawnPoint() {
    // ベッドで設定したリスポーン地点（ベッドが撤去されていたら初期スポーンへ）
    const s = SAVE.spawn;
    if (s && isBedBlock(blockAt(s.x, s.y, s.z))) return { x: s.x + 0.5, y: s.y + 2.2, z: s.z + 0.5 };
    return { x: spawnX, y: heightAt(spawnPt.x, spawnPt.z) + 3, z: spawnZ };
  }
  function respawnPlayer() {
    const p = respawnPoint();
    player.pos.set(p.x, p.y, p.z);
    player.vel.set(0, 0, 0);
    player.onGround = false;
    SURVIVAL.health = 20;
    SURVIVAL.hunger = 18;
    SURVIVAL.saturation = 5;
    SURVIVAL.absorb = 0;
    SURVIVAL.absorbClock = 0;
    SURVIVAL.hurtFlash = 0;
    SURVIVAL.invuln = 2.0;
    SURVIVAL.burn = 0;
    SURVIVAL.dead = false;
    deathScreen.classList.remove('show');
    regenWindow(Math.floor(player.pos.x), Math.floor(player.pos.z));
    writeSaveNow();
    updateSurvivalHud();
    if (typeof relockPointerForGame === 'function') relockPointerForGame();
  }
  deathScreen.querySelector('#respawnBtn').addEventListener('click', respawnPlayer);

  let lastDamageCause = '';
  function damagePlayer(amount, cause = '') {
    if (SURVIVAL.dead || amount <= 0) return;
    if (SURVIVAL.invuln > 0 && amount < 900) return;
    // 防具によるダメージ軽減（空腹と奈落は防げない）。防具は被弾のたびに消耗する
    const armor = SAVE.armor, armorDef = armor ? ITEM_DEFS[armor.id] : null;
    if (armorDef && armorDef.armor && amount < 900 && cause !== '空腹') {
      // 防護N: さらに -4%×N（上限64%）（C11）
      const cut = Math.min(0.85, armorDef.armor * 0.06 + enchProtectionCut(armor));
      amount = Math.max(1, Math.round(amount * (1 - cut)));
      armor.dur = (Number.isFinite(armor.dur) ? armor.dur : armorDef.durability) - 1;
      if (armor.dur <= 0) {
        SAVE.armor = null;
        if (typeof setDebugToast === 'function') setDebugToast(`${armorDef.name} が壊れた！`, 2.0);
      }
      markSaveDirty();
    }
    // 吸収ハートがあれば先に削る（本家と同じ）
    if ((SURVIVAL.absorb || 0) > 0) {
      const taken = Math.min(SURVIVAL.absorb, amount);
      SURVIVAL.absorb -= taken;
      amount -= taken;
      if (SURVIVAL.absorb <= 0) SURVIVAL.absorbClock = 0;
    }
    SURVIVAL.health = Math.max(0, SURVIVAL.health - amount);
    SURVIVAL.hurtFlash = 0.75;
    SURVIVAL.invuln = 0.55;
    if (cause) lastDamageCause = cause;
    if (typeof playHurtSound === 'function') playHurtSound();
    else thock(80);
    if (SURVIVAL.health <= 0) diePlayer();
    updateSurvivalHud();
  }
  function diePlayer() {
    SURVIVAL.dead = true;
    SURVIVAL.health = 0;
    // キープインベントリ方式（ユーザー要望による本家からの意図的な変更）:
    // 死んでも持ち物・防具はドロップせず、リスポーン後もそのまま持っている
    deathScreen.querySelector('.death-detail').textContent =
      `${lastDamageCause ? `死因: ${lastDamageCause}　` : ''}持ち物はそのまま残っている`;
    deathScreen.classList.add('show');
    releasePointerForUi();
    if (typeof closeContainer === 'function') closeContainer();
    writeSaveNow();
  }
  function applyFallDamage(fallSpeed) {
    const excess = Math.abs(fallSpeed) - 16.5;
    if (excess > 0) damagePlayer(Math.ceil(excess * 0.9), '落下');
  }

  function updateSurvival(dt, moving) {
    if (!started || SURVIVAL.dead) return;
    SURVIVAL.hurtFlash = Math.max(0, SURVIVAL.hurtFlash - dt * 1.8);
    SURVIVAL.invuln = Math.max(0, SURVIVAL.invuln - dt);
    // 夜を生き延びた進捗（夜→朝の切り替わりで判定）
    const isNight = DAY.label === '夜';
    if (SURVIVAL.wasNight && !isNight) {
      SAVE.stats.nights = (SAVE.stats.nights || 0) + 1;
      if (typeof progressEvent === 'function') progressEvent('survive_night');
    }
    SURVIVAL.wasNight = isNight;
    // 空腹の減り（動くと早い）
    // 吸収ハート（金リンゴ）は時間で消える
    if ((SURVIVAL.absorb || 0) > 0) {
      SURVIVAL.absorbClock = (SURVIVAL.absorbClock || 0) - dt;
      if (SURVIVAL.absorbClock <= 0) { SURVIVAL.absorb = 0; SURVIVAL.absorbClock = 0; }
    }
    SURVIVAL.hungerClock += dt * (moving ? 1.0 : 0.35);
    if (SURVIVAL.hungerClock > 28) {
      SURVIVAL.hungerClock = 0;
      // 隠し満腹度がある間は空腹が減らない（本家と同じ順序）
      if ((SURVIVAL.saturation || 0) > 0) SURVIVAL.saturation = Math.max(0, SURVIVAL.saturation - 1);
      else SURVIVAL.hunger = Math.max(0, SURVIVAL.hunger - 1);
    }
    // 空腹が満ちていれば自然回復
    if (SURVIVAL.hunger >= 18 && SURVIVAL.health < 20) {
      SURVIVAL.healClock += dt;
      if (SURVIVAL.healClock > 3.0) {
        SURVIVAL.healClock = 0;
        SURVIVAL.health = Math.min(20, SURVIVAL.health + 1);
        // 回復のコストも隠し満腹度から先に払う
        if ((SURVIVAL.saturation || 0) >= 0.4) SURVIVAL.saturation -= 0.4;
        else SURVIVAL.hunger = Math.max(0, SURVIVAL.hunger - 0.4);
      }
    } else {
      SURVIVAL.healClock = 0;
    }
    if ((SURVIVAL.saturation || 0) > SURVIVAL.hunger) SURVIVAL.saturation = SURVIVAL.hunger;
    // 飢餓ダメージ
    if (SURVIVAL.hunger <= 0) {
      SURVIVAL.starveClock = (SURVIVAL.starveClock || 0) + dt;
      if (SURVIVAL.starveClock > 3.2) { SURVIVAL.starveClock = 0; damagePlayer(1, '空腹'); }
    } else {
      SURVIVAL.starveClock = 0;
    }
    // 溶岩・炎上・サボテン
    if (!(typeof DEBUG !== 'undefined' && DEBUG.fly)) {
      const fx = Math.floor(player.pos.x), fz = Math.floor(player.pos.z);
      const feet = Math.floor(player.pos.y - 0.9);
      if (blockAt(fx, feet, fz) === LAVA || blockAt(fx, feet + 1, fz) === LAVA) {
        damagePlayer(3, '溶岩');
        SURVIVAL.hurtFlash = 0.8;
        SURVIVAL.burn = 2.0; // 溶岩から出ても2秒燃え続ける
      }
      // 水に入ると消火。炎上中は約0.8秒ごとに追加ダメージ
      if (blockAt(fx, feet, fz) === WATER || blockAt(fx, feet + 1, fz) === WATER) SURVIVAL.burn = 0;
      if ((SURVIVAL.burn || 0) > 0) {
        SURVIVAL.burn -= dt;
        SURVIVAL.burnClock = (SURVIVAL.burnClock || 0) + dt;
        if (SURVIVAL.burnClock >= 0.8) { SURVIVAL.burnClock = 0; damagePlayer(1, '炎上'); SURVIVAL.hurtFlash = 0.5; }
      } else {
        SURVIVAL.burnClock = 0;
      }
      for (const [nx, nz] of [[fx + 1, fz], [fx - 1, fz], [fx, fz + 1], [fx, fz - 1]]) {
        if (blockAt(nx, feet, nz) === CACTUS || blockAt(nx, feet + 1, nz) === CACTUS) {
          damagePlayer(1, 'サボテン');
          break;
        }
      }
    }
    updateSurvivalHud();
  }

  function updateSurvivalHud() {
    const hp = Math.max(0, Math.ceil(SURVIVAL.health));
    const food = Math.max(0, Math.ceil(SURVIVAL.hunger));
    const hearts = '♥'.repeat(Math.ceil(hp / 2)).padEnd(10, '♡');
    const meat = '◆'.repeat(Math.ceil(food / 2)).padEnd(10, '◇');
    survivalHud.classList.toggle('hurt', SURVIVAL.hurtFlash > 0);
    const fire = (SURVIVAL.burn || 0) > 0 ? '🔥 ' : '';
    const abs = Math.max(0, Math.ceil((SURVIVAL.absorb || 0) / 2));
    const absHearts = abs > 0 ? `<span class="absorb">${'♥'.repeat(abs)}</span>` : '';
    survivalHud.innerHTML = `<div class="health">${fire}${hearts}${absHearts}</div><div class="hunger">${meat}</div>`;
  }
  updateSurvivalHud();
