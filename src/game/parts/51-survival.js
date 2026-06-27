  /* ============== サバイバル基礎（体力・空腹・落下ダメージ） ============== */
  const SURVIVAL = {
    health: 20,
    hunger: 20,
    hurtFlash: 0,
    hungerClock: 0,
    healClock: 0,
    respawnClock: 0,
  };
  const survivalHud = document.createElement('div');
  survivalHud.id = 'survivalHud';
  document.body.appendChild(survivalHud);

  function respawnPlayer() {
    player.pos.set(spawnX, spawnY, spawnZ);
    player.vel.set(0, 0, 0);
    player.onGround = false;
    SURVIVAL.health = 20;
    SURVIVAL.hunger = 18;
    SURVIVAL.hurtFlash = 0.6;
  }

  function damagePlayer(amount) {
    if (SURVIVAL.respawnClock > 0 || amount <= 0) return;
    SURVIVAL.health = Math.max(0, SURVIVAL.health - amount);
    SURVIVAL.hurtFlash = 0.75;
    if (SURVIVAL.health <= 0) SURVIVAL.respawnClock = 1.2;
  }

  function eatFood(amount) {
    SURVIVAL.hunger = Math.min(20, SURVIVAL.hunger + amount);
    SURVIVAL.healClock = Math.max(0, SURVIVAL.healClock - 1.0);
    updateSurvivalHud();
  }

  function eatInventoryFood(id) {
    const def = ITEMS[id];
    if (!def || !def.food || inventoryCount(id) <= 0 || SURVIVAL.respawnClock > 0) return false;
    if (SURVIVAL.hunger >= 20 && SURVIVAL.health >= 20) return false;
    if (!consumeInventory(id, 1)) return false;
    eatFood(def.food);
    if (def.heal) SURVIVAL.health = Math.min(20, SURVIVAL.health + def.heal);
    SURVIVAL.hurtFlash = Math.max(SURVIVAL.hurtFlash, 0.18);
    updateSurvivalHud();
    if (typeof updateFoodHud === 'function') updateFoodHud();
    thock(360);
    return true;
  }

  function applyFallDamage(fallSpeed) {
    const excess = Math.abs(fallSpeed) - 16.5;
    if (excess > 0) damagePlayer(Math.ceil(excess * 0.9));
  }

  function updateSurvival(dt, moving) {
    if (!started) return;
    SURVIVAL.hurtFlash = Math.max(0, SURVIVAL.hurtFlash - dt * 1.8);
    if (SURVIVAL.respawnClock > 0) {
      SURVIVAL.respawnClock -= dt;
      if (SURVIVAL.respawnClock <= 0) respawnPlayer();
      updateSurvivalHud();
      return;
    }
    SURVIVAL.hungerClock += dt * (moving ? 1.0 : 0.35);
    if (SURVIVAL.hungerClock > 28) {
      SURVIVAL.hungerClock = 0;
      SURVIVAL.hunger = Math.max(0, SURVIVAL.hunger - 1);
    }
    if (SURVIVAL.hunger >= 18 && SURVIVAL.health < 20) {
      SURVIVAL.healClock += dt;
      if (SURVIVAL.healClock > 3.0) {
        SURVIVAL.healClock = 0;
        SURVIVAL.health = Math.min(20, SURVIVAL.health + 1);
      }
    } else {
      SURVIVAL.healClock = 0;
    }
    if (SURVIVAL.hunger <= 0) damagePlayer(dt * 0.8);
    if (!(typeof DEBUG !== 'undefined' && DEBUG.fly)) {
      const fx = Math.floor(player.pos.x), fz = Math.floor(player.pos.z);
      const feet = Math.floor(player.pos.y - 0.9);
      if (world.get(key(fx, feet, fz)) === LAVA || world.get(key(fx, feet + 1, fz)) === LAVA) {
        damagePlayer(dt * 6);
        SURVIVAL.hurtFlash = 0.8;
      }
      for (const [nx, nz] of [[fx + 1, fz], [fx - 1, fz], [fx, fz + 1], [fx, fz - 1]]) {
        if (world.get(key(nx, feet, nz)) === CACTUS || world.get(key(nx, feet + 1, nz)) === CACTUS) {
          damagePlayer(dt * 1.6);
          SURVIVAL.hurtFlash = Math.max(SURVIVAL.hurtFlash, 0.4);
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
    survivalHud.innerHTML = `<div class="health">${hearts}</div><div class="hunger">${meat}</div>`;
  }
  updateSurvivalHud();
