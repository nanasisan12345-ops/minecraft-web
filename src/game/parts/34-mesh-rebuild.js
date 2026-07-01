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
  const MESH_WORKER_VERSION = 4;
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
        indices: Array.from({ length: groupCount }, () => []),
        blocks: 0,
      };
    });
  }

  function addBlockFaceToState(state, x, y, z, f) {
    const fd = FACE_DEFS[f];
    const group = state.positions.length === 1 ? 0 : fd.m;
    const pos = state.positions[group], norm = state.normals[group], uv = state.uvs[group], idx = state.indices[group];
    const base = pos.length / 3;
    for (const p of fd.v) {
      pos.push(x + p[0], y + p[1], z + p[2]);
      norm.push(fd.n[0], fd.n[1], fd.n[2]);
    }
    uv.push(...fd.uv);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  function addBlockToState(build, x, y, z, t) {
    let added = false;
    for (let f = 0; f < FACE_DEFS.length; f++) {
      if (!faceVisible(x, y, z, t, f)) continue;
      addBlockFaceToState(build[t], x, y, z, f);
      added = true;
    }
    if (added) build[t].blocks++;
  }

  function buildGeometry(state) {
    const geo = new THREE.BufferGeometry();
    const pos = [], norm = [], uv = [], idx = [];
    for (let g = 0; g < state.positions.length; g++) {
      const gp = state.positions[g];
      if (!gp.length) continue;
      const vertexOffset = pos.length / 3;
      const indexStart = idx.length;
      for (let i = 0; i < gp.length; i++) pos.push(gp[i]);
      const gn = state.normals[g], guv = state.uvs[g], gi = state.indices[g];
      for (let i = 0; i < gn.length; i++) norm.push(gn[i]);
      for (let i = 0; i < guv.length; i++) uv.push(guv[i]);
      for (let i = 0; i < gi.length; i++) idx.push(gi[i] + vertexOffset);
      geo.addGroup(indexStart, gi.length, g);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
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
    const blocks = [], airs = [], editEntries = [], blockedColumns = [];
    let hash = 2166136261 >>> 0;
    const includeXYZ = (x, y, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1 && y >= CHUNK_Y_MIN - 1 && y <= CHUNK_Y_MAX + 1;
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
      blocks,
      airs,
      edits: editEntries,
      blockedColumns,
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
    }
  }

  function rebuild() {
    rebuildJob = null;
    pendingChunkKeys.clear();
    for (const chunk of terrainChunks.values()) disposeTerrainChunk(chunk);
    terrainChunks.clear();
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

  function requestEditedBlockRebuild(x, y, z) {
    if (typeof noteColumnY === 'function') noteColumnY(x, y, z);
    const keys = new Set();
    for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) keys.add(chunkKey(chunkCoord(x + dx), chunkCoord(z + dz)));
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
