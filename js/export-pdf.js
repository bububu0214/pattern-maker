/*
 * 1:1 實際大小 PDF，A4 直度分頁。
 * 第 1 頁：封面（尺寸資料、10cm 測試方格、拼頁圖）；之後每頁一格紙樣，有對位記號。
 * 自己寫 PDF（只用 Helvetica），唔使任何外部函式庫。
 */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});

  var K = 72 / 25.4;            // mm → pt
  var PW = 210, PH = 297;       // A4 (mm)
  var MG = 10;                  // 頁邊 (mm)
  var TW = PW - 2 * MG, TH = PH - 2 * MG; // 每頁可印範圍

  var HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,
    667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
    278, 278, 278, 469, 556, 333,
    556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
    334, 260, 334, 584];
  function textWidth(s, fs) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      w += (c >= 32 && c <= 126) ? HW[c - 32] : 556;
    }
    return w / 1000 * fs;
  }
  function ascii(s) { return String(s).replace(/[^\x20-\x7e]/g, '?'); }
  function pdfStr(s) { return '(' + ascii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')'; }
  function n(v) { return (Math.round(v * 1000) / 1000).toString(); }

  var COLORS = {
    CUT: [0, 0, 0, 0.35], SEAM: [0.8, 0.2, 0.17, 0.25], DART: [0, 0, 0, 0.3], GRAIN: [0.12, 0.37, 0.75, 0.3],
    NOTCH: [0, 0, 0, 0.4], GUIDE: [0.5, 0.5, 0.5, 0.2], DIM: [0.18, 0.49, 0.2, 0.18], TEXT: [0, 0, 0, 0.2], TEST: [0, 0, 0, 0.3]
  };

  /** 內容串流（座標：mm，y 向下） */
  function Canvas() { this.o = []; }
  Canvas.prototype = {
    raw: function (s) { this.o.push(s); return this; },
    color: function (c) { this.o.push(n(c[0]) + ' ' + n(c[1]) + ' ' + n(c[2]) + ' RG ' + n(c[0]) + ' ' + n(c[1]) + ' ' + n(c[2]) + ' rg'); return this; },
    width: function (w) { this.o.push(n(w) + ' w'); return this; },
    dash: function (d) { this.o.push(d ? '[' + d.map(n).join(' ') + '] 0 d' : '[] 0 d'); return this; },
    poly: function (pts, closed) {
      if (!pts.length) return this;
      var s = n(pts[0].x) + ' ' + n(pts[0].y) + ' m';
      for (var i = 1; i < pts.length; i++) s += ' ' + n(pts[i].x) + ' ' + n(pts[i].y) + ' l';
      this.o.push(s + (closed ? ' h S' : ' S'));
      return this;
    },
    rect: function (x, y, w, h) { this.o.push(n(x) + ' ' + n(y) + ' ' + n(w) + ' ' + n(h) + ' re S'); return this; },
    fillRect: function (x, y, w, h) { this.o.push(n(x) + ' ' + n(y) + ' ' + n(w) + ' ' + n(h) + ' re f'); return this; },
    circle: function (cx, cy, r) {
      var pts = [];
      for (var i = 0; i <= 32; i++) pts.push({ x: cx + r * Math.cos(i / 16 * Math.PI), y: cy + r * Math.sin(i / 16 * Math.PI) });
      return this.poly(pts, true);
    },
    /** align: 'start' | 'middle' | 'end'；(x,y) 為基線（middle 時為文字中心） */
    text: function (s, x, y, fs, angleDeg, align, vcenter) {
      s = ascii(s);
      var a = (angleDeg || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
      var w = textWidth(s, fs);
      var shift = align === 'middle' ? -w / 2 : (align === 'end' ? -w : 0);
      var down = vcenter ? 0.35 * fs : 0;
      var bx = x + c * shift - sn * down, by = y + sn * shift + c * down;
      this.o.push('BT /F1 1 Tf ' + n(fs * c) + ' ' + n(fs * sn) + ' ' + n(fs * sn) + ' ' + n(-fs * c) + ' ' + n(bx) + ' ' + n(by) + ' Tm ' + pdfStr(s) + ' Tj ET');
      return this;
    },
    toString: function () { return this.o.join('\n'); }
  };

  function drawEntities(cv, ents, scale, onlyCut) {
    ents.forEach(function (e) {
      if (onlyCut && e.layer !== 'CUT' && e.layer !== 'TEST') return;
      var c = COLORS[e.layer] || COLORS.TEXT;
      cv.color(c);
      if (e.t === 'path') {
        cv.width(onlyCut ? 0.2 : c[3]).dash(e.dash ? e.dash.map(function (d) { return d * scale; }) : null);
        cv.poly(e.pts.map(function (p) { return { x: p.x * scale, y: p.y * scale }; }), e.closed);
      } else if (!onlyCut) {
        cv.dash(null).text(e.en, e.x * scale, e.y * scale, e.size * scale, e.angle, 'middle', true);
      }
    });
    cv.dash(null);
  }

  function regMark(cv, x, y) {
    cv.circle(x, y, 4);
    cv.poly([{ x: x - 7, y: y }, { x: x + 7, y: y }]);
    cv.poly([{ x: x, y: y - 7 }, { x: x, y: y + 7 }]);
  }

  function rowName(r) { return String.fromCharCode(65 + r); }

  function buildPDF(model, meta) {
    var Wmm = model.width * 10, Hmm = model.height * 10;
    var cols = Math.ceil(Wmm / TW), rows = Math.ceil(Hmm / TH);
    var pages = [];

    // 邊界盒，用嚟跳過空白頁
    var boxes = model.entities.map(function (e) {
      var pts = e.t === 'path' ? e.pts : [{ x: e.x, y: e.y }];
      var b = PM.geom.bbox(pts);
      return { x0: b.x0 * 10 - 3, y0: b.y0 * 10 - 3, x1: b.x1 * 10 + 3, y1: b.y1 * 10 + 3 };
    });
    var used = [];
    for (var r = 0; r < rows; r++) {
      used[r] = [];
      for (var c = 0; c < cols; c++) {
        var x0 = c * TW, y0 = r * TH;
        used[r][c] = boxes.some(function (b) { return b.x1 > x0 && b.x0 < x0 + TW && b.y1 > y0 && b.y0 < y0 + TH; });
      }
    }
    var total = 1;
    used.forEach(function (row) { row.forEach(function (u) { if (u) total++; }); });

    /* ---------- 封面 ---------- */
    var cv = new Canvas();
    cv.raw(n(K) + ' 0 0 ' + n(-K) + ' 0 ' + n(PH * K) + ' cm');
    cv.color([0, 0, 0]);
    cv.text('Women\'s Basic Bodice Block (front & back, waist darts)', MG + 5, 22, 6, 0, 'start');
    cv.text('Print at 100% / "Actual size" on A4 portrait. Do NOT use "Fit to page".', MG + 5, 30, 3.6, 0, 'start');
    cv.text('Check the 10 cm test square below with a ruler before cutting.', MG + 5, 35, 3.6, 0, 'start');

    // 尺寸表
    var y = 46;
    cv.text('Measurements (cm)', MG + 5, y, 4.2, 0, 'start');
    y += 6;
    (meta.lines || []).forEach(function (ln) { cv.text(ln, MG + 5, y, 3.2, 0, 'start'); y += 4.6; });

    // 10 cm 測試方格
    var sx = 110, sy = 46; // 方格左上角 = (sx - 10, sy)
    cv.width(0.4).rect(sx - 10, sy, 100, 100);
    for (var i = 1; i < 10; i++) {
      var l = i === 5 ? 6 : 3;
      cv.width(0.25).poly([{ x: sx - 10 + i * 10, y: sy }, { x: sx - 10 + i * 10, y: sy + l }]);
      cv.poly([{ x: sx - 10, y: sy + i * 10 }, { x: sx - 10 + l, y: sy + i * 10 }]);
    }
    cv.text('10 cm x 10 cm', sx + 40, sy + 48, 5, 0, 'middle');
    cv.text('TEST SQUARE', sx + 40, sy + 55, 3.5, 0, 'middle');

    // 拼頁圖
    var mapTop = 160, mapH = 110, mapW = 180;
    cv.text('Page layout (assemble in this order; trim along the grey frame, match the circle marks)', MG + 5, mapTop - 4, 3.2, 0, 'start');
    var s = Math.min(mapW / (cols * TW), mapH / (rows * TH));
    var mx = (PW - cols * TW * s) / 2, my = mapTop + 2;
    cv.raw('q ' + n(1) + ' 0 0 1 ' + n(mx) + ' ' + n(my) + ' cm');
    drawEntities(cv, model.entities, 10 * s, true);
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      cv.color(used[r][c] ? [0.4, 0.4, 0.4] : [0.85, 0.85, 0.85]).width(0.3).rect(c * TW * s, r * TH * s, TW * s, TH * s);
      if (used[r][c]) cv.color([0.12, 0.37, 0.75]).text(rowName(r) + (c + 1), c * TW * s + 3, r * TH * s + 6, 4.5, 0, 'start');
    }
    cv.raw('Q');
    cv.color([0, 0, 0]).text('Page 1 of ' + total + '  |  Pattern Maker', PW / 2, PH - 5, 3, 0, 'middle');
    pages.push(cv.toString());

    /* ---------- 紙樣分頁 ---------- */
    var pageNo = 1;
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      if (!used[r][c]) continue;
      pageNo++;
      var tx = c * TW, ty = r * TH;
      cv = new Canvas();
      cv.raw(n(K) + ' 0 0 ' + n(-K) + ' 0 ' + n(PH * K) + ' cm');
      // 剪裁到可印範圍，再畫紙樣
      cv.raw('q ' + n(MG) + ' ' + n(MG) + ' ' + n(TW) + ' ' + n(TH) + ' re W n');
      cv.raw('1 0 0 1 ' + n(MG - tx) + ' ' + n(MG - ty) + ' cm');
      drawEntities(cv, model.entities, 10, false);
      // 對位記號（喺每條拼接線上，剪開後兩頁各有一半）
      cv.color([0, 0, 0]).width(0.25);
      for (var cc = 1; cc < cols; cc++) {
        for (var rr = 0; rr < rows; rr++) regMark(cv, cc * TW, rr * TH + TH / 2);
        for (rr = 1; rr < rows; rr++) regMark(cv, cc * TW, rr * TH);
      }
      for (rr = 1; rr < rows; rr++) for (cc = 0; cc < cols; cc++) regMark(cv, cc * TW + TW / 2, rr * TH);
      cv.raw('Q');

      // 框線同角位記號
      cv.color([0.6, 0.6, 0.6]).width(0.2).rect(MG, MG, TW, TH);
      cv.color([0, 0, 0]).width(0.3);
      [[MG, MG], [MG + TW, MG], [MG, MG + TH], [MG + TW, MG + TH]].forEach(function (pt) {
        var dx = pt[0] === MG ? -1 : 1, dy = pt[1] === MG ? -1 : 1;
        cv.poly([{ x: pt[0] + dx * 2, y: pt[1] }, { x: pt[0] + dx * 8, y: pt[1] }]);
        cv.poly([{ x: pt[0], y: pt[1] + dy * 2 }, { x: pt[0], y: pt[1] + dy * 8 }]);
      });

      // 頁碼同相鄰頁提示
      var id = rowName(r) + (c + 1);
      cv.color([0.12, 0.37, 0.75]).text(id, MG + 2, MG - 2.5, 5, 0, 'start');
      cv.color([0, 0, 0]);
      cv.text('Page ' + pageNo + ' of ' + total + '  |  Women\'s Basic Bodice  |  Print at 100% (Actual size)  |  10 cm test square on page 1',
        PW / 2, PH - 4, 2.6, 0, 'middle');
      if (c > 0 && used[r][c - 1]) cv.text('< ' + rowName(r) + c, MG - 3, MG + TH / 2, 3, -90, 'middle');
      if (c < cols - 1 && used[r][c + 1]) cv.text(rowName(r) + (c + 2) + ' >', MG + TW + 3, MG + TH / 2, 3, 90, 'middle');
      if (r > 0 && used[r - 1][c]) cv.text('^ ' + rowName(r - 1) + (c + 1), PW / 2, MG - 2.5, 3, 0, 'middle');
      if (r < rows - 1 && used[r + 1][c]) cv.text('v ' + rowName(r + 1) + (c + 1), PW / 2, MG + TH + 4, 3, 0, 'middle');
      pages.push(cv.toString());
    }

    return assemble(pages);
  }

  function assemble(contents) {
    var objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    var kids = [];
    contents.forEach(function (c, i) {
      var pid = 4 + i * 2, cid = pid + 1;
      kids.push(pid + ' 0 R');
      objs[pid] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n(PW * K) + ' ' + n(PH * K) + '] /Contents ' + cid +
        ' 0 R /Resources << /Font << /F1 3 0 R >> >> >>';
      objs[cid] = '<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream';
    });
    objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';

    var out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    var offsets = [];
    for (var i = 1; i < objs.length; i++) {
      offsets[i] = out.length;
      out += i + ' 0 obj\n' + objs[i] + '\nendobj\n';
    }
    var xref = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (i = 1; i < objs.length; i++) out += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';

    // 轉成位元組（全部係 0–255 字元）
    var bytes = new Uint8Array(out.length);
    for (i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }

  PM.toPDF = buildPDF;
})(typeof window !== 'undefined' ? window : globalThis);
