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
    'neckWiden', 'neckDropF', 'neckDropB', 'hemLen', 'flare', 'sleeveLen', 'ext', 'collarW', 'cuffH',
    'skirtLen', 'skirtFlare', 'slitLen', 'bandW', 'hemSa',
    'yokeDepthB', 'yokeDepthF', 'yokeFull', 'sleevePuff', 'sleeveGather', 'ruffleW', 'ruffleRatio', 'skirtRatio',
    'trouserLen', 'crotchDepth', 'outseam'];
  var SEL = ['neckline', 'lengthPreset', 'hemShape', 'sleeve', 'fit', 'collar', 'pocket', 'cuff',
    'garment', 'skirtShape', 'skirtLenPreset', 'slit', 'zip', 'yoke', 'yokeFullType', 'ruffle',
    'trouserShape', 'trouserLenPreset', 'trouserWaist', 'dressType'];
  var CHK = ['cfFold', 'cbFold', 'dims', 'opening', 'facing', 'princess'];
  var defaults = readForm();

  /* ---------- 預設值對照 ---------- */
  var FIT_EASE = {
    fitted: { easeBust: 6, easeWaist: 4, easeHip: 4 },
    regular: { easeBust: 10, easeWaist: 12, easeHip: 8 },
    loose: { easeBust: 16, easeWaist: 16, easeHip: 12 },
    jacket: { easeBust: 12, easeWaist: 12, easeHip: 10, easeArmhole: 4, easeNeck: 1 }
  };
  var COLLAR_W = { peterpan: 7, mandarin: 3.5, shirt: 4.5, convertible: 7, notched: 7.5 };
  function lengthFor(preset, v) {
    return { cropped: -6, waist: 0, hip: v.waistToHip + 2, tunic: v.waistToHip + 18, dress: 58 }[preset];
  }
  var SKIRT_LEN = { mini: 42, knee: 58, midi: 72, long: 90 };
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
    form.elements.facing.disabled = !v.opening;
    form.elements.collarW.disabled = v.collar === 'none';
    form.elements.cuff.disabled = !(v.sleeve === 'long' || v.sleeve === 'elbow');
    form.elements.cuffH.disabled = form.elements.cuff.disabled || v.cuff === 'none';
    form.elements.skirtFlare.disabled = v.skirtShape !== 'aline';
    form.elements.skirtRatio.disabled = v.skirtShape !== 'gathered';
    form.elements.yokeDepthB.disabled = !(v.yoke === 'back' || v.yoke === 'both');
    form.elements.yokeDepthF.disabled = !(v.yoke === 'front' || v.yoke === 'both');
    form.elements.yokeFull.disabled = form.elements.yokeFullType.disabled = v.yoke === 'none';
    form.elements.ruffleW.disabled = form.elements.ruffleRatio.disabled = v.ruffle === 'none';
    form.elements.sleevePuff.disabled = form.elements.sleeveGather.disabled = v.sleeve === 'none';
    form.elements.slitLen.disabled = v.slit === 'none';
    // 上衣／半截裙：只顯示用得着嘅欄位
    Array.prototype.forEach.call(form.querySelectorAll('.only-top, .only-skirt, .only-trousers, .only-dress'), function (el) {
      el.hidden = !el.classList.contains('only-' + (v.garment === 'jacket' ? 'top' : v.garment));
    });
    updateTotal();
  }
  ['skirtShape', 'slit', 'yoke', 'ruffle'].forEach(function (k) { form.elements[k].addEventListener('change', syncControls); });
  function trouserLenFor(p, v) {
    var cd = (v.crotchDepth || 26) + 1, tl = v.outseam || 96;
    return { shorts: Math.round(cd + 12), capri: Math.round(cd + (tl - cd) * 0.6), ankle: Math.round(tl - 6), full: tl }[p];
  }
  form.elements.trouserLenPreset.addEventListener('change', function () {
    var p = form.elements.trouserLenPreset.value;
    if (p !== 'custom') setVal('trouserLen', trouserLenFor(p, readForm()));
  });
  form.elements.trouserLen.addEventListener('input', function () { setVal('trouserLenPreset', 'custom'); });
  form.elements.outseam.addEventListener('input', function () {
    var p = form.elements.trouserLenPreset.value;
    if (p !== 'custom') setVal('trouserLen', trouserLenFor(p, readForm()));
  });
  form.elements.garment.addEventListener('change', function () {
    if (form.elements.garment.value === 'skirt') { setVal('easeWaist', 1); setVal('easeHip', 4); }
    else if (form.elements.garment.value === 'trousers') { setVal('easeWaist', 1); setVal('easeHip', 5); }
    else if (form.elements.garment.value === 'jacket') {
      var v0 = readForm();
      setVal('fit', 'jacket'); Object.keys(FIT_EASE.jacket).forEach(function (k) { setVal(k, FIT_EASE.jacket[k]); });
      setVal('collar', 'notched'); setVal('collarW', 7.5); form.elements.opening.checked = true; setVal('ext', 2.5);
      setVal('sleeve', 'long'); setVal('sleeveLen', v0.armLen + 2); setVal('hemLen', v0.waistToHip + 4); setVal('lengthPreset', 'custom');
      setVal('neckline', 'round'); setVal('neckWiden', 0); setVal('neckDropF', 0);
    }
    else { var e = FIT_EASE[form.elements.fit.value]; Object.keys(e).forEach(function (k) { setVal(k, e[k]); }); }
    syncControls();
  });
  form.elements.skirtLenPreset.addEventListener('change', function () {
    var p = form.elements.skirtLenPreset.value;
    if (SKIRT_LEN[p]) setVal('skirtLen', SKIRT_LEN[p]);
  });
  form.elements.skirtLen.addEventListener('input', function () { setVal('skirtLenPreset', 'custom'); });
  ['collar', 'cuff'].forEach(function (k) { form.elements[k].addEventListener('change', syncControls); });
  form.elements.collar.addEventListener('change', function () {
    var c = form.elements.collar.value;
    if (COLLAR_W[c]) setVal('collarW', COLLAR_W[c]);
    if (c === 'notched' || c === 'shirt') { form.elements.opening.checked = true; if (c === 'notched') setVal('ext', Math.max(2.5, parseFloat(form.elements.ext.value) || 2)); }
    syncControls();
  });
  form.elements.fit.addEventListener('change', function () {
    var e = FIT_EASE[form.elements.fit.value];
    Object.keys(e).forEach(function (k) { setVal(k, e[k]); });
  });
  form.elements.lengthPreset.addEventListener('change', function () {
    var p = form.elements.lengthPreset.value;
    if (p !== 'custom') { setVal('hemLen', lengthFor(p, readForm())); updateTotal(); }
  });
  function updateTotal() {
    var bl = parseFloat(form.elements.backLen.value), hl = parseFloat(form.elements.hemLen.value);
    if (!isNaN(bl) && !isNaN(hl)) setVal('totalLen', Math.round((bl + hl) * 10) / 10);
  }
  form.elements.hemLen.addEventListener('input', function () { setVal('lengthPreset', 'custom'); updateTotal(); });
  form.elements.backLen.addEventListener('input', updateTotal);
  form.elements.totalLen.addEventListener('input', function () {
    var t = parseFloat(form.elements.totalLen.value), bl = parseFloat(form.elements.backLen.value);
    if (isNaN(t) || isNaN(bl)) return;
    setVal('hemLen', Math.round((t - bl) * 10) / 10);
    setVal('lengthPreset', 'custom');
  });
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
    var bad = NUM.filter(function (k) {
      var el = form.elements[k], lab = el.closest('label');
      if (el.disabled || (lab && lab.hidden)) return false;
      return isNaN(v[k]) || !el.checkValidity();
    });
    if (bad.length) {
      showWarnings(['請檢查紅框嘅數值（空白或者超出範圍）。']);
      return;
    }
    try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* 私隱模式 */ }

    var m = {
      bust: v.bust, waist: v.waist, hip: v.hip, shoulder: v.shoulder, backLen: v.backLen, frontLen: v.frontLen,
      neck: v.neck, armhole: v.armhole, waistToHip: v.waistToHip, armLen: v.armLen, upperArm: v.upperArm, wrist: v.wrist,
      crotchDepth: v.crotchDepth, outseam: v.outseam
    };
    var ease = { bust: v.easeBust, waist: v.easeWaist, hip: v.easeHip, neck: v.easeNeck, armhole: v.easeArmhole };
    var style = {
      yoke: v.yoke, yokeFullness: v.yokeFull > 0 ? v.yokeFullType : 'none', princess: v.princess,
      puffSleeve: v.sleevePuff > 0, sleeveHemGather: v.sleeveGather > 0, ruffle: v.ruffle,
      neckline: v.neckline, neckWiden: v.neckWiden || 0, neckDropF: v.neckDropF || 0, neckDropB: v.neckDropB || 0,
      hemLen: v.hemLen || 0, hemShape: v.hemShape, flare: v.flare || 0,
      sleeve: v.sleeve, sleeveLen: v.sleeveLen || 0, fit: v.fit,
      opening: v.opening, ext: v.ext || 2, cfFold: v.cfFold, cbFold: v.cbFold,
      facing: v.facing, collar: v.collar, collarW: v.collarW || 7, pocket: v.pocket,
      cuff: form.elements.cuff.disabled ? 'none' : v.cuff, cuffH: v.cuffH || 5,
      garment: v.garment, trouserShape: v.trouserShape, trouserWaist: v.trouserWaist, trouserLen: v.trouserLen, skirtShape: v.skirtShape, skirtLen: v.skirtLen || 58, skirtFlare: v.skirtFlare || 6,
      slit: v.slit, slitLen: v.slitLen || 18, zip: v.zip, bandW: v.bandW || 3, hemSa: isNaN(v.hemSa) ? v.sa : v.hemSa,
      yoke: v.yoke, yokeDepthB: v.yokeDepthB || 9, yokeDepthF: v.yokeDepthF || 7, yokeFull: v.yoke === 'none' ? 0 : (v.yokeFull || 0),
      yokeFullType: v.yokeFullType, princess: v.princess,
      sleevePuff: v.sleeve === 'none' ? 0 : (v.sleevePuff || 0), sleeveGather: v.sleeve === 'none' ? 0 : (v.sleeveGather || 0),
      ruffle: v.ruffle, ruffleW: v.ruffleW || 6, ruffleRatio: v.ruffleRatio || 1.8, skirtRatio: v.skirtRatio || 1.6,
      trouserShape: v.trouserShape, trouserLen: v.trouserLen || v.outseam, trouserWaist: v.trouserWaist,
      dressType: v.dressType
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

  function infoTable(sr) {
    document.getElementById('info').innerHTML = '<table><tr><th>項目</th><th>紙樣（cm）</th><th>參考（cm）</th></tr>' +
      sr.map(function (r) {
        var a = r[3] != null ? r[3] : (r[1] != null ? f1(r[1]) : '');
        return '<tr><td>' + r[0] + '</td><td class="num">' + a + '</td><td class="num">' + (r[2] != null ? f1(r[2]) : '') + '</td></tr>';
      }).join('') + '</table>';
  }
  function showInfo(i, v) {
    if (i.garment === 'trousers') {
      return infoTable([
        ['成品腰圍（連放鬆量）', i.waistTotal, i.waistTotal == null ? null : v.waist + v.easeWaist],
        ['成品臀圍（連放鬆量）', i.hipTotal, v.hip + v.easeHip],
        ['褲長（腰下）', i.len],
        ['股上（連 1 cm 活動量）', i.crotchDepth, v.crotchDepth],
        ['前浪 / 後浪', null, null, f1(i.riseF) + ' / ' + f1(i.riseB)],
        ['內浪 前 / 後', null, null, f1(i.inseamF) + ' / ' + f1(i.inseamB)],
        ['側骨 前 / 後', null, null, f1(i.outseamF) + ' / ' + f1(i.outseamB)],
        ['褲腳圍', i.hemTotal],
        ['腰褶 前 / 後', null, null, f1(i.dartsF) + ' / ' + f1(i.dartsB)]
      ]);
    }
    if (i.garment === 'skirt') {
      var sr = [
        (v.zip === 'elastic' || v.zip === 'halfElastic')
          ? ['裙腰口（未收橡筋）', i.waistTotal, null]
          : ['成品腰圍（連放鬆量）', i.waistTotal, v.waist + v.easeWaist],
        ['成品臀圍（連放鬆量）', i.hipTotal, i.hipTotal == null ? null : v.hip + v.easeHip],
        ['下擺圍', i.hemTotal],
        ['裙長（腰下，唔計腰頭）', i.len],
        ['後腰褶 / 前腰褶（每片）', null, null, i.dartsBack + ' / ' + i.dartsFront],
        ['側縫收腰（每邊）', i.sideTake],
        ['側縫長 後 / 前', null, null, f1(i.sideLen) + ' / ' + f1(i.sideLenF)],
        ['腰頭總長', i.bandLen]
      ];
      document.getElementById('info').innerHTML = '<table><tr><th>項目</th><th>紙樣（cm）</th><th>參考（cm）</th></tr>' +
        sr.map(function (r) {
          var a = r[3] != null ? r[3] : (r[1] != null ? f1(r[1]) : '');
          return '<tr><td>' + r[0] + '</td><td class="num">' + a + '</td><td class="num">' + (r[2] != null ? f1(r[2]) : '') + '</td></tr>';
        }).join('') + '</table>';
      return;
    }
    var dressRows = [];
    if (i.garment === 'dress' && i.dressType === 'waist' && i.skirt) {
      dressRows = [
        ['腰縫長度 上身 / 裙', null, null, f1(i.waistSeamTop) + ' / ' + f1(i.waistSeamSkirt)],
        ['裙長（腰下）', i.skirt.len],
        ['下擺圍', i.skirt.hemTotal]
      ];
    }
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
    rows = rows.concat(dressRows);
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
  function stamp() {
    var v = current.v;
    if (v.garment === 'trousers') return 'trousers_W' + v.waist + '_H' + v.hip;
    if (v.garment === 'dress') return 'dress_B' + v.bust + '_W' + v.waist;
    if (v.garment === 'jacket') return 'jacket_B' + v.bust + '_W' + v.waist;
    return v.garment === 'skirt' ? 'skirt_W' + v.waist + '_H' + v.hip : 'top_B' + v.bust + '_W' + v.waist;
  }

  var NAMES = {
    neckline: { round: 'round neck', v: 'V-neck', square: 'square neck', boat: 'boat neck' },
    sleeve: { none: 'sleeveless', short: 'short sleeve', elbow: '3/4 sleeve', long: 'long sleeve' },
    fit: { fitted: 'fitted', regular: 'regular fit', loose: 'loose', jacket: 'jacket ease' }
  };
  var SK_NAMES = { straight: 'straight skirt', pencil: 'pencil skirt', aline: 'A-line skirt', gathered: 'gathered skirt',
    pleated: 'pleated skirt', halfcircle: 'half-circle skirt', circle: 'circle skirt' };
  var TR_NAMES = { straight: 'straight-leg trousers', slim: 'slim trousers', wide: 'wide-leg trousers' };
  var TRW_NAMES = { zip: 'front fly zip', side: 'side zip', elastic: 'elastic waist' };
  function styleLine(v) {
    if (v.garment === 'dress') {
      return (v.dressType === 'shift' ? 'shift dress' : 'dress with waist seam, ' + SK_NAMES[v.skirtShape]) + ', skirt length ' + v.skirtLen +
        ' cm, ' + NAMES.neckline[v.neckline] + ', ' + NAMES.sleeve[v.sleeve] + ', ' + NAMES.fit[v.fit] +
        (v.collar === 'peterpan' ? ', Peter Pan collar' : '') + (v.princess ? ', princess seams' : '') + ', ' + v.zip + ' zip';
    }
    if (v.garment === 'trousers') return TR_NAMES[v.trouserShape] + ', length ' + v.trouserLen + ' cm from waist, ' + TRW_NAMES[v.trouserWaist];
    if (v.garment === 'skirt') {
      return SK_NAMES[v.skirtShape] + ', length ' + v.skirtLen + ' cm from waist' +
        (v.slit !== 'none' ? ', ' + v.slit + ' slit ' + v.slitLen + ' cm' : '') + ', ' +
        ({ back: 'back zip', side: 'side zip', halfElastic: 'flat front / elastic back waist', elastic: 'elastic waist' }[v.zip]) + ', waistband ' + v.bandW + ' cm';
    }
    return NAMES.neckline[v.neckline] + ', ' + NAMES.sleeve[v.sleeve] + ', ' + NAMES.fit[v.fit] +
      ', length ' + (v.hemLen >= 0 ? '+' : '') + v.hemLen + ' from waist' + (v.hemShape === 'aline' ? ', A-line' : '') +
      (v.opening ? ', front opening' : '') + ({ peterpan: ', Peter Pan collar', mandarin: ', mandarin collar', shirt: ', shirt collar with stand', convertible: ', convertible collar', notched: ', notched lapel collar' }[v.collar] || '') +
      (v.pocket !== 'none' ? ', patch pocket' : '') + (v.cuff === 'band' && !form.elements.cuff.disabled ? ', cuffs' : '') +
      (v.yoke !== 'none' ? ', ' + v.yoke + ' yoke' + (v.yokeFull > 0 ? ' with ' + (v.yokeFullType === 'pleat' ? 'pleat' : 'gathers') : '') : '') +
      (v.princess ? ', princess seams' : '') + (v.sleevePuff > 0 && v.sleeve !== 'none' ? ', puff sleeves' : '') +
      (v.sleeveGather > 0 && v.sleeve !== 'none' ? ', gathered sleeve hem' : '') + (v.ruffle !== 'none' ? ', ' + v.ruffle + ' ruffle' : '');
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
    var desc = v.garment === 'dress'
      ? 'Women\'s dress: ' + styleLine(v) + '. Bust ' + v.bust + '+' + v.easeBust + ', Waist ' + v.waist + '+' + v.easeWaist + ', Hip ' + v.hip + '+' + v.easeHip + ' (cm)'
      : v.garment === 'trousers'
      ? 'Women\'s trousers: ' + styleLine(v) + '. Waist ' + v.waist + '+' + v.easeWaist + ', Hip ' + v.hip + '+' + v.easeHip + ', Crotch depth ' + v.crotchDepth + ', Outseam ' + v.outseam + ' (cm)'
      : v.garment === 'skirt'
      ? 'Women\'s skirt: ' + styleLine(v) + '. Waist ' + v.waist + '+' + v.easeWaist + ', Hip ' + v.hip + '+' + v.easeHip + ', Waist to hip ' + v.waistToHip + ' (cm)'
      : 'Women\'s top: ' + styleLine(v) + '. Bust ' + v.bust + '+' + v.easeBust + ', Waist ' + v.waist + '+' + v.easeWaist +
      ', Hip ' + v.hip + '+' + v.easeHip + ', Shoulder ' + v.shoulder + ', Back length ' + v.backLen + ', Front length ' + v.frontLen +
      ', Neck ' + v.neck + ', Armhole ' + v.armhole + '+' + v.easeArmhole + ' (cm)';
    download(PM.toSeamly(current.res, { sa: v.sa, description: desc }), stamp() + '.sm2d', 'application/xml');
  };
  document.getElementById('dlPdf').onclick = function () {
    if (!current) return;
    var v = current.v, i = current.res.info;
    if (v.garment === 'trousers') {
      var tl = [
        'Style: ' + styleLine(v),
        'Waist ' + v.waist + ' (+' + v.easeWaist + ')   Hip ' + v.hip + ' (+' + v.easeHip + ')   Waist to hip ' + v.waistToHip,
        'Crotch depth ' + v.crotchDepth + '   Outseam ' + v.outseam,
        'Seam allowance ' + v.sa + ' cm, hem ' + v.hemSa + ' cm',
        '',
        'Pattern: rise F/B ' + f1(i.riseF) + ' / ' + f1(i.riseB) + ', inseam F/B ' + f1(i.inseamF) + ' / ' + f1(i.inseamB),
        'Pieces: ' + current.res.pieces.map(function (p) { return p.en.toLowerCase(); }).join(', ')
      ];
      download(PM.toPDF(current.model, { lines: tl, title: 'Women\'s Trouser Pattern - ' + TR_NAMES[v.trouserShape] }), stamp() + '_A4.pdf', 'application/pdf');
      return;
    }
    if (v.garment === 'skirt') {
      var sl = [
        'Style: ' + styleLine(v),
        'Waist ' + v.waist + ' (+' + v.easeWaist + ')   Hip ' + v.hip + ' (+' + v.easeHip + ')   Waist to hip ' + v.waistToHip,
        'Seam allowance ' + v.sa + ' cm, hem ' + v.hemSa + ' cm',
        '',
        'Pattern: waist ' + f1(i.waistTotal) + ', hip ' + f1(i.hipTotal) + ', hem ' + f1(i.hemTotal) + ', waistband ' + f1(i.bandLen),
        'Pieces: ' + current.res.pieces.map(function (p) { return p.en.toLowerCase(); }).join(', ')
      ];
      download(PM.toPDF(current.model, { lines: sl, title: 'Women\'s Skirt Pattern - ' + SK_NAMES[v.skirtShape] }), stamp() + '_A4.pdf', 'application/pdf');
      return;
    }
    var lines = [
      'Style: ' + styleLine(v),
      'Bust ' + v.bust + ' (+' + v.easeBust + ')   Waist ' + v.waist + ' (+' + v.easeWaist + ')   Hip ' + v.hip + ' (+' + v.easeHip + ')',
      'Shoulder width ' + v.shoulder + '   Neck ' + v.neck + ' (+' + v.easeNeck + ')',
      'Back length ' + v.backLen + '   Front length ' + v.frontLen,
      'Armhole ' + v.armhole + ' (+' + v.easeArmhole + ')   Waist to hip ' + v.waistToHip,
      'Arm length ' + v.armLen + '   Upper arm ' + v.upperArm + '   Wrist ' + v.wrist,
      'Seam allowance ' + v.sa + ' cm, hem ' + v.hemSa + ' cm' + (v.cfFold && !v.opening ? ' | CF on fold' : '') + (v.cbFold ? ' | CB on fold' : ''),
      '',
      'Pattern: armhole F+B ' + f1(i.armBack + i.armFront) + ', darts back ' + f1(i.dartBack) + ' / front ' + f1(i.dartFront)
    ];
    if (i.sleeve) lines.push('Sleeve: cap ' + f1(i.sleeve.capLen) + ' (ease ' + f1(i.sleeve.capEase) + '), bicep ' + f1(i.sleeve.bicep) + ', length ' + f1(i.sleeve.len));
    if (v.opening && !v.facing) lines.push('Front facing not included.');
    lines.push('Pieces: ' + current.res.pieces.map(function (p) { return p.en.toLowerCase(); }).join(', '));
    if (v.garment === 'dress') lines.unshift('Dress: ' + (v.dressType === 'shift' ? 'no waist seam' : 'waist seam, ' + SK_NAMES[v.skirtShape]) + ', skirt length ' + v.skirtLen + ' cm');
    download(PM.toPDF(current.model, { lines: lines, title: (v.garment === 'dress' ? 'Women\'s Dress Pattern - ' : v.garment === 'jacket' ? 'Women\'s Jacket Pattern - ' : 'Women\'s Top Pattern - ') + NAMES.neckline[v.neckline] + ', ' + NAMES.sleeve[v.sleeve] }), stamp() + '_A4.pdf', 'application/pdf');
  };

  /* ---------- 上傳圖片（可多張）+ AI 分析 ---------- */
  var imgInput = document.getElementById('styleImage');
  var thumbs = document.getElementById('thumbs');
  var analyzeBtn = document.getElementById('analyze');
  var aiHint = document.getElementById('aiHint');
  var aiResult = document.getElementById('aiResult');
  var reqBox = document.getElementById('request');
  var images = []; // [{file, url, view}]
  var maxImages = 6, sampleFn = null, imagesOK = false, aiBusy = false;
  var applyReqBtn = document.getElementById('applyReq');
  function updateAnalyze() {
    analyzeBtn.hidden = !(sampleFn && ((imagesOK && images.length) || reqBox.value.trim()));
    applyReqBtn.hidden = !reqBox.value.trim();
  }

  /* 唔使 AI：網頁自己讀文字要求 */
  applyReqBtn.addEventListener('click', function () {
    var cur = readForm();
    var r = PM.parseRequest(reqBox.value, cur);
    Object.keys(r.set).forEach(function (k) {
      var el = form.elements[k];
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!r.set[k]; else el.value = r.set[k];
    });
    syncControls();
    var html = '<div class="ai' + (r.done.length ? '' : ' err') + '">';
    if (r.done.length) html += '<p><b>已照做：</b>' + esc(r.done.join('、')) + '</p>';
    else html += '<p>認唔到要改乜。試下用簡單講法，例如「V領，短袖，衫長45cm，唔要口袋」。</p>';
    if (r.cannot.length) html += '<p>⚠️ 做唔到：' + esc(r.cannot.join('、')) + '</p>';
    if (r.unknown.length) html += '<p>❓ 唔明：「' + esc(r.unknown.join('」「')) + '」，請改用簡單講法或者自己喺下面揀。</p>';
    html += '</div>';
    aiResult.innerHTML = html;
    if (r.done.length) generate();
  });
  reqBox.addEventListener('input', updateAnalyze);
  var VIEWS = { front: '前面', back: '後面', side: '側面', detail: '細節' };
  var VIEW_EN = { front: 'front view', back: 'back view', side: 'side view', detail: 'close-up detail' };

  function renderThumbs() {
    thumbs.innerHTML = '';
    images.forEach(function (im, i) {
      var d = document.createElement('div');
      d.className = 'thumb';
      var img = document.createElement('img');
      img.src = im.url; img.alt = '款式圖 ' + (i + 1);
      var sel = document.createElement('select');
      Object.keys(VIEWS).forEach(function (k) {
        var o = document.createElement('option'); o.value = k; o.textContent = VIEWS[k];
        if (k === im.view) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = function () { im.view = sel.value; };
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'rm'; rm.textContent = '✕'; rm.title = '刪除';
      rm.onclick = function () { URL.revokeObjectURL(im.url); images.splice(i, 1); renderThumbs(); };
      d.appendChild(img); d.appendChild(sel); d.appendChild(rm);
      thumbs.appendChild(d);
    });
    updateAnalyze();
    document.getElementById('fileBtnText').textContent = images.length
      ? '＋ 再加相（已有 ' + images.length + ' 張，最多 ' + maxImages + ' 張）'
      : '＋ 加相（前面、後面、細節都得）';
  }

  imgInput.addEventListener('change', function () {
    var files = Array.prototype.slice.call(imgInput.files || []);
    files.forEach(function (f) {
      if (images.length >= maxImages) return;
      var hasFront = images.some(function (x) { return x.view === 'front'; });
      var hasBack = images.some(function (x) { return x.view === 'back'; });
      images.push({ file: f, url: URL.createObjectURL(f), view: !hasFront ? 'front' : (!hasBack ? 'back' : 'detail') });
    });
    imgInput.value = ''; // 等同一張相可以再揀
    renderThumbs();
    if (!files.length) return;
    if (sampleFn && imagesOK) {
      aiResult.innerHTML = '<div class="ai"><p>✅ 已加 ' + images.length + ' 張相。每張下面揀返角度，再撳「AI 分析款式」。</p></div>';
    } else {
      aiResult.innerHTML = '<div class="ai"><p>✅ 已加 ' + images.length + ' 張相（喺上面）。</p>' +
        '<p>呢個版本冇 AI，唔會自動睇相。請睇住張相：</p>' +
        '<p>① 喺「你嘅要求」打字，例如「A字連身裙，V領，短袖」，再撳「照文字要求改款式」；或者<br>② 喺下面「② 款式」自己揀。</p>' +
        '<p class="hint">想 AI 自動睇相，要用 claude.ai 嗰個版本。</p></div>';
    }
  });

  if (hasClaude) {
    window.claude.use('sample').then(function (s) {
      if (!s) return;
      return s.limits().then(function (lim) {
        sampleFn = s;
        imagesOK = !!(lim && lim.images);
        if (imagesOK) maxImages = Math.max(1, Math.min(6, lim.images.maxCount || 1));
        aiHint.textContent = imagesOK
          ? '可以加幾張相（前面、後面…）同寫低要求，撳「AI 分析款式」由 AI 綜合設定（你嘅要求優先）。只係寫字嘅話，撳「照文字要求改款式」唔使用 AI 都得。'
          : '寫低要求，撳「照文字要求改款式」（唔使 AI），或者「AI 分析款式」由 AI 幫你設定。';
        renderThumbs();
      });
    }).catch(function () { /* 用唔到 AI：保持手動 */ });
  }

  /** 縮細圖片（JPEG，最長邊 1600px） */
  function shrinkImage(im) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { resolve(b || im.file); }, 'image/jpeg', 0.88);
      };
      img.onerror = function () { resolve(im.file); };
      img.src = im.url;
    });
  }

  var AI_PROMPT = [
    'You are a pattern-making assistant. The images show ONE garment design (sketches or photos of it worn, on a hanger or on a mannequin).',
    'There may be several images of the same garment (front, back, side, close-ups); combine them. Use the back view for the back neckline and back details.',
    'The generator makes women\'s TOPS, SKIRTS (half skirts, from the waist down), TROUSERS (pants and shorts) and DRESSES.',
    'Decide "garment": "top", "skirt", "trousers" or "dress" (if several appear, use the one the user asks for, else the more prominent one), then classify its features.',
    'For a dress: "dressType": "waist" (bodice and skirt joined by a waist seam) or "shift" (no waist seam); describe the bodice with the top fields and the skirt part with the skirt fields.',
    'Reply with ONLY a JSON object, no other text, exactly in this shape:',
    '{"garment": "top", "dressType": "waist", "isTop": true, "summary": "...", "neckline": "round|v|square|boat", "neckWidth": "narrow|medium|wide|very_wide",',
    ' "frontNeckDepth": "high|medium|low|deep", "backNeckDepth": "high|medium|low",',
    ' "length": "cropped|waist|hip|tunic|dress", "hem": "straight|aline", "sleeve": "none|short|elbow|long",',
    ' "fit": "fitted|regular|loose|jacket", "frontOpening": false, "collar": "none|peterpan|mandarin|shirt|convertible|notched|other",',
    ' "pocket": "none|left|right|both", "cuff": "none|band",',
    ' "yoke": "none|back|front|both", "yokeFullness": "none|gather|pleat", "princess": false, "puffSleeve": false, "sleeveHemGather": false,',
    ' "ruffle": "none|hem|sleeve|neck",',
    ' "trouserShape": "straight|slim|wide", "trouserLength": "shorts|capri|ankle|full", "trouserWaist": "zip|side|elastic",',
    ' "skirtShape": "straight|pencil|aline|gathered|pleated|halfcircle|circle", "skirtLength": "mini|knee|midi|long", "slit": "none|back|front|side", "zip": "back|side|halfElastic|elastic",',
    ' "fabricTip": "...", "notes": "..."}',
    'For a skirt, fill the skirt fields (top fields may be anything); for a top, the skirt fields may be anything.',
    '- yoke = a separate shoulder/upper-back panel (seam across the upper back or front); yokeFullness = gathers or a centre box pleat below the yoke.',
    '- princess = vertical princess seams over the bust/shoulder blade instead of darts; puffSleeve = gathered, puffed sleeve cap; sleeveHemGather = sleeve gathered at the hem or into the cuff (bishop/lantern sleeve).',
    '- ruffle = a gathered ruffle strip sewn to the hem, sleeve hem or neckline.',
    'Skirt definitions: straight = straight from hip to hem; pencil = narrows towards the hem; aline = flares out; gathered = gathered at the waist (dirndl); pleated = knife pleats all round; halfcircle / circle = half or full circle skirt. skirtLength: mini = mid-thigh or shorter, knee = around the knee, midi = mid-calf, long = ankle.',
    'Trouser definitions: straight = straight leg, slim = narrow/tapered, wide = wide or flared leg; shorts = above the knee, capri = mid-calf, ankle = just above the ankle (9/10 length), full = to the floor/heel; trouserWaist: zip = front fly with waistband, side = side zip with waistband, elastic = elastic/drawstring waist.',
    'slit = a vent/opening at the hem (back, front centre or side seam). zip = waist closure: back = back zip with waistband, side = side zip with waistband, halfElastic = flat front waistband with elastic back (no zip), elastic = fully elastic waist (no zip). Default back. The skirt always has a waistband and waist darts.',
    'Definitions:',
    '- neckWidth = how far the neckline opens towards the shoulders (narrow = sits at the base of the neck). With a collar, describe the neckline under the collar (usually round, narrow, high).',
    '- frontNeckDepth: high = at the base of the neck, medium = a little lower, low = well below the collarbone, deep = near or below the bust line.',
    '- length: cropped = ends above the waist, waist = at the waist, hip = at the hips, tunic = mid-thigh, dress = knee length or longer.',
    '  Judge length against the body or, on a hanger or mannequin, against typical body proportions: most shirts and blouses reach the hip.',
    '- sleeve: short = above the elbow, elbow = elbow to 3/4, long = to the wrist. Cap sleeves count as short.',
    '- fit: fitted = shaped to the body with darts or seams, regular = some shaping, loose = boxy or flowing.',
    '- frontOpening = true if it opens at centre front with buttons, snaps or a zip (the generator adds a button stand, button marks and a front facing).',
    '- collar: peterpan = flat collar with rounded front ends; mandarin = stand-up band collar; shirt = shirt collar with a separate stand; convertible = one-piece collar that lies open (camp/Cuban collar); notched = tailored jacket collar with lapels; other = any other collar (shawl, sailor, bow, ruffled, hood, etc.).',
    '- fit: use "jacket" for jackets, blazers and coats (more ease, worn over clothes); use garment "top" for them.',
    '- pocket: patch pocket on the chest, as seen by the wearer (left = wearer\'s left, which appears on the RIGHT of a front-facing photo).',
    '- cuff: band = sleeve finished with a cuff band (usually with gathers or pleats and a button); none = plain hem.',
    'The generator CAN make: for tops the necklines above, length, straight or A-line hem, sleeves, fit, front button opening with facing, Peter Pan / mandarin / shirt / convertible / notched lapel collars, jackets, chest patch pockets, cuffs,',
    'yokes (with gathers or a box pleat below), princess seams, puff sleeves, gathered sleeve hems, ruffles at hem/sleeve/neck;',
    'for skirts straight/pencil/A-line/gathered/pleated/half-circle/circle, any length, a slit at the back, front or side, back or side zip, waistband, waist darts;',
    'for trousers straight/slim/wide legs, shorts to full length, front fly or side zip with waistband, or elastic waist, waist darts.',
    'summary: one short sentence in Traditional Chinese (Cantonese, Hong Kong style) describing the garment.',
    'fabricTip: in Traditional Chinese (Cantonese), ONLY if the garment mixes fabrics or colours by area: which pattern pieces to cut in which fabric (pieces: 前片, 後片, 袖, 衣領, 袖頭, 貼袋), e.g. "袖同袖頭用牛仔布，前後片用印花布". Otherwise "". Never mention prints or colours otherwise; they do not change the pattern.',
    'notes: in Traditional Chinese (Cantonese), list ONLY design details the generator CANNOT make (e.g. a collar of type other, asymmetry, wrap fronts, pocket flaps, side pockets, trouser pockets, pleats at the trouser waist, cargo pockets, jumpsuits, smocking, tiers, mermaid/fishtail, skirt yokes, belt loops, lining). Do not list anything it can make, nor fabric/print/colour. "" if none.',
    'fabricTip pieces for trousers: 前褲片, 後褲片, 腰頭. fabricTip pieces for skirts: 前裙片, 後裙片, 腰頭. Extra top pieces when used: 後育克, 前育克, 前中片, 前側片, 後中片, 後側片, 荷葉邊.',
    'If the image shows neither a top nor a skirt (e.g. trousers, not a garment), set "isTop": false and "garment": "none", and explain in "summary".',
    'Also include "cm": {"neckWiden": null, "neckDropF": null, "neckDropB": null, "hemLen": null, "totalLen": null, "sleeveLen": null, "flare": null, "collarW": null, "cuffH": null, "skirtLen": null, "skirtFlare": null, "slitLen": null, "bandW": null, "yokeDepthB": null, "ruffleW": null, "trouserLen": null}',
    'and "requestReply": "". Put a number (cm) in "cm" ONLY when the user\'s request asks for a specific or relative size; otherwise null.',
    'cm meanings: neckWiden = neckline widened per side along the shoulder; neckDropF / neckDropB = front / back neckline lowered from the base of the neck (negative raises it);',
    'hemLen = length below the waistline (negative = above the waist); totalLen = overall garment length at centre back from the nape (back neck point) to the hem.',
    'When the user gives a garment length (e.g. 衫長 45cm) without saying it is measured from the waist, put it in totalLen (NOT hemLen); the generator converts it. Set the length category to match it.',
    'sleeveLen = sleeve length from the shoulder point; flare = A-line flare per side seam at the hem; collarW = collar width; cuffH = cuff height.',
    'yokeDepthB = back yoke depth from the nape; ruffleW = ruffle width; trouserLen = trouser length from the waist to the hem (a plain 褲長 for trousers goes here).',
    'Skirt cm: skirtLen = skirt length from the waistline to the hem (for a skirt, a plain length like 裙長 60cm goes here); skirtFlare = A-line flare per side seam; slitLen = slit length; bandW = waistband width.',
    'The USER REQUEST (if any) has priority over the images. Relative requests ("longer", "a bit wider") change the CURRENT SETTINGS by a sensible amount (usually 2-5 cm).',
    'With no images, start from the CURRENT SETTINGS and change only what the request asks for (keep every other field as it is now).',
    'requestReply: in Traditional Chinese (Cantonese), one or two short sentences on how the request was applied and anything in it the generator cannot do; "" if there was no request.'
  ].join('\n');

  /** 而家嘅設定（俾 AI 參考） */
  function currentSettings() {
    var v = readForm();
    var len = v.lengthPreset === 'custom'
      ? (v.hemLen < -1 ? 'cropped' : v.hemLen < 8 ? 'waist' : v.hemLen < v.waistToHip + 10 ? 'hip' : v.hemLen < 45 ? 'tunic' : 'dress')
      : v.lengthPreset;
    var neckWidth = v.neckWiden >= 5 ? 'very_wide' : v.neckWiden >= 2.5 ? 'wide' : v.neckWiden >= 1 ? 'medium' : 'narrow';
    var fnd = v.neckDropF >= 10 ? 'deep' : v.neckDropF >= 5 ? 'low' : v.neckDropF >= 1.5 ? 'medium' : 'high';
    var bnd = v.neckDropB >= 3 ? 'low' : v.neckDropB >= 0.5 ? 'medium' : 'high';
    return JSON.stringify({
      garment: v.garment, skirtShape: v.skirtShape, slit: v.slit, zip: v.zip,
      skirtCm: { skirtLen: v.skirtLen, skirtFlare: v.skirtFlare, slitLen: v.slitLen, bandW: v.bandW },
      neckline: v.neckline, neckWidth: neckWidth, frontNeckDepth: fnd, backNeckDepth: bnd, length: len, hem: v.hemShape,
      sleeve: v.sleeve, fit: v.fit, frontOpening: v.opening, collar: v.collar, pocket: v.pocket, cuff: v.cuff,
      cm: { neckWiden: v.neckWiden, neckDropF: v.neckDropF, neckDropB: v.neckDropB, hemLen: v.hemLen, totalLen: v.backLen + v.hemLen, sleeveLen: v.sleeveLen,
        flare: v.flare, collarW: v.collarW, cuffH: v.cuffH }
    });
  }

  var LEVELS = {
    neckWidth: { narrow: 0, medium: 1.5, wide: 3.5, very_wide: 6 },
    frontNeckDepth: { high: 0, medium: 2.5, low: 6, deep: 12 },
    backNeckDepth: { high: 0, medium: 1, low: 4 }
  };
  var ZH = {
    neckline: { round: '圓領', v: 'V 領', square: '方領', boat: '一字領' },
    length: { cropped: '短身', waist: '及腰', hip: '及臀', tunic: '長身', dress: '連身裙長' },
    sleeve: { none: '無袖', short: '短袖', elbow: '七分袖', long: '長袖' },
    fit: { fitted: '修身', regular: '合身', loose: '寬鬆', jacket: '外套' },
    hem: { straight: '直腳', aline: 'A 字' }
  };
  function pick(val, allowed, dflt) { return allowed.indexOf(val) >= 0 ? val : dflt; }

  var lastRequest = '';
  function num(v, lo, hi) { return typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null; }

  var SK_ZH = { straight: '直身裙', pencil: '窄身裙', aline: 'A 字裙', gathered: '碎褶裙', pleated: '百褶裙', halfcircle: '半圓裙', circle: '全圓裙' };
  var SLIT_ZH = { none: '無開衩', back: '後中開衩', front: '前中開衩', side: '側開衩' };
  function applySkirtAI(r) {
    var cm = r.cm || {};
    setVal('garment', 'skirt');
    setVal('easeWaist', 1); setVal('easeHip', 4);
    var shape = pick(r.skirtShape, ['straight', 'pencil', 'aline', 'gathered', 'pleated', 'halfcircle', 'circle'], 'straight');
    var lenP = pick(r.skirtLength, ['mini', 'knee', 'midi', 'long'], 'knee');
    var slit = pick(r.slit, ['none', 'back', 'front', 'side'], 'none');
    setVal('skirtShape', shape); setVal('skirtLenPreset', lenP); setVal('skirtLen', SKIRT_LEN[lenP]);
    setVal('slit', slit); setVal('zip', pick(r.zip, ['back', 'side', 'halfElastic', 'elastic'], 'back'));
    var lim = { skirtLen: [25, 120], skirtFlare: [1, 40], slitLen: [5, 60], bandW: [2, 8] };
    Object.keys(lim).forEach(function (k) {
      var x = num(cm[k], lim[k][0], lim[k][1]);
      if (x == null) return;
      setVal(k, Math.round(x * 2) / 2);
      if (k === 'skirtLen') setVal('skirtLenPreset', 'custom');
      if (k === 'skirtFlare') setVal('skirtShape', 'aline');
    });
    syncControls();
    var v2 = readForm();
    aiResult.innerHTML = '<div class="ai"><p><b>' + (images.length && imagesOK ? 'AI 睇到：' : 'AI：') + '</b>' + esc(r.summary || '') + '</p>' +
      (lastRequest && r.requestReply ? '<p><b>你嘅要求：</b>' + esc(r.requestReply) + '</p>' : '') +
      '<p>已設定：半截裙、' + SK_ZH[v2.skirtShape] + '、裙長 ' + v2.skirtLen + ' cm、' + SLIT_ZH[v2.slit] +
      (v2.slit !== 'none' ? ' ' + v2.slitLen + ' cm' : '') + '、' + ({ back: '後中拉鏈', side: '側拉鏈', halfElastic: '前平後橡筋', elastic: '全橡筋' }[v2.zip]) + '、腰頭</p>' +
      (r.fabricTip ? '<p>🧵 用布：' + esc(r.fabricTip) + '</p>' : '') +
      (r.notes ? '<p>⚠️ 未能做到嘅細節：' + esc(r.notes) + '</p>' : '') +
      '<p class="hint">AI 估嘅款式未必完全準，可以喺下面再改。</p></div>';
    generate();
  }

  var TR_ZH = { straight: '直腳褲', slim: '窄腳褲', wide: '闊腳褲' };
  var TRW_ZH = { zip: '前拉鏈＋腰頭', side: '側拉鏈＋腰頭', elastic: '鬆緊帶腰' };
  var TRL_ZH = { shorts: '短褲', capri: '七分', ankle: '九分', full: '長褲', custom: '自訂長度' };
  function applyTrousersAI(r) {
    setVal('garment', 'trousers'); setVal('easeWaist', 1); setVal('easeHip', 5);
    var v = readForm();
    setVal('trouserShape', pick(r.trouserShape, ['straight', 'slim', 'wide'], 'straight'));
    var lp = pick(r.trouserLength, ['shorts', 'capri', 'ankle', 'full'], 'full');
    setVal('trouserLenPreset', lp); setVal('trouserLen', trouserLenFor(lp, v));
    setVal('trouserWaist', pick(r.trouserWaist, ['zip', 'side', 'elastic'], 'zip'));
    var x = num((r.cm || {}).trouserLen, 30, 120);
    if (x != null) { setVal('trouserLen', Math.round(x * 2) / 2); setVal('trouserLenPreset', 'custom'); }
    syncControls();
    var v2 = readForm();
    aiResult.innerHTML = '<div class="ai"><p><b>' + (images.length && imagesOK ? 'AI 睇到：' : 'AI：') + '</b>' + esc(r.summary || '') + '</p>' +
      (lastRequest && r.requestReply ? '<p><b>你嘅要求：</b>' + esc(r.requestReply) + '</p>' : '') +
      '<p>已設定：褲、' + TR_ZH[v2.trouserShape] + '、' + TRL_ZH[v2.trouserLenPreset] + '（腰下 ' + v2.trouserLen + ' cm）、' + TRW_ZH[v2.trouserWaist] + '</p>' +
      (r.fabricTip ? '<p>🧵 用布：' + esc(r.fabricTip) + '</p>' : '') +
      (r.notes ? '<p>⚠️ 未能做到嘅細節：' + esc(r.notes) + '</p>' : '') +
      '<p class="hint">AI 估嘅款式未必完全準，可以喺下面再改。</p></div>';
    generate();
  }

  function applyAI(r) {
    if (r.garment === 'trousers') return applyTrousersAI(r);
    if (r.garment === 'skirt') return applySkirtAI(r);
    var isDress = r.garment === 'dress';
    setVal('garment', isDress ? 'dress' : 'top');
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
    var fit = pick(r.fit, ['fitted', 'regular', 'loose', 'jacket'], 'fitted');
    if (fit === 'jacket' && !isDress) setVal('garment', 'jacket');
    var hem = pick(r.hem, ['straight', 'aline'], 'straight');

    setVal('neckline', neckline);
    setVal('neckWiden', nw); setVal('neckDropF', fd); setVal('neckDropB', bd);
    setVal('lengthPreset', length); setVal('hemLen', lengthFor(length, v));
    setVal('hemShape', hem); setVal('flare', hem === 'aline' ? (length === 'dress' ? 8 : 4) : 0);
    setVal('sleeve', sleeve); setVal('sleeveLen', sleeveLenFor(sleeve, v));
    setVal('fit', fit);
    var e = FIT_EASE[fit]; Object.keys(e).forEach(function (k) { setVal(k, e[k]); });
    form.elements.opening.checked = !!r.frontOpening;
    if (r.frontOpening) form.elements.facing.checked = true;
    var collar = pick(r.collar, ['none', 'peterpan', 'mandarin', 'shirt', 'convertible', 'notched'], 'none');
    if (collar !== 'none' && (neckline === 'v' || neckline === 'square' || (collar !== 'peterpan' && neckline === 'boat'))) { neckline = 'round'; setVal('neckline', 'round'); fd = 0; setVal('neckDropF', 0); setVal('neckWiden', 0); }
    setVal('collar', collar); if (COLLAR_W[collar]) setVal('collarW', COLLAR_W[collar]);
    if (collar === 'notched') { form.elements.opening.checked = true; setVal('ext', 2.5); }
    setVal('pocket', pick(r.pocket, ['none', 'left', 'right', 'both'], 'none'));
    var cuff = r.cuff === 'band' && (sleeve === 'long' || sleeve === 'elbow') ? 'band' : 'none';
    setVal('cuff', cuff);
    var yoke = pick(r.yoke, ['none', 'back', 'front', 'both'], 'none');
    var yf = pick(r.yokeFullness, ['none', 'gather', 'pleat'], 'none');
    setVal('yoke', yoke);
    setVal('yokeFull', yoke !== 'none' && yf !== 'none' ? (yf === 'pleat' ? 6 : 10) : 0);
    if (yf !== 'none') setVal('yokeFullType', yf);
    form.elements.princess.checked = !!r.princess && fit !== 'loose';
    setVal('sleevePuff', r.puffSleeve && sleeve !== 'none' ? 5 : 0);
    setVal('sleeveGather', r.sleeveHemGather && sleeve !== 'none' ? 8 : 0);
    setVal('ruffle', pick(r.ruffle, ['none', 'hem', 'sleeve', 'neck'], 'none'));
    var dressTxt = '';
    if (isDress) {
      var dt = pick(r.dressType, ['waist', 'shift'], 'waist');
      var dsh = pick(r.skirtShape, ['straight', 'pencil', 'aline', 'gathered', 'pleated', 'halfcircle', 'circle'], 'aline');
      var dlp = pick(r.skirtLength, ['mini', 'knee', 'midi', 'long'], 'knee');
      setVal('dressType', dt); setVal('skirtShape', dsh); setVal('skirtLenPreset', dlp); setVal('skirtLen', SKIRT_LEN[dlp]);
      setVal('slit', pick(r.slit, ['none', 'back', 'front', 'side'], 'none')); setVal('zip', pick(r.zip, ['back', 'side'], 'back'));
      var dcm = num((r.cm || {}).skirtLen, 25, 120);
      if (dcm != null) { setVal('skirtLen', Math.round(dcm * 2) / 2); setVal('skirtLenPreset', 'custom'); }
      dressTxt = '連身裙（' + (dt === 'waist' ? '有腰線、' + SK_ZH[dsh] : '無腰線') + '、裙長 ' + form.elements.skirtLen.value + ' cm）、';
    }
    // 要求入面有具體尺寸就用
    var cm = r.cm || {};
    var lim = { neckWiden: [0, 10], neckDropF: [-5, 25], neckDropB: [0, 20], hemLen: [-15, 90], sleeveLen: [0, 80], flare: [0, 30], collarW: [3, 15], cuffH: [2, 12], yokeDepthB: [3, 25], ruffleW: [2, 30] };
    var tl = num(cm.totalLen, 15, 140);
    if (tl != null) cm.hemLen = Math.max(-15, Math.min(90, tl - v.backLen));
    Object.keys(lim).forEach(function (k) {
      var x = num(cm[k], lim[k][0], lim[k][1]);
      if (x == null) return;
      setVal(k, Math.round(x * 2) / 2);
      if (k === 'hemLen') setVal('lengthPreset', 'custom');
      if (k === 'flare' && x > 0) setVal('hemShape', 'aline');
    });
    syncControls();
    var pocketZh = { left: '左胸貼袋', right: '右胸貼袋', both: '兩邊胸貼袋' }[form.elements.pocket.value];

    aiResult.innerHTML = '<div class="ai"><p><b>' + (images.length && imagesOK ? 'AI 睇到：' : 'AI：') + '</b>' + esc(r.summary || '') + '</p>' +
      (lastRequest && r.requestReply ? '<p><b>你嘅要求：</b>' + esc(r.requestReply) + '</p>' : '') +
      '<p>已設定：' + dressTxt + ZH.neckline[neckline] + '、' + (isDress ? '' : (num(cm.hemLen, -15, 90) != null ? '衫總長 ' + form.elements.totalLen.value + ' cm（腰下 ' + form.elements.hemLen.value + ' cm）' : ZH.length[length]) + '、' + ZH.hem[hem] + '、') + ZH.sleeve[sleeve] + '、' +
      ZH.fit[fit] + (r.frontOpening ? '、前中開胸（連門襟、貼邊）' : '') + ({ peterpan: '、彼得潘圓領', mandarin: '、企領', shirt: '、恤衫領', convertible: '、翻領', notched: '、西裝領' }[collar] || '') +
      (pocketZh ? '、' + pocketZh : '') + (cuff === 'band' ? '、袖頭' : '') +
      ({ back: '、後育克', front: '、前育克', both: '、前後育克' }[yoke] || '') + (yoke !== 'none' && yf !== 'none' ? (yf === 'pleat' ? '（中間褶）' : '（碎褶）') : '') +
      (form.elements.princess.checked ? '、公主線' : '') + (r.puffSleeve && sleeve !== 'none' ? '、泡泡袖' : '') +
      (r.sleeveHemGather && sleeve !== 'none' ? '、袖口碎褶' : '') +
      ({ hem: '、下擺荷葉邊', sleeve: '、袖口荷葉邊', neck: '、領口荷葉邊' }[form.elements.ruffle.value] || '') + '</p>' +
      (r.fabricTip ? '<p>🧵 用布：' + esc(r.fabricTip) + '</p>' : '') +
      (r.collar === 'other' ? '<p>⚠️ 呢款衣領暫時做唔到，紙樣冇衣領，可以自己另外加。</p>' : '') +
      (r.notes ? '<p>⚠️ 未能做到嘅細節：' + esc(r.notes) + '</p>' : '') +
      '<p class="hint">AI 估嘅款式未必完全準，可以喺下面再改。</p></div>';
    generate();
  }

  analyzeBtn.addEventListener('click', function () {
    var request = reqBox.value.trim();
    if (!sampleFn || aiBusy || !((imagesOK && images.length) || request)) return;
    aiBusy = true;
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'AI 分析緊…（大約半分鐘）';
    aiResult.innerHTML = '';
    var list = imagesOK ? images.slice(0, maxImages) : [];
    var desc = '\n\n' + (list.length
      ? 'The images, in order: ' + list.map(function (im, i) { return 'image ' + (i + 1) + ' = ' + VIEW_EN[im.view]; }).join('; ') + '.'
      : 'There are NO images; work from the current settings and the request.') +
      '\nCURRENT SETTINGS: ' + currentSettings() +
      '\nUSER REQUEST: ' + (request ? JSON.stringify(request) : '(none)');
    lastRequest = request;
    Promise.all(list.map(shrinkImage)).then(function (blobs) {
      return sampleFn.json(AI_PROMPT + desc, blobs.length ? { images: blobs } : {});
    }).then(function (r) {
      if (!r || typeof r !== 'object') throw { code: 'invalid_json' };
      if (r.garment !== 'skirt' && r.garment !== 'trousers' && (r.isTop === false || r.garment === 'none')) {
        aiResult.innerHTML = '<div class="ai err"><p>' + esc(r.summary || 'AI 認唔到上衣或者半截裙。') + '</p>' +
          '<p><b>冇改到任何設定</b>：呢個生成器暫時只做上衣（衫、連身裙上身）、半截裙同褲，下面仲係之前嘅款式。請換一張相，或者自己喺下面揀款式。</p></div>';
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

  // 俾「睇相快選」用
  window.PMApp = { generate: generate, syncControls: syncControls, readForm: readForm };

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
