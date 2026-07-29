  /* ============== 可視面だけのチャンクメッシュ再構築 ============== */
  function occludes(x, y, z, self) {
    const nt = blockAt(x, y, z);
    if (nt === undefined) return false;
    if (!TYPES[nt].transparent) return true;
    return nt === self;
  }
  function faceVisible(x, y, z, t, f) {
    const n = FACE_DEFS[f].n;
    return !occludes(x + n[0], y + n[1], z + n[2], t);
  }
  function visible(x, y, z, t) {
    for (let f = 0; f < FACE_DEFS.length; f++) if (faceVisible(x, y, z, t, f)) return true;
    return false;
  }

  const REBUILD_JOB_MS = 2.2;
  let rebuildJob = null, rebuildSeq = 0, pendingChunkKeys = new Set();
  const MESH_WORKER_VERSION = 26; // 14: packed.light。15: はしご/板ガラス/看板。16: 液体の可変水面高。17: RS鉱石+RS部品モデル。18: ドア32IDバリアント+面別マテリアル。19-20: モデルブロックの面別UV。21: ベッド2ブロック化。22: 松明の形状。23: 壁掛け松明+モデル回転。24: 砂利の地形生成。25: 掘り跡に流れ込んだ液体を描く。26: 液体の源を満杯で描く
  // 1本のワーカーで49チャンクを直列に組むと遅いので、CPUコア数に応じた
  // ワーカープールで並列に組む。各ワーカーの onmessage は共有の inflight を id で引く。
  const MESH_WORKER_COUNT = (() => {
    let n = 3;
    try { n = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 1)); } catch (e) {}
    return n;
  })();
  let meshWorkers = null, meshWorkerSeq = 0;
  const meshWorkerInflight = new Map();
  const meshWorkerLoad = new Map(); // worker -> 未処理メッセージ数（最も空いているワーカーへ割り振る）
  // 並列ワーカーやキャッシュヒットが同一フレームに大量のジオメトリ生成を持ち込むと
  // メインスレッドがカクつくため、完成メッシュはキューに積んでフレームあたり時間予算で貼る。
  const meshApplyQueue = [];
  // ワーカーが焼いた光値(sky/blk)を chunkKey ごとに保持（fresh/cache 両経路で更新）。
  // モブの湧き判定・日光燃焼が bakedLightAt() 経由で参照する。
  const CHUNK_LIGHT = new Map(); // chunkKey -> { x0, z0, y0, y1, data:Uint8Array((sky<<4|blk)/cell) }
  // 焼き込み済みブロック光を返す。データ未取得なら null（呼び出し側は保守的に扱う）。
  function bakedLightAt(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    const g = CHUNK_LIGHT.get(chunkKey(chunkCoord(x), chunkCoord(z)));
    if (!g) return null;
    if (y < g.y0 || y > g.y1) return null;
    const lx = x - g.x0, lz = z - g.z0;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return null;
    const b = g.data[(y - g.y0) * (CHUNK_SIZE * CHUNK_SIZE) + lx * CHUNK_SIZE + lz];
    return { sky: b >> 4, blk: b & 15 };
  }
  const chunkBuildVersions = new Map();
  let chunkMeshDbPromise = null;
  const meshWorkerStats = { workerBuilds: 0, cacheHits: 0, cacheWrites: 0, fallbacks: 0, errors: 0 };
  try { window.__mcMeshWorkerStats = meshWorkerStats; } catch (e) {}
  function publishMeshWorkerStats() {
    try { document.documentElement.dataset.mcMeshWorkerStats = JSON.stringify(meshWorkerStats); } catch (e) {}
  }
  publishMeshWorkerStats();

  function sortChunkKeysNear(keys, x, z) {
    const pcx = chunkCoord(x), pcz = chunkCoord(z);
    return [...keys].sort((a, b) => {
      const [ax, az] = a.split(',').map(Number);
      const [bx, bz] = b.split(',').map(Number);
      return (Math.abs(ax - pcx) + Math.abs(az - pcz)) - (Math.abs(bx - pcx) + Math.abs(bz - pcz));
    });
  }

  function makeMeshBuildState() {
    return TYPES.map((ty) => {
      const groupCount = Array.isArray(ty.mats) ? ty.mats.length : 1;
      return {
        positions: Array.from({ length: groupCount }, () => []),
        normals: Array.from({ length: groupCount }, () => []),
        uvs: Array.from({ length: groupCount }, () => []),
        lights: Array.from({ length: groupCount }, () => []),
        indices: Array.from({ length: groupCount }, () => []),
        blocks: 0,
      };
    });
  }

  // フォールバック（ワーカー不可時）用の簡易ライト: 頭上が空いていれば太陽光、
  // 塞がっていれば暗所として扱う。BFS 伝播はワーカー経路が担うので、ここは列単位の近似でよい。
  let mainLightMemo = null;
  function mainSkyOpen(x, y, z) {
    const memoKey = x + ',' + y + ',' + z;
    if (mainLightMemo) {
      const m = mainLightMemo.get(memoKey);
      if (m !== undefined) return m;
    }
    let open = true;
    const yTop = Math.min(CHUNK_Y_MAX, y + 56);
    for (let yy = y + 1; yy <= yTop; yy++) {
      const t = blockAt(x, yy, z);
      if (t !== undefined && !TYPES[t].transparent && !TYPES[t].model) { open = false; break; }
    }
    if (mainLightMemo) mainLightMemo.set(memoKey, open);
    return open;
  }
  function mainFaceLight(x, y, z) {
    return [mainSkyOpen(x, y, z) ? 1 : 0.08, 0];
  }

  const FULL_LIGHT = [1, 0];
  function addQuadToState(state, verts, normal, uvCoords, mat = 0, sb = FULL_LIGHT) {
    const group = state.positions.length === 1 ? 0 : Math.max(0, Math.min(state.positions.length - 1, mat | 0));
    const pos = state.positions[group], norm = state.normals[group], uv = state.uvs[group], idx = state.indices[group];
    const lig = state.lights[group];
    const base = pos.length / 3;
    for (const p of verts) {
      pos.push(p[0], p[1], p[2]);
      norm.push(normal[0], normal[1], normal[2]);
      lig.push(sb[0], sb[1]);
    }
    uv.push(...uvCoords);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  function addBlockFaceToState(state, x, y, z, f, topY = 1) {
    const fd = FACE_DEFS[f];
    const rgb = mainFaceLight(x + fd.n[0], y + fd.n[1], z + fd.n[2]);
    addQuadToState(state, fd.v.map(p => [x + p[0], y + (p[1] === 1 ? topY : p[1]), z + p[2]]), fd.n, fd.uv, fd.m, rgb);
  }

  function addBoxPartToState(state, x, y, z, part, rgbIn) {
    const b = part && part.box;
    if (!b || b.length < 6) return false;
    const x0 = x + b[0], y0 = y + b[1], z0 = z + b[2];
    const x1 = x + b[3], y1 = y + b[4], z1 = z + b[5];
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return false;
    // UVは面ごと（FACE_DEFS[f].uv）を使う。面によって頂点の並び順が違うため、
    // 1種類のUVを全面に使い回すと面1(-x)と面4(+z)でu,vが入れ替わり絵柄が90度回る。
    // part.uv を明示した場合のみ全面をそれで上書きする
    const uvCoords = part.uv || null;
    const faces = [
      [[x1,y0,z0], [x1,y1,z0], [x1,y1,z1], [x1,y0,z1]],
      [[x0,y0,z0], [x0,y0,z1], [x0,y1,z1], [x0,y1,z0]],
      [[x0,y1,z0], [x0,y1,z1], [x1,y1,z1], [x1,y1,z0]],
      [[x0,y0,z0], [x1,y0,z0], [x1,y0,z1], [x0,y0,z1]],
      [[x0,y0,z1], [x1,y0,z1], [x1,y1,z1], [x0,y1,z1]],
      [[x0,y0,z0], [x0,y1,z0], [x1,y1,z0], [x1,y0,z0]],
    ];
    // part.rot: ブロックローカルの origin まわりに1軸だけ回す（壁掛け松明の傾きなど）
    const norms = applyPartRotation(part, faces, x, y, z);
    for (let f = 0; f < FACE_DEFS.length; f++) {
      const fd = FACE_DEFS[f];
      addQuadToState(state, faces[f], norms ? norms[f] : fd.n, uvCoords || fd.uv, part.mat ?? fd.m, rgbIn);
    }
    return true;
  }
  // faces を破壊的に回し、回転後の面法線を返す（回転が無ければ null）
  function applyPartRotation(part, faces, x, y, z) {
    const rot = part && part.rot;
    if (!rot) return null;
    const c = Math.cos(rot.angle), s = Math.sin(rot.angle);
    const ox = x + rot.origin[0], oy = y + rot.origin[1], oz = z + rot.origin[2];
    const rv = rot.axis === 'z' ? (a, b, d) => [a * c - b * s, a * s + b * c, d]
      : rot.axis === 'x' ? (a, b, d) => [a, b * c - d * s, b * s + d * c]
        : (a, b, d) => [a * c + d * s, b, -a * s + d * c];
    for (let f = 0; f < faces.length; f++) {
      faces[f] = faces[f].map(p => {
        const r = rv(p[0] - ox, p[1] - oy, p[2] - oz);
        return [ox + r[0], oy + r[1], oz + r[2]];
      });
    }
    return FACE_DEFS.map(fd => rv(fd.n[0], fd.n[1], fd.n[2]));
  }

  function addCrossPartToState(state, x, y, z, part, rgbIn) {
    const r = part.r ?? 0.5;
    const y0 = y + (part.y0 ?? 0);
    const y1 = y + (part.y1 ?? 1);
    const cx = x + 0.5, cz = z + 0.5;
    const uvCoords = part.uv || FACE_DEFS[0].uv;
    const m = part.mat ?? 0;
    const d = Math.SQRT1_2;
    addQuadToState(state, [[cx - r,y0,cz - r], [cx - r,y1,cz - r], [cx + r,y1,cz + r], [cx + r,y0,cz + r]], [-d, 0, d], uvCoords, m, rgbIn);
    addQuadToState(state, [[cx - r,y0,cz + r], [cx - r,y1,cz + r], [cx + r,y1,cz - r], [cx + r,y0,cz - r]], [d, 0, d], uvCoords, m, rgbIn);
    return true;
  }

  function addModelToState(state, x, y, z, model) {
    let rgb = mainFaceLight(x, y, z);
    // RSワイヤの信号強度→明度（ワーカー経路と同形）
    if (typeof rsSignalInfoAt === 'function' && blockAt(x, y, z) === REDSTONE_WIRE) {
      const info = rsSignalInfoAt(x, y, z);
      const wl = info.wireLevel || 0;
      rgb = [rgb[0] * 0.5, Math.max(rgb[1], 0.10 + 0.90 * (wl / 15))];
    }
    let added = false;
    for (const part of model) {
      if (part.kind === 'cross') added = addCrossPartToState(state, x, y, z, part, rgb) || added;
      else added = addBoxPartToState(state, x, y, z, part, rgb) || added;
    }
    if (added) state.blocks++;
  }

  function addBlockToState(build, x, y, z, t) {
    const state = build[t];
    if (!state) return;
    const model = TYPES[t] && TYPES[t].model;
    if (model) {
      addModelToState(state, x, y, z, model);
      return;
    }
    // シム液体セル: レベルに応じて上面を下げる（ワーカー経路の addLiquidBlockToState と同形）
    const lq = (typeof getLiquid === 'function') ? getLiquid(x, y, z) : null;
    if (lq) {
      const above = blockAt(x, y + 1, z);
      // 水は常に満杯で描く。自然の海/川/湖は暗黙ブロック＝満杯なので、掘り跡へ流れ込んだ
      // 水だけを (8-lv)/9 にすると、水辺じゅうが階段状の板になって見た目が破綻し、
      // 半透明の重ね描画が増えて重くもなる。溶岩は不透明で量も少ないので段差を残す。
      // （ワーカー側 world-mesh-worker.js と完全に同じ式にすること）
      const topH = (above === t || t === WATER) ? 1 : Math.max(1 / 9, (8 - lq.lv) / 9);
      let addedL = false;
      for (let f = 0; f < FACE_DEFS.length; f++) {
        if (f === 3 && y === CHUNK_Y_MIN) continue;
        if (f === 2) { if (above === t) continue; } // 上面: 高さが下がるので同液体が乗る時以外は常に描く
        else if (!faceVisible(x, y, z, t, f)) continue;
        addBlockFaceToState(state, x, y, z, f, topH);
        addedL = true;
      }
      if (addedL) state.blocks++;
      return;
    }
    let added = false;
    for (let f = 0; f < FACE_DEFS.length; f++) {
      if (f === 3 && y === CHUNK_Y_MIN) continue; // ワールド最下面（岩盤の底）は描かない
      if (!faceVisible(x, y, z, t, f)) continue;
      addBlockFaceToState(state, x, y, z, f);
      added = true;
    }
    if (added) state.blocks++;
  }

  function buildGeometry(state) {
    const geo = new THREE.BufferGeometry();
    const pos = [], norm = [], uv = [], lig = [], idx = [];
    for (let g = 0; g < state.positions.length; g++) {
      const gp = state.positions[g];
      if (!gp.length) continue;
      const vertexOffset = pos.length / 3;
      const indexStart = idx.length;
      for (let i = 0; i < gp.length; i++) pos.push(gp[i]);
      const gn = state.normals[g], guv = state.uvs[g], gl = state.lights[g], gi = state.indices[g];
      for (let i = 0; i < gn.length; i++) norm.push(gn[i]);
      for (let i = 0; i < guv.length; i++) uv.push(guv[i]);
      for (let i = 0; i < gl.length; i++) lig.push(gl[i]);
      for (let i = 0; i < gi.length; i++) idx.push(gi[i] + vertexOffset);
      geo.addGroup(indexStart, gi.length, g);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('mcLight', new THREE.Float32BufferAttribute(lig, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  }

  function buildGeometryFromPacked(part) {
    const geo = new THREE.BufferGeometry();
    const asF32 = (v) => v instanceof Float32Array ? v : new Float32Array(v || 0);
    const asU32 = (v) => v instanceof Uint32Array ? v : new Uint32Array(v || 0);
    const pos = asF32(part.positions);
    const norm = asF32(part.normals);
    const uv = asF32(part.uvs);
    const idx = asU32(part.indices);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    // ライトエンジンの焼き込み [sky, block]×頂点。欠けていたら「空100%」で埋める
    const ligSrc = part.lights ? asF32(part.lights) : null;
    const vtx = pos.length / 3;
    let lig = ligSrc && ligSrc.length === vtx * 2 ? ligSrc : null;
    if (!lig) {
      lig = new Float32Array(vtx * 2);
      for (let i = 0; i < vtx; i++) lig[i * 2] = 1;
    }
    geo.setAttribute('mcLight', new THREE.BufferAttribute(lig, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    for (const g of part.groups || []) geo.addGroup(g.start, g.count, g.material);
    geo.computeBoundingSphere();
    return geo;
  }

  function chunkInCurrentWindow(cx, cz) {
    if (winCX > 1e8 || winCZ > 1e8) return true;
    const b = chunkBounds(cx, cz);
    return !(b.x1 < winCX - WIN_R || b.x0 > winCX + WIN_R || b.z1 < winCZ - WIN_R || b.z0 > winCZ + WIN_R);
  }

  function chunkBounds(cx, cz) {
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    return { x0, x1: x0 + CHUNK_SIZE - 1, z0, z1: z0 + CHUNK_SIZE - 1 };
  }

  function buildChunkState(cx, cz) {
    mainLightMemo = new Map();
    const build = makeMeshBuildState();
    const b = chunkBounds(cx, cz);
    for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) {
      const yr = typeof columnYRange === 'function' ? columnYRange(x, z) : null;
      if (!yr) continue;
      const y0 = Math.max(CHUNK_Y_MIN, yr.min - 1);
      const y1 = Math.min(CHUNK_Y_MAX, yr.max + 1);
      for (let y = y0; y <= y1; y++) {
        const t = blockAt(x, y, z);
        if (t !== undefined) addBlockToState(build, x, y, z, t);
      }
    }
    return build;
  }

  // 空タイプ用の共有空ジオメトリ。ブロック種は約40あり、多くは各チャンクで0個なので、
  // 0個のタイプにわざわざ空ジオメトリを毎回生成せず、これを使い回してGPU/GC負荷を減らす。
  const EMPTY_GEO = new THREE.BufferGeometry();

  function applyChunkState(cx, cz, build) {
    const id = chunkKey(cx, cz);
    const chunk = terrainChunks.get(id) || createTerrainChunk(cx, cz);
    for (let t = 0; t < TYPES.length; t++) {
      const blocks = build[t].blocks;
      drawCountsByType[t] += blocks - chunk.counts[t];
      chunk.counts[t] = blocks;
      const mesh = chunk.meshes[t], old = mesh.geometry;
      mesh.geometry = blocks > 0 ? buildGeometry(build[t]) : EMPTY_GEO;
      mesh.visible = blocks > 0;
      if (old && old !== EMPTY_GEO) old.dispose();
    }
  }

  function applyPackedChunkState(cx, cz, packed) {
    const id = chunkKey(cx, cz);
    const chunk = terrainChunks.get(id) || createTerrainChunk(cx, cz);
    const parts = packed.parts || [];
    for (let t = 0; t < TYPES.length; t++) {
      const part = parts[t];
      const blocks = part ? (part.blocks || 0) : 0;
      drawCountsByType[t] += blocks - chunk.counts[t];
      chunk.counts[t] = blocks;
      const mesh = chunk.meshes[t], old = mesh.geometry;
      mesh.geometry = blocks > 0 ? buildGeometryFromPacked(part) : EMPTY_GEO;
      mesh.visible = blocks > 0;
      if (old && old !== EMPTY_GEO) old.dispose();
    }
    const lg = packed.light;
    if (lg && lg.data) {
      CHUNK_LIGHT.set(id, {
        x0: lg.x0, z0: lg.z0, y0: lg.y0, y1: lg.y1,
        data: lg.data instanceof Uint8Array ? lg.data : new Uint8Array(lg.data),
      });
    }
  }

  function meshDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (chunkMeshDbPromise) return chunkMeshDbPromise;
    chunkMeshDbPromise = new Promise((resolve) => {
      const req = indexedDB.open('mc_chunk_mesh_cache', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('chunks');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
    return chunkMeshDbPromise;
  }

  async function readMeshCache(cacheKey) {
    const db = await meshDb(); if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction('chunks', 'readonly');
      const req = tx.objectStore('chunks').get(cacheKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async function writeMeshCache(cacheKey, packed) {
    const db = await meshDb(); if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction('chunks', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.objectStore('chunks').put(packed, cacheKey);
    });
  }

  function makeMeshWorker() {
    const worker = new Worker(new URL('./world-mesh-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const msg = ev.data || {};
      const pending = meshWorkerInflight.get(msg.id);
      meshWorkerLoad.set(worker, Math.max(0, (meshWorkerLoad.get(worker) || 1) - 1));
      if (!pending) return;
      meshWorkerInflight.delete(msg.id);
      if (msg.error) {
        meshWorkerStats.errors++;
        meshWorkerStats.fallbacks++;
        publishMeshWorkerStats();
        applyChunkState(pending.cx, pending.cz, buildChunkState(pending.cx, pending.cz));
        return;
      }
      if (msg.probeLight) { try { (window.__mcLastProbes = window.__mcLastProbes || []).push(msg.probeLight); } catch (e) {} }
      if (typeof msg.ms === 'number') {
        meshWorkerStats.lastBuildMs = Math.round(msg.ms * 10) / 10;
        meshWorkerStats.maxBuildMs = Math.max(meshWorkerStats.maxBuildMs || 0, meshWorkerStats.lastBuildMs);
        meshWorkerStats.avgBuildMs = Math.round(((meshWorkerStats.avgBuildMs || msg.ms) * 0.9 + msg.ms * 0.1) * 10) / 10;
      }
      if (chunkBuildVersions.get(pending.key) !== pending.version) return;
      meshApplyQueue.push({ cx: pending.cx, cz: pending.cz, key: pending.key, version: pending.version, cacheKey: pending.cacheKey, packed: msg.packed, fromCache: false });
    };
    worker.onerror = () => { meshWorkerStats.errors++; publishMeshWorkerStats(); };
    meshWorkerLoad.set(worker, 0);
    return worker;
  }
  function initMeshWorkers() {
    if (meshWorkers || !window.Worker) return meshWorkers;
    try {
      meshWorkers = [];
      for (let i = 0; i < MESH_WORKER_COUNT; i++) meshWorkers.push(makeMeshWorker());
    } catch (e) {
      meshWorkers = null;
    }
    return meshWorkers;
  }
  function pickMeshWorker() {
    // 最も未処理メッセージが少ないワーカーへ割り振る（負荷分散）
    let best = meshWorkers[0], bestLoad = meshWorkerLoad.get(best) || 0;
    for (let i = 1; i < meshWorkers.length; i++) {
      const w = meshWorkers[i], l = meshWorkerLoad.get(w) || 0;
      if (l < bestLoad) { best = w; bestLoad = l; }
    }
    return best;
  }

  function fnvAdd(h, n) {
    h ^= n & 255; h = Math.imul(h, 16777619);
    h ^= (n >> 8) & 255; h = Math.imul(h, 16777619);
    h ^= (n >> 16) & 255; h = Math.imul(h, 16777619);
    h ^= (n >> 24) & 255; h = Math.imul(h, 16777619);
    return h >>> 0;
  }

  function collectMeshPayload(cx, cz) {
    const b = chunkBounds(cx, cz);
    const x0 = b.x0 - 1, x1 = b.x1 + 1, z0 = b.z0 - 1, z1 = b.z1 + 1;
    // ライトエンジンはチャンク外周 LIGHT_PAD(=6, world-mesh-worker.js) まで光を解くので、
    // 明示ブロック/空気/編集はその範囲まで渡す（範囲がハッシュに入るため、隣接チャンクの
    // 光源設置/破壊でもキャッシュキーが変わり正しく再ビルドされる）
    const lx0 = b.x0 - 6, lx1 = b.x1 + 6, lz0 = b.z0 - 6, lz1 = b.z1 + 6;
    const blocks = [], airs = [], editEntries = [], blockedColumns = [];
    let hash = 2166136261 >>> 0;
    const includeXYZ = (x, y, z) => x >= lx0 && x <= lx1 && z >= lz0 && z <= lz1 && y >= CHUNK_Y_MIN - 1 && y <= CHUNK_Y_MAX + 1;
    // world/airBlocks/edits はプレイ範囲が広がるほど巨大化するので、全件走査せず
    // このチャンク±1に触れうる3x3チャンク分のインデックスだけ見る（パディングは1マスなので必ずここに収まる）。
    for (let ncx = cx - 1; ncx <= cx + 1; ncx++) for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
      const ck = chunkKey(ncx, ncz);
      const wb = worldChunkIndex.get(ck);
      if (wb) for (const [id, t] of wb) {
        const c = id.split(','), x = +c[0], y = +c[1], z = +c[2];
        if (!includeXYZ(x, y, z)) continue;
        blocks.push(x, y, z, t);
        hash = fnvAdd(fnvAdd(fnvAdd(fnvAdd(hash, x), y), z), t);
      }
      const ab = airChunkIndex.get(ck);
      if (ab) for (const id of ab) {
        const c = id.split(','), x = +c[0], y = +c[1], z = +c[2];
        if (!includeXYZ(x, y, z)) continue;
        airs.push(x, y, z);
        hash = fnvAdd(fnvAdd(fnvAdd(hash, x ^ 0x51), y ^ 0x91), z ^ 0xd3);
      }
      const eb = editsChunkIndex.get(ck);
      if (eb) for (const [id, t] of eb) {
        const c = id.split(','), x = +c[0], y = +c[1], z = +c[2];
        if (!includeXYZ(x, y, z)) continue;
        // 掘り跡(-1)にシム液体が流れ込んでいるセルは編集を送らない。ワーカーの blockAt は
        // edit<0 を無条件に空気とするので、送ると浸水した穴が空気のまま描かれる（メイン側の
        // blockAt は liquids を見るので、送らないことで両者の見え方が一致する）。
        if (t < 0 && typeof getLiquid === 'function' && getLiquid(x, y, z)) continue;
        editEntries.push(x, y, z, t);
        hash = fnvAdd(fnvAdd(fnvAdd(fnvAdd(hash, x ^ 0xabc), y ^ 0xdef), z ^ 0x123), t);
      }
    }
    for (let x = x0 - 2; x <= x1 + 2; x++) for (let z = z0 - 2; z <= z1 + 2; z++) {
      const blocked = (typeof structureAffectsColumn === 'function' && structureAffectsColumn(x, z, 2)) ||
        (typeof villageAffectsColumn === 'function' && villageAffectsColumn(x, z, 2));
      if (!blocked) continue;
      blockedColumns.push(x, z);
      hash = fnvAdd(fnvAdd(hash, x ^ 0x2d2d), z ^ 0x4b4b);
    }
    // シム液体セル（レベル別の水面高）。レベルが変わるとハッシュも変わり正しく再ビルドされる
    const liquidCells = (typeof collectLiquidMeshCells === 'function') ? collectLiquidMeshCells(x0, x1, z0, z1) : [];
    for (let i = 0; i < liquidCells.length; i += 4) {
      hash = fnvAdd(fnvAdd(fnvAdd(fnvAdd(hash, liquidCells[i] ^ 0x7171), liquidCells[i + 1] ^ 0x3939), liquidCells[i + 2] ^ 0x5b5b), liquidCells[i + 3] ^ 0x1d1d);
    }
    // RSワイヤ（信号強度で赤の明度が変わる）。同じくハッシュに含める
    const wireCells = (typeof collectRsWireCells === 'function') ? collectRsWireCells(x0, x1, z0, z1) : [];
    for (let i = 0; i < wireCells.length; i += 4) {
      hash = fnvAdd(fnvAdd(fnvAdd(fnvAdd(hash, wireCells[i] ^ 0x2f2f), wireCells[i + 1] ^ 0x6363), wireCells[i + 2] ^ 0x0f0f), wireCells[i + 3] ^ 0x4545);
    }
    hash = fnvAdd(fnvAdd(hash, WORLD_SEED), MESH_WORKER_VERSION);
    return {
      cx, cz,
      seed: WORLD_SEED,
      chunkSize: CHUNK_SIZE,
      yMin: CHUNK_Y_MIN,
      yMax: CHUNK_Y_MAX,
      typeCount: TYPES.length,
      transparent: TYPES.map(t => !!t.transparent),
      groupCounts: TYPES.map(t => Array.isArray(t.mats) ? t.mats.length : 1),
      blockModels: TYPES.map(t => t.model || null),
      lightLevels: TYPES.map(t => t.lightLevel || 0),
      probe: (typeof window !== 'undefined' && window.__mcLightProbe) || null, // デバッグ: ワーカー内の光値を覗く
      blocks,
      airs,
      edits: editEntries,
      blockedColumns,
      liquidCells,
      wireCells,
      cacheKey: `${WORLD_SEED}:mesh:${MESH_WORKER_VERSION}:${cx},${cz}:${hash.toString(36)}`,
    };
  }

  function rebuildChunkWithWorker(cx, cz) {
    const workers = initMeshWorkers();
    if (!workers || !workers.length) return false;
    const key = chunkKey(cx, cz);
    const version = (chunkBuildVersions.get(key) || 0) + 1;
    chunkBuildVersions.set(key, version);
    const payload = collectMeshPayload(cx, cz);
    readMeshCache(payload.cacheKey).then((cached) => {
      if (chunkBuildVersions.get(key) !== version) return;
      if (cached) {
        meshApplyQueue.push({ cx, cz, key, version, cacheKey: payload.cacheKey, packed: cached, fromCache: true });
        return;
      }
      const id = ++meshWorkerSeq;
      meshWorkerInflight.set(id, { cx, cz, key, version, cacheKey: payload.cacheKey });
      const worker = pickMeshWorker();
      meshWorkerLoad.set(worker, (meshWorkerLoad.get(worker) || 0) + 1);
      worker.postMessage({ id, payload });
    });
    return true;
  }

  function rebuildChunk(cx, cz) {
    if (rebuildChunkWithWorker(cx, cz)) return;
    applyChunkState(cx, cz, buildChunkState(cx, cz));
  }

  function chunkKeysForArea(x0, x1, z0, z1) {
    const out = [];
    const cx0 = chunkCoord(x0), cx1 = chunkCoord(x1), cz0 = chunkCoord(z0), cz1 = chunkCoord(z1);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) out.push(chunkKey(cx, cz));
    return out;
  }

  function chunkKeysOutsideOldArea(x0, x1, z0, z1, oldX0, oldX1, oldZ0, oldZ1) {
    const out = new Set();
    const cx0 = chunkCoord(x0), cx1 = chunkCoord(x1), cz0 = chunkCoord(z0), cz1 = chunkCoord(z1);
    const ocx0 = chunkCoord(oldX0), ocx1 = chunkCoord(oldX1), ocz0 = chunkCoord(oldZ0), ocz1 = chunkCoord(oldZ1);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      if (cx >= ocx0 && cx <= ocx1 && cz >= ocz0 && cz <= ocz1) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < cx0 || nx > cx1 || nz < cz0 || nz > cz1) continue;
        out.add(chunkKey(nx, nz));
      }
    }
    return [...out];
  }

  function removeChunksOutside(x0, x1, z0, z1) {
    const cx0 = chunkCoord(x0), cx1 = chunkCoord(x1), cz0 = chunkCoord(z0), cz1 = chunkCoord(z1);
    for (const [id, chunk] of [...terrainChunks]) {
      if (chunk.cx >= cx0 && chunk.cx <= cx1 && chunk.cz >= cz0 && chunk.cz <= cz1) continue;
      disposeTerrainChunk(chunk);
      terrainChunks.delete(id);
      CHUNK_LIGHT.delete(id);
    }
  }

  function rebuild() {
    rebuildJob = null;
    pendingChunkKeys.clear();
    for (const chunk of terrainChunks.values()) disposeTerrainChunk(chunk);
    terrainChunks.clear();
    CHUNK_LIGHT.clear();
    const cx0 = chunkCoord(winCX - WIN_R), cx1 = chunkCoord(winCX + WIN_R);
    const cz0 = chunkCoord(winCZ - WIN_R), cz1 = chunkCoord(winCZ + WIN_R);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) rebuildChunk(cx, cz);
  }

  function startRebuildJob(keys, x0, x1, z0, z1) {
    const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
    rebuildJob = { seq: ++rebuildSeq, keys: sortChunkKeysNear(keys, px, pz), i: 0, x0, x1, z0, z1 };
    removeChunksOutside(x0, x1, z0, z1);
  }

  function requestRebuildAsync(x0, x1, z0, z1) {
    dirtyStructureChunks.clear(); // 窓全体を再構築するので構造物ダーティは消化済み
    const keys = chunkKeysForArea(x0, x1, z0, z1);
    if (rebuildJob) {
      for (const id of keys) pendingChunkKeys.add(id);
      rebuildJob.x0 = x0; rebuildJob.x1 = x1; rebuildJob.z0 = z0; rebuildJob.z1 = z1;
      removeChunksOutside(x0, x1, z0, z1);
      return;
    }
    startRebuildJob(keys, x0, x1, z0, z1);
  }

  function requestRebuildWindowMove(x0, x1, z0, z1, oldX0, oldX1, oldZ0, oldZ1) {
    const keySet = new Set(chunkKeysOutsideOldArea(x0, x1, z0, z1, oldX0, oldX1, oldZ0, oldZ1));
    // 構造物が書き込んだチャンクは重なり領域でも必ず再構築する（大型構造物が欠ける問題の対策）
    for (const id of dirtyStructureChunks) keySet.add(id);
    dirtyStructureChunks.clear();
    const keys = [...keySet];
    if (!keys.length) { removeChunksOutside(x0, x1, z0, z1); return; }
    if (rebuildJob) {
      for (const id of keys) pendingChunkKeys.add(id);
      rebuildJob.x0 = x0; rebuildJob.x1 = x1; rebuildJob.z0 = z0; rebuildJob.z1 = z1;
      removeChunksOutside(x0, x1, z0, z1);
      return;
    }
    startRebuildJob(keys, x0, x1, z0, z1);
  }

  function requestEditedBlockRebuild(x, y, z, emitType) {
    if (typeof noteColumnY === 'function') noteColumnY(x, y, z);
    // 光源ブロックの設置/破壊は半径14ブロックまで明るさが変わるので、
    // その範囲に重なるチャンクも再メッシュしてライトの継ぎ目を消す
    const curT = blockAt(x, y, z);
    const lit = (emitType != null && TYPES[emitType] && TYPES[emitType].lightLevel > 0) ||
      (curT !== undefined && TYPES[curT].lightLevel > 0);
    const r = lit ? 14 : 1;
    const keys = new Set();
    for (const dx of [-r, 0, r]) for (const dz of [-r, 0, r]) keys.add(chunkKey(chunkCoord(x + dx), chunkCoord(z + dz)));
    for (const id of keys) {
      const [cx, cz] = id.split(',').map(Number);
      rebuildChunk(cx, cz);
    }
    rebuildPlants(winCX - WIN_R, winCX + WIN_R, winCZ - WIN_R, winCZ + WIN_R);
  }

  // 完成済みメッシュをフレーム予算内で貼る。初期ロード中（未開始）は大きめ予算で一気に、
  // プレイ中は控えめにしてカクつきを抑える。
  function drainMeshApplyQueue() {
    if (!meshApplyQueue.length) return;
    const budget = started ? 3.5 : 10;
    const end = performance.now() + budget;
    let dirty = false;
    while (meshApplyQueue.length && performance.now() < end) {
      const it = meshApplyQueue.shift();
      if (chunkBuildVersions.get(it.key) !== it.version) continue;
      if (!chunkInCurrentWindow(it.cx, it.cz)) continue;
      applyPackedChunkState(it.cx, it.cz, it.packed);
      if (it.fromCache) meshWorkerStats.cacheHits++;
      else {
        meshWorkerStats.workerBuilds++;
        writeMeshCache(it.cacheKey, it.packed).then(() => { meshWorkerStats.cacheWrites++; publishMeshWorkerStats(); });
      }
      dirty = true;
    }
    if (dirty) publishMeshWorkerStats();
  }

  function processRebuildJob() {
    drainMeshApplyQueue();
    const job = rebuildJob;
    if (!job) return;
    const end = performance.now() + REBUILD_JOB_MS;
    while (job.i < job.keys.length && performance.now() < end) {
      const [cx, cz] = job.keys[job.i++].split(',').map(Number);
      const b = chunkBounds(cx, cz);
      if (b.x1 < job.x0 || b.x0 > job.x1 || b.z1 < job.z0 || b.z0 > job.z1) continue;
      rebuildChunk(cx, cz);
    }
    if (job.i >= job.keys.length) {
      rebuildPlants(job.x0, job.x1, job.z0, job.z1);
      if (rebuildJob === job) {
        rebuildJob = null;
        if (!pregenJob && !started) updatePreloadText('クリックして開始');
        if (pendingChunkKeys.size) {
          const keys = [...pendingChunkKeys];
          pendingChunkKeys.clear();
          const cx = winCX < 1e8 ? winCX : Math.floor(player.pos.x);
          const cz = winCZ < 1e8 ? winCZ : Math.floor(player.pos.z);
          startRebuildJob(keys, cx - WIN_R, cx + WIN_R, cz - WIN_R, cz + WIN_R);
        }
      }
    }
  }
