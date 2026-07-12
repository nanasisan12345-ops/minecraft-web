  /* ============== ブロック種別（光を受けるマテリアル） ============== */
  const T = TX;
  function mkMat(map, opt) {
    const nm = (map.userData && map.userData.normalMap) || null;
    const m = new THREE.MeshPhongMaterial({
      map, color: 0xffffff, shininess: opt.shininess ?? 3, specular: new THREE.Color(opt.specular ?? 0x0c0c0c),
      transparent: !!opt.transparent, opacity: opt.opacity ?? 1, depthWrite: opt.depthWrite ?? true,
      side: opt.side ?? THREE.FrontSide, alphaTest: opt.alphaTest ?? 0,
    });
    if (opt.emissive) { m.emissive = new THREE.Color(opt.emissive); m.emissiveIntensity = opt.emissiveIntensity ?? 0.35; }
    if (nm) { m.normalMap = nm; m.normalScale = new THREE.Vector2(0.6, 0.6); }
    return m;
  }
  function faceMats(tex, opt = {}) { return Array.isArray(tex) ? tex.map(t => mkMat(t, opt)) : mkMat(tex, opt); }

  const TYPES = [
    { name: '草',     color: 0x6ab04c, icon: T.grassSide, mats: faceMats([T.grassSide, T.grassSide, T.grassTop, T.dirt, T.grassSide, T.grassSide]) }, // 0
    { name: '土',     color: 0x8a5a2b, icon: T.dirt,      mats: faceMats(T.dirt) },   // 1
    { name: '石',     color: 0x8b9094, icon: T.stone,     mats: faceMats(T.stone) },  // 2
    { name: '丸太',   color: 0x6d4c1b, icon: T.bark,      mats: faceMats([T.bark, T.bark, T.logTop, T.logTop, T.bark, T.bark]) }, // 3
    { name: '葉',     color: 0x3f8a2e, icon: T.leaves,    mats: faceMats(T.leaves) }, // 4
    { name: '砂',     color: 0xe6da9c, icon: T.sand,      mats: faceMats(T.sand) },   // 5
    { name: '板材',   color: 0xb5824a, icon: T.planks,    mats: faceMats(T.planks) }, // 6
    { name: 'レンガ', color: 0xa83a2a, icon: T.brick,     mats: faceMats(T.brick) },  // 7
    { name: 'ガラス', color: 0xbfe9ff, icon: T.glass,     mats: faceMats(T.glass, { transparent: true, depthWrite: false }), transparent: true }, // 8
    { name: '水',     color: 0x3a78d8, icon: T.water,     mats: faceMats(T.water, { transparent: true, depthWrite: false, opacity: 0.72, shininess: 90, specular: 0x335577 }), transparent: true, solid: false }, // 9
    { name: '雪',     color: 0xf2f7ff, icon: T.snow,      mats: faceMats(T.snow) },   // 10
    { name: '石炭鉱石', color: 0x35383c, icon: T.coalOre,    mats: faceMats(T.coalOre) }, // 11
    { name: '鉄鉱石',   color: 0xc78a55, icon: T.ironOre,    mats: faceMats(T.ironOre) }, // 12
    { name: '金鉱石',   color: 0xe2b93c, icon: T.goldOre,    mats: faceMats(T.goldOre, { shininess: 8, specular: 0x332800 }) }, // 13
    { name: 'ダイヤ鉱石', color: 0x55d9e8, icon: T.diamondOre, mats: faceMats(T.diamondOre, { shininess: 12, specular: 0x225566 }) }, // 14
    { name: 'たいまつ', color: 0xffb23a, icon: T.torch, mats: faceMats(T.torch, { emissive: 0xffa324, emissiveIntensity: 0.75, shininess: 16, specular: 0x442200 }), transparent: true }, // 15
    { name: '作業台', color: 0xb5824a, icon: T.crafting, mats: faceMats(T.crafting) }, // 16
    { name: 'かまど', color: 0x757a7d, icon: T.furnaceFront, mats: faceMats([T.furnaceSide, T.furnaceSide, T.furnaceTop, T.furnaceTop, T.furnaceFront, T.furnaceSide], { emissive: 0x221008, emissiveIntensity: 0.12 }) }, // 17
    { name: '発光結晶', color: 0x6df7ff, icon: T.glowCrystal, mats: faceMats(T.glowCrystal, { emissive: 0x52dfff, emissiveIntensity: 0.92, shininess: 30, specular: 0x66ffff }) }, // 18
    { name: '鍾乳石', color: 0x8b8172, icon: T.dripstone, mats: faceMats(T.dripstone) }, // 19
    { name: '石レンガ', color: 0x868b8f, icon: T.stoneBrick, mats: faceMats(T.stoneBrick) }, // 20
    { name: '苔石レンガ', color: 0x6f8a5a, icon: T.mossyBrick, mats: faceMats(T.mossyBrick) }, // 21
    { name: '宝箱', color: 0xc79a52, icon: T.chest, mats: faceMats(T.chest, { shininess: 8, specular: 0x332100 }), transparent: true }, // 22
    { name: 'ランタン', color: 0xffc25a, icon: T.lantern, mats: faceMats(T.lantern, { emissive: 0xffb43a, emissiveIntensity: 0.85, shininess: 18, specular: 0x442200 }), transparent: true }, // 23
    { name: '溶岩', color: 0xff6a1a, icon: T.lava, mats: faceMats(T.lava, { transparent: true, depthWrite: false, opacity: 0.94, emissive: 0xff5a18, emissiveIntensity: 0.9, shininess: 40, specular: 0x552200 }), transparent: true, solid: false }, // 24
    { name: 'サボテン', color: 0x4f8f3a, icon: T.cactus, mats: faceMats(T.cactus), transparent: true }, // 25
    { name: '開いた宝箱', color: 0x9a7038, icon: T.chestOpen, mats: faceMats(T.chestOpen, { shininess: 8, specular: 0x332100 }), transparent: true }, // 26
    { name: '村の看板', color: 0xb5824a, icon: T.villageSign, mats: faceMats(T.villageSign, { shininess: 5, specular: 0x221400 }), transparent: true }, // 27
    { name: '朱の木', color: 0xcf3b1e, icon: T.vermilion, mats: faceMats(T.vermilion, { shininess: 5, specular: 0x331008 }) }, // 28
    { name: '白漆喰', color: 0xeae3d2, icon: T.plaster, mats: faceMats(T.plaster) }, // 29
    { name: '瓦', color: 0x44525c, icon: T.roofTile, mats: faceMats(T.roofTile, { shininess: 14, specular: 0x223344 }) }, // 30
    { name: '金ブロック', color: 0xe6c23a, icon: T.goldBlock, mats: faceMats(T.goldBlock, { shininess: 22, specular: 0x6a5400 }) }, // 31
    { name: '銅瓦', color: 0x4a9e86, icon: T.copperRoof, mats: faceMats(T.copperRoof, { shininess: 12, specular: 0x224433 }) }, // 32
    { name: '青銅', color: 0x6f8472, icon: T.bronze, mats: faceMats(T.bronze, { shininess: 10, specular: 0x2a3a30 }) }, // 33
    { name: '青銅(陰)', color: 0x47554b, icon: T.bronzeDark, mats: faceMats(T.bronzeDark, { shininess: 8, specular: 0x1f2a24 }) }, // 34
    { name: '畳', color: 0x9aa96a, icon: T.tatami, mats: faceMats(T.tatami) }, // 35
    { name: '障子', color: 0xf3ead2, icon: T.shoji, mats: faceMats(T.shoji, { transparent: true, opacity: 0.86, depthWrite: false }), transparent: true }, // 36
    { name: '暖簾', color: 0x284669, icon: T.noren, mats: faceMats(T.noren) }, // 37
    { name: '提灯', color: 0xffc36a, icon: T.paperLantern, mats: faceMats(T.paperLantern, { emissive: 0xff9c44, emissiveIntensity: 0.72, shininess: 12, specular: 0x442000 }), transparent: true }, // 38
    { name: '丸石', color: 0x7d8286, icon: T.cobble, mats: faceMats(T.cobble) }, // 39
    { name: 'ベッド', color: 0xb03030, icon: T.bedTop, mats: faceMats([T.bedSide, T.bedSide, T.bedTop, T.bedSide, T.bedSide, T.bedSide]), transparent: true }, // 40
    { name: '耕地', color: 0x6b4423, icon: T.farmland, mats: faceMats([T.dirt, T.dirt, T.farmland, T.dirt, T.dirt, T.dirt]) }, // 41
    { name: '小麦の苗', color: 0x55a83c, icon: T.wheatYoung, mats: faceMats(T.wheatYoung, { transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.18 }), transparent: true, solid: false }, // 42
    { name: '小麦', color: 0xd8b84a, icon: T.wheatRipe, mats: faceMats(T.wheatRipe, { transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.18 }), transparent: true, solid: false }, // 43
    { name: 'かまど(点火)', color: 0x757a7d, icon: T.furnaceLit, mats: faceMats([T.furnaceSide, T.furnaceSide, T.furnaceTop, T.furnaceTop, T.furnaceLit, T.furnaceSide], { emissive: 0xff6a24, emissiveIntensity: 0.55 }) }, // 44
    { name: 'TNT', color: 0xc0392b, icon: T.tntSide, mats: faceMats([T.tntSide, T.tntSide, T.tntTop, T.tntTop, T.tntSide, T.tntSide]) }, // 45
    { name: '苗木', color: 0x3f8a2e, icon: T.sapling, mats: faceMats(T.sapling, { transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.18 }), transparent: true, solid: false }, // 46
    { name: '鉄ブロック', color: 0xd0d5da, icon: T.ironBlock, mats: faceMats(T.ironBlock, { shininess: 26, specular: 0x6a7076 }) }, // 47
    { name: 'ダイヤブロック', color: 0x66d8e6, icon: T.diamondBlock, mats: faceMats(T.diamondBlock, { shininess: 30, specular: 0x226677 }) }, // 48
    { name: '石炭ブロック', color: 0x26282c, icon: T.coalBlock, mats: faceMats(T.coalBlock) }, // 49
    { name: '木のドア', color: 0xa8743d, icon: T.doorLower, mats: faceMats(T.doorLower, { transparent: true, alphaTest: 0.18 }), transparent: true }, // 50
    { name: '木のドア(上)', color: 0xa8743d, icon: T.doorUpper, mats: faceMats(T.doorUpper, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 51
    { name: '開いた木のドア', color: 0xa8743d, icon: T.doorLower, mats: faceMats(T.doorLower, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 52
    { name: '開いた木のドア(上)', color: 0xa8743d, icon: T.doorUpper, mats: faceMats(T.doorUpper, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 53
    { name: '木のドア', color: 0xa8743d, icon: T.doorLower, mats: faceMats(T.doorLower, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 54
    { name: '木のドア(上)', color: 0xa8743d, icon: T.doorUpper, mats: faceMats(T.doorUpper, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 55
    { name: '開いた木のドア', color: 0xa8743d, icon: T.doorLower, mats: faceMats(T.doorLower, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 56
    { name: '開いた木のドア(上)', color: 0xa8743d, icon: T.doorUpper, mats: faceMats(T.doorUpper, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 57
    { name: '木のトラップドア', color: 0xa8743d, icon: T.trapdoor, mats: faceMats(T.trapdoor, { transparent: true, alphaTest: 0.18 }), transparent: true }, // 58
    { name: '開いた木のトラップドア', color: 0xa8743d, icon: T.trapdoor, mats: faceMats(T.trapdoor, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 59
    { name: '木のフェンス', color: 0xa8743d, icon: T.planks, mats: faceMats(T.planks), transparent: true, collisionHeight: 1.5 }, // 60
    { name: '木のフェンスゲート', color: 0xa8743d, icon: T.planks, mats: faceMats(T.planks), transparent: true, collisionHeight: 1.5 }, // 61
    { name: '開いた木のフェンスゲート', color: 0xa8743d, icon: T.planks, mats: faceMats(T.planks), transparent: true, solid: false, noAutoItem: true }, // 62
    { name: '木のフェンスゲート', color: 0xa8743d, icon: T.planks, mats: faceMats(T.planks), transparent: true, collisionHeight: 1.5, noAutoItem: true }, // 63
    { name: '開いた木のフェンスゲート', color: 0xa8743d, icon: T.planks, mats: faceMats(T.planks), transparent: true, solid: false, noAutoItem: true }, // 64
    { name: '丸石の壁', color: 0x7d8286, icon: T.cobble, mats: faceMats(T.cobble), transparent: true, collisionHeight: 1.5 }, // 65
    { name: '木のドア', color: 0xa8743d, icon: T.doorLower, mats: faceMats(T.doorLower, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 66
    { name: '木のドア(上)', color: 0xa8743d, icon: T.doorUpper, mats: faceMats(T.doorUpper, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 67
    { name: '開いた木のドア', color: 0xa8743d, icon: T.doorLower, mats: faceMats(T.doorLower, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 68
    { name: '開いた木のドア(上)', color: 0xa8743d, icon: T.doorUpper, mats: faceMats(T.doorUpper, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 69
    { name: '木のドア', color: 0xa8743d, icon: T.doorLower, mats: faceMats(T.doorLower, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 70
    { name: '木のドア(上)', color: 0xa8743d, icon: T.doorUpper, mats: faceMats(T.doorUpper, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 71
    { name: '開いた木のドア', color: 0xa8743d, icon: T.doorLower, mats: faceMats(T.doorLower, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 72
    { name: '開いた木のドア(上)', color: 0xa8743d, icon: T.doorUpper, mats: faceMats(T.doorUpper, { transparent: true, alphaTest: 0.18 }), transparent: true, noAutoItem: true }, // 73
  ];
  const GRASS = 0, DIRT = 1, STONE = 2, LOG = 3, LEAVES = 4, SAND = 5, PLANKS = 6, BRICK = 7, GLASS = 8, WATER = 9, SNOW = 10;
  const COAL_ORE = 11, IRON_ORE = 12, GOLD_ORE = 13, DIAMOND_ORE = 14, TORCH = 15;
  const CRAFTING_TABLE = 16, FURNACE = 17;
  const GLOW_CRYSTAL = 18, DRIPSTONE = 19;
  const STONE_BRICK = 20, MOSSY_BRICK = 21, CHEST = 22, LANTERN = 23, LAVA = 24, CACTUS = 25, OPEN_CHEST = 26, VILLAGE_SIGN = 27;
  const VERMILION = 28, PLASTER = 29, ROOF_TILE = 30, GOLD_BLOCK = 31, COPPER_ROOF = 32;
  const BRONZE = 33, BRONZE_DARK = 34;
  const TATAMI = 35, SHOJI = 36, NOREN = 37, PAPER_LANTERN = 38;
  const COBBLESTONE = 39, BED = 40;
  const FARMLAND = 41, WHEAT_YOUNG = 42, WHEAT_RIPE = 43, FURNACE_LIT = 44;
  const TNT = 45, SAPLING = 46;
  const IRON_BLOCK = 47, DIAMOND_BLOCK = 48, COAL_BLOCK = 49;
  const OAK_DOOR_Z_CLOSED = 50, OAK_DOOR_Z_CLOSED_TOP = 51, OAK_DOOR_Z_OPEN = 52, OAK_DOOR_Z_OPEN_TOP = 53;
  const OAK_DOOR_X_CLOSED = 54, OAK_DOOR_X_CLOSED_TOP = 55, OAK_DOOR_X_OPEN = 56, OAK_DOOR_X_OPEN_TOP = 57;
  const OAK_TRAPDOOR_CLOSED = 58, OAK_TRAPDOOR_OPEN = 59;
  const OAK_FENCE = 60, OAK_FENCE_GATE_Z_CLOSED = 61, OAK_FENCE_GATE_Z_OPEN = 62, OAK_FENCE_GATE_X_CLOSED = 63, OAK_FENCE_GATE_X_OPEN = 64;
  const COBBLESTONE_WALL = 65;
  const OAK_DOOR_S_CLOSED = 66, OAK_DOOR_S_CLOSED_TOP = 67, OAK_DOOR_S_OPEN = 68, OAK_DOOR_S_OPEN_TOP = 69;
  const OAK_DOOR_W_CLOSED = 70, OAK_DOOR_W_CLOSED_TOP = 71, OAK_DOOR_W_OPEN = 72, OAK_DOOR_W_OPEN_TOP = 73;

  // 発光ブロックの光レベル（本家準拠）。ライトエンジンが BFS 伝播して頂点カラーへ焼き込む
  TYPES[TORCH].lightLevel = 14;
  TYPES[LANTERN].lightLevel = 15;
  TYPES[PAPER_LANTERN].lightLevel = 14;
  TYPES[GLOW_CRYSTAL].lightLevel = 13;
  TYPES[LAVA].lightLevel = 15;
  TYPES[FURNACE_LIT].lightLevel = 13;

  TYPES[TORCH].model = [
    { box: [0.43, 0.00, 0.43, 0.57, 0.72, 0.57] },
    { box: [0.32, 0.62, 0.32, 0.68, 1.00, 0.68] },
  ];
  TYPES[CHEST].model = [
    { box: [0.0625, 0.00, 0.0625, 0.9375, 0.875, 0.9375] },
  ];
  TYPES[OPEN_CHEST].model = [
    { box: [0.0625, 0.00, 0.0625, 0.9375, 0.625, 0.9375] },
    { box: [0.0625, 0.625, 0.0625, 0.9375, 1.000, 0.2500] },
  ];
  TYPES[LANTERN].model = [
    { box: [0.34, 0.00, 0.34, 0.66, 0.14, 0.66] },
    { box: [0.25, 0.14, 0.25, 0.75, 0.78, 0.75] },
    { box: [0.32, 0.78, 0.32, 0.68, 0.92, 0.68] },
    { box: [0.31, 0.92, 0.45, 0.69, 1.00, 0.55] },
    { box: [0.45, 0.92, 0.31, 0.55, 1.00, 0.69] },
  ];
  TYPES[CACTUS].model = [
    { box: [0.0625, 0.00, 0.0625, 0.9375, 1.000, 0.9375] },
  ];
  TYPES[VILLAGE_SIGN].model = [
    { box: [0.45, 0.00, 0.45, 0.55, 0.48, 0.55] },
    { box: [0.08, 0.48, 0.36, 0.92, 0.86, 0.64] },
  ];
  TYPES[PAPER_LANTERN].model = [
    { box: [0.22, 0.08, 0.22, 0.78, 0.88, 0.78] },
    { box: [0.28, 0.00, 0.28, 0.72, 0.10, 0.72] },
    { box: [0.28, 0.86, 0.28, 0.72, 0.98, 0.72] },
  ];
  TYPES[BED].model = [
    { box: [0.02, 0.18, 0.02, 0.98, 0.56, 0.98] },
    { box: [0.08, 0.00, 0.08, 0.22, 0.18, 0.22] },
    { box: [0.78, 0.00, 0.08, 0.92, 0.18, 0.22] },
    { box: [0.08, 0.00, 0.78, 0.22, 0.18, 0.92] },
    { box: [0.78, 0.00, 0.78, 0.92, 0.18, 0.92] },
  ];
  TYPES[WHEAT_YOUNG].model = [
    { kind: 'cross', y0: 0.00, y1: 0.55, r: 0.42 },
  ];
  TYPES[WHEAT_RIPE].model = [
    { kind: 'cross', y0: 0.00, y1: 0.90, r: 0.46 },
  ];
  TYPES[SAPLING].model = [
    { kind: 'cross', y0: 0.00, y1: 0.82, r: 0.38 },
  ];
  function setDoorShape(lower, upper, box) {
    TYPES[lower].model = [{ box }];
    TYPES[upper].model = [{ box }];
    TYPES[lower].collisionBoxes = [box];
    TYPES[upper].collisionBoxes = [box];
  }
  setDoorShape(OAK_DOOR_Z_CLOSED, OAK_DOOR_Z_CLOSED_TOP, [0.00, 0.00, 0.0000, 1.00, 1.00, 0.1875]);
  setDoorShape(OAK_DOOR_Z_OPEN, OAK_DOOR_Z_OPEN_TOP, [0.0000, 0.00, 0.00, 0.1875, 1.00, 1.00]);
  setDoorShape(OAK_DOOR_X_CLOSED, OAK_DOOR_X_CLOSED_TOP, [0.8125, 0.00, 0.00, 1.00, 1.00, 1.00]);
  setDoorShape(OAK_DOOR_X_OPEN, OAK_DOOR_X_OPEN_TOP, [0.00, 0.00, 0.0000, 1.00, 1.00, 0.1875]);
  setDoorShape(OAK_DOOR_S_CLOSED, OAK_DOOR_S_CLOSED_TOP, [0.00, 0.00, 0.8125, 1.00, 1.00, 1.00]);
  setDoorShape(OAK_DOOR_S_OPEN, OAK_DOOR_S_OPEN_TOP, [0.8125, 0.00, 0.00, 1.00, 1.00, 1.00]);
  setDoorShape(OAK_DOOR_W_CLOSED, OAK_DOOR_W_CLOSED_TOP, [0.0000, 0.00, 0.00, 0.1875, 1.00, 1.00]);
  setDoorShape(OAK_DOOR_W_OPEN, OAK_DOOR_W_OPEN_TOP, [0.00, 0.00, 0.8125, 1.00, 1.00, 1.00]);
  TYPES[OAK_TRAPDOOR_CLOSED].model = [{ box: [0.00, 0.00, 0.00, 1.00, 0.1875, 1.00] }];
  TYPES[OAK_TRAPDOOR_OPEN].model = [{ box: [0.00, 0.00, 0.8125, 1.00, 1.00, 1.00] }];
  TYPES[OAK_FENCE].model = [
    { box: [0.3750, 0.00, 0.3750, 0.6250, 1.50, 0.6250] },
    { box: [0.0000, 0.35, 0.4063, 1.0000, 0.50, 0.5938] },
    { box: [0.0000, 0.75, 0.4063, 1.0000, 0.90, 0.5938] },
    { box: [0.4063, 0.35, 0.0000, 0.5938, 0.50, 1.0000] },
    { box: [0.4063, 0.75, 0.0000, 0.5938, 0.90, 1.0000] },
  ];
  TYPES[OAK_FENCE_GATE_Z_CLOSED].model = [
    { box: [0.0625, 0.00, 0.3750, 0.2500, 1.50, 0.6250] },
    { box: [0.7500, 0.00, 0.3750, 0.9375, 1.50, 0.6250] },
    { box: [0.1875, 0.35, 0.4063, 0.8125, 0.50, 0.5938] },
    { box: [0.1875, 0.75, 0.4063, 0.8125, 0.90, 0.5938] },
  ];
  TYPES[OAK_FENCE_GATE_Z_OPEN].model = [
    { box: [0.0625, 0.00, 0.3750, 0.2500, 1.50, 0.6250] },
    { box: [0.7500, 0.00, 0.3750, 0.9375, 1.50, 0.6250] },
    { box: [0.0625, 0.35, 0.0000, 0.2500, 0.50, 0.6250] },
    { box: [0.0625, 0.75, 0.0000, 0.2500, 0.90, 0.6250] },
    { box: [0.7500, 0.35, 0.3750, 0.9375, 0.50, 1.0000] },
    { box: [0.7500, 0.75, 0.3750, 0.9375, 0.90, 1.0000] },
  ];
  TYPES[OAK_FENCE_GATE_X_CLOSED].model = [
    { box: [0.3750, 0.00, 0.0625, 0.6250, 1.50, 0.2500] },
    { box: [0.3750, 0.00, 0.7500, 0.6250, 1.50, 0.9375] },
    { box: [0.4063, 0.35, 0.1875, 0.5938, 0.50, 0.8125] },
    { box: [0.4063, 0.75, 0.1875, 0.5938, 0.90, 0.8125] },
  ];
  TYPES[OAK_FENCE_GATE_X_OPEN].model = [
    { box: [0.3750, 0.00, 0.0625, 0.6250, 1.50, 0.2500] },
    { box: [0.3750, 0.00, 0.7500, 0.6250, 1.50, 0.9375] },
    { box: [0.0000, 0.35, 0.0625, 0.6250, 0.50, 0.2500] },
    { box: [0.0000, 0.75, 0.0625, 0.6250, 0.90, 0.2500] },
    { box: [0.3750, 0.35, 0.7500, 1.0000, 0.50, 0.9375] },
    { box: [0.3750, 0.75, 0.7500, 1.0000, 0.90, 0.9375] },
  ];
  TYPES[COBBLESTONE_WALL].model = [
    { box: [0.2500, 0.00, 0.2500, 0.7500, 1.00, 0.7500] },
    { box: [0.0000, 0.00, 0.3125, 1.0000, 0.8125, 0.6875] },
    { box: [0.3125, 0.00, 0.0000, 0.6875, 0.8125, 1.0000] },
    { box: [0.3125, 0.8125, 0.3125, 0.6875, 1.0000, 0.6875] },
  ];
