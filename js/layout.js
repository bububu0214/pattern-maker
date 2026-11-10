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
  function normAngle(a) {
    while (a > 90) a -= 180;
    while (a <= -90) a += 180;
    return a;
  }
  function angleOf(a, b) { return normAngle(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI); }
  function arrowHead(tip, from, layer) {
    var d = G.norm(G.sub(from, tip)), n = P(-d.y, d.x), L = 0.45, w = 0.18;
    var base = G.add(tip, G.mul(d, L));
    return path([G.add(base, G.mul(n, w)), tip, G.sub(base, G.mul(n, w))], layer);
  }
  function circle(c, r) {
    var pts = [];
    for (var k = 0; k <= 24; k++) pts.push(P(c.x + r * Math.cos(k / 24 * 2 * Math.PI), c.y + r * Math.sin(k / 24 * 2 * Math.PI)));
    return pts;
  }

  /** 尺寸線：a→b，偏移 offVec */
  function dimLine(out, a, b, offVec, zh, en) {
    var a2 = G.add(a, offVec), b2 = G.add(b, offVec);
    if (G.len(offVec) > 0.05) {
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
    var up = Math.abs(ang) < 45 ? P(0, -1) : P(-1, 0);
    if (nrm.x * up.x + nrm.y * up.y < 0) nrm = G.mul(nrm, -1);
    out.push(text(G.add(mid, G.mul(nrm, 0.45)), zh, en, DIM, ang, 'DIM'));
  }

  /** 喺折線上搵最近 p 嘅位置同切線 */
  function nearestOn(pts, p) {
    var best = 0, bd = Infinity;
    for (var i = 0; i < pts.length; i++) { var d = G.dist(pts[i], p); if (d < bd) { bd = d; best = i; } }
    var a = pts[Math.max(0, best - 1)], b = pts[Math.min(pts.length - 1, best + 1)];
    return { p: p, t: G.norm(G.sub(b, a)) };
  }

  function buildPiece(pc, opt) {
    var sa = opt.sa;
    var ents = [];
    var edge = function (n) { return pc.edges.filter(function (e) { return e.name === n; })[0]; };
    var outN = function (t) { return P(t.y, -t.x); }; // 順時針多邊形外法線
    function edgeSa(name) {
      if (name === pc.fold) return 0;
      if (sa > 0 && pc.saEdge && pc.saEdge[name] != null && !isNaN(pc.saEdge[name])) return pc.saEdge[name];
      return sa;
    }

    // 淨樣同縫份
    var seam = [], offs = [];
    pc.edges.forEach(function (e) {
      var d = edgeSa(e.name);
      for (var i = 0; i < e.pts.length - 1; i++) { seam.push(e.pts[i]); offs.push(d); }
    });
    var cut = sa > 0 ? G.offsetPolygon(seam, offs) : seam;
    ents.push(path(cut, 'CUT', true));
    if (sa > 0) ents.push(path(seam, 'SEAM', true, [0.4, 0.25]));

    // 褶
    pc.darts.forEach(function (d) {
      ents.push(path(d.pts, 'DART', d.closed));
      var tip = d.apex;
      var mid = d.closed ? d.low : G.lerp(d.pts[0], d.pts[d.pts.length - 1], 0.5);
      ents.push(path([tip, mid], 'GUIDE', false, [0.3, 0.2]));
      ents.push(path([G.add(tip, P(-0.25, -0.25)), G.add(tip, P(0.25, 0.25))], 'DART'));
      ents.push(path([G.add(tip, P(-0.25, 0.25)), G.add(tip, P(0.25, -0.25))], 'DART'));
      var lp = G.add(tip, P(0.6, (mid.y - tip.y) * 0.3));
      ents.push(text(lp, '褶 ' + f1(d.w), 'Dart ' + f1(d.w), DIM, -90, 'DIM'));
    });

    // 輔助線
    pc.guides.forEach(function (gd) {
      ents.push(path(gd.pts, 'GUIDE', !!gd.closed, gd.dash));
      if (gd.zh) {
        var a = gd.pts[0], b = gd.pts[gd.pts.length - 1];
        var vertical = Math.abs(b.x - a.x) < Math.abs(b.y - a.y);
        var tp = vertical ? G.add(G.lerp(a, b, 0.25), P(0.45, 0)) : G.add(G.lerp(a, b, 0.25), P(0, -0.4));
        ents.push(text(tp, gd.zh, gd.en, 0.38, vertical ? -90 : 0, 'DIM'));
      }
    });

    // 胸點、鈕位
    pc.marks.forEach(function (mk) {
      if (mk.type === 'bp') {
        ents.push(path(circle(mk.p, 0.5), 'GUIDE', true));
        ents.push(text(G.add(mk.p, P(-1.3, -0.6)), '胸點', 'BP', DIM, 0, 'DIM'));
      } else if (mk.type === 'buttonhole') {
        ents.push(path([G.add(mk.p, P(-0.8, 0)), G.add(mk.p, P(0.8, 0))], 'NOTCH'));
        ents.push(path([G.add(mk.p, P(-0.8, -0.25)), G.add(mk.p, P(-0.8, 0.25))], 'NOTCH'));
        ents.push(path([G.add(mk.p, P(0.8, -0.25)), G.add(mk.p, P(0.8, 0.25))], 'NOTCH'));
      } else if (mk.type === 'button') {
        ents.push(path(circle(mk.p, 0.6), 'NOTCH', true));
        ents.push(path([G.add(mk.p, P(-0.9, 0)), G.add(mk.p, P(0.9, 0))], 'NOTCH'));
      }
    });

    // 剪口
    pc.notches.forEach(function (nt) {
      var e = edge(nt.edge);
      if (!e) return;
      var o = nearestOn(e.pts, nt.p), n = outN(o.t);
      var es = edgeSa(nt.edge);
      var offsets = nt.count === 2 ? [-0.35, 0.35] : [0];
      offsets.forEach(function (k) {
        var q = G.add(o.p, G.mul(o.t, k));
        ents.push(path([G.add(q, G.mul(n, es > 0 ? es : 0)), G.add(q, G.mul(n, es > 0 ? es - 0.6 : -0.5))], 'NOTCH'));
      });
    });

    // 布紋線
    var g0 = pc.grain[0], g1 = pc.grain[1];
    ents.push(path([g0, g1], 'GRAIN'));
    ents.push(arrowHead(g0, g1, 'GRAIN'));
    ents.push(arrowHead(g1, g0, 'GRAIN'));
    var gd0 = G.norm(G.sub(g1, g0)), gn = P(gd0.y, -gd0.x);
    if (gn.y > 0 || (Math.abs(gn.y) < 1e-6 && gn.x > 0)) gn = G.mul(gn, -1);
    ents.push(text(G.add(G.lerp(g0, g1, 0.5), G.mul(gn, 0.45)), '布紋線', 'GRAINLINE', DIM, angleOf(g0, g1), 'GRAIN'));

    // 對摺記號
    if (pc.fold) {
      var fe = edge(pc.fold).pts, fa = fe[0], fb = fe[fe.length - 1];
      var fd = G.norm(G.sub(fb, fa)), fn = outN(fd);
      var L = G.dist(fa, fb), q0 = G.add(fa, G.mul(fd, 2.5)), q1 = G.add(fa, G.mul(fd, L - 2.5));
      var o0 = G.add(q0, G.mul(fn, 1.3)), o1 = G.add(q1, G.mul(fn, 1.3));
      ents.push(path([q0, o0, o1, q1], 'GRAIN'));
      ents.push(arrowHead(q0, o0, 'GRAIN'));
      ents.push(arrowHead(q1, o1, 'GRAIN'));
      ents.push(text(G.add(G.lerp(o0, o1, 0.5), G.mul(fn, 0.45)), pc.foldZh, pc.foldEn, DIM, angleOf(o0, o1), 'GRAIN'));
    }

    // 片名
    var lp0 = pc.label.p, k = pc.small ? 0.75 : 1;
    var cutZh = pc.cutZh || (pc.cut === 1 ? '裁 1 片（對摺）' : '裁 2 片（左右對稱）');
    var cutEn = pc.cutEn || (pc.cut === 1 ? 'CUT 1 ON FOLD' : 'CUT 2 (MIRROR PAIR)');
    ents.push(text(lp0, pc.zh, pc.en, TITLE * k, 0, 'TEXT'));
    ents.push(text(P(lp0.x, lp0.y + 1.3 * k), cutZh, cutEn, 0.5 * k, 0, 'TEXT'));
    ents.push(text(P(lp0.x, lp0.y + 2.2 * k), sa > 0 ? '已含縫份 ' + sa + ' cm' : '無縫份（淨樣）',
      sa > 0 ? 'SEAM ALLOWANCE ' + sa + ' CM INCLUDED' : 'NO SEAM ALLOWANCE', 0.42 * k, 0, 'TEXT'));

    if (opt.dims) {
      var maxY = Math.max.apply(null, seam.map(function (p) { return p.y; }));
      pc.dims.forEach(function (d) {
        if (d.kind === 'dim') {
          var gap = pc.fold && d.side === 'left' ? 3.2 : sa + 1.5;
          dimLine(ents, d.a, d.b, P(d.side === 'left' ? -gap : gap, 0), d.zh, d.en);
        } else if (d.kind === 'text') {
          ents.push(text(d.p, d.zh, d.en, DIM, d.angle || 0, 'DIM'));
        } else if (d.kind === 'below') {
          var yLow = maxY + Math.max(sa, edgeSa('hem')) + 1.6;
          dimLine(ents, P(d.a.x, yLow), P(d.b.x, yLow), P(0, 0), d.zh, d.en);
          [d.a, d.b].forEach(function (p) {
            ents.push(path([P(p.x, p.y + Math.max(sa, edgeSa('hem')) + 0.2), P(p.x, yLow + 0.3)], 'DIM'));
          });
        } else if (d.kind === 'edge') {
          var e = edge(d.edge);
          if (!e) return;
          var Ln = G.polyLen(e.pts);
          var pa = G.pointAt(e.pts, Ln * (d.frac || 0.5));
          var n = outN(pa.t);
          var pos = d.inside ? G.add(pa.p, G.mul(n, -1.2)) : G.add(pa.p, G.mul(n, sa + 0.75));
          ents.push(text(pos, d.zh + ' ' + f1(Ln), d.en + ' ' + f1(Ln), DIM, normAngle(Math.atan2(pa.t.y, pa.t.x) * 180 / Math.PI), 'DIM'));
        }
      });
    }
    return ents;
  }

  function transform(ents, fn, mirror) {
    return ents.map(function (e) {
      if (e.t === 'path') { var o = Object.assign({}, e); o.pts = e.pts.map(fn); return o; }
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
        var w = (e.zh.length * e.size) / 2, a = e.angle * Math.PI / 180;
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
   * 生成整個版面：紙樣由左至右排
   * opt: { sa, dims }
   */
  function layout(result, opt) {
    var M = 2, GAP = 4;
    var built = result.pieces.map(function (pc) {
      var ents = buildPiece(pc, opt);
      if (pc.mirror) ents = transform(ents, function (p) { return P(-p.x, p.y); }, true);
      return { ents: ents, box: entsBox(ents) };
    });
    // 排版：限定總闊度（前後片並排嘅闊度），每塊放喺「最高可放嘅位置」（左下優先）
    var widths = built.map(function (b) { return b.box.x1 - b.box.x0; });
    var sortedW = widths.slice().sort(function (a, b) { return b - a; });
    var maxW = Math.max(widths[0] + GAP + (widths[1] || 0), sortedW[0] + GAP + (sortedW[1] || 0), 60);
    var placed = [], all = [];
    built.forEach(function (b, i) {
      var bw = widths[i], bh = b.box.y1 - b.box.y0;
      var xs = [M].concat(placed.map(function (r) { return r.x1 + GAP; }));
      var best = null;
      xs.forEach(function (x) {
        if (x + bw > M + maxW + 0.01) return;
        var y = M;
        placed.forEach(function (r) {
          if (r.x0 < x + bw + GAP && r.x1 + GAP > x) y = Math.max(y, r.y1 + GAP);
        });
        if (!best || y < best.y - 0.01 || (Math.abs(y - best.y) < 0.01 && x < best.x)) best = { x: x, y: y };
      });
      var dx = best.x - b.box.x0, dy = best.y - b.box.y0;
      all = all.concat(transform(b.ents, function (p) { return P(p.x + dx, p.y + dy); }));
      placed.push({ x0: best.x, y0: best.y, x1: best.x + bw, y1: best.y + bh });
    });
    var xEnd = Math.max.apply(null, placed.map(function (r) { return r.x1; }));
    var yEnd = Math.max.apply(null, placed.map(function (r) { return r.y1; }));
    var width = xEnd + M, height = yEnd + M;

    // 10cm 測試方格：搵一個唔會令 A4 頁數增加嘅空位（PDF 封面一定有測試方格）
    var TW = 19, TH = 27.7, SQ = 10;
    var pages = function (w, h) { return Math.ceil(w / TW) * Math.ceil(h / TH); };
    var base = pages(width, height);
    var limW = Math.ceil(width / TW) * TW, limH = Math.ceil(height / TH) * TH;
    var spot = null;
    var xs = [M].concat(placed.map(function (r) { return r.x1 + 1.5; }));
    xs.forEach(function (x) {
      if (x + SQ + 0.5 > limW) return;
      var ys = [M].concat(placed.map(function (r) { return r.y1 + 1.5; }));
      ys.forEach(function (y) {
        if (y + SQ + 0.5 > limH) return;
        var hit = placed.some(function (r) { return r.x0 < x + SQ + 1.5 && r.x1 + 1.5 > x && r.y0 < y + SQ + 1.5 && r.y1 + 1.5 > y; });
        if (hit) return;
        if (!spot || y < spot.y || (y === spot.y && x < spot.x)) spot = { x: x, y: y };
      });
    });
    var sq = [];
    if (spot && pages(Math.max(width, spot.x + SQ + 0.5), Math.max(height, spot.y + SQ + 0.5)) === base) {
      sq = testSquare(spot.x, spot.y);
      width = Math.max(width, spot.x + SQ + 0.5);
      height = Math.max(height, spot.y + SQ + 0.5);
    }

    return { entities: all.concat(sq), width: width, height: Math.max(height, 14) };
  }

  PM.layout = layout;
})(typeof window !== 'undefined' ? window : globalThis);
