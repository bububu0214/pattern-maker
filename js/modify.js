/*
 * 通用款式修改工具（喺基本紙樣上面做）
 *   splitAtY     ：橫向剪開（育克）
 *   addFullness  ：喺中線加闊（育克下碎褶／中間褶）
 *   princess     ：公主線（由夾圈經褶尖落下擺）
 *   ruffles      ：荷葉邊長條
 * 紙樣外形用「段」表示：{ name, line, b:[p0,p1,p2,p3] }（直線都當三次曲線存）
 */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});
  var G = PM.geom, P = G.P, B = PM.bez, f1 = PM.fmt;
  var EPS = 0.02;

  function same(a, b) { return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- 外形 <-> 段 ---------- */
  function toSegs(edges) {
    var segs = [];
    edges.forEach(function (e) {
      if (e.bez) e.bez.forEach(function (b) { segs.push({ name: e.name, line: false, b: b }); });
      else for (var i = 0; i < e.pts.length - 1; i++) {
        if (same(e.pts[i], e.pts[i + 1])) continue;
        segs.push({ name: e.name, line: true, b: B.line(e.pts[i], e.pts[i + 1]) });
      }
    });
    return segs;
  }
  function toEdges(segs) {
    var groups = [];
    segs.forEach(function (s) {
      var last = groups[groups.length - 1];
      if (last && last.name === s.name) last.segs.push(s); else groups.push({ name: s.name, segs: [s] });
    });
    // 頭尾同名就合併
    if (groups.length > 1 && groups[0].name === groups[groups.length - 1].name) {
      var tail = groups.pop(); groups[0].segs = tail.segs.concat(groups[0].segs);
    }
    return groups.map(function (gr) {
      if (gr.segs.every(function (s) { return s.line; })) {
        var pts = [gr.segs[0].b[0]];
        gr.segs.forEach(function (s) { pts.push(s.b[3]); });
        return { name: gr.name, pts: pts };
      }
      return B.edge(gr.name, gr.segs.map(function (s) { return s.b; }));
    });
  }
  function outline(edges) {
    var pts = [];
    edges.forEach(function (e) { pts = pts.concat(e.pts.slice(0, -1)); });
    return pts;
  }
  function inside(poly, p) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  function distToPoly(poly, p) {
    var best = Infinity;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var ab = G.sub(b, a), t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)));
      best = Math.min(best, G.dist(p, G.add(a, G.mul(ab, t))));
    }
    return best;
  }
  function centroid(poly) {
    var A = 0, cx = 0, cy = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length], k = a.x * b.y - b.x * a.y;
      A += k; cx += (a.x + b.x) * k; cy += (a.y + b.y) * k;
    }
    return A ? P(cx / (3 * A), cy / (3 * A)) : poly[0];
  }
  /** 喺 x 呢條垂直線上，紙樣入面嘅 y 範圍 */
  function yRangeAt(poly, x) {
    var ys = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) ys.push(a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x));
    }
    if (ys.length < 2) return null;
    return [Math.min.apply(null, ys), Math.max.apply(null, ys)];
  }

  /** 修改外形之後，整理剪口、褶、輔助線、記號、布紋線、片名 */
  function tidy(pc, opts) {
    opts = opts || {};
    var poly = outline(pc.edges);
    var inP = function (p) { return inside(poly, p) || distToPoly(poly, p) < 0.05; };
    var names = pc.edges.map(function (e) { return e.name; });
    if (pc.fold && names.indexOf(pc.fold) < 0) {
      pc.fold = null;
      if (pc.cut === 1) { pc.cut = 2; pc.cutZh = pc.cutZhNoFold || null; pc.cutEn = pc.cutEnNoFold || null; pc.qty = pc.qtyNoFold || null; }
    }
    pc.notches = (pc.notches || []).filter(function (n) { return names.indexOf(n.edge) >= 0 && distToPoly(poly, n.p) < 0.05; });
    pc.darts = opts.dropDarts ? [] : (pc.darts || []).filter(function (d) { return d.pts.every(inP); });
    // 輔助線：只保留喺紙樣入面嘅部份
    var guides = [];
    (pc.guides || []).forEach(function (gd) {
      var run = [], first = true;
      var flush = function () {
        if (run.length >= 2 && G.polyLen(run) > 1) {
          var o = Object.assign({}, gd, { pts: run, closed: gd.closed && run.length === gd.pts.length });
          if (!first) { delete o.zh; delete o.en; }
          guides.push(o); first = false;
        }
        run = [];
      };
      var pts = gd.closed ? gd.pts.concat([gd.pts[0]]) : gd.pts;
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(G.dist(a, b) / 0.5));
        for (var k = (i === 0 ? 0 : 1); k <= n; k++) {
          var q = G.lerp(a, b, k / n);
          if (inP(q)) run.push(q); else flush();
        }
      }
      flush();
      if (gd.closed && guides.length && guides[guides.length - 1].pts.length === gd.pts.length + 0) guides[guides.length - 1].closed = true;
    });
    pc.guides = guides;
    pc.marks = (pc.marks || []).filter(function (m) { return inP(m.p); });
    // 布紋線
    var c = centroid(poly);
    if (!pc.grain || !inP(pc.grain[0]) || !inP(pc.grain[1])) {
      var gx = opts.grainX != null ? opts.grainX : c.x;
      var r = yRangeAt(poly, gx) || [c.y - 2, c.y + 2];
      var pad = Math.min(3, (r[1] - r[0]) * 0.15);
      pc.grain = [P(gx, r[0] + pad), P(gx, r[1] - pad)];
    }
    if (!pc.label || !inside(poly, pc.label.p)) pc.label = { p: c };
    // 標示：只保留仲存在嘅邊
    pc.dims = (pc.dims || []).filter(function (d) {
      if (d.kind === 'edge') return names.indexOf(d.edge) >= 0;
      if (d.kind === 'dim' || d.kind === 'below') return opts.keepDims;
      return d.p ? inP(d.p) : false;
    });
    return pc;
  }

  /* ---------- 喺段上面搵 y 交點 ---------- */
  function crossT(b, y) {
    var y0 = b[0].y, y3 = b[3].y;
    if ((y0 - y) * (y3 - y) > 0) return null;
    if (Math.abs(y0 - y3) < 1e-9) return null;
    var lo = 0, hi = 1, up = y3 > y0;
    for (var i = 0; i < 45; i++) {
      var mid = (lo + hi) / 2, yy = B.at(b, mid).y;
      if ((yy < y) === up) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function splitSeg(s, t) {
    var parts = B.split(s.b, t);
    return [{ name: s.name, line: s.line, b: parts[0] }, { name: s.name, line: s.line, b: parts[1] }];
  }

  /**
   * 橫向剪開：返回 { upper, lower }（兩塊紙樣），交點唔係兩個就返回 null
   */
  function splitAtY(pc, y, seamName, upperInfo) {
    y += 1e-6;
    var segs = toSegs(pc.edges);
    var hits = [];
    segs.forEach(function (s, i) { var t = crossT(s.b, y); if (t != null && t > 1e-6 && t < 1 - 1e-6) hits.push({ i: i, t: t }); });
    if (hits.length !== 2) return null;
    var A = hits[0], Bh = hits[1];
    var sa = splitSeg(segs[A.i], A.t), sb = splitSeg(segs[Bh.i], Bh.t);
    var chain1 = [sa[1]].concat(segs.slice(A.i + 1, Bh.i)).concat([sb[0]]);          // A → B
    var chain2 = [sb[1]].concat(segs.slice(Bh.i + 1)).concat(segs.slice(0, A.i)).concat([sa[0]]); // B → A
    var pa = sa[0].b[3], pb = sb[0].b[3];
    var close1 = { name: seamName, line: true, b: B.line(pb, pa) };
    var close2 = { name: seamName, line: true, b: B.line(pa, pb) };
    var poly1 = chain1.concat([close1]), poly2 = chain2.concat([close2]);
    var avg = function (ch) { return ch.reduce(function (s, x) { return s + x.b[0].y + x.b[3].y; }, 0) / (2 * ch.length); };
    var upperSegs = avg(chain1) < avg(chain2) ? poly1 : poly2;
    var lowerSegs = upperSegs === poly1 ? poly2 : poly1;

    var upper = clone(pc), lower = clone(pc);
    upper.edges = toEdges(upperSegs); lower.edges = toEdges(lowerSegs);
    var seamMid = G.lerp(pa, pb, 0.5);
    upper.notches = (upper.notches || []).concat([{ edge: seamName, p: seamMid, count: 1 }]);
    lower.notches = (lower.notches || []).concat([{ edge: seamName, p: seamMid, count: 1 }]);
    // 喺接縫中間加一點，等 Seamly2D 剪口有位放
    [upper, lower].forEach(function (pp) {
      pp.edges.forEach(function (e) { if (e.name === seamName && e.pts.length === 2) e.pts = [e.pts[0], seamMid, e.pts[1]]; });
    });
    Object.assign(upper, upperInfo);
    upper.saEdge = {};
    lower.label = null; lower.grain = pc.grain;
    tidy(upper, {}); tidy(lower, { keepDims: false });
    lower.dims = lower.dims.concat((pc.dims || []).filter(function (d) { return d.kind === 'below'; }));
    return { upper: upper, lower: lower, seam: [pa, pb] };
  }

  /**
   * 中線加闊（碎褶或者中間褶）：中線向外推 add，接縫同下擺跟住加長
   * 只適用於中線係垂直直線、上面接住直線邊（例如育克接縫）
   */
  function addFullness(pc, add, type) {
    var ci = -1;
    pc.edges.forEach(function (e, i) { if (e.name === 'center') ci = i; });
    if (ci < 0 || add <= 0) return pc;
    var cE = pc.edges[ci];
    var cx = cE.pts[0].x;
    var prev = pc.edges[(ci - 1 + pc.edges.length) % pc.edges.length];
    var next = pc.edges[(ci + 1) % pc.edges.length];
    if (prev.bez || next.bez) return pc;
    var sh = function (p) { return P(p.x + add, p.y); };
    var shPt = function (p) { return p.x >= cx - 1e-6 ? sh(p) : p; };
    pc.edges.forEach(function (e) {
      if (e.bez) { e.bez = e.bez.map(function (b) { return b.map(sh); }); e.pts = e.pts.map(sh); }
      else e.pts = e.pts.map(sh);
    });
    var yTop = cE.pts[cE.pts.length - 1].y, yBot = cE.pts[0].y;
    cE.pts = [P(cx, yBot), P(cx, yTop)];
    prev.pts.push(P(cx, yBot));
    next.pts.unshift(P(cx, yTop));
    // 其他資料跟住推
    pc.notches = (pc.notches || []).map(function (n) { return Object.assign({}, n, { p: n.edge === 'center' ? n.p : shPt(n.p) }); });
    pc.darts = (pc.darts || []).map(function (d) {
      return Object.assign({}, d, { pts: d.pts.map(sh), apex: sh(d.apex), low: d.low ? sh(d.low) : d.low });
    });
    pc.guides = (pc.guides || []).map(function (gd) { return Object.assign({}, gd, { pts: gd.pts.map(shPt) }); });
    pc.marks = (pc.marks || []).map(function (m) { return Object.assign({}, m, { p: sh(m.p) }); });
    if (pc.grain) pc.grain = pc.grain.map(sh);
    if (pc.label) pc.label = { p: sh(pc.label.p) };
    pc.dims = (pc.dims || []).filter(function (d) { return d.kind === 'edge'; });
    // 記號
    var seamY = yTop;
    if (type === 'pleat') {
      // 中間褶（工字褶）：摺線
      [cx + add / 2, cx + add].forEach(function (x, i) {
        pc.guides.push({ pts: [P(x, seamY + 0.3), P(x, seamY + 8)], dash: i ? null : [0.6, 0.3], zh: i ? '褶位' : '摺線', en: i ? 'PLEAT' : 'FOLD' });
      });
    } else {
      pc.guides.push({ pts: [P(cx + 0.5, seamY + 1.2), P(cx + add + 4, seamY + 1.2)], dash: [0.3, 0.3], zh: '收碎褶', en: 'GATHER' });
    }
    return pc;
  }

  /* ---------- 公主線 ---------- */
  function princess(pc, names) {
    var d = pc._, dart = pc.darts && pc.darts[0];
    if (!d || !dart || !d.G) return null;
    var Gp = d.G, apex = dart.apex, open = !dart.closed;
    var footL, footR, low = null;
    if (open) { footL = dart.pts[0]; footR = dart.pts[2]; } else { footR = dart.pts[1]; low = dart.pts[2]; footL = dart.pts[3]; }

    // 下擺上要有分界點
    var edges = clone(pc.edges);
    var hemE = edges.filter(function (e) { return e.name === 'hem'; })[0];
    var Hc, Hs;
    if (open) { Hc = footL; Hs = footR; }
    else {
      var yH = null, pts = hemE.pts;
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        if ((a.x - d.dX) * (b.x - d.dX) <= 0 && a.x !== b.x) { yH = a.y + (b.y - a.y) * (d.dX - a.x) / (b.x - a.x); pts.splice(i + 1, 0, P(d.dX, yH)); break; }
      }
      if (yH == null) return null;
      Hc = Hs = P(d.dX, yH);
    }
    var segs = toSegs(edges);
    var idx = function (p, atEnd) {
      for (var i = 0; i < segs.length; i++) if (same(atEnd ? segs[i].b[3] : segs[i].b[0], p)) return i;
      return -1;
    };
    var iG = idx(Gp, false), iHs = idx(Hs, true), iHc = idx(Hc, false);
    if (iG < 0 || iHs < 0 || iHc < 0) return null;
    var wrap = function (from, to) { // from..to（包括），可以繞圈
      var out = [], i = from;
      while (true) { out.push(segs[i]); if (i === to) break; i = (i + 1) % segs.length; }
      return out;
    };
    // 公主線：夾圈點 → 褶尖（曲線）→ 褶腳 →（菱形褶下尖 → 下擺）
    var dl = G.dist(Gp, apex);
    var curve = [Gp, G.lerp(Gp, apex, 0.35), P(apex.x, apex.y - dl * 0.35), apex];
    var pathC = [{ name: 'princess', line: false, b: curve }, { name: 'princess', line: true, b: B.line(apex, footL) }];
    var pathS = [{ name: 'princess', line: false, b: curve }, { name: 'princess', line: true, b: B.line(apex, footR) }];
    if (!open) {
      pathC.push({ name: 'princess', line: true, b: B.line(footL, low) }, { name: 'princess', line: true, b: B.line(low, Hc) });
      pathS.push({ name: 'princess', line: true, b: B.line(footR, low) }, { name: 'princess', line: true, b: B.line(low, Hs) });
    }
    var rev = function (path) { return path.slice().reverse().map(function (s) { return { name: s.name, line: s.line, b: [s.b[3], s.b[2], s.b[1], s.b[0]] }; }); };
    var sideSegs = wrap(iG, iHs).concat(rev(pathS));                        // 夾圈下半 → 側縫 → 下擺 → 公主線返上去
    var centerSegs = wrap(iHc, (iG - 1 + segs.length) % segs.length).concat(pathC); // 下擺 → 中線 → 領 → 肩 → 夾圈上半 → 公主線落嚟

    var side = clone(pc), center = clone(pc);
    side.edges = toEdges(sideSegs); center.edges = toEdges(centerSegs);
    [side, center].forEach(function (pp) {
      pp.notches = (pp.notches || []).filter(function (n) { return !same(n.p, Gp); }).concat([{ edge: 'princess', p: apex, count: 1 }]);
      pp.darts = [];
      pp.marks = (pp.marks || []).filter(function (m) { return m.type !== 'bp'; });
    });
    side.key = pc.key + 'Side'; side.zh = names.side[0]; side.en = names.side[1];
    side.fold = null; side.cut = 2; side.mirror = pc.mirror; side.label = null;
    center.key = pc.key; center.zh = names.center[0]; center.en = names.center[1];
    tidy(center, { dropDarts: true, keepDims: true, grainX: Math.min(d.dX * 0.5, d.dX - 3) });
    tidy(side, { dropDarts: true, grainX: (d.dX + d.w) / 2 });
    center.dims = center.dims.filter(function (x) { return x.kind !== 'below'; });
    return { center: center, side: side };
  }

  /* ---------- 荷葉邊長條 ---------- */
  function ruffle(key, zh, en, seamLen, width, ratio, cut, note) {
    var Lr = Math.max(10, seamLen * ratio), W = width + 1; // +1 cm 捲邊
    var pc = {
      key: key, zh: zh, en: en, mirror: false, fold: null, darts: [], marks: [], notches: [],
      edges: [
        { name: 'top', pts: [P(0, 0), P(Lr / 2, 0), P(Lr, 0)] },
        { name: 'right', pts: [P(Lr, 0), P(Lr, W)] },
        { name: 'hem', pts: [P(Lr, W), P(0, W)] },
        { name: 'left', pts: [P(0, W), P(0, 0)] }
      ],
      guides: [{ pts: [P(1, 0.8), P(Math.min(Lr - 1, 20), 0.8)], dash: [0.3, 0.3], zh: '收碎褶至 ' + f1(seamLen) + ' cm', en: 'GATHER TO ' + f1(seamLen) }],
      grain: [P(2, W * 0.6), P(Math.min(Lr - 2, 25), W * 0.6)],
      label: { p: P(Math.min(Lr * 0.5, 30), W * 0.55) },
      cut: cut, cutZh: '裁 ' + cut + ' 片' + (note || ''), cutEn: 'CUT ' + cut, small: true,
      notchesNote: true
    };
    pc.notches = [{ edge: 'top', p: P(Lr / 2, 0), count: 1 }];
    pc.dims = [{ kind: 'below', a: P(0, W), b: P(Lr, W), zh: '長 ' + f1(Lr) + '（闊 ' + f1(width) + '）', en: 'Length ' + f1(Lr) }];
    return pc;
  }

  PM.modify = {
    splitAtY: splitAtY, addFullness: addFullness, princess: princess, ruffle: ruffle,
    tidy: tidy, toSegs: toSegs, toEdges: toEdges
  };
})(typeof window !== 'undefined' ? window : globalThis);
