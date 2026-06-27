  /* ============== 可視面だけのチャンクメッシュ再構築 ============== */
  function occludes(x, y, z, self) {
    const nt = world.get(key(x, y, z));
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

  function chunkBounds(cx, cz) {
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    return { x0, x1: x0 + CHUNK_SIZE - 1, z0, z1: z0 + CHUNK_SIZE - 1 };
  }

  function buildChunkState(cx, cz) {
    const build = makeMeshBuildState();
    const b = chunkBounds(cx, cz);
    for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) {
      for (let y = CHUNK_Y_MIN; y <= CHUNK_Y_MAX; y++) {
        const t = world.get(key(x, y, z));
        if (t !== undefined) addBlockToState(build, x, y, z, t);
      }
    }
    return build;
  }

  function applyChunkState(cx, cz, build) {
    const id = chunkKey(cx, cz);
    const chunk = terrainChunks.get(id) || createTerrainChunk(cx, cz);
    for (let t = 0; t < TYPES.length; t++) {
      drawCountsByType[t] += build[t].blocks - chunk.counts[t];
      chunk.counts[t] = build[t].blocks;
      const mesh = chunk.meshes[t], old = mesh.geometry;
      mesh.geometry = buildGeometry(build[t]);
      mesh.visible = build[t].blocks > 0;
      if (old) old.dispose();
    }
  }

  function rebuildChunk(cx, cz) {
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
    const keys = chunkKeysOutsideOldArea(x0, x1, z0, z1, oldX0, oldX1, oldZ0, oldZ1);
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
    const keys = new Set();
    for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) keys.add(chunkKey(chunkCoord(x + dx), chunkCoord(z + dz)));
    for (const id of keys) {
      const [cx, cz] = id.split(',').map(Number);
      rebuildChunk(cx, cz);
    }
    rebuildPlants(winCX - WIN_R, winCX + WIN_R, winCZ - WIN_R, winCZ + WIN_R);
  }

  function processRebuildJob() {
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
