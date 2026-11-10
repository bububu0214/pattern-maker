/*
 * 將打版結果轉成可繪製嘅圖元（path / text），並排版。
 * 圖元座標單位：厘米，y 向下，(0,0) 喺左上角。
 * 每個文字有 zh（畫面 / SVG 用）同 en（PDF / DXF 用，避免字型問題）。
 */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});
  var G = PM.geom, P = G.P, f1 = PM.fmt;

  var DIM = 0.42;   // 標示字高
  var TITLE = 1.1;  // 片名字高

  function path(pts, layer, closed, dash) {
    return { t: 'path', pts: pts, layer: layer, closed: !!closed, dash: dash || null };
  }
  function text(p, zh, en, size, angle, layer) {
    return { t: 'text', x: p.x, y: p.y, zh: zh, en: en, size: size || DIM, angle: angle || 0, layer: layer || 'TEXT' };
  }
  function angleOf(a, b) {
    var ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    return normAngle(ang);
  }
  function normAngle(a) {
    while (a > 90) a -= 180;
    while (a <= -90) a += 180;
    return a;
  }
  function arrowHead(tip, from, layer) {
    var d = G.norm(G.sub(from, tip)), n = P(-d.y, d.x), L = 0.45, w = 0.18;
    var base = G.add(tip, G.mul(d, L));
    return path([G.add(base, G.mul(n, w)), tip, G.sub(base, G.mul(n, w))], layer);
  }

  /** 尺寸線：a→b，沿法線方向 off 偏移 */
  function dimLine(out, a, b, offVec, zh, en) {
    var a2 = G.add(a, offVec), b2 = G.add(b, offVec);
    var ol = G.len(offVec);
    if (ol > 0.05) {
      var u = G.norm(offVec);
      out.push(path([G.add(a, G.mul(u, 0.15)), G.add(a2, G.mul(u, 0.3))], 'DIM'));
      out.push(path([G.add(b, G.mul(u, 0.15)), G.add(b2, G.mul(u, 0.3))], 'DIM'));
    }
    out.push(path([a2, b2], 'DIM'));
    out.push(arrowHead(a2, b2, 'DIM'));
    out.push(arrowHead(b2, a2, 'DIM'));
    var mid = G.lerp(a2, b2, 0.5);
    var dir = G.norm(G.sub(b2, a2));
    var nrm = P(dir.y, -dir.x);
    var ang = angleOf(a2, b2);
    // 文字放喺線嘅「上方」（畫面上）
    var up = Math.abs(ang) < 45 ? P(0, -1) : P(-1, 0);
    if (nrm.x * up.x + nrm.y * up.y < 0) nrm = G.mul(nrm, -1);
    out.push(text(G.add(mid, G.mul(nrm, 0.45)), zh, en, DIM, ang, 'DIM'));
  }

  function buildPiece(pc, opt) {
    var sa = opt.sa;
    var fold = pc.key === 'back' ? opt.cbFold : opt.cfFold;
    var ents = [];

    // 淨樣（縫線）多邊形同縫份
    var seam = [], offs = [];
    pc.edges.forEach(function (e) {
      var d = (e.name === 'center' && fold) ? 0 : sa;
      for (var i = 0; i < e.pts.length - 1; i++) { seam.push(e.pts[i]); offs.push(d); }
    });
    var cut = sa > 0 || !fold ? G.offsetPolygon(seam, offs) : seam;
    ents.push(path(cut, 'CUT', true));
    if (sa > 0) ents.push(path(seam, 'SEAM', true, [0.4, 0.25]));

    var edge = function (n) { return pc.edges.filter(function (e) { return e.name === n; })[0]; };
    var outN = function (t) { return P(t.y, -t.x); }; // 順時針多邊形外法線

    // 腰褶
    if (pc.dart) {
      ents.push(path([pc.dart.l, pc.dart.apex, pc.dart.r], 'DART'));
      ents.push(path([G.lerp(pc.dart.l, pc.dart.r, 0.5), pc.dart.apex], 'GUIDE', false, [0.3, 0.2]));
      var dl = G.add(pc.dart.apex, P(0.6, (pc.dart.l.y - pc.dart.apex.y) * 0.3));
      ents.push(text(dl, '褶 ' + f1(pc.dart.w), 'Dart ' + f1(pc.dart.w), DIM, -90, 'DIM'));
      // 褶位剪口
      [pc.dart.l, pc.dart.r].forEach(function (p) {
        ents.push(path([G.add(p, P(0, sa > 0 ? sa : 0)), G.add(p, P(0, sa > 0 ? sa - 0.6 : -0.5))], 'NOTCH'));
      });
      ents.push(path([G.add(pc.dart.apex, P(-0.25, -0.25)), G.add(pc.dart.apex, P(0.25, 0.25))], 'DART'));
      ents.push(path([G.add(pc.dart.apex, P(-0.25, 0.25)), G.add(pc.dart.apex, P(0.25, -0.25))], 'DART'));
    }

    // 胸點
    if (pc.bp) {
      var circ = [];
      for (var k = 0; k <= 24; k++) circ.push(P(pc.bp.x + 0.5 * Math.cos(k / 24 * 2 * Math.PI), pc.bp.y + 0.5 * Math.sin(k / 24 * 2 * Math.PI)));
      ents.push(path(circ, 'GUIDE', true));
      ents.push(text(G.add(pc.bp, P(-1.3, -0.6)), '胸點', 'BP', DIM, 0, 'DIM'));
    }

    // 胸圍線
    ents.push(path([P(0, pc.yB), P(pc.bustW, pc.yB)], 'GUIDE', false, [0.6, 0.3]));

    // 剪口（夾圈）
    pc.notches.forEach(function (nt) {
      var pts = edge(nt.edge).pts, L = G.polyLen(pts);
      var ds = nt.double ? [L * nt.frac - 0.35, L * nt.frac + 0.35] : [L * nt.frac];
      ds.forEach(function (d) {
        var pa = G.pointAt(pts, d), n = outN(pa.t);
        ents.push(path([G.add(pa.p, G.mul(n, sa > 0 ? sa : 0)), G.add(pa.p, G.mul(n, sa > 0 ? sa - 0.6 : -0.5))], 'NOTCH'));
      });
    });

    // 布紋線
    var gy0 = pc.yB - 6, gy1 = Math.min(pc.centerBot.y, edge('side').pts[1].y) - 3;
    var gx = pc.grainX;
    var g0 = P(gx, gy0), g1 = P(gx, gy1);
    ents.push(path([g0, g1], 'GRAIN'));
    ents.push(arrowHead(g0, g1, 'GRAIN'));
    ents.push(arrowHead(g1, g0, 'GRAIN'));
    ents.push(text(P(gx - 0.45, (gy0 + gy1) / 2), '布紋線', 'GRAINLINE', DIM, -90, 'GRAIN'));

    // 對摺記號
    var ct = pc.centerTop, cb = pc.centerBot;
    if (fold) {
      var fx = -1.3, fy0 = ct.y + 2.5, fy1 = cb.y - 2.5;
      ents.push(path([P(0, fy0), P(fx, fy0), P(fx, fy1), P(0, fy1)], 'GRAIN'));
      ents.push(arrowHead(P(0, fy0), P(fx, fy0), 'GRAIN'));
      ents.push(arrowHead(P(0, fy1), P(fx, fy1), 'GRAIN'));
      ents.push(text(P(fx - 0.45, (fy0 + fy1) / 2), pc.centerZh + '對摺線', pc.centerEn + ' PLACE ON FOLD', DIM, -90, 'GRAIN'));
    }

    // 片名
    var lx = pc.bustW * 0.5, ly = pc.yB - 7.5;
    ents.push(text(P(lx, ly), pc.zh, pc.en, TITLE, 0, 'TEXT'));
    ents.push(text(P(lx, ly + 1.3), fold ? '裁 1 片（對摺）' : '裁 2 片（左右對稱）', fold ? 'CUT 1 ON FOLD' : 'CUT 2 (MIRROR)', 0.5, 0, 'TEXT'));
    ents.push(text(P(lx, ly + 2.2), sa > 0 ? '已含縫份 ' + sa + ' cm' : '無縫份（淨樣）', sa > 0 ? 'SEAM ALLOWANCE ' + sa + ' CM INCLUDED' : 'NO SEAM ALLOWANCE', 0.42, 0, 'TEXT'));

    if (opt.dims) {
      // 中線長
      var cx = fold ? -3.2 : -(sa + 1.5);
      dimLine(ents, ct, cb, P(cx, 0), pc.centerZh + '長 ' + f1(cb.y - ct.y), pc.centerEn + ' ' + f1(cb.y - ct.y));
      // 胸寬（喺胸圍線上）
      ents.push(text(P(pc.bustW * 0.72, pc.yB - 0.45), '胸寬 ' + f1(pc.bustW), 'Bust ' + f1(pc.bustW), DIM, 0, 'DIM'));
      // 腰寬
      var sw = edge('side').pts[1];
      var yLow = Math.max(cb.y, sw.y) + sa + 1.6;
      dimLine(ents, P(0, yLow), P(sw.x, yLow), P(0, 0),
        '腰寬 ' + f1(pc.waistW) + '（不計褶）', 'Waist ' + f1(pc.waistW) + ' (excl. dart)');
      ents.push(path([P(sw.x, sw.y + sa + 0.2), P(sw.x, yLow + 0.3)], 'DIM'));
      ents.push(path([P(0, cb.y + (fold ? 0.2 : sa + 0.2)), P(0, yLow + 0.3)], 'DIM'));
      // 沿邊標示
      [['shoulder', '肩', 'Shoulder'], ['armhole', '夾圈', 'Armhole'], ['neck', '領', 'Neck'], ['side', '側縫', 'Side']].forEach(function (lb) {
        var pts = edge(lb[0]).pts, L = G.polyLen(pts);
        var pa = G.pointAt(pts, L * (lb[0] === 'armhole' ? 0.35 : 0.5));
        var n = outN(pa.t);
        var pos = G.add(pa.p, G.mul(n, sa + 0.75));
        var ang = normAngle(Math.atan2(pa.t.y, pa.t.x) * 180 / Math.PI);
        if (lb[0] === 'neck') { pos = G.add(pa.p, G.mul(n, -1.2)); }
        ents.push(text(pos, lb[1] + ' ' + f1(L), lb[2] + ' ' + f1(L), DIM, ang, 'DIM'));
      });
    }
    return ents;
  }

  function transform(ents, fn, mirror) {
    return ents.map(function (e) {
      if (e.t === 'path') {
        var o = Object.assign({}, e); o.pts = e.pts.map(fn); return o;
      }
      var p = fn(P(e.x, e.y));
      var o2 = Object.assign({}, e, { x: p.x, y: p.y });
      if (mirror) o2.angle = normAngle(180 - e.angle);
      return o2;
    });
  }

  function entsBox(ents) {
    var pts = [];
    ents.forEach(function (e) {
      if (e.t === 'path') pts = pts.concat(e.pts);
      else {
        var w = (e.zh.length * e.size) / 2;
        var a = e.angle * Math.PI / 180;
        pts.push(P(e.x + Math.cos(a) * w, e.y + Math.sin(a) * w));
        pts.push(P(e.x - Math.cos(a) * w, e.y - Math.sin(a) * w));
      }
    });
    return G.bbox(pts);
  }

  function testSquare(x, y) {
    var e = [path([P(x, y), P(x + 10, y), P(x + 10, y + 10), P(x, y + 10)], 'TEST', true)];
    for (var i = 1; i < 10; i++) {
      var l = i === 5 ? 0.8 : 0.4;
      e.push(path([P(x + i, y), P(x + i, y + l)], 'TEST'));
      e.push(path([P(x, y + i), P(x + l, y + i)], 'TEST'));
    }
    e.push(text(P(x + 5, y + 4.4), '10 cm 測試方格', '10 CM TEST SQUARE', 0.6, 0, 'TEST'));
    e.push(text(P(x + 5, y + 5.6), '請量度確認比例 1:1', 'Measure to check 1:1 scale', 0.4, 0, 'TEST'));
    return e;
  }

  /**
   * 生成整個版面
   * opt: { sa, cbFold, cfFold, dims }
   */
  function layout(result, opt) {
    var M = 2, GAP = 4;
    var back = buildPiece(result.back, opt);
    var front = transform(buildPiece(result.front, opt), function (p) { return P(-p.x, p.y); }, true);

    var bb = entsBox(back), fb = entsBox(front);
    var top = Math.min(bb.y0, fb.y0);
    var bx = M - bb.x0;
    back = transform(back, function (p) { return P(p.x + bx, p.y - top + M); });
    var fx = M + (bb.x1 - bb.x0) + GAP - fb.x0;
    front = transform(front, function (p) { return P(p.x + fx, p.y - top + M); });

    var xEnd = M + (bb.x1 - bb.x0) + GAP + (fb.x1 - fb.x0);
    var height = Math.max(bb.y1, fb.y1) - top + 2 * M;
    var width = xEnd + M;

    // 10cm 測試方格：放喺唔會令 A4 頁數增加嘅位置
    var TW = 19, TH = 27.7; // A4 每頁可印範圍（cm）
    var pages = function (w, h) { return Math.ceil(w / TW) * Math.ceil(h / TH); };
    var sq = [];
    var backH = bb.y1 - bb.y0;
    var base = pages(width, height);
    if (pages(xEnd + GAP + 10 + M, height) === base) {
      sq = testSquare(xEnd + GAP, M);
      width = xEnd + GAP + 10 + M;
    } else if (pages(xEnd + 1.5 + 10 + 0.5, height) === base) {
      sq = testSquare(xEnd + 1.5, M);
      width = xEnd + 1.5 + 10 + 0.5;
    } else if (pages(width, M + backH + 2 + 10 + M) === base) {
      sq = testSquare(M + 2, M + backH + 2);
      height = Math.max(height, M + backH + 2 + 10 + M);
    } // 否則唔放（PDF 封面一定有測試方格）

    return { entities: back.concat(front, sq), width: width, height: Math.max(height, 14) };
  }

  PM.layout = layout;
})(typeof window !== 'undefined' ? window : globalThis);
