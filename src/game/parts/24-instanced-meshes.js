  /* ============== チャンク化ブロックメッシュ（見える面だけを結合） ============== */
  const CHUNK_SIZE = 24, CHUNK_Y_MIN = 0, CHUNK_Y_MAX = 80;
  const terrainChunks = new Map();
  const drawCountsByType = TYPES.map(() => 0);
  const chunkKey = (cx, cz) => cx + ',' + cz;
  const chunkCoord = (v) => Math.floor(v / CHUNK_SIZE);

  const FACE_DEFS = [
    { n: [ 1,  0,  0], m: 0, v: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]], uv: [0,0, 0,1, 1,1, 1,0] },
    { n: [-1,  0,  0], m: 1, v: [[0,0,0], [0,0,1], [0,1,1], [0,1,0]], uv: [0,0, 1,0, 1,1, 0,1] },
    { n: [ 0,  1,  0], m: 2, v: [[0,1,0], [0,1,1], [1,1,1], [1,1,0]], uv: [0,0, 0,1, 1,1, 1,0] },
    { n: [ 0, -1,  0], m: 3, v: [[0,0,0], [1,0,0], [1,0,1], [0,0,1]], uv: [0,0, 1,0, 1,1, 0,1] },
    { n: [ 0,  0,  1], m: 4, v: [[0,0,1], [1,0,1], [1,1,1], [0,1,1]], uv: [0,0, 1,0, 1,1, 0,1] },
    { n: [ 0,  0, -1], m: 5, v: [[0,0,0], [0,1,0], [1,1,0], [1,0,0]], uv: [0,0, 0,1, 1,1, 1,0] },
  ];

  function makeChunkMesh(ty) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), ty.mats);
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = !ty.transparent;
    scene.add(mesh);
    return mesh;
  }

  function createTerrainChunk(cx, cz) {
    const chunk = { cx, cz, meshes: TYPES.map(makeChunkMesh), counts: TYPES.map(() => 0) };
    terrainChunks.set(chunkKey(cx, cz), chunk);
    return chunk;
  }

  function disposeTerrainChunk(chunk) {
    for (let t = 0; t < chunk.meshes.length; t++) {
      drawCountsByType[t] -= chunk.counts[t];
      const mesh = chunk.meshes[t];
      if (mesh.geometry) mesh.geometry.dispose();
      scene.remove(mesh);
    }
  }

  function renderedBlockCount() {
    return drawCountsByType.reduce((a, c) => a + c, 0);
  }
  function terrainChunkCount() {
    return terrainChunks.size;
  }
