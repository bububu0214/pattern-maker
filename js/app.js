/* 介面控制 */
(function () {
  'use strict';
  var PM = window.PM, f1 = PM.fmt;
  var form = document.getElementById('form');
  var preview = document.getElementById('preview');
  var STORE = 'pattern-maker-v2';
  var current = null;
  var zoom = 0; // 0 = 全圖；否則每厘米像素

  var NUM = ['bust', 'waist', 'hip', 'shoulder', 'backLen', 'frontLen', 'neck', 'armhole',
    'waistToHip', 'armLen', 'upperArm', 'wrist',
    'easeBust', 'easeWaist', 'easeHip', 'easeNeck', 'easeArmhole', 'sa',
    'neckWiden', 'neckDropF', 'neckDropB', 'hemLen', 'flare', 'sleeveLen', 'ext'];
  var SEL = ['neckline', 'lengthPreset', 'hemShape', 'sleeve', 'fit'];
  var CHK = ['cfFold', 'cbFold', 'dims', 'opening'];
  var defaults = readForm();

  /* ---------- 預設值對照 ---------- */
  var FIT_EASE = {
    fitted: { easeBust: 6, easeWaist: 4, easeHip: 4 },
    regular: { easeBust: 10, easeWaist: 12, easeHip: 8 },
    loose: { easeBust: 16, easeWaist: 16, easeHip: 12 }
  };
  function lengthFor(preset, v) {
    return { cropped: -6, waist: 0, hip: v.waistToHip + 2, tunic: v.waistToHip + 18, dress: 58 }[preset];
  }
  function sleeveLenFor(type, v) {
    return { none: 0, short: 20, elbow: Math.round(v.armLen * 0.75), long: v.armLen }[type];
  }

  function readForm() {
    var v = {};
    NUM.forEach(function (k) { v[k] = parseFloat(form.elements[k].value); });
    SEL.forEach(function (k) { v[k] = form.elements[k].value; });
    CHK.forEach(function (k) { v[k] = form.elements[k].checked; });
    return v;
  }
  function writeForm(v) {
    NUM.forEach(function (k) { if (v[k] != null && !isNaN(v[k])) form.elements[k].value = v[k]; });
    SEL.forEach(function (k) { if (v[k]) form.elements[k].value = v[k]; });
    CHK.forEach(function (k) { if (typeof v[k] === 'boolean') form.elements[k].checked = v[k]; });
    syncControls();
  }
  function setVal(k, val) { form.elements[k].value = val; }

  /* 選項之間嘅連動 */
  function syncControls() {
    var v = readForm();
    form.elements.cfFold.disabled = v.opening;
    form.elements.ext.disabled = !v.opening;
    form.elements.flare.disabled = v.hemShape !== 'aline';
    form.elements.sleeveLen.disabled = v.sleeve === 'none';
  }
  form.elements.fit.addEventListener('change', function () {
    var e = FIT_EASE[form.elements.fit.value];
    Object.keys(e).forEach(function (k) { setVal(k, e[k]); });
  });
  form.elements.lengthPreset.addEventListener('change', function () {
    var p = form.elements.lengthPreset.value;
    if (p !== 'custom') setVal('hemLen', lengthFor(p, readForm()));
  });
  form.elements.hemLen.addEventListener('input', function () { setVal('lengthPreset', 'custom'); });
  form.elements.hemShape.addEventListener('change', function () {
    if (form.elements.hemShape.value === 'aline' && !(parseFloat(form.elements.flare.value) > 0)) setVal('flare', 4);
    syncControls();
  });
  form.elements.sleeve.addEventListener('change', function () {
    setVal('sleeveLen', sleeveLenFor(form.elements.sleeve.value, readForm()));
    syncControls();
  });
  form.elements.opening.addEventListener('change', syncControls);

  /* ---------- 生成 ---------- */
  function generate() {
    var v = readForm();
    var bad = NUM.filter(function (k) { return !form.elements[k].disabled && (isNaN(v[k]) || !form.elements[k].checkValidity()); });
    if (bad.length) {
      showWarnings(['請檢查紅框嘅數值（空白或者超出範圍）。']);
      return;
    }
    try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* 私隱模式 */ }

    var m = {
      bust: v.bust, waist: v.waist, hip: v.hip, shoulder: v.shoulder, backLen: v.backLen, frontLen: v.frontLen,
      neck: v.neck, armhole: v.armhole, waistToHip: v.waistToHip, armLen: v.armLen, upperArm: v.upperArm, wrist: v.wrist
    };
    var ease = { bust: v.easeBust, waist: v.easeWaist, hip: v.easeHip, neck: v.easeNeck, armhole: v.easeArmhole };
    var style = {
      neckline: v.neckline, neckWiden: v.neckWiden || 0, neckDropF: v.neckDropF || 0, neckDropB: v.neckDropB || 0,
      hemLen: v.hemLen || 0, hemShape: v.hemShape, flare: v.flare || 0,
      sleeve: v.sleeve, sleeveLen: v.sleeveLen || 0, fit: v.fit,
      opening: v.opening, ext: v.ext || 2, cfFold: v.cfFold, cbFold: v.cbFold
    };
    var res = PM.draft(m, ease, style);
    var model = PM.layout(res, { sa: v.sa, dims: v.dims });
    current = { v: v, m: m, ease: ease, res: res, model: model };

    preview.innerHTML = PM.toSVG(model, { screen: true }).replace(/^<\?xml[^>]*>\s*/, '');
    applyZoom();
    showWarnings(res.warnings);
    showInfo(res.info, v);
    ['dlPdf', 'dlSvg', 'dlDxf', 'dlSeamly'].forEach(function (id) { document.getElementById(id).disabled = false; });
  }

  /* ---------- 預覽縮放 ---------- */
  function applyZoom() {
    var svg = preview.querySelector('svg');
    if (!svg || !current) return;
    var k = zoom || fitScale();
    svg.setAttribute('width', Math.floor(current.model.width * k));
    svg.setAttribute('height', Math.floor(current.model.height * k));
  }
  function fitScale() {
    if (!current) return 10;
    var maxH = window.innerWidth <= 800 ? window.innerHeight * 0.6 : window.innerHeight * 0.72;
    return Math.min((preview.clientWidth - 2) / current.model.width, maxH / current.model.height);
  }
  window.addEventListener('resize', function () { if (!zoom) applyZoom(); });
  document.getElementById('zoomIn').onclick = function () { zoom = (zoom || fitScale()) * 1.4; applyZoom(); };
  document.getElementById('zoomOut').onclick = function () { zoom = Math.max(2, (zoom || fitScale()) / 1.4); applyZoom(); };
  document.getElementById('zoomFit').onclick = function () { zoom = 0; applyZoom(); };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function showWarnings(list) {
    document.getElementById('warnings').innerHTML = list.map(function (w) {
      return '<div class="warn">⚠️ ' + esc(w) + '</div>';
    }).join('');
  }

  function showInfo(i, v) {
    var rows = [
      ['成品胸圍（連放鬆量）', i.bustTotal, v.bust + v.easeBust],
      ['成品腰圍（連放鬆量）', i.waistTotal, v.fit === 'loose' ? null : v.waist + v.easeWaist]
    ];
    if (i.hemLen > v.waistToHip) rows.push(['成品臀圍（連放鬆量）', i.hipTotal, v.hip + v.easeHip]);
    rows.push(
      ['夾圈長（前＋後）', i.armBack + i.armFront, v.armhole + v.easeArmhole],
      ['　後夾圈 / 前夾圈', null, null, f1(i.armBack) + ' / ' + f1(i.armFront)],
      ['基本領圍（前＋後）×2', (i.neckBack + i.neckFront) * 2, v.neck + v.easeNeck],
      ['款式領口（前＋後）×2', (i.neckBackStyled + i.neckFrontStyled) * 2, null],
      ['夾圈深（肩點至胸圍線）', i.armDepth],
      ['後肩長 / 前肩長', null, null, f1(i.shoulderBack) + ' / ' + f1(i.shoulderFront)],
      ['後腰褶 / 前腰褶', null, null, f1(i.dartBack) + ' / ' + f1(i.dartFront)],
      ['腰下長度', i.hemLen]
    );
    if (i.sleeve) {
      rows.push(
        ['袖山弧長 / 吃勢', null, null, f1(i.sleeve.capLen) + ' / ' + f1(i.sleeve.capEase)],
        ['袖山高', i.sleeve.capHeight],
        ['袖寬（上臂）', i.sleeve.bicep, v.upperArm],
        ['袖長 / 袖口', null, null, f1(i.sleeve.len) + ' / ' + f1(i.sleeve.hemW)]
      );
    }
    document.getElementById('info').innerHTML = '<table><tr><th>項目</th><th>紙樣（cm）</th><th>參考（cm）</th></tr>' +
      rows.map(function (r) {
        var a = r[3] != null ? r[3] : (r[1] != null ? f1(r[1]) : '');
        return '<tr><td>' + r[0] + '</td><td class="num">' + a + '</td><td class="num">' + (r[2] != null ? f1(r[2]) : '') + '</td></tr>';
      }).join('') + '</table>';
  }

  /* ---------- 下載 ---------- */
  // 喺 claude.ai 網上版用平台嘅下載功能；一般瀏覽器就用普通下載
  var hasClaude = !!(window.claude && typeof window.claude.use === 'function');
  var claudeDl = hasClaude ? window.claude.use('downloads').catch(function () { return null; }) : null;

  function download(data, name, type) {
    if (claudeDl) {
      claudeDl.then(function (dl) {
        if (!dl) return plainDownload(data, name, type);
        dl.save({ filename: name, data: new Blob([data], { type: type }) }).catch(function (err) {
          if (err && err.code === 'declined') return;
          var msg = err && (err.code === 'rejected_extension' || err.code === 'extension_not_enabled')
            ? '呢個網上版唔支援下載 ' + name.split('.').pop().toUpperCase() + ' 檔，請用電腦版（見 README）。'
            : '下載失敗：' + ((err && err.message) || '未知錯誤');
          showWarnings((current ? current.res.warnings : []).concat([msg]));
        });
      });
      return;
    }
    plainDownload(data, name, type);
  }
  function plainDownload(data, name, type) {
    var url = URL.createObjectURL(new Blob([data], { type: type }));
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function stamp() { return 'top_B' + current.v.bust + '_W' + current.v.waist; }

  var NAMES = {
    neckline: { round: 'round neck', v: 'V-neck', square: 'square neck', boat: 'boat neck' },
    sleeve: { none: 'sleeveless', short: 'short sleeve', elbow: '3/4 sleeve', long: 'long sleeve' },
    fit: { fitted: 'fitted', regular: 'regular fit', loose: 'loose' }
  };
  function styleLine(v) {
    return NAMES.neckline[v.neckline] + ', ' + NAMES.sleeve[v.sleeve] + ', ' + NAMES.fit[v.fit] +
      ', length ' + (v.hemLen >= 0 ? '+' : '') + v.hemLen + ' from waist' + (v.hemShape === 'aline' ? ', A-line' : '') +
      (v.opening ? ', front opening' : '');
  }

  document.getElementById('dlSvg').onclick = function () {
    if (current) download(PM.toSVG(current.model, {}), stamp() + '.svg', 'image/svg+xml');
  };
  document.getElementById('dlDxf').onclick = function () {
    if (current) download(PM.toDXF(current.model), stamp() + '.dxf', 'application/dxf');
  };
  document.getElementById('dlSeamly').onclick = function () {
    if (!current) return;
    var v = current.v;
    var desc = 'Women\'s top: ' + styleLine(v) + '. Bust ' + v.bust + '+' + v.easeBust + ', Waist ' + v.waist + '+' + v.easeWaist +
      ', Hip ' + v.hip + '+' + v.easeHip + ', Shoulder ' + v.shoulder + ', Back length ' + v.backLen + ', Front length ' + v.frontLen +
      ', Neck ' + v.neck + ', Armhole ' + v.armhole + '+' + v.easeArmhole + ' (cm)';
    download(PM.toSeamly(current.res, { sa: v.sa, description: desc }), stamp() + '.sm2d', 'application/xml');
  };
  document.getElementById('dlPdf').onclick = function () {
    if (!current) return;
    var v = current.v, i = current.res.info;
    var lines = [
      'Style: ' + styleLine(v),
      'Bust ' + v.bust + ' (+' + v.easeBust + ')   Waist ' + v.waist + ' (+' + v.easeWaist + ')   Hip ' + v.hip + ' (+' + v.easeHip + ')',
      'Shoulder width ' + v.shoulder + '   Neck ' + v.neck + ' (+' + v.easeNeck + ')',
      'Back length ' + v.backLen + '   Front length ' + v.frontLen,
      'Armhole ' + v.armhole + ' (+' + v.easeArmhole + ')   Waist to hip ' + v.waistToHip,
      'Arm length ' + v.armLen + '   Upper arm ' + v.upperArm + '   Wrist ' + v.wrist,
      'Seam allowance ' + v.sa + ' cm' + (v.cfFold && !v.opening ? ' | CF on fold' : '') + (v.cbFold ? ' | CB on fold' : ''),
      '',
      'Pattern: armhole F+B ' + f1(i.armBack + i.armFront) + ', darts back ' + f1(i.dartBack) + ' / front ' + f1(i.dartFront)
    ];
    if (i.sleeve) lines.push('Sleeve: cap ' + f1(i.sleeve.capLen) + ' (ease ' + f1(i.sleeve.capEase) + '), bicep ' + f1(i.sleeve.bicep) + ', length ' + f1(i.sleeve.len));
    if (v.opening) lines.push('Front facing not included.');
    download(PM.toPDF(current.model, { lines: lines, title: 'Women\'s Top Pattern - ' + NAMES.neckline[v.neckline] + ', ' + NAMES.sleeve[v.sleeve] }), stamp() + '_A4.pdf', 'application/pdf');
  };

  /* ---------- 上傳圖片 + AI 分析 ---------- */
  var imgInput = document.getElementById('styleImage');
  var imgWrap = document.getElementById('imgWrap');
  var imgPreview = document.getElementById('imgPreview');
  var analyzeBtn = document.getElementById('analyze');
  var aiHint = document.getElementById('aiHint');
  var aiResult = document.getElementById('aiResult');
  var imageFile = null, imageUrl = null, sampleFn = null, aiBusy = false;

  imgInput.addEventListener('change', function () {
    var f = imgInput.files && imgInput.files[0];
    if (!f) return;
    imageFile = f;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(f);
    imgPreview.src = imageUrl;
    imgWrap.hidden = false;
    aiResult.innerHTML = '';
    if (sampleFn) analyzeBtn.hidden = false;
  });

  if (hasClaude) {
    window.claude.use('sample').then(function (s) {
      if (!s) return;
      return s.limits().then(function (lim) {
        if (!lim || !lim.images) return;
        sampleFn = s;
        aiHint.textContent = '上傳衫嘅設計圖或者相，撳「AI 分析款式」，AI 會認出領口、衫長、袖同鬆緊度，自動填好款式。';
        if (imageFile) analyzeBtn.hidden = false;
      });
    }).catch(function () { /* 用唔到 AI：保持手動 */ });
  }

  /** 縮細圖片（JPEG，最長邊 1600px） */
  function shrinkImage(file) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { resolve(b || file); }, 'image/jpeg', 0.88);
      };
      img.onerror = function () { resolve(file); };
      img.src = imageUrl;
    });
  }

  var AI_PROMPT = [
    'You are a pattern-making assistant. The image shows a garment design (a sketch or a photo).',
    'Identify the TOP (upper-body garment or the bodice of a dress) and classify its features for a women\'s bodice pattern generator.',
    'Reply with ONLY a JSON object, no other text, exactly in this shape:',
    '{"isTop": true, "summary": "...", "neckline": "round|v|square|boat", "neckWidth": "narrow|medium|wide|very_wide",',
    ' "frontNeckDepth": "high|medium|low|deep", "backNeckDepth": "high|medium|low",',
    ' "length": "cropped|waist|hip|tunic|dress", "hem": "straight|aline", "sleeve": "none|short|elbow|long",',
    ' "fit": "fitted|regular|loose", "frontOpening": false, "notes": "..."}',
    'Definitions: neckWidth = how far the neckline opens towards the shoulders (narrow = sits at the base of the neck).',
    'frontNeckDepth: high = at the base of the neck, medium = a little lower, low = well below the collarbone, deep = near or below the bust line.',
    'length: cropped = ends above the waist, waist = at the waist, hip = at the hips, tunic = mid-thigh, dress = knee length or longer.',
    'sleeve: short = above the elbow, elbow = elbow to 3/4, long = to the wrist. Cap sleeves count as short.',
    'fit: fitted = shaped to the body with darts or seams, regular = some shaping, loose = boxy or flowing.',
    'frontOpening = true if it opens at centre front with buttons or a zip.',
    'summary: one short sentence in Traditional Chinese (Cantonese, Hong Kong style) describing the garment.',
    'notes: in Traditional Chinese (Cantonese), list design details this simple generator cannot make (collars, pockets, ruffles, gathers, princess seams, asymmetry, wrap fronts, etc.), or "" if none.',
    'If the image is not a garment or has no top, set "isTop": false and explain in "summary".'
  ].join('\n');

  var LEVELS = {
    neckWidth: { narrow: 0, medium: 1.5, wide: 3.5, very_wide: 6 },
    frontNeckDepth: { high: 0, medium: 2.5, low: 6, deep: 12 },
    backNeckDepth: { high: 0, medium: 1, low: 4 }
  };
  var ZH = {
    neckline: { round: '圓領', v: 'V 領', square: '方領', boat: '一字領' },
    length: { cropped: '短身', waist: '及腰', hip: '及臀', tunic: '長身', dress: '連身裙長' },
    sleeve: { none: '無袖', short: '短袖', elbow: '七分袖', long: '長袖' },
    fit: { fitted: '修身', regular: '合身', loose: '寬鬆' },
    hem: { straight: '直腳', aline: 'A 字' }
  };
  function pick(val, allowed, dflt) { return allowed.indexOf(val) >= 0 ? val : dflt; }

  function applyAI(r) {
    var v = readForm();
    var neckline = pick(r.neckline, ['round', 'v', 'square', 'boat'], 'round');
    var nw = LEVELS.neckWidth[r.neckWidth]; if (nw == null) nw = 0;
    var fd = LEVELS.frontNeckDepth[r.frontNeckDepth]; if (fd == null) fd = 0;
    var bd = LEVELS.backNeckDepth[r.backNeckDepth]; if (bd == null) bd = 0;
    if (neckline === 'boat') { nw = Math.max(nw, 4); fd = Math.min(fd, 0) - 2; bd = Math.max(bd, 1); }
    if (neckline === 'v') fd = Math.max(fd, 6);
    if (neckline === 'square') fd = Math.max(fd, 4);
    var length = pick(r.length, ['cropped', 'waist', 'hip', 'tunic', 'dress'], 'waist');
    var sleeve = pick(r.sleeve, ['none', 'short', 'elbow', 'long'], 'none');
    var fit = pick(r.fit, ['fitted', 'regular', 'loose'], 'fitted');
    var hem = pick(r.hem, ['straight', 'aline'], 'straight');

    setVal('neckline', neckline);
    setVal('neckWiden', nw); setVal('neckDropF', fd); setVal('neckDropB', bd);
    setVal('lengthPreset', length); setVal('hemLen', lengthFor(length, v));
    setVal('hemShape', hem); setVal('flare', hem === 'aline' ? (length === 'dress' ? 8 : 4) : 0);
    setVal('sleeve', sleeve); setVal('sleeveLen', sleeveLenFor(sleeve, v));
    setVal('fit', fit);
    var e = FIT_EASE[fit]; Object.keys(e).forEach(function (k) { setVal(k, e[k]); });
    form.elements.opening.checked = !!r.frontOpening;
    syncControls();

    aiResult.innerHTML = '<div class="ai"><p><b>AI 睇到：</b>' + esc(r.summary || '') + '</p>' +
      '<p>已設定：' + ZH.neckline[neckline] + '、' + ZH.length[length] + '、' + ZH.hem[hem] + '、' + ZH.sleeve[sleeve] + '、' +
      ZH.fit[fit] + (r.frontOpening ? '、前中開胸' : '') + '</p>' +
      (r.notes ? '<p>⚠️ 未能做到嘅細節：' + esc(r.notes) + '</p>' : '') +
      '<p class="hint">AI 估嘅款式未必完全準，可以喺下面再改。</p></div>';
    generate();
  }

  analyzeBtn.addEventListener('click', function () {
    if (!sampleFn || !imageFile || aiBusy) return;
    aiBusy = true;
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'AI 分析緊…（大約半分鐘）';
    aiResult.innerHTML = '';
    shrinkImage(imageFile).then(function (blob) {
      return sampleFn.json(AI_PROMPT, { images: [blob] });
    }).then(function (r) {
      if (!r || typeof r !== 'object') throw { code: 'invalid_json' };
      if (r.isTop === false) {
        aiResult.innerHTML = '<div class="ai err"><p>' + esc(r.summary || 'AI 認唔到上衣款式。') + '</p></div>';
        return;
      }
      applyAI(r);
    }).catch(function (e) {
      var code = e && e.code;
      var msg = {
        not_granted: '未允許使用 AI，所以分析唔到。可以喺下面自己揀款式。',
        rate_limited: '用量暫時太多，請遲啲再試。',
        image_rejected: '呢張圖用唔到，請試另一張（JPG／PNG）。',
        invalid_json: 'AI 回覆格式唔啱，請再撳一次。',
        refused: 'AI 唔處理呢張圖，請試另一張。'
      }[code] || 'AI 分析失敗，請再試一次，或者喺下面自己揀款式。';
      aiResult.innerHTML = '<div class="ai err"><p>' + msg + '</p></div>';
      if (code === 'not_granted' || code === 'sampling_disabled' || code === 'images_unavailable') analyzeBtn.hidden = true;
    }).then(function () {
      aiBusy = false;
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'AI 分析款式';
    });
  });

  /* ---------- 啟動 ---------- */
  form.addEventListener('submit', function (e) { e.preventDefault(); generate(); });
  document.getElementById('reset').onclick = function () { writeForm(defaults); generate(); };

  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) writeForm(saved);
  } catch (e) { /* 忽略 */ }
  syncControls();
  generate();
})();
