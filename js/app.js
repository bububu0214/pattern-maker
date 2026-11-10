/* 介面控制 */
(function () {
  'use strict';
  var PM = window.PM, f1 = PM.fmt;
  var form = document.getElementById('form');
  var preview = document.getElementById('preview');
  var STORE = 'pattern-maker-bodice-v1';
  var current = null;
  var zoom = 0; // 0 = 全圖；否則每厘米像素

  var NUM = ['bust', 'waist', 'shoulder', 'backLen', 'frontLen', 'neck', 'armhole',
    'easeBust', 'easeWaist', 'easeNeck', 'easeArmhole', 'sa'];
  var CHK = ['cfFold', 'cbFold', 'dims'];
  var defaults = readForm();

  function readForm() {
    var v = {};
    NUM.forEach(function (k) { v[k] = parseFloat(form.elements[k].value); });
    CHK.forEach(function (k) { v[k] = form.elements[k].checked; });
    return v;
  }
  function writeForm(v) {
    NUM.forEach(function (k) { if (v[k] != null && !isNaN(v[k])) form.elements[k].value = v[k]; });
    CHK.forEach(function (k) { if (typeof v[k] === 'boolean') form.elements[k].checked = v[k]; });
  }

  function generate() {
    var v = readForm();
    var bad = NUM.filter(function (k) { return isNaN(v[k]) || !form.elements[k].checkValidity(); });
    if (bad.length) {
      showWarnings(['請檢查紅框嘅數值（空白或者超出範圍）。']);
      return;
    }
    try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* 私隱模式 */ }

    var m = { bust: v.bust, waist: v.waist, shoulder: v.shoulder, backLen: v.backLen, frontLen: v.frontLen, neck: v.neck, armhole: v.armhole };
    var ease = { bust: v.easeBust, waist: v.easeWaist, neck: v.easeNeck, armhole: v.easeArmhole };
    var res = PM.draft(m, ease);
    var model = PM.layout(res, { sa: v.sa, cbFold: v.cbFold, cfFold: v.cfFold, dims: v.dims });
    current = { v: v, m: m, ease: ease, res: res, model: model };

    preview.innerHTML = PM.toSVG(model, { screen: true }).replace(/^<\?xml[^>]*>\s*/, '');
    applyZoom();
    showWarnings(res.warnings);
    showInfo(res.info, v);
    ['dlPdf', 'dlSvg', 'dlDxf'].forEach(function (id) { document.getElementById(id).disabled = false; });
  }

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

  function showWarnings(list) {
    document.getElementById('warnings').innerHTML = list.map(function (w) {
      return '<div class="warn">⚠️ ' + w + '</div>';
    }).join('');
  }

  function showInfo(i, v) {
    var rows = [
      ['成品胸圍（連放鬆量）', i.bustTotal, v.bust + v.easeBust],
      ['成品腰圍（連放鬆量）', i.waistTotal, v.waist + v.easeWaist],
      ['夾圈長（前＋後）', i.armBack + i.armFront, v.armhole + v.easeArmhole],
      ['　後夾圈 / 前夾圈', null, null, f1(i.armBack) + ' / ' + f1(i.armFront)],
      ['領圍（前＋後）×2', (i.neckBack + i.neckFront) * 2, v.neck + v.easeNeck],
      ['夾圈深（肩點至胸圍線）', i.armDepth],
      ['後頸點至胸圍線', i.bustLineFromNape],
      ['後肩長 / 前肩長', null, null, f1(i.shoulderBack) + ' / ' + f1(i.shoulderFront)],
      ['後腰褶 / 前腰褶', null, null, f1(i.dartBack) + ' / ' + f1(i.dartFront)],
      ['側縫收腰（每邊）', i.sideTake],
      ['側縫長', i.sideLen],
      ['前腰比後腰低', i.frontDrop]
    ];
    var html = '<table><tr><th>項目</th><th>紙樣（cm）</th><th>目標（cm）</th></tr>' +
      rows.map(function (r) {
        var a = r[3] != null ? r[3] : (r[1] != null ? f1(r[1]) : '');
        return '<tr><td>' + r[0] + '</td><td class="num">' + a + '</td><td class="num">' + (r[2] != null ? f1(r[2]) : '') + '</td></tr>';
      }).join('') + '</table>';
    document.getElementById('info').innerHTML = html;
  }

  // 喺 claude.ai 預覽頁入面用平台嘅下載功能；一般瀏覽器就用普通下載
  var claudeDl = (window.claude && typeof window.claude.use === 'function')
    ? window.claude.use('downloads').catch(function () { return null; }) : null;

  function download(data, name, type) {
    if (claudeDl) {
      claudeDl.then(function (dl) {
        if (!dl) return plainDownload(data, name, type);
        dl.save({ filename: name, data: new Blob([data], { type: type }) }).catch(function (err) {
          if (err && err.code === 'declined') return;
          var msg = err && (err.code === 'rejected_extension' || err.code === 'extension_not_enabled')
            ? '呢個網上預覽版唔支援下載 ' + name.split('.').pop().toUpperCase() + ' 檔，請用 GitHub 版本（見 README）。'
            : '下載失敗：' + ((err && err.message) || '未知錯誤');
          showWarnings((current ? current.res.warnings : []).concat([msg]));
        });
      });
      return;
    }
    plainDownload(data, name, type);
  }
  function plainDownload(data, name, type) {
    var blob = new Blob([data], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function stamp() {
    var v = current.v;
    return 'bodice_B' + v.bust + '_W' + v.waist;
  }

  document.getElementById('dlSvg').onclick = function () {
    if (current) download(PM.toSVG(current.model, {}), stamp() + '.svg', 'image/svg+xml');
  };
  document.getElementById('dlDxf').onclick = function () {
    if (current) download(PM.toDXF(current.model), stamp() + '.dxf', 'application/dxf');
  };
  document.getElementById('dlPdf').onclick = function () {
    if (!current) return;
    var v = current.v, i = current.res.info;
    var lines = [
      'Bust ' + v.bust + '  (+' + v.easeBust + ' ease)',
      'Waist ' + v.waist + '  (+' + v.easeWaist + ' ease)',
      'Shoulder width ' + v.shoulder,
      'Back length (nape to waist) ' + v.backLen,
      'Front length (HPS over bust) ' + v.frontLen,
      'Neck ' + v.neck + '  (+' + v.easeNeck + ' ease)',
      'Armhole ' + v.armhole + '  (+' + v.easeArmhole + ' ease)',
      'Seam allowance ' + v.sa + (v.cfFold ? ' | CF on fold' : '') + (v.cbFold ? ' | CB on fold' : ''),
      '',
      'Pattern: armhole F+B ' + f1(i.armBack + i.armFront) + ', neck F+B ' + f1(i.neckBack + i.neckFront),
      'Darts: back ' + f1(i.dartBack) + ', front ' + f1(i.dartFront)
    ];
    download(PM.toPDF(current.model, { lines: lines }), stamp() + '_A4.pdf', 'application/pdf');
  };

  form.addEventListener('submit', function (e) { e.preventDefault(); generate(); });
  document.getElementById('reset').onclick = function () { writeForm(defaults); generate(); };

  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) writeForm(saved);
  } catch (e) { /* 忽略 */ }
  generate();
})();
