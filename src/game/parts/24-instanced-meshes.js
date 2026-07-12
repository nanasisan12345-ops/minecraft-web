  /* ============== チャンク化ブロックメッシュ（見える面だけを結合） ============== */
  const CHUNK_SIZE = 24, CHUNK_Y_MIN = -64, CHUNK_Y_MAX = 319;
  const terrainChunks = new Map();
  const drawCountsByType = TYPES.map(() => 0);
  const chunkKey = (cx, cz) => cx + ',' + cz;
  const chunkCoord = (v) => Math.floor(v / CHUNK_SIZE);
  // 構造物が書き込んだチャンク。窓移動時に重なり領域でも必ず再メッシュするため記録する。
  const dirtyStructureChunks = new Set();

  const FACE_DEFS = [
    { n: [ 1,  0,  0], m: 0, v: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]], uv: [0,0, 0,1, 1,1, 1,0] },
    { n: [-1,  0,  0], m: 1, v: [[0,0,0], [0,0,1], [0,1,1], [0,1,0]], uv: [0,0, 1,0, 1,1, 0,1] },
    { n: [ 0,  1,  0], m: 2, v: [[0,1,0], [0,1,1], [1,1,1], [1,1,0]], uv: [0,0, 0,1, 1,1, 1,0] },
    { n: [ 0, -1,  0], m: 3, v: [[0,0,0], [1,0,0], [1,0,1], [0,0,1]], uv: [0,0, 1,0, 1,1, 0,1] },
    { n: [ 0,  0,  1], m: 4, v: [[0,0,1], [1,0,1], [1,1,1], [0,1,1]], uv: [0,0, 1,0, 1,1, 0,1] },
    { n: [ 0,  0, -1], m: 5, v: [[0,0,0], [0,1,0], [1,1,0], [1,0,0]], uv: [0,0, 0,1, 1,1, 1,0] },
  ];

  // チャンク地形専用マテリアル: ライトエンジンが焼いた頂点属性 mcLight = [sky, block] を
  // シェーダー注入で合成する。TYPES.mats 本体はアイテムドロップ/手持ち表示と共有していて、
  // そちらのジオメトリには mcLight 属性が無いので触らない（クローンのみ改造する）。
  // 合成則: 出力 = max(シーンライト結果 × sky × uMcDay, テクスチャ色 × 松明暖色 × block) + 発光。
  //  - sky チャンネルはシーンの昼夜（環境光の減衰）に従う
  //  - block チャンネル（松明等）はシーンライトと独立＝夜でも洞窟でも一定の明るさ
  const CHUNK_LIGHT_UNIFORM = { value: 1.0 }; // 予備の昼夜係数（現状1.0固定。全チャンク共有）
  function applyChunkLightShader(m) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uMcDay = CHUNK_LIGHT_UNIFORM;
      shader.vertexShader = 'attribute vec2 mcLight;\nvarying vec2 vMcLight;\n' +
        shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvMcLight = mcLight;');
      shader.fragmentShader = 'varying vec2 vMcLight;\nuniform float uMcDay;\n' +
        shader.fragmentShader.replace('#include <opaque_fragment>',
          'vec3 mcBlockLit = diffuseColor.rgb * vec3(1.0, 0.85, 0.62) * vMcLight.y;\n' +
          '\toutgoingLight = max((outgoingLight - totalEmissiveRadiance) * (vMcLight.x * uMcDay), mcBlockLit) + totalEmissiveRadiance;\n' +
          '\t#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'mcChunkLight';
    return m;
  }
  function litChunkMats(ty) {
    if (!ty._litMats) {
      const lit = (m) => applyChunkLightShader(m.clone());
      ty._litMats = Array.isArray(ty.mats) ? ty.mats.map(lit) : lit(ty.mats);
    }
    return ty._litMats;
  }
  function makeChunkMesh(ty) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), litChunkMats(ty));
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
      // EMPTY_GEO（空タイプ共有ジオメトリ）は使い回すので dispose しない
      if (mesh.geometry && mesh.geometry !== EMPTY_GEO) mesh.geometry.dispose();
      scene.remove(mesh);
    }
  }

  function renderedBlockCount() {
    return drawCountsByType.reduce((a, c) => a + c, 0);
  }
  function terrainChunkCount() {
    return terrainChunks.size;
  }
