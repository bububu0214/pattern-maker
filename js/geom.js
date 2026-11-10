/* 基本幾何工具（單位：厘米，y 軸向下） */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});

  function P(x, y) { return { x: x, y: y }; }
  function add(a, b) { return P(a.x + b.x, a.y + b.y); }
  function sub(a, b) { return P(a.x - b.x, a.y - b.y); }
  function mul(a, k) { return P(a.x * k, a.y * k); }
  function len(a) { return Math.hypot(a.x, a.y); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function norm(a) { var l = len(a) || 1; return P(a.x / l, a.y / l); }
  function lerp(a, b, t) { return P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }

  /** 三次貝茲曲線取樣 */
  function cubic(p0, p1, p2, p3, n) {
    n = n || 32;
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      out.push(P(
        u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
      ));
    }
    return out;
  }

  function polyLen(pts) {
    var s = 0;
    for (var i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
    return s;
  }

  /** 沿折線距離 d 嘅點同切線 */
  function pointAt(pts, d) {
    var acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var l = dist(pts[i - 1], pts[i]);
      if (acc + l >= d || i === pts.length - 1) {
        var t = l ? Math.min(1, Math.max(0, (d - acc) / l)) : 0;
        return { p: lerp(pts[i - 1], pts[i], t), t: norm(sub(pts[i], pts[i - 1])) };
      }
      acc += l;
    }
    return { p: pts[0], t: P(1, 0) };
  }

  /** 有向面積（y 向下時，正值 = 畫面上順時針） */
  function signedArea(pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
  }

  function lineIntersect(p1, d1, p2, d2) {
    var den = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(den) < 1e-9) return null;
    var t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den;
    return add(p1, mul(d1, t));
  }

  /**
   * 閉合多邊形向外偏移（縫份）。
   * pts：頂點；offs[i]：第 i 段（pts[i] → pts[i+1]）嘅偏移量。
   */
  function offsetPolygon(pts, offs) {
    var n = pts.length;
    var sign = signedArea(pts) > 0 ? 1 : -1; // 順時針（y 向下）時外法線 = (dy, -dx)
    var segs = [];
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var d = norm(sub(b, a));
      var nrm = P(d.y * sign, -d.x * sign);
      segs.push({ p: add(a, mul(nrm, offs[i])), d: d, n: nrm, o: offs[i] });
    }
    var out = [];
    for (var j = 0; j < n; j++) {
      var s0 = segs[(j - 1 + n) % n], s1 = segs[j];
      var v = pts[j];
      var cross = s0.d.x * s1.d.y - s0.d.y * s1.d.x;
      var x = Math.abs(cross) < 1e-4 ? null : lineIntersect(s0.p, s0.d, s1.p, s1.d);
      var lim = Math.max(s0.o, s1.o) * 2.5 + 0.01;
      if (!x) {
        out.push(add(v, mul(s1.n, s1.o)));
      } else if (dist(x, v) > lim) {
        // 尖角：斜切
        out.push(add(v, mul(s0.n, s0.o)));
        out.push(add(v, mul(s1.n, s1.o)));
      } else {
        out.push(x);
      }
    }
    return out;
  }

  function bbox(pointsList) {
    var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    pointsList.forEach(function (p) {
      if (p.x < b.x0) b.x0 = p.x;
      if (p.y < b.y0) b.y0 = p.y;
      if (p.x > b.x1) b.x1 = p.x;
      if (p.y > b.y1) b.y1 = p.y;
    });
    return b;
  }

  /** 二分法求解：f 單調遞增，搵 x 令 f(x) ≈ target */
  function solve(f, target, lo, hi) {
    var flo = f(lo), fhi = f(hi);
    if (target <= flo) return { x: lo, ok: Math.abs(flo - target) < 0.05 };
    if (target >= fhi) return { x: hi, ok: Math.abs(fhi - target) < 0.05 };
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (f(mid) < target) lo = mid; else hi = mid;
    }
    return { x: (lo + hi) / 2, ok: true };
  }

  PM.geom = {
    P: P, add: add, sub: sub, mul: mul, len: len, dist: dist, norm: norm, lerp: lerp,
    cubic: cubic, polyLen: polyLen, pointAt: pointAt, signedArea: signedArea,
    offsetPolygon: offsetPolygon, bbox: bbox, solve: solve
  };
})(typeof window !== 'undefined' ? window : globalThis);
