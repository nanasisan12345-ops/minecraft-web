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
  // 水だけの追加表現: 水面のうねり（頂点）と空の映り込み（フレネル）。
  // ライト合成はチャンク共通と同じ式を使う（水も焼き込みライトに従う必要があるため）。
  // uniform は 82-weather-and-loop.js が毎フレーム更新する。
  const WATER_SHADER = { time: { value: 0 }, sky: { value: new THREE.Color(0x9fc6f0) } };
  function applyWaterShader(m) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uMcDay = CHUNK_LIGHT_UNIFORM;
      shader.uniforms.uMcTime = WATER_SHADER.time;
      shader.uniforms.uMcSky = WATER_SHADER.sky;
      shader.vertexShader = 'attribute vec2 mcLight;\nvarying vec2 vMcLight;\nuniform float uMcTime;\n' +
        shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n\tvMcLight = mcLight;\n' +
          // 上面だけを小さく上下させる。側面と最大0.06ずれるが、半透明なので継ぎ目は見えない
          '\tif (normal.y > 0.5) transformed.y += sin(position.x * 1.6 + uMcTime * 1.7) * 0.030\n' +
          '\t\t+ sin(position.z * 2.1 + uMcTime * 1.3) * 0.024;');
      shader.fragmentShader = 'varying vec2 vMcLight;\nuniform float uMcDay;\nuniform vec3 uMcSky;\n' +
        shader.fragmentShader.replace('#include <opaque_fragment>',
          'vec3 mcBlockLit = diffuseColor.rgb * vec3(1.0, 0.85, 0.62) * vMcLight.y;\n' +
          '\toutgoingLight = max((outgoingLight - totalEmissiveRadiance) * (vMcLight.x * uMcDay), mcBlockLit) + totalEmissiveRadiance;\n' +
          // 浅い角度ほど空を映す。skylight を掛けるので洞窟の水は映り込まない
          '\tfloat mcFres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);\n' +
          '\toutgoingLight = mix(outgoingLight, uMcSky * vMcLight.x, mcFres * 0.42);\n' +
          '\t#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'mcChunkWater';
    if (m.normalScale) m.normalScale.set(0.32, 0.32); // 岩肌と同じ強さだと水面がザラつく
    return m;
  }
  function litChunkMats(ty) {
    if (!ty._litMats) {
      const isWater = ty === TYPES[WATER];
      const lit = (m) => (isWater ? applyWaterShader(m.clone()) : applyChunkLightShader(m.clone()));
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
