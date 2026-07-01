  /* ============== 草花（クロス型ビルボード） ============== */
  function makeCutout(draw) {
    const S = 16, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); g.clearRect(0, 0, S, S); draw(g, S);
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function crossGeometry() {
    const g = new THREE.BufferGeometry(), h = 0.92, w = 0.45, pos = [], uv = [], idx = [];
    const quad = (ax) => {
      const b = pos.length / 3;
      if (ax === 'z') pos.push(-w, 0, 0, w, 0, 0, w, h, 0, -w, h, 0);
      else pos.push(0, 0, -w, 0, 0, w, 0, h, w, 0, h, -w);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    quad('z'); quad('x');
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const PLANTS = [
    { tex: makeCutout((g, S) => { for (let x = 1; x < S - 1; x++) { if (Math.random() < 0.5) continue; const bh = 4 + (Math.random() * 8 | 0); const col = tint(0x5fae3a, rnd(0.7, 1.12)); for (let y = S - 1; y >= S - bh; y--) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } }), max: 6000 },
    { tex: makeCutout((g, S) => { g.fillStyle = '#3f8a2e'; for (let y = 6; y < S; y++) g.fillRect(7, y, 2, 1); g.fillRect(5, 11, 2, 1); g.fillRect(9, 9, 2, 1); g.fillStyle = '#e23b3b'; g.fillRect(5, 3, 6, 4); g.fillStyle = '#ffd84a'; g.fillRect(7, 4, 2, 2); }), max: 1500 },
    { tex: makeCutout((g, S) => { g.fillStyle = '#3f8a2e'; for (let y = 6; y < S; y++) g.fillRect(7, y, 2, 1); g.fillRect(5, 10, 2, 1); g.fillRect(9, 12, 2, 1); g.fillStyle = '#ffe14a'; g.fillRect(5, 3, 6, 4); g.fillStyle = '#ffffff'; g.fillRect(7, 4, 2, 2); }), max: 1500 },
  ];
  const crossGeo = crossGeometry();
  const plantMeshes = PLANTS.map(p => {
    const mesh = new THREE.InstancedMesh(crossGeo, new THREE.MeshLambertMaterial({ map: p.tex, alphaTest: 0.5, side: THREE.DoubleSide }), p.max);
    mesh.count = 0; mesh.frustumCulled = false; scene.add(mesh); return mesh;
  });
  function plantKind(x, z) {
    if (inSpawnClearing(x, z, SPAWN_CLEAR_R)) return -1;
    if (structureAffectsColumn(x, z, 1)) return -1;
    const biome = biomeAt(x, z);
    const r = hash2(x * 1.7 + 5, z * 1.3 - 9);
    const flowerScale = biome.flower ?? 1;
    if (r < 0.012 * flowerScale) return 2;
    if (r < 0.03 * flowerScale) return 1;
    if (r < 0.20 * Math.max(0.18, flowerScale)) return 0;
    return -1;
  }
  // 窓全体(約2万列)を毎回同期スキャンするとブロック設置や窓移動のたびに大きくカクつくため、
  // フレーム予算で分割実行するジョブにする。完了時に count/needsUpdate を一括更新する。
  const _plantTmp = { pm: new THREE.Matrix4(), q: new THREE.Quaternion(), sv: new THREE.Vector3(), pv: new THREE.Vector3(), eu: new THREE.Euler() };
  let plantJob = null;
  const PLANT_JOB_MS = 2.0, PLANT_BATCH = 512;
  function startPlantRebuild(x0, x1, z0, z1) {
    plantJob = { x0, x1, z0, z1, x: x0, z: z0, cnt: [0, 0, 0] };
  }
  function commitPlantJob(job) {
    plantMeshes.forEach((m, i) => { m.count = job.cnt[i]; m.instanceMatrix.needsUpdate = true; });
  }
  function processPlantJob() {
    const job = plantJob;
    if (!job) return;
    const { pm, q, sv, pv, eu } = _plantTmp, cnt = job.cnt;
    const end = performance.now() + PLANT_JOB_MS;
    while (true) {
      for (let n = 0; n < PLANT_BATCH; n++) {
        const x = job.x, z = job.z;
        job.z++;
        if (job.z > job.z1) { job.z = job.z0; job.x++; }
        if (x > job.x1) { commitPlantJob(job); plantJob = null; return; }
        const h = heightAt(x, z);
        if (topTypeAt(x, z, h) !== GRASS) continue;
        if (blockAt(x, h, z) !== GRASS || hasBlock(x, h + 1, z)) continue;
        const pi = plantKind(x, z); if (pi < 0 || cnt[pi] >= PLANTS[pi].max) continue;
        pv.set(x + 0.5, h + 1, z + 0.5); eu.set(0, hash2(x * 3, z * 3) * Math.PI, 0); q.setFromEuler(eu);
        const sc = pi === 0 ? 0.8 + hash2(x, z) * 0.35 : 1; sv.set(sc, sc, sc);
        pm.compose(pv, q, sv); plantMeshes[pi].setMatrixAt(cnt[pi]++, pm);
      }
      if (performance.now() >= end) return;
    }
  }
  // 既存の呼び出し名は維持（中身をジョブ起動に差し替え）
  function rebuildPlants(x0, x1, z0, z1) { startPlantRebuild(x0, x1, z0, z1); }
