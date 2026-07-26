  /* ============== ボクセルレイキャスト / 採掘 / 設置 / ブロックインタラクション ============== */
  const mod = (a, n) => ((a % n) + n) % n;
  function intbound(s, ds) { if (ds < 0) return intbound(-s, -ds); return (1 - mod(s, 1)) / ds; }
  function pickTarget() {
    const o = camera.position, dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    let tx = intbound(o.x, dir.x), ty = intbound(o.y, dir.y), tz = intbound(o.z, dir.z);
    const dx = sx !== 0 ? 1 / Math.abs(dir.x) : Infinity, dy = sy !== 0 ? 1 / Math.abs(dir.y) : Infinity, dz = sz !== 0 ? 1 / Math.abs(dir.z) : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 256 && t <= REACH; i++) {
      // hit = 面に当たった座標。ドアのヒンジ左右など「ブロックのどちら側をクリックしたか」に使う
      if (isTargetableBlock(x, y, z)) return { block: [x, y, z], normal: [nx, ny, nz], hit: [o.x + dir.x * t, o.y + dir.y * t, o.z + dir.z * t] };
      if (tx < ty) { if (tx < tz) { x += sx; t = tx; tx += dx; nx = -sx; ny = 0; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
      else { if (ty < tz) { y += sy; t = ty; ty += dy; nx = 0; ny = -sy; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
    }
    return null;
  }
  // バケツ用: 手前の水/溶岩ブロックを拾う（非solidなので通常のpickTargetでは当たらない）
  function pickLiquidTarget() {
    const o = camera.position, dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    let tx = intbound(o.x, dir.x), ty = intbound(o.y, dir.y), tz = intbound(o.z, dir.z);
    const dx = sx !== 0 ? 1 / Math.abs(dir.x) : Infinity, dy = sy !== 0 ? 1 / Math.abs(dir.y) : Infinity, dz = sz !== 0 ? 1 / Math.abs(dir.z) : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 256 && t <= REACH; i++) {
      const bt = blockAt(x, y, z);
      if (bt === WATER || bt === LAVA) return { block: [x, y, z], type: bt, normal: [nx, ny, nz] };
      if (bt !== undefined && TYPES[bt].solid !== false) return null;  // 液体より手前に固体があれば汲めない
      if (tx < ty) { if (tx < tz) { x += sx; t = tx; tx += dx; nx = -sx; ny = 0; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
      else { if (ty < tz) { y += sy; t = ty; ty += dy; nx = 0; ny = -sy; nz = 0; } else { z += sz; t = tz; tz += dz; nx = 0; ny = 0; nz = -sz; } }
    }
    return null;
  }
  function isTargetableBlock(x, y, z) {
    const type = blockAt(x, y, z);
    return type !== undefined && (TYPES[type].solid !== false || isInteractableBlock(type));
  }

  // DOOR_INFO / DOOR_IDS は 22-block-types.js で定義（32IDバリアント）
  function isDoorBlock(type) { return DOOR_INFO.has(type); }
  function doorTypes(facing, hinge, open) { return DOOR_IDS[facing][hinge][open ? 1 : 0]; }
  function doorPairAt(x, y, z, type = blockAt(x, y, z)) {
    const info = DOOR_INFO.get(type);
    if (!info) return null;
    const by = info.top ? y - 1 : y;
    const bottomType = blockAt(x, by, z);
    const bottomInfo = DOOR_INFO.get(bottomType);
    if (!bottomInfo || bottomInfo.top) return null;
    return { x, y: by, z, info: bottomInfo };
  }
  // 本家同様、ドアの向きはクリックした面ではなくプレイヤーの視線方向で決まる。
  // facing はパネルが接する面（=プレイヤー側の手前の面）なので視線の逆向きになる
  function playerDoorFacing() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    if (Math.abs(dir.x) > Math.abs(dir.z)) return dir.x > 0 ? 3 : 1; // 東を向く→w(-x)側 / 西→e(+x)側
    return dir.z > 0 ? 0 : 2;                                        // 南を向く→n(-z)側 / 北→s(+z)側
  }
  // facing ごとの「設置者から見て左」方向（dx, dz）
  const DOOR_LEFT_OFF = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  // 本家準拠: 隣に同じ向きのドアがあれば反対側のヒンジ（＝観音開きになる）、
  // なければクリックしたのが左半分か右半分かで決める
  function chooseDoorHinge(x, y, z, facing, hit) {
    const [lx, lz] = DOOR_LEFT_OFF[facing];
    const leftInfo = DOOR_INFO.get(blockAt(x + lx, y, z + lz));
    if (leftInfo && !leftInfo.top && leftInfo.facing === facing) return 0;
    const rightInfo = DOOR_INFO.get(blockAt(x - lx, y, z - lz));
    if (rightInfo && !rightInfo.top && rightInfo.facing === facing) return 1;
    if (!hit) return 0;
    const fx = Math.min(1, Math.max(0, hit[0] - x)), fz = Math.min(1, Math.max(0, hit[2] - z));
    const along = lx !== 0 ? (lx > 0 ? fx : 1 - fx) : (lz > 0 ? fz : 1 - fz);
    return along > 0.5 ? 1 : 0;
  }
  // 隣に同じ向きのドアが並んだら、双方のヒンジを外側へ揃えて観音開きにする。
  // （本家は後から置いた側しか合わせないので、内側ヒンジ同士だと内開きのままになる）
  // 設置時に加えて開閉時にも呼ぶので、この対応より前に置いた古いドアも使えば直る。
  function alignDoubleDoor(x, y, z, facing) {
    const [lx, lz] = DOOR_LEFT_OFF[facing];
    // 相手が自分の左にいるなら 自分=右ヒンジ/相手=左ヒンジ。右にいればその逆
    for (const [ox, oz, myHinge, itsHinge] of [[lx, lz, 0, 1], [-lx, -lz, 1, 0]]) {
      const nx = x + ox, nz = z + oz;
      const its = DOOR_INFO.get(blockAt(nx, y, nz));
      if (!its || its.top || its.facing !== facing) continue;
      if (its.hinge !== itsHinge) setDoorPair(nx, y, nz, ...DOOR_IDS[facing][itsHinge][its.open ? 1 : 0]);
      const mine = DOOR_INFO.get(blockAt(x, y, z));
      if (mine && !mine.top && mine.hinge !== myHinge) setDoorPair(x, y, z, ...DOOR_IDS[facing][myHinge][mine.open ? 1 : 0]);
      break; // 3枚以上並んでいる場合は左隣とのペアを優先する
    }
  }
  function setDoorPair(x, y, z, lower, upper) {
    const lowerId = key(x, y, z), upperId = key(x, y + 1, z);
    setEdit(lowerId, lower); setEdit(upperId, upper); saveEditsSoon();
    setBlock(x, y, z, lower); setBlock(x, y + 1, z, upper);
    requestEditedBlockRebuild(x, y, z); requestEditedBlockRebuild(x, y + 1, z);
  }
  function toggleDoorAt(x, y, z, type) {
    const pair = doorPairAt(x, y, z, type);
    if (!pair) return false;
    const [lower, upper] = doorTypes(pair.info.facing, pair.info.hinge, !pair.info.open);
    setDoorPair(pair.x, pair.y, pair.z, lower, upper);
    alignDoubleDoor(pair.x, pair.y, pair.z, pair.info.facing);
    thock(pair.info.open ? 180 : 260);
    if (typeof setDebugToast === 'function') setDebugToast(pair.info.open ? 'ドアを閉めた' : 'ドアを開けた', 1.0);
    return true;
  }
  function removeDoorPairAt(x, y, z, type) {
    const pair = doorPairAt(x, y, z, type);
    if (!pair) return false;
    setEdit(key(pair.x, pair.y, pair.z), -1);
    setEdit(key(pair.x, pair.y + 1, pair.z), -1);
    saveEditsSoon();
    setBlock(pair.x, pair.y, pair.z, null);
    setBlock(pair.x, pair.y + 1, pair.z, null);
    requestEditedBlockRebuild(pair.x, pair.y, pair.z);
    requestEditedBlockRebuild(pair.x, pair.y + 1, pair.z);
    return true;
  }
  function placeDoorFromTarget(tg) {
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    if (y < CHUNK_Y_MIN || y + 1 > CHUNK_Y_MAX) return false;
    if (isPlacementBlocked(x, y, z) || isPlacementBlocked(x, y + 1, z) || overlapsPlayer(x, y, z) || overlapsPlayer(x, y + 1, z)) return false;
    const facing = playerDoorFacing();
    const hinge = chooseDoorHinge(x, y, z, facing, tg.hit);
    const [lower, upper] = doorTypes(facing, hinge, false);
    const s = selectedItem();
    if (!s) return false;
    s.n -= 1;
    if (s.n <= 0) INV[selected] = null;
    invChanged();
    setDoorPair(x, y, z, lower, upper);
    alignDoubleDoor(x, y, z, facing);
    thock(260);
    if (typeof progressEvent === 'function') progressEvent('place', 'oak_door');
    return true;
  }
  /* ---- ベッド: 足元＋枕元の2ブロック（BED_INFO / BED_IDS は 22-block-types.js） ---- */
  // 旧1ブロック版(ID 40)も引き続きベッドとして扱う
  function isBedBlock(type) { return type === BED || BED_INFO.has(type); }
  // 足元セルに正規化する。旧版は自分自身が足元
  function bedPairAt(x, y, z, type = blockAt(x, y, z)) {
    if (type === BED) return { x, y, z, facing: null, legacy: true };
    const info = BED_INFO.get(type);
    if (!info) return null;
    if (!info.head) return { x, y, z, facing: info.facing, legacy: false };
    const [dx, dz] = BED_DIR[info.facing];
    const fx = x - dx, fz = z - dz;
    const footInfo = BED_INFO.get(blockAt(fx, y, fz));
    if (!footInfo || footInfo.head || footInfo.facing !== info.facing) return null;
    return { x: fx, y, z: fz, facing: info.facing, legacy: false };
  }
  function placeBedFromTarget(tg) {
    if (tg.normal[1] !== 1) return false; // 本家同様、上向きの面にしか置けない
    const fx = tg.block[0], fy = tg.block[1] + 1, fz = tg.block[2];
    const facing = playerDoorFacing() ^ 2; // 視線の向き（facing の逆が playerDoorFacing なので反転）
    const [dx, dz] = BED_DIR[facing];
    const hx = fx + dx, hz = fz + dz;
    if (fy > CHUNK_Y_MAX) return false;
    if (isPlacementBlocked(fx, fy, fz) || isPlacementBlocked(hx, fy, hz)) return false;
    if (overlapsPlayer(fx, fy, fz) || overlapsPlayer(hx, fy, hz)) return false;
    if (!isSolid(hx, fy - 1, hz)) return false; // 枕元側にも土台が要る
    const s = selectedItem();
    if (!s) return false;
    s.n -= 1;
    if (s.n <= 0) INV[selected] = null;
    invChanged();
    const [footId, headId] = BED_IDS[facing];
    setEdit(key(fx, fy, fz), footId); setEdit(key(hx, fy, hz), headId); saveEditsSoon();
    setBlock(fx, fy, fz, footId); setBlock(hx, fy, hz, headId);
    requestEditedBlockRebuild(fx, fy, fz); requestEditedBlockRebuild(hx, fy, hz);
    thock(240);
    if (typeof progressEvent === 'function') progressEvent('place', 'bed');
    return true;
  }
  function removeBedPairAt(x, y, z, type) {
    const pair = bedPairAt(x, y, z, type);
    if (!pair) return false;
    const cells = [[pair.x, pair.y, pair.z]];
    if (!pair.legacy) {
      const [dx, dz] = BED_DIR[pair.facing];
      cells.push([pair.x + dx, pair.y, pair.z + dz]);
    }
    for (const [cx, cy, cz] of cells) {
      setEdit(key(cx, cy, cz), -1);
      setBlock(cx, cy, cz, null);
      requestEditedBlockRebuild(cx, cy, cz);
    }
    saveEditsSoon();
    return true;
  }
  /* ---- 壁掛け松明: 壁面をクリックしたら斜めに張り付く版を置く ---- */
  function isWallTorch(type) { return type >= TORCH_WALL && type < TORCH_WALL + 4; }
  const TORCH_WALL_INDEX = { '0,0,-1': 0, '1,0,0': 1, '0,0,1': 2, '-1,0,0': 3 };
  function placeWallTorchFromTarget(tg) {
    const idx = TORCH_WALL_INDEX[tg.normal.join(',')];
    if (idx === undefined) return false;
    if (!isSolid(tg.block[0], tg.block[1], tg.block[2])) return false; // 支えになる壁が要る
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX || isPlacementBlocked(x, y, z)) return false;
    const s = selectedItem();
    if (!s) return false;
    s.n -= 1;
    if (s.n <= 0) INV[selected] = null;
    invChanged();
    const type = TORCH_WALL + idx;
    setEdit(key(x, y, z), type); saveEditsSoon();
    setBlock(x, y, z, type); requestEditedBlockRebuild(x, y, z);
    thock(240);
    if (typeof progressEvent === 'function') progressEvent('place', 'torch');
    return true;
  }
  function isTrapdoorBlock(type) { return type === OAK_TRAPDOOR_CLOSED || type === OAK_TRAPDOOR_OPEN; }
  function toggleTrapdoorAt(x, y, z, type) {
    if (!isTrapdoorBlock(type)) return false;
    const next = type === OAK_TRAPDOOR_CLOSED ? OAK_TRAPDOOR_OPEN : OAK_TRAPDOOR_CLOSED;
    const id = key(x, y, z);
    setEdit(id, next); saveEditsSoon();
    setBlock(x, y, z, next);
    requestEditedBlockRebuild(x, y, z);
    thock(type === OAK_TRAPDOOR_CLOSED ? 230 : 170);
    if (typeof setDebugToast === 'function') setDebugToast(type === OAK_TRAPDOOR_CLOSED ? 'トラップドアを開けた' : 'トラップドアを閉めた', 1.0);
    return true;
  }
  const FENCE_GATE_INFO = new Map([
    [OAK_FENCE_GATE_Z_CLOSED, { axis: 'z', open: false }],
    [OAK_FENCE_GATE_Z_OPEN, { axis: 'z', open: true }],
    [OAK_FENCE_GATE_X_CLOSED, { axis: 'x', open: false }],
    [OAK_FENCE_GATE_X_OPEN, { axis: 'x', open: true }],
  ]);
  function isFenceGateBlock(type) { return FENCE_GATE_INFO.has(type); }
  function fenceGateType(axis, open) {
    if (axis === 'x') return open ? OAK_FENCE_GATE_X_OPEN : OAK_FENCE_GATE_X_CLOSED;
    return open ? OAK_FENCE_GATE_Z_OPEN : OAK_FENCE_GATE_Z_CLOSED;
  }
  function chooseFenceGateBaseType(normal) {
    if (Math.abs(normal[0]) > 0) return OAK_FENCE_GATE_X_CLOSED;
    if (Math.abs(normal[2]) > 0) return OAK_FENCE_GATE_Z_CLOSED;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    return Math.abs(dir.x) > Math.abs(dir.z) ? OAK_FENCE_GATE_X_CLOSED : OAK_FENCE_GATE_Z_CLOSED;
  }
  function toggleFenceGateAt(x, y, z, type) {
    const info = FENCE_GATE_INFO.get(type);
    if (!info) return false;
    const next = fenceGateType(info.axis, !info.open);
    const id = key(x, y, z);
    setEdit(id, next); saveEditsSoon();
    setBlock(x, y, z, next);
    requestEditedBlockRebuild(x, y, z);
    thock(info.open ? 180 : 260);
    if (typeof setDebugToast === 'function') setDebugToast(info.open ? 'フェンスゲートを閉めた' : 'フェンスゲートを開けた', 1.0);
    return true;
  }
  function placeFenceGateFromTarget(tg) {
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    const type = chooseFenceGateBaseType(tg.normal);
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return false;
    if (isPlacementBlocked(x, y, z) || overlapsPlayer(x, y, z, type)) return false;
    const s = selectedItem();
    if (!s) return false;
    s.n -= 1;
    if (s.n <= 0) INV[selected] = null;
    invChanged();
    setEdit(key(x, y, z), type); saveEditsSoon();
    setBlock(x, y, z, type);
    requestEditedBlockRebuild(x, y, z);
    thock(260);
    if (typeof progressEvent === 'function') progressEvent('place', 'oak_fence_gate');
    return true;
  }
  /* --- 階段/ハーフブロックの設置（IDバリアント方式。ドアと同じ流儀） --- */
  const isStairsBlock = (type) => type >= OAK_STAIRS && type < OAK_STAIRS + 12;
  const isSlabBlock = (type) => type >= OAK_SLAB && type < OAK_SLAB + 6;
  const isLadderBlock = (type) => type >= LADDER && type < LADDER + 4;
  const isSignBlock = (type) => type >= SIGN && type < SIGN + 4;
  // プレイヤーの視線の水平方位（0=-z 1=+x 2=+z 3=-x）。階段は「向いている方向の奥が高くなる」
  function horizontalFacingIndex() {
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    return Math.abs(d.x) > Math.abs(d.z) ? (d.x > 0 ? 1 : 3) : (d.z > 0 ? 2 : 0);
  }
  function consumeSelectedAndPlace(x, y, z, type) {
    const s = selectedItem(); if (!s) return false;
    s.n -= 1; if (s.n <= 0) INV[selected] = null; invChanged();
    setEdit(key(x, y, z), type); saveEditsSoon(); setBlock(x, y, z, type); requestEditedBlockRebuild(x, y, z, type);
    if (typeof displaceLiquidAt === 'function') displaceLiquidAt(x, y, z); // 液体を塞いだら下流を枯らす
    thock(260);
    if (typeof progressEvent === 'function') progressEvent('place', ITEM_FOR_BLOCK[type]);
    return true;
  }
  function placeStairsFromTarget(tg, def) {
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return false;
    const type = def.block + horizontalFacingIndex();
    if (isPlacementBlocked(x, y, z) || overlapsPlayer(x, y, z, type)) return false;
    return consumeSelectedAndPlace(x, y, z, type);
  }
  function placeSlabFromTarget(tg, def) {
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return false;
    let top;
    if (tg.normal[1] === 1) top = false;        // 上面クリック → 下付き
    else if (tg.normal[1] === -1) top = true;   // 下面クリック → 上付き
    else {
      // 側面クリック: 視線とクリック面の交点の高さで上下を決める（本家の挙動）
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const useX = tg.normal[0] !== 0;
      const plane = (useX ? tg.block[0] : tg.block[2]) + ((useX ? tg.normal[0] : tg.normal[2]) > 0 ? 1 : 0);
      const o = useX ? player.pos.x : player.pos.z;
      const dv = useX ? dir.x : dir.z;
      let frac = 0.5;
      if (Math.abs(dv) > 1e-6) frac = (player.pos.y + dir.y * ((plane - o) / dv)) - y;
      top = frac >= 0.5;
    }
    const type = def.block + (top ? 1 : 0);
    if (isPlacementBlocked(x, y, z) || overlapsPlayer(x, y, z, type)) return false;
    return consumeSelectedAndPlace(x, y, z, type);
  }

  // はしごは「背面が不透明フルブロックの側面」にのみ設置できる。向きは設置面normalで決まる。
  function isOpaqueFullBlock(x, y, z) {
    const t = blockAt(x, y, z);
    return t !== undefined && TYPES[t].solid !== false && !TYPES[t].transparent && !TYPES[t].model;
  }
  function ladderFacingFromNormal(n) {
    if (n[2] === -1) return 0; // -z
    if (n[0] === 1) return 1;  // +x
    if (n[2] === 1) return 2;  // +z
    return 3;                  // -x
  }
  function placeLadderFromTarget(tg) {
    if (tg.normal[1] !== 0) return false;                        // 側面クリックのみ
    if (!isOpaqueFullBlock(tg.block[0], tg.block[1], tg.block[2])) return false; // 背面が不透明フルブロック必須
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return false;
    const type = LADDER + ladderFacingFromNormal(tg.normal);
    if (isPlacementBlocked(x, y, z) || overlapsPlayer(x, y, z, type)) return false;
    return consumeSelectedAndPlace(x, y, z, type);
  }
  // 立て看板: ブロックの上面クリックのみ。向きは視線方位。設置直後に編集ダイアログを開く。
  function placeSignFromTarget(tg) {
    if (tg.normal[1] !== 1) return false;
    const x = tg.block[0], y = tg.block[1] + 1, z = tg.block[2];
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return false;
    const type = SIGN + horizontalFacingIndex();
    if (isPlacementBlocked(x, y, z) || overlapsPlayer(x, y, z, type)) return false;
    if (!consumeSelectedAndPlace(x, y, z, type)) return false;
    if (typeof openSignEditor === 'function') openSignEditor(x, y, z);
    return true;
  }

  function isInteractableBlock(type) {
    return isDoorBlock(type) || isTrapdoorBlock(type) || isFenceGateBlock(type);
  }
  function isPlacementBlocked(x, y, z) {
    const type = blockAt(x, y, z);
    return type !== undefined && (TYPES[type].solid !== false || isInteractableBlock(type));
  }

  /* --- ブロックごとの適正ツール / 硬さ / 必要ツールレベル --- */
  function blockPreferredTool(type) {
    if (isStairsBlock(type)) return (type < OAK_STAIRS + 4) ? 'axe' : 'pickaxe';       // 木=斧 / 石系=ツルハシ
    if (isSlabBlock(type)) return (type < OAK_SLAB + 2) ? 'axe' : 'pickaxe';
    if ([STONE, DEEPSLATE, COBBLESTONE, COBBLESTONE_WALL, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, REDSTONE_ORE, BRICK, FURNACE, FURNACE_LIT, GLOW_CRYSTAL, DRIPSTONE, STONE_BRICK, MOSSY_BRICK, PLASTER, ROOF_TILE, GOLD_BLOCK, COPPER_ROOF, BRONZE, BRONZE_DARK, IRON_BLOCK, DIAMOND_BLOCK, COAL_BLOCK, OBSIDIAN, STONE_BUTTON_OFF, STONE_BUTTON_ON, STONE_PLATE_OFF, STONE_PLATE_ON].includes(type)) return 'pickaxe';
    if (isDoorBlock(type) || isTrapdoorBlock(type) || isFenceGateBlock(type) || isBedBlock(type) || type === OAK_FENCE) return 'axe';
    if (isLadderBlock(type) || isSignBlock(type) || type === BOOKSHELF) return 'axe';
    if (type === ENCHANT_TABLE || type === ANVIL) return 'pickaxe';
    if ([LOG, PLANKS, CRAFTING_TABLE, CHEST, OPEN_CHEST, BED, CACTUS, VILLAGE_SIGN, VERMILION, TATAMI, SHOJI, NOREN, PAPER_LANTERN, OAK_DOOR_Z_CLOSED, OAK_DOOR_Z_CLOSED_TOP, OAK_DOOR_Z_OPEN, OAK_DOOR_Z_OPEN_TOP, OAK_DOOR_X_CLOSED, OAK_DOOR_X_CLOSED_TOP, OAK_DOOR_X_OPEN, OAK_DOOR_X_OPEN_TOP, OAK_TRAPDOOR_CLOSED, OAK_TRAPDOOR_OPEN, OAK_FENCE, OAK_FENCE_GATE_Z_CLOSED, OAK_FENCE_GATE_Z_OPEN, OAK_FENCE_GATE_X_CLOSED, OAK_FENCE_GATE_X_OPEN].includes(type)) return 'axe';
    if ([DIRT, GRASS, SAND, SNOW, FARMLAND, GRAVEL].includes(type)) return 'shovel';
    return null;
  }
  const BLOCK_HARDNESS = new Map([
    [LEAVES, 0.25], [TORCH, 0.1], [SNOW, 0.22], [DIRT, 0.6], [GRASS, 0.7], [SAND, 0.55],
    [LOG, 2.2], [PLANKS, 1.8], [CRAFTING_TABLE, 1.8], [BED, 0.9], [FARMLAND, 0.6],
    [STONE, 2.4], [DEEPSLATE, 4.8], [COBBLESTONE, 2.6], [BRICK, 2.8], [FURNACE, 3.0], [FURNACE_LIT, 3.0],
    [COAL_ORE, 3.0], [IRON_ORE, 3.4], [GOLD_ORE, 3.4], [DIAMOND_ORE, 4.0],
    [GLASS, 0.4], [GLOW_CRYSTAL, 1.2], [DRIPSTONE, 1.0],
    [STONE_BRICK, 2.6], [MOSSY_BRICK, 2.4], [CHEST, 1.8], [OPEN_CHEST, 1.4], [LANTERN, 0.4], [CACTUS, 0.5], [VILLAGE_SIGN, 0.7],
    [VERMILION, 1.4], [PLASTER, 1.4], [ROOF_TILE, 2.2], [GOLD_BLOCK, 2.6], [COPPER_ROOF, 2.2],
    [TATAMI, 0.7], [SHOJI, 0.4], [NOREN, 0.35], [PAPER_LANTERN, 0.3],
    [BRONZE, 2.4], [BRONZE_DARK, 2.4],
    [IRON_BLOCK, 3.0], [DIAMOND_BLOCK, 3.4], [COAL_BLOCK, 3.0],
    [OAK_DOOR_Z_CLOSED, 1.0], [OAK_DOOR_Z_CLOSED_TOP, 1.0], [OAK_DOOR_Z_OPEN, 1.0], [OAK_DOOR_Z_OPEN_TOP, 1.0],
    [OAK_DOOR_X_CLOSED, 1.0], [OAK_DOOR_X_CLOSED_TOP, 1.0], [OAK_DOOR_X_OPEN, 1.0], [OAK_DOOR_X_OPEN_TOP, 1.0],
    [OAK_TRAPDOOR_CLOSED, 0.9], [OAK_TRAPDOOR_OPEN, 0.9],
    [OAK_FENCE, 1.0], [OAK_FENCE_GATE_Z_CLOSED, 1.0], [OAK_FENCE_GATE_Z_OPEN, 1.0], [OAK_FENCE_GATE_X_CLOSED, 1.0], [OAK_FENCE_GATE_X_OPEN, 1.0],
    [COBBLESTONE_WALL, 2.6],
  ]);
  // 階段/ハーフブロックの硬さは元素材と同じ
  for (let i = 0; i < 4; i++) {
    BLOCK_HARDNESS.set(OAK_STAIRS + i, 1.8);
    BLOCK_HARDNESS.set(OAK_STAIRS + 4 + i, 2.6);
    BLOCK_HARDNESS.set(OAK_STAIRS + 8 + i, 2.6);
  }
  for (let i = 0; i < 2; i++) {
    BLOCK_HARDNESS.set(OAK_SLAB + i, 1.8);
    BLOCK_HARDNESS.set(OAK_SLAB + 2 + i, 2.6);
    BLOCK_HARDNESS.set(OAK_SLAB + 4 + i, 2.6);
  }
  for (let i = 0; i < 4; i++) { BLOCK_HARDNESS.set(LADDER + i, 0.4); BLOCK_HARDNESS.set(SIGN + i, 1.0); }
  BLOCK_HARDNESS.set(GLASS_PANE, 0.3);
  BLOCK_HARDNESS.set(GRAVEL, 0.6);
  BLOCK_HARDNESS.set(ENCHANT_TABLE, 5.0);
  BLOCK_HARDNESS.set(ANVIL, 5.0);
  BLOCK_HARDNESS.set(BOOKSHELF, 1.5);
  BLOCK_HARDNESS.set(OBSIDIAN, 50); // 本家準拠。ダイヤツルハシで約9.4秒
  // レッドストーン
  BLOCK_HARDNESS.set(REDSTONE_ORE, 3.4);
  BLOCK_HARDNESS.set(REDSTONE_WIRE, 0.05);
  for (const t of TORCH_WALL_IDS) BLOCK_HARDNESS.set(t, 0.1);
  BLOCK_HARDNESS.set(REDSTONE_TORCH, 0.1); BLOCK_HARDNESS.set(REDSTONE_TORCH_OFF, 0.1);
  BLOCK_HARDNESS.set(LEVER_OFF, 0.5); BLOCK_HARDNESS.set(LEVER_ON, 0.5);
  BLOCK_HARDNESS.set(STONE_BUTTON_OFF, 0.5); BLOCK_HARDNESS.set(STONE_BUTTON_ON, 0.5);
  BLOCK_HARDNESS.set(STONE_PLATE_OFF, 0.5); BLOCK_HARDNESS.set(STONE_PLATE_ON, 0.5);
  BLOCK_HARDNESS.set(WOOD_PLATE_OFF, 0.5); BLOCK_HARDNESS.set(WOOD_PLATE_ON, 0.5);
  BLOCK_HARDNESS.set(REDSTONE_LAMP_OFF, 0.8); BLOCK_HARDNESS.set(REDSTONE_LAMP_ON, 0.8);
  // 掘ってもドロップしない（必要ツールレベル未満）判定。tier: 1木 2石 3鉄 4ダイヤ
  // 採掘で出るXP（本家準拠）。鉄/金鉱石は採掘では0で、精錬時に入る
  const ORE_XP = {
    [COAL_ORE]: [1, 2],
    [DIAMOND_ORE]: [3, 7],
    [REDSTONE_ORE]: [1, 5],
  };
  function requiredToolTier(type) {
    if ([IRON_ORE, IRON_BLOCK].includes(type)) return 2;            // 鉄鉱石/鉄ブロック: 石ツルハシ以上
    if (type === OBSIDIAN) return 4;                                // 黒曜石: ダイヤツルハシ必須
    if ([GOLD_ORE, DIAMOND_ORE, GOLD_BLOCK, DIAMOND_BLOCK, REDSTONE_ORE].includes(type)) return 3; // 金/ダイヤ/RS鉱石・ブロック: 鉄ツルハシ以上
    if (blockPreferredTool(type) === 'pickaxe') return 1;           // 石系: 何かしらのツルハシが必要
    return 0;
  }
  function heldToolInfo() {
    const s = selectedItem();
    const d = s ? ITEM_DEFS[s.id] : null;
    if (!d || !d.tool || d.tool === 'sword') return null;
    return { id: s.id, tool: d.tool, tier: d.tier, speed: d.speed, item: s };
  }
  // 破壊にかかる秒数。適正ツールを持っていると速い。岩盤(unbreakable)は無限＝ゲージが進まない。
  function miningTime(type) {
    if (TYPES[type] && TYPES[type].unbreakable) return Infinity;
    const base = isDoorBlock(type) ? 1.0 : (isBedBlock(type) ? 0.9 : (BLOCK_HARDNESS.get(type) || 1.2));
    const tool = blockPreferredTool(type);
    if (!tool) return Math.min(base, 1.2);
    const held = heldToolInfo();
    if (!held || held.tool !== tool) {
      // ツルハシ必須ブロックを素手で掘ると非常に遅い
      return requiredToolTier(type) >= 1 ? base * 2.4 : base * 1.6;
    }
    // speed 指定があればそれを使う（金ツールは tier1 だが採掘は最速）
    // 効率N: 採掘速度に N^2+1 を加算（C11）
    const sp = (held.speed || { 1: 2.2, 2: 4.0, 3: 6.5, 4: 9.0 }[held.tier] || 2.0) + enchMiningBonus(held.item);
    return base / sp;
  }
  // ブロック -> ドロップするアイテム（[id, n] の配列）
  function blockDrops(type) {
    if (isDoorBlock(type)) return [['oak_door', 1]];
    if (isBedBlock(type)) return [['bed', 1]];   // 2ブロックでもアイテムは1個
    if (type === GRAVEL) return Math.random() < 0.1 ? [['flint', 1]] : [['gravel', 1]]; // 本家準拠: 10%で火打石
    if (type === BOOKSHELF) return [['book', 3]]; // 本家準拠: 板材は返らない
    if (isTrapdoorBlock(type)) return [['oak_trapdoor', 1]];
    if (isFenceGateBlock(type)) return [['oak_fence_gate', 1]];
    if (type === STONE) return [['cobblestone', 1]];
    if (type === COAL_ORE) return [['coal', 1]];
    if (type === IRON_ORE) return [['raw_iron', 1]];
    if (type === GOLD_ORE) return [['raw_gold', 1]];
    if (type === DIAMOND_ORE) return [['diamond', 1]];
    if (type === REDSTONE_ORE) return [['redstone_dust', 4 + (Math.random() < 0.5 ? 1 : 0)]]; // 本家準拠: ダスト4-5
    if (type === REDSTONE_WIRE) return [['redstone_dust', 1]];
    if (type === GLOW_CRYSTAL) return [['glow_shard', 1]];
    if (type === OPEN_CHEST || type === VILLAGE_SIGN) return [['planks', 1]];
    if (type === GLASS_PANE) return []; // 本家同様ガラス板はドロップなし
    if (type === FARMLAND || type === FURNACE_LIT) return [[type === FARMLAND ? 'dirt' : 'furnace', 1]];
    if (type === GRASS) {
      const out = [['dirt', 1]];
      if (Math.random() < 0.15) out.push(['fiber', 1]);
      if (Math.random() < 0.22) out.push(['wheat_seeds', 1]);
      return out;
    }
    if (type === LEAVES) {
      const out = [];
      if (Math.random() < 0.3) out.push(['stick', 1]);
      if (Math.random() < 0.14) out.push(['fiber', 1]);
      if (Math.random() < 0.08) out.push(['apple', 1]);
      if (Math.random() < 0.10) out.push(['berries', 1]);
      if (Math.random() < 0.10) out.push(['sapling', 1]);
      return out;
    }
    const id = ITEM_FOR_BLOCK[type];
    return id ? [[id, 1]] : [];
  }

  /* --- 採掘 --- */
  const breakMeter = document.createElement('div');
  breakMeter.id = 'breakMeter';
  breakMeter.innerHTML = '<span></span>';
  document.body.appendChild(breakMeter);
  const MINING = { active: false, id: '', progress: 0, tap: 0 };
  function resetMining() {
    MINING.active = false; MINING.id = ''; MINING.progress = 0; MINING.tap = 0;
    breakMeter.classList.remove('show');
    breakMeter.querySelector('span').style.width = '0%';
  }
  function finishBreak(tg) {
    const [x, y, z] = tg.block; const t = blockAt(x, y, z); if (t === undefined) return;
    if (TYPES[t].unbreakable) return; // 岩盤はどの経路でも壊せない
    burst(x, y, z, TYPES[t].color);
    const tool = blockPreferredTool(t);
    const held = heldToolInfo();
    const needTier = requiredToolTier(t);
    const hasProperTool = held && held.tool === tool && held.tier >= needTier;
    const id = key(x, y, z);
    // 中身持ちブロックの後始末
    if (t === CHEST) { rollWorldChestLoot(id); spillChest(id); delete SAVE.chestSeen[id]; markSaveDirty(); }
    if (t === FURNACE || t === FURNACE_LIT) spillFurnace(id);
    // ベッドを壊したらリスポーン地点を解除（2ブロック版はどちらの半分でも足元セルと照合する）
    if (isBedBlock(t) && SAVE.spawn) {
      const p = bedPairAt(x, y, z, t);
      if (p && SAVE.spawn.x === p.x && SAVE.spawn.y === p.y && SAVE.spawn.z === p.z) { SAVE.spawn = null; markSaveDirty(); }
    }
    // 耕地を壊したら上の作物も一緒に撤去する
    if (t === FARMLAND) {
      const above = blockAt(x, y + 1, z);
      if (above === WHEAT_YOUNG || above === WHEAT_RIPE) {
        if (above === WHEAT_RIPE) spawnItemDrop(x, y + 1, z, 'wheat', 1);
        spawnItemDrop(x, y + 1, z, 'wheat_seeds', 1);
        if (typeof clearCropAt === 'function') clearCropAt(x, y + 1, z);
        setEdit(key(x, y + 1, z), -1); setBlock(x, y + 1, z, null); requestEditedBlockRebuild(x, y + 1, z);
      }
    }
    // 土/草を壊したら上の苗木も落として撤去する
    if ((t === GRASS || t === DIRT) && blockAt(x, y + 1, z) === SAPLING) {
      spawnItemDrop(x, y + 1, z, 'sapling', 1);
      if (typeof clearSaplingAt === 'function') clearSaplingAt(x, y + 1, z);
      setEdit(key(x, y + 1, z), -1); setBlock(x, y + 1, z, null); requestEditedBlockRebuild(x, y + 1, z);
    }
    // ドロップ（必要ツールレベルを満たさない鉱石/石はドロップしない）。実体として地面に落ちる
    if (needTier === 0 || hasProperTool) {
      // 採掘XP。プレイヤーが設置したブロックからは出さない（設置→再採掘の無限XP防止）
      const xpRange = ORE_XP[t];
      if (xpRange && edits.get(id) !== t && typeof spawnXpOrb === 'function') {
        spawnXpOrb(x, y, z, xpRange[0] + Math.floor(Math.random() * (xpRange[1] - xpRange[0] + 1)));
      }
      for (const [itemId, n] of blockDrops(t)) spawnItemDrop(x, y, z, itemId, n);
    } else if (typeof setDebugToast === 'function' && needTier >= 2) {
      setDebugToast(`${TYPES[t].name} には${needTier >= 3 ? '鉄' : '石'}のツルハシ以上が必要`, 1.6);
    }
    // 道具の耐久値を消費
    if (held && held.tool === tool) damageSelectedTool(1);
    if (isSignBlock(t) && typeof deleteSignText === 'function') deleteSignText(x, y, z); // 看板テキストを削除
    if (isDoorBlock(t)) {
      removeDoorPairAt(x, y, z, t);
      thock(150);
      return;
    }
    if (isBedBlock(t)) {          // ベッドはどちらの半分を壊しても2ブロックとも消える
      removeBedPairAt(x, y, z, t);
      thock(150);
      return;
    }
    setEdit(id, -1); saveEditsSoon(); setBlock(x, y, z, null); requestEditedBlockRebuild(x, y, z, t); thock(150);
    breakDetachedLadders(x, y, z); // 背面(壁)を失ったはしごを剥がしてアイテム化
    if (typeof rsOnBlockChanged === 'function') { rsOnBlockChanged(x, y, z, -1); breakUnsupportedRsBlocks(x, y, z); }
  }
  // (bx,by,bz) を足場にしていたRS部品（ワイヤ/トーチ/レバー/ボタン/感圧板）を剥がしてアイテム化
  function breakUnsupportedRsBlocks(bx, by, bz) {
    const at = blockAt(bx, by + 1, bz);
    if (at === undefined || typeof rsOnBlockChanged !== 'function') return;
    const groundMounted = [REDSTONE_WIRE, REDSTONE_TORCH, REDSTONE_TORCH_OFF, LEVER_OFF, LEVER_ON,
      STONE_BUTTON_OFF, STONE_BUTTON_ON, STONE_PLATE_OFF, STONE_PLATE_ON, WOOD_PLATE_OFF, WOOD_PLATE_ON];
    if (!groundMounted.includes(at)) return;
    for (const [itemId, n] of blockDrops(at)) spawnItemDrop(bx, by + 1, bz, itemId, n);
    setEdit(key(bx, by + 1, bz), -1); setBlock(bx, by + 1, bz, null); requestEditedBlockRebuild(bx, by + 1, bz, at);
    rsOnBlockChanged(bx, by + 1, bz, -1);
  }
  // RS部品の設置: 不透明フルブロックの上面クリックのみ
  function placeRsGroundFromTarget(tg, def) {
    if (tg.normal[1] !== 1) return false;
    const x = tg.block[0], y = tg.block[1] + 1, z = tg.block[2];
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return false;
    const below = blockAt(x, y - 1, z);
    if (below === undefined || TYPES[below].solid === false || TYPES[below].model) { thock(90); return false; }
    if (isPlacementBlocked(x, y, z) || overlapsPlayer(x, y, z, def.block)) return false;
    const s = selectedItem();
    if (!s) return false;
    s.n -= 1;
    if (s.n <= 0) INV[selected] = null;
    invChanged();
    setEdit(key(x, y, z), def.block); saveEditsSoon(); setBlock(x, y, z, def.block); requestEditedBlockRebuild(x, y, z, def.block);
    if (typeof rsOnBlockChanged === 'function') rsOnBlockChanged(x, y, z, def.block);
    thock(280);
    if (typeof progressEvent === 'function') progressEvent('place', ITEM_FOR_BLOCK[def.block]);
    return true;
  }
  // (bx,by,bz) を壁にしていたはしごを、隣接4方向から探して剥がす（本家: 背面が壊れると落ちる）
  const LADDER_WALL_OFFSET = [[0, 0, 1], [-1, 0, 0], [0, 0, -1], [1, 0, 0]]; // facing 0..3 → 壁の相対位置
  function breakDetachedLadders(bx, by, bz) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const lx = bx + dx, lz = bz + dz, lt = blockAt(lx, by, lz);
      if (lt === undefined || !isLadderBlock(lt)) continue;
      const off = LADDER_WALL_OFFSET[lt - LADDER];
      if (lx + off[0] === bx && lz + off[2] === bz) {
        spawnItemDrop(lx, by, lz, 'ladder', 1);
        setEdit(key(lx, by, lz), -1); setBlock(lx, by, lz, null); requestEditedBlockRebuild(lx, by, lz, lt);
      }
    }
  }
  function updateMining(dt, tg) {
    if (!mouseHeld.left || !started || SURVIVAL.dead || !tg || isContainerOpen()) { resetMining(); return; }
    const [x, y, z] = tg.block, id = key(x, y, z), t = blockAt(x, y, z);
    if (t === undefined || (TYPES[t].solid === false && !isInteractableBlock(t))) { resetMining(); return; }
    if (MINING.id !== id) { MINING.active = true; MINING.id = id; MINING.progress = 0; MINING.tap = 0; }
    const total = Math.max(0.08, miningTime(t));
    MINING.progress += dt / total;
    MINING.tap += dt;
    if (MINING.tap > 0.22) { MINING.tap = 0; thock(105 + Math.min(260, MINING.progress * 210)); }
    breakMeter.classList.add('show');
    breakMeter.querySelector('span').style.width = `${Math.min(100, MINING.progress * 100).toFixed(1)}%`;
    if (MINING.progress >= 1) {
      finishBreak(tg);
      resetMining();
    }
  }

  /* --- ベッド --- */
  function trySleepInBed(x, y, z) {
    if (DAY.label !== '夜' && DAY.label !== '夕方') {
      if (typeof setDebugToast === 'function') setDebugToast('まだ眠くない（夜になったら眠れる）', 2.0);
      return;
    }
    if (typeof hostileNear === 'function' && hostileNear(player.pos, 14)) {
      if (typeof setDebugToast === 'function') setDebugToast('近くにモンスターがいて眠れない！', 2.2);
      thock(90);
      return;
    }
    SAVE.spawn = { x, y, z };
    DAY.time = 0.26; // 朝
    SURVIVAL.hunger = Math.max(0, SURVIVAL.hunger - 1);
    markSaveDirty();
    if (typeof progressEvent === 'function') progressEvent('sleep');
    if (typeof setDebugToast === 'function') setDebugToast('ぐっすり眠って朝になった（リスポーン地点を設定）', 2.6);
    thock(420);
  }

  /* --- バケツ: 水/溶岩を汲む・置く、牛から牛乳、牛乳を飲む --- */
  function tryUseBucket() {
    const s = selectedItem(); if (!s) return false;
    if (s.id === 'bucket') {
      // 牛を右クリックで牛乳
      const at = typeof pickAnimalTarget === 'function' ? pickAnimalTarget() : null;
      if (at && at.userData.kind === 'cow' && !at.userData.baby) {
        INV[selected] = mkItem('milk_bucket'); invChanged(); thock(300); return true;
      }
      // 水/溶岩を汲む（汲めるのは源のみ。流れは汲めない。自然の水源は無限のまま残す）
      const lq = pickLiquidTarget();
      if (lq) {
        const [bx, by, bz] = lq.block;
        const sim = (typeof getLiquid === 'function') ? getLiquid(bx, by, bz) : null;
        if (sim && sim.lv > 0) return false; // 流れ（level>0）は汲めない
        INV[selected] = mkItem(lq.type === LAVA ? 'lava_bucket' : 'water_bucket'); invChanged();
        if (sim && sim.lv === 0 && typeof pickupLiquidSource === 'function') {
          pickupLiquidSource(bx, by, bz);              // シムの源を消す（下流が枯れる）
        } else if (!sim && edits.get(key(bx, by, bz)) === lq.type) {
          // 旧セーブ由来の edit 水源（sim管理外）は従来どおり消す
          setEdit(key(bx, by, bz), -1); saveEditsSoon(); setBlock(bx, by, bz, null); requestEditedBlockRebuild(bx, by, bz);
        }
        // 自然の水源(sim無し・edit無し)は残す（無限）
        thock(300); return true;
      }
      return false;
    }
    if (s.id === 'water_bucket' || s.id === 'lava_bucket') {
      const tg = pickTarget(); if (!tg) return false;
      const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
      const type = s.id === 'lava_bucket' ? LAVA : WATER;
      if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX || isPlacementBlocked(x, y, z) || overlapsPlayer(x, y, z, type)) return false;
      // 液体の源として設置 → セルオートマトンが流れを作る（47-liquids.js）
      if (typeof placeLiquidSource === 'function') placeLiquidSource(x, y, z, type);
      else { setEdit(key(x, y, z), type); saveEditsSoon(); setBlock(x, y, z, type); requestEditedBlockRebuild(x, y, z, type); }
      INV[selected] = mkItem('bucket'); invChanged(); thock(240); return true;
    }
    if (s.id === 'milk_bucket') {
      SURVIVAL.hunger = Math.min(20, SURVIVAL.hunger + 1);
      if (typeof updateSurvivalHud === 'function') updateSurvivalHud();
      INV[selected] = mkItem('bucket'); invChanged(); thock(360); return true;
    }
    return false;
  }

  /* --- 右クリック: インタラクション or 設置 or 食べる --- */
  function interactOrPlace() {
    if (SURVIVAL.dead || isContainerOpen()) return;
    // 村人との会話を最優先
    const traveler = typeof pickTravelerTarget === 'function' ? pickTravelerTarget() : null;
    if (traveler) {
      if (typeof openTravelerPanel === 'function') openTravelerPanel(traveler);
      thock(180);
      return;
    }
    // 動物への餌やり（繁殖）: 手前の動物を優先。餌が合えば消費して恋愛モードへ
    const heldDef = selectedItemDef();
    if (heldDef && typeof pickAnimalTarget === 'function') {
      const animalTg = pickAnimalTarget();
      if (animalTg && feedAnimal(animalTg, heldDef)) {
        const s = selectedItem();
        s.n -= 1;
        if (s.n <= 0) INV[selected] = null;
        invChanged();
        return;
      }
    }
    const tg = pickTarget();
    if (tg) {
      const [bx, by, bz] = tg.block;
      const hitType = blockAt(bx, by, bz);
      if (hitType === CRAFTING_TABLE) { openContainer('table'); return; }
      if (hitType === ANVIL) { openContainer('anvil', { key: key(bx, by, bz) }); return; }
      if (hitType === ENCHANT_TABLE) { openContainer('enchant', { key: key(bx, by, bz), shelves: bookshelvesAround(bx, by, bz) }); return; }
      if (hitType === FURNACE || hitType === FURNACE_LIT) { openContainer('furnace', { key: key(bx, by, bz) }); return; }
      if (hitType === CHEST) {
        const id = key(bx, by, bz);
        // プレイヤーが置いたチェスト以外（＝ワールド生成）は初回に報酬を抽選
        const isPlayerChest = edits.get(id) === CHEST;
        openContainer('chest', { key: id, world: !isPlayerChest });
        if (typeof progressEvent === 'function') progressEvent('openChest');
        return;
      }
      if (hitType === OPEN_CHEST) { openContainer('chest', { key: key(bx, by, bz) }); return; }
      if (isBedBlock(hitType)) { const p = bedPairAt(bx, by, bz, hitType); if (p) trySleepInBed(p.x, p.y, p.z); return; }
      if (hitType === TNT) { igniteTNT(bx, by, bz); return; }   // TNTを右クリックで着火
      if (hitType === LEVER_OFF || hitType === LEVER_ON) { rsToggleLeverAt(bx, by, bz, hitType); return; }
      if (hitType === STONE_BUTTON_OFF) { rsPressButtonAt(bx, by, bz); return; }
      if (hitType === STONE_BUTTON_ON) return; // 押下中のボタンは待つ
      if (isDoorBlock(hitType)) { toggleDoorAt(bx, by, bz, hitType); return; }
      if (isTrapdoorBlock(hitType)) { toggleTrapdoorAt(bx, by, bz, hitType); return; }
      if (isFenceGateBlock(hitType)) { toggleFenceGateAt(bx, by, bz, hitType); return; }
      if (isSignBlock(hitType) && typeof openSignEditor === 'function') { openSignEditor(bx, by, bz); return; } // 看板を右クリックで再編集
    }
    // バケツ（水/溶岩/牛乳）
    if (tryUseBucket()) return;
    // 弓を持っていたら撃つ
    const def = selectedItemDef();
    if (def && def.tool === 'bow') { shootPlayerArrow(); return; }
    // 苗木を土/草の上に植える
    if (tg && def && def.id === 'sapling' && tg.normal[1] === 1) {
      if (plantSaplingAt(tg.block[0], tg.block[1], tg.block[2])) return;
    }
    // 農業: クワで耕す / 耕地の上の作物を収穫 / 種をまく
    if (tg) {
      const [bx, by, bz] = tg.block;
      const hitType = blockAt(bx, by, bz);
      // C12 骨粉: 小麦は即実り、苗木は45%で木になる
      if (def && def.id === 'bone_meal' && (hitType === WHEAT_YOUNG || hitType === SAPLING)) {
        const s2 = selectedItem();
        if (hitType === WHEAT_YOUNG) {
          setEdit(key(bx, by, bz), WHEAT_RIPE); setBlock(bx, by, bz, WHEAT_RIPE); requestEditedBlockRebuild(bx, by, bz);
          saveEditsSoon();
        } else if (Math.random() < 0.45 && typeof growTree === 'function') {
          if (growTree(bx, by, bz)) delete SAVE.saplings[key(bx, by, bz)];
        }
        burst(bx, by + 0.6, bz, 0x7ce03a);
        s2.n -= 1; if (s2.n <= 0) INV[selected] = null;
        invChanged(); thock(520);
        return;
      }
      if (def && def.tool === 'hoe' && tillableBlock(hitType)) { tillSoil(bx, by, bz); return; }
      if (hitType === FARMLAND) {
        const above = blockAt(bx, by + 1, bz);
        if (above === WHEAT_RIPE || above === WHEAT_YOUNG) { harvestCrop(bx, by + 1, bz); return; }
        if (def && def.id === 'wheat_seeds') { plantSeed(bx, by, bz); return; }
      }
    }
    // 食べ物を持っていたら食べる
    if (def && def.food) { eatSelectedFood(); return; }
    if (tg && def && def.id === 'torch' && tg.normal[1] === 0) { placeWallTorchFromTarget(tg); return; }
    if (tg && def && def.id === 'bed') { placeBedFromTarget(tg); return; }
    if (tg && def && def.id === 'oak_door') { placeDoorFromTarget(tg); return; }
    if (tg && def && def.id === 'oak_fence_gate') { placeFenceGateFromTarget(tg); return; }
    if (tg && def && def.stairs) { placeStairsFromTarget(tg, def); return; }
    if (tg && def && def.slab) { placeSlabFromTarget(tg, def); return; }
    if (tg && def && def.ladder) { placeLadderFromTarget(tg); return; }
    if (tg && def && def.sign) { placeSignFromTarget(tg); return; }
    if (tg && def && def.rsGround) { placeRsGroundFromTarget(tg, def); return; }
    // ブロック設置
    if (!tg || !def || def.block == null) { if (def && def.block == null) thock(90); return; }
    const x = tg.block[0] + tg.normal[0], y = tg.block[1] + tg.normal[1], z = tg.block[2] + tg.normal[2];
    if (y < CHUNK_Y_MIN || y > CHUNK_Y_MAX) return;
    const type = def.block;
    if (isPlacementBlocked(x, y, z) || overlapsPlayer(x, y, z, type)) return;
    const s = selectedItem();
    s.n -= 1;
    if (s.n <= 0) INV[selected] = null;
    invChanged();
    setEdit(key(x, y, z), type); saveEditsSoon(); setBlock(x, y, z, type); requestEditedBlockRebuild(x, y, z, type); thock(260);
    if (typeof displaceLiquidAt === 'function') displaceLiquidAt(x, y, z); // 液体を塞いだら下流を枯らす
    if (typeof rsOnBlockChanged === 'function') rsOnBlockChanged(x, y, z, type); // RS部品の登録/回路の再評価
    if (typeof progressEvent === 'function') progressEvent('place', ITEM_FOR_BLOCK[type]);
  }
