  /* ============== ブロック種別（光を受けるマテリアル） ============== */
  const T = TX;
  function mkMat(map, opt) {
    const nm = (map.userData && map.userData.normalMap) || null;
    const m = new THREE.MeshPhongMaterial({
      map, color: 0xffffff, shininess: opt.shininess ?? 3, specular: new THREE.Color(opt.specular ?? 0x0c0c0c),
      transparent: !!opt.transparent, opacity: opt.opacity ?? 1, depthWrite: opt.depthWrite ?? true,
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
    { name: 'たいまつ', color: 0xffb23a, icon: T.torch, mats: faceMats(T.torch, { emissive: 0xffa324, emissiveIntensity: 0.75, shininess: 16, specular: 0x442200 }) }, // 15
    { name: '作業台', color: 0xb5824a, icon: T.crafting, mats: faceMats(T.crafting) }, // 16
    { name: 'かまど', color: 0x757a7d, icon: T.furnace, mats: faceMats(T.furnace, { emissive: 0x221008, emissiveIntensity: 0.12 }) }, // 17
    { name: '発光結晶', color: 0x6df7ff, icon: T.glowCrystal, mats: faceMats(T.glowCrystal, { emissive: 0x52dfff, emissiveIntensity: 0.92, shininess: 30, specular: 0x66ffff }) }, // 18
    { name: '鍾乳石', color: 0x8b8172, icon: T.dripstone, mats: faceMats(T.dripstone) }, // 19
    { name: '石レンガ', color: 0x868b8f, icon: T.stoneBrick, mats: faceMats(T.stoneBrick) }, // 20
    { name: '苔石レンガ', color: 0x6f8a5a, icon: T.mossyBrick, mats: faceMats(T.mossyBrick) }, // 21
    { name: '宝箱', color: 0xc79a52, icon: T.chest, mats: faceMats(T.chest, { shininess: 8, specular: 0x332100 }) }, // 22
    { name: 'ランタン', color: 0xffc25a, icon: T.lantern, mats: faceMats(T.lantern, { emissive: 0xffb43a, emissiveIntensity: 0.85, shininess: 18, specular: 0x442200 }) }, // 23
    { name: '溶岩', color: 0xff6a1a, icon: T.lava, mats: faceMats(T.lava, { transparent: true, depthWrite: false, opacity: 0.94, emissive: 0xff5a18, emissiveIntensity: 0.9, shininess: 40, specular: 0x552200 }), transparent: true, solid: false }, // 24
    { name: 'サボテン', color: 0x4f8f3a, icon: T.cactus, mats: faceMats(T.cactus) }, // 25
    { name: '開いた宝箱', color: 0x9a7038, icon: T.chestOpen, mats: faceMats(T.chestOpen, { shininess: 8, specular: 0x332100 }) }, // 26
    { name: '村の看板', color: 0xb5824a, icon: T.villageSign, mats: faceMats(T.villageSign, { shininess: 5, specular: 0x221400 }) }, // 27
    { name: '朱の木', color: 0xcf3b1e, icon: T.vermilion, mats: faceMats(T.vermilion, { shininess: 5, specular: 0x331008 }) }, // 28
    { name: '白漆喰', color: 0xeae3d2, icon: T.plaster, mats: faceMats(T.plaster) }, // 29
    { name: '瓦', color: 0x44525c, icon: T.roofTile, mats: faceMats(T.roofTile, { shininess: 14, specular: 0x223344 }) }, // 30
    { name: '金ブロック', color: 0xe6c23a, icon: T.goldBlock, mats: faceMats(T.goldBlock, { shininess: 22, specular: 0x6a5400 }) }, // 31
    { name: '銅瓦', color: 0x4a9e86, icon: T.copperRoof, mats: faceMats(T.copperRoof, { shininess: 12, specular: 0x224433 }) }, // 32
    { name: '青銅', color: 0x6f8472, icon: T.bronze, mats: faceMats(T.bronze, { shininess: 10, specular: 0x2a3a30 }) }, // 33
    { name: '青銅(陰)', color: 0x47554b, icon: T.bronzeDark, mats: faceMats(T.bronzeDark, { shininess: 8, specular: 0x1f2a24 }) }, // 34
  ];
  const GRASS = 0, DIRT = 1, STONE = 2, LOG = 3, LEAVES = 4, SAND = 5, PLANKS = 6, BRICK = 7, GLASS = 8, WATER = 9, SNOW = 10;
  const COAL_ORE = 11, IRON_ORE = 12, GOLD_ORE = 13, DIAMOND_ORE = 14, TORCH = 15;
  const CRAFTING_TABLE = 16, FURNACE = 17;
  const GLOW_CRYSTAL = 18, DRIPSTONE = 19;
  const STONE_BRICK = 20, MOSSY_BRICK = 21, CHEST = 22, LANTERN = 23, LAVA = 24, CACTUS = 25, OPEN_CHEST = 26, VILLAGE_SIGN = 27;
  const VERMILION = 28, PLASTER = 29, ROOF_TILE = 30, GOLD_BLOCK = 31, COPPER_ROOF = 32;
  const BRONZE = 33, BRONZE_DARK = 34;
  const HOTBAR = [0, 1, 2, 10, 5, 3, 4, 6, 8, TORCH, CRAFTING_TABLE, FURNACE]; // 草 土 石 雪 砂 丸太 葉 板材 ガラス たいまつ 作業台 かまど
