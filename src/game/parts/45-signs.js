  /* ============== 看板テキスト（チャンクメッシュとは別のオーバーレイ層） ==============
   * 看板ブロック(SIGN 99-102)の板面に、SAVE.signs のテキストを CanvasTexture で貼る。
   * 数が少ないので window 連動はせず、ロード時/設置/編集/破壊で mesh を作り直す。
   * テキストは input.value / Canvas fillText のみで扱う（innerHTML は使わない）。 */
  const SIGN_MESHES = new Map(); // "x,y,z" -> { mesh, tex, mat, geo }
  const SIGN_ROWS = 4, SIGN_COLS = 15;
  const signKey = (x, y, z) => `${x},${y},${z}`;

  function signTextTexture(lines) {
    const W = 256, H = 128;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#2a1608';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lh = H / SIGN_ROWS;
    g.font = `bold ${Math.floor(lh * 0.6)}px "Yu Gothic", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`;
    for (let i = 0; i < SIGN_ROWS; i++) {
      const t = (lines && lines[i]) ? String(lines[i]) : '';
      if (t) g.fillText(t, W / 2, lh * (i + 0.5), W - 16);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  // 板の前面（テキストが向く側）の中心オフセットと平面の向き（dir=SIGNからの差 0..3）
  function signPlanePlacement(dir) {
    if (dir === 1) return { px: 0.36 - 0.012, pz: 0.5, rotY: -Math.PI / 2 };  // 板が -x を向く
    if (dir === 2) return { px: 0.5, pz: 0.36 - 0.012, rotY: Math.PI };        // -z
    if (dir === 3) return { px: 0.64 + 0.012, pz: 0.5, rotY: Math.PI / 2 };    // +x
    return { px: 0.5, pz: 0.64 + 0.012, rotY: 0 };                             // dir 0: +z
  }
  function removeSignMesh(x, y, z) {
    const k = signKey(x, y, z);
    const e = SIGN_MESHES.get(k);
    if (!e) return;
    scene.remove(e.mesh);
    if (e.geo) e.geo.dispose();
    if (e.mat) e.mat.dispose();
    if (e.tex) e.tex.dispose();
    SIGN_MESHES.delete(k);
  }
  function refreshSignMesh(x, y, z) {
    removeSignMesh(x, y, z);
    const t = blockAt(x, y, z);
    if (t === undefined || t < SIGN || t >= SIGN + 4) return;      // その座標に看板が無い
    const lines = SAVE.signs && SAVE.signs[signKey(x, y, z)];
    if (!lines || !lines.some(s => s)) return;                     // テキスト空なら板そのまま（オーバーレイ不要）
    const tex = signTextTexture(lines);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const geo = new THREE.PlaneGeometry(0.8, 0.34);
    const mesh = new THREE.Mesh(geo, mat);
    const p = signPlanePlacement(t - SIGN);
    mesh.position.set(x + p.px, y + 0.67, z + p.pz);
    mesh.rotation.y = p.rotY;
    mesh.renderOrder = 2;
    scene.add(mesh);
    SIGN_MESHES.set(signKey(x, y, z), { mesh, tex, mat, geo });
  }
  // 全看板を SAVE.signs から作り直す（ワールドロード時に一度呼ぶ）
  function refreshAllSigns() {
    for (const k of [...SIGN_MESHES.keys()]) { const c = k.split(',').map(Number); removeSignMesh(c[0], c[1], c[2]); }
    if (!SAVE.signs) return;
    for (const k of Object.keys(SAVE.signs)) { const c = k.split(',').map(Number); refreshSignMesh(c[0], c[1], c[2]); }
  }
  // 看板を壊したときにテキストとオーバーレイを消す
  function deleteSignText(x, y, z) {
    if (SAVE.signs) delete SAVE.signs[signKey(x, y, z)];
    removeSignMesh(x, y, z);
    markSaveDirty();
  }

  /* --- 編集ダイアログ（ポインタ解放 → 4行入力 → 確定で保存） --- */
  let signDialog = null, signInputs = null, signEditTarget = null;
  function buildSignDialog() {
    const back = document.createElement('div');
    back.id = 'signEditor';
    back.style.cssText = 'position:fixed;inset:0;z-index:6000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:#3a2a18;border:3px solid #1c130a;border-radius:8px;padding:18px 20px;box-shadow:0 8px 30px rgba(0,0,0,0.5);font-family:sans-serif;color:#f0e0c0;text-align:center;';
    const title = document.createElement('div');
    title.textContent = '看板を編集（4行・各15文字まで）';
    title.style.cssText = 'font-weight:bold;margin-bottom:10px;';
    panel.appendChild(title);
    signInputs = [];
    for (let i = 0; i < SIGN_ROWS; i++) {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.maxLength = SIGN_COLS;
      inp.style.cssText = 'display:block;margin:4px auto;width:220px;padding:4px 6px;font-size:15px;text-align:center;background:#d8c39a;color:#2a1608;border:1px solid #1c130a;border-radius:3px;';
      panel.appendChild(inp);
      signInputs.push(inp);
    }
    const row = document.createElement('div');
    row.style.cssText = 'margin-top:12px;';
    const ok = document.createElement('button');
    ok.textContent = '確定'; ok.style.cssText = 'margin:0 6px;padding:5px 16px;cursor:pointer;';
    const cancel = document.createElement('button');
    cancel.textContent = 'キャンセル'; cancel.style.cssText = 'margin:0 6px;padding:5px 16px;cursor:pointer;';
    ok.addEventListener('click', () => closeSignEditor(true));
    cancel.addEventListener('click', () => closeSignEditor(false));
    row.appendChild(ok); row.appendChild(cancel);
    panel.appendChild(row);
    back.appendChild(panel);
    // ゲーム側のキーバインド(R等)・クリックを奪われないよう、ダイアログ内のイベントは伝播させない
    back.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') closeSignEditor(true);
      else if (e.key === 'Escape') closeSignEditor(false);
    });
    back.addEventListener('keyup', (e) => e.stopPropagation());
    back.addEventListener('mousedown', (e) => e.stopPropagation());
    document.body.appendChild(back);
    signDialog = back;
  }
  function openSignEditor(x, y, z) {
    if (!signDialog) buildSignDialog();
    const t = blockAt(x, y, z);
    if (t === undefined || t < SIGN || t >= SIGN + 4) return;
    signEditTarget = { x, y, z };
    const cur = (SAVE.signs && SAVE.signs[signKey(x, y, z)]) || [];
    for (let i = 0; i < SIGN_ROWS; i++) signInputs[i].value = cur[i] || '';
    signDialog.style.display = 'flex';
    if (typeof releasePointerForUi === 'function') releasePointerForUi();
    setTimeout(() => signInputs[0].focus(), 0);
  }
  function closeSignEditor(save) {
    if (!signDialog) return;
    if (save && signEditTarget) {
      const lines = signInputs.map(inp => inp.value.slice(0, SIGN_COLS));
      const { x, y, z } = signEditTarget;
      if (!SAVE.signs) SAVE.signs = {};
      if (lines.some(s => s)) SAVE.signs[signKey(x, y, z)] = lines;
      else delete SAVE.signs[signKey(x, y, z)];
      markSaveDirty();
      refreshSignMesh(x, y, z);
    }
    signDialog.style.display = 'none';
    signEditTarget = null;
    if (typeof relockPointerForGame === 'function') relockPointerForGame();
  }
