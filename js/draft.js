/*
 * 女裝上身紙樣打版（基本原型 + 款式變化）
 * 單位：厘米；座標 y 軸向下；每塊紙樣喺自己嘅座標系（中線 x = 0）。
 *
 * m（淨尺寸）：bust, waist, hip, shoulder, backLen, frontLen, neck, armhole,
 *              waistToHip, armLen, upperArm, wrist
 * ease（放鬆量）：bust, waist, hip, neck, armhole
 * style（款式）：見 DEFAULT_STYLE
 *
 * 輸出每塊紙樣（piece）：
 *   edges   外輪廓（順時針），每段 {name, pts, bez?}
 *   fold    對摺邊名稱（或 null）
 *   darts   [{pts, closed, w, apex, label}]
 *   guides  [{pts, dash}]（胸圍線、腰線等）
 *   marks   [{type:'button'|'bp', p}]
 *   notches [{edge, p, count}]
 *   grain   [p0, p1]
 *   label   {p, zh, en, cutZh, cutEn}
 *   dims    標示（layout.js 會畫）
 */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});
  var G = PM.geom, P = G.P;
  var DEG = Math.PI / 180;

  var BACK_SLOPE = 18;     // 後肩斜度（度）
  var FRONT_SLOPE = 22;    // 前肩斜度（度）
  var SHOULDER_EASE = 0.5; // 後肩比前肩長（縮縫量）

  var DEFAULT_STYLE = {
    neckline: 'round',  // round 圓領 | v V領 | square 方領 | boat 一字領
    neckWiden: 0,       // 領口加闊（每邊，沿肩線，cm）
    neckDropF: 0,       // 前領加深（cm，負數 = 升高）
    neckDropB: 0,       // 後領加深（cm）
    hemLen: 0,          // 衫長：腰線以下幾多 cm（負數 = 短身）
    hemShape: 'straight', // straight 直腳 | aline A 字
    flare: 0,           // A 字下擺每條側縫放出（cm）
    sleeve: 'none',     // none | short | elbow | long
    sleeveLen: 0,       // 袖長（由袖山頂度，cm）
    fit: 'fitted',      // fitted 修身 | regular 合身 | loose 寬鬆
    opening: false,     // 前中開胸（門襟）
    ext: 2,             // 門襟寬（前中線外加，cm）
    facing: true,       // 開胸時加前貼邊
    collar: 'none',     // none | peterpan 彼得潘圓領
    collarW: 7,         // 領闊（cm）
    pocket: 'none',     // none | left | right | both（胸前貼袋，著衫者計）
    cuff: 'none',       // none | band 袖頭（長袖／七分袖用）
    cuffH: 5,           // 袖頭闊（完成，cm）
    // 通用設計工具
    yoke: 'none',       // none | back | front | both 育克
    yokeDepthB: 9,      // 後育克：由後頸點向下（cm）
    yokeDepthF: 7,      // 前育克：由側頸點水平向下（cm）
    yokeFull: 0,        // 育克下加闊（全件後幅計，cm）
    yokeFullType: 'gather', // gather 碎褶 | pleat 中間褶
    princess: false,    // 公主線（有腰褶先用到）
    sleevePuff: 0,      // 泡泡袖：袖山加幾多 cm 收碎褶
    sleeveGather: 0,    // 袖口加闊幾多 cm 收碎褶
    ruffle: 'none',     // none | hem | sleeve | neck 荷葉邊
    ruffleW: 6,         // 荷葉邊闊
    ruffleRatio: 1.8    // 荷葉邊長度倍數（收碎褶）
  };

  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  /** 直線 ab 喺高度 y 嘅 x */
  function lineX(a, b, y) {
    if (Math.abs(b.y - a.y) < 1e-9) return a.x;
    return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y);
  }

  /** 折線喺高度 y 嘅 x（折線由上至下） */
  function xOnPolyline(pts, y) {
    for (var i = 1; i < pts.length; i++) {
      if (y <= pts[i].y + 1e-9) return lineX(pts[i - 1], pts[i], y);
    }
    return pts[pts.length - 1].x;
  }

  /* ---------- 三次貝茲工具 ---------- */
  function cubicPts(b, n) { return G.cubic(b[0], b[1], b[2], b[3], n || 32); }
  function cubicLen(b) { return G.polyLen(cubicPts(b, 64)); }
  function splitCubic(b, t) {
    var p01 = G.lerp(b[0], b[1], t), p12 = G.lerp(b[1], b[2], t), p23 = G.lerp(b[2], b[3], t);
    var a = G.lerp(p01, p12, t), c = G.lerp(p12, p23, t), m = G.lerp(a, c, t);
    return [[b[0], p01, a, m], [m, c, p23, b[3]]];
  }
  /** 由起點沿曲線量 d cm 嘅位置切開 */
  function splitAtLen(b, d) {
    var lo = 0, hi = 1;
    for (var i = 0; i < 40; i++) {
      var mid = (lo + hi) / 2;
      if (cubicLen(splitCubic(b, mid)[0]) < d) lo = mid; else hi = mid;
    }
    return splitCubic(b, (lo + hi) / 2);
  }
  function lineBez(a, b) { return [a, G.lerp(a, b, 1 / 3), G.lerp(a, b, 2 / 3), b]; }
  function bezAt(b, t) { return splitCubic(b, t)[0][3]; }
  /** 曲線（y 由上至下）去到高度 y 嗰點 */
  function bezTAtY(b, y) {
    var lo = 0, hi = 1;
    for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (bezAt(b, mid).y < y) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function bezPointAtY(b, y) { return bezAt(b, bezTAtY(b, y)); }
  function cutBezAtY(b, y) { return splitCubic(b, bezTAtY(b, y))[0]; }
  function reverseBez(list) {
    return list.slice().reverse().map(function (b) { return [b[3], b[2], b[1], b[0]]; });
  }
  function bezEdge(name, list) {
    var pts = [];
    list.forEach(function (b, i) { var s = cubicPts(b, 24); pts = pts.concat(i ? s.slice(1) : s); });
    return { name: name, pts: pts, bez: list };
  }
  function edgeLen(pc, name) {
    var e = pc.edges.filter(function (x) { return x.name === name; })[0];
    return e ? G.polyLen(e.pts) : 0;
  }

  /* ---------- 基本領口（用嚟計領寬） ---------- */
  var DIR_B = P(Math.cos(BACK_SLOPE * DEG), Math.sin(BACK_SLOPE * DEG));
  var DIR_F = P(Math.cos(FRONT_SLOPE * DEG), Math.sin(FRONT_SLOPE * DEG));

  function basicNeck(nwB) {
    var riseB = nwB / 3, nwF = nwB - 0.2, ndF = nwF + 0.5;
    var b = neckEdge('round', P(0, riseB), P(nwB, 0), DIR_B).bez[0];
    var f = neckEdge('round', P(0, ndF), P(nwF, 0), DIR_F).bez[0];
    return { nwB: nwB, riseB: riseB, nwF: nwF, ndF: ndF, lenB: cubicLen(b), lenF: cubicLen(f) };
  }

  /**
   * 款式領口：C = 中線領點，S = 側頸點，dir = 肩線方向。
   * 圓領／一字領喺側頸點同肩線成直角。
   */
  function neckEdge(type, C, S, dir) {
    var d = Math.max(0.5, C.y - S.y);
    var perp = P(-dir.y, dir.x); // 垂直肩線，向衣身內
    if (type === 'v') return { name: 'neck', pts: [C, S] };
    if (type === 'square') return { name: 'neck', pts: [C, P(S.x, C.y), S] };
    var arm = type === 'boat' ? Math.min(d * 0.45, S.x * 0.15) : Math.min(d * 0.55, S.x * 0.6);
    var c1x = type === 'boat' ? S.x * 0.55 : S.x * 0.6;
    return bezEdge('neck', [[C, P(c1x, C.y), G.add(S, G.mul(perp, arm)), S]]);
  }

  /* ---------- 夾圈（肩點 → 夾底），喺夾圈中點分兩段 ---------- */
  function armBez(S, shoulderDir, crossX, U, kv, kh) {
    var depth = U.y - S.y;
    var Gp = P(crossX, S.y + depth * 0.5);
    var perp = P(-shoulderDir.y, shoulderDir.x);
    var l1 = G.dist(S, Gp);
    return [
      [S, G.add(S, G.mul(perp, l1 * 0.35)), P(Gp.x, Gp.y - l1 * 0.35), Gp],
      [Gp, P(Gp.x, Gp.y + (U.y - Gp.y) * kv), P(U.x - (U.x - Gp.x) * kh, U.y), U]
    ];
  }

  var FIT = {
    fitted: { capH: function (ah) { return ah / 4 + 2.5; }, capEase: 2, sleeveEase: 6 },
    regular: { capH: function (ah) { return ah / 4 + 1; }, capEase: 1.5, sleeveEase: 8 },
    loose: { capH: function (ah) { return ah / 6 + 1.5; }, capEase: 0.5, sleeveEase: 12 },
    jacket: { capH: function (ah) { return ah / 4 + 3; }, capEase: 3, sleeveEase: 12 }
  };

  /* ---------- 衣身 ---------- */
  function bodice(m, ease, st, warnings) {
    var B = m.bust + ease.bust, W = m.waist + ease.waist, H = m.hip + ease.hip;
    var noDarts = st.fit === 'loose';

    // 領寬：令基本領弧總長 = 領圍 / 2
    var ns = G.solve(function (nw) { var n = basicNeck(nw); return n.lenB + n.lenF; },
      (m.neck + ease.neck) / 2, 3, 14);
    if (!ns.ok) warnings.push('領圍數值偏離常見範圍，領口已用最接近嘅尺寸。');
    var nk = basicNeck(ns.x);

    // 肩線
    var bsx = m.shoulder / 2;
    if (bsx - nk.nwB < 6) warnings.push('肩寬相對領圍太細，肩線會好短，請檢查尺寸。');
    var bDir = DIR_B, fDir = DIR_F;
    var shB = (bsx - nk.nwB) / bDir.x;
    var SB = P(bsx, shB * bDir.y);
    var SF = G.add(P(nk.nwF, 0), G.mul(fDir, shB - SHOULDER_EASE));

    // 款式領口
    var widen = clamp(st.neckWiden || 0, 0, shB - 4);
    if (widen < (st.neckWiden || 0)) warnings.push('領口加闊太多，已限制為 ' + f1(widen) + ' cm（肩線最少留 4 cm）。');
    var snpB = G.add(P(nk.nwB, 0), G.mul(bDir, widen));
    var snpF = G.add(P(nk.nwF, 0), G.mul(fDir, widen));
    var cB = P(0, Math.max(snpB.y + 0.5, nk.riseB + (st.neckDropB || 0)));
    var cF = P(0, Math.max(snpF.y + 1.5, nk.ndF + (st.neckDropF || 0)));

    // 胸圍
    var bw = B / 4 - 0.5, fw = B / 4 + 0.5;
    var crossB = Math.min(bsx - 1.5, bw - 1.5), crossF = Math.min(SF.x - 1.5, fw - 2);

    // 夾圈深：令前後夾圈總長 = 夾圈
    function arms(y) {
      return { b: armBez(SB, bDir, crossB, P(bw, y), 0.5, 0.55), f: armBez(SF, fDir, crossF, P(fw, y), 0.6, 0.5) };
    }
    function armLen(a) { return cubicLen(a.b[0]) + cubicLen(a.b[1]) + cubicLen(a.f[0]) + cubicLen(a.f[1]); }
    var yLo = Math.max(SB.y, SF.y) + 10;
    var yHi = Math.min(nk.riseB + m.backLen - 6, Math.max(SB.y, SF.y) + 32);
    var as = G.solve(function (y) { return armLen(arms(y)); }, m.armhole + ease.armhole, yLo, yHi);
    if (!as.ok) warnings.push('夾圈尺寸同胸圍／肩寬唔太夾，夾圈深已限制喺合理範圍（實際夾圈長見下表）。');
    var yB = as.x, arm = arms(yB);

    // 腰、臀
    var yWB = nk.riseB + m.backLen;
    var yWF = Math.max(m.frontLen, yWB);
    if (m.frontLen < yWB - 0.5) warnings.push('前長比後片（背長＋後領高）仲短，前腰已同後腰齊平。');
    if (m.frontLen - yWB > 6) warnings.push('前長比後片長好多（' + f1(m.frontLen - yWB) + ' cm），建議改用胸褶原型。');
    var wwB = W / 4 - 0.5, wwF = W / 4 + 0.5;
    var hwB = H / 4 - 0.5, hwF = H / 4 + 0.5;
    var exB = bw - wwB, exF = fw - wwF;
    var side = noDarts ? 0 : clamp(Math.min(exB, exF) * 0.4, -3, 2.5);
    var dartB = noDarts ? 0 : Math.max(0, exB - side);
    var dartF = noDarts ? 0 : Math.max(0, exF - side);
    if (dartF > 6 || dartB > 6) warnings.push('胸腰差好大，腰褶超過 6 cm，可能要分開兩個褶。');

    var L = clamp(st.hemLen || 0, -(yWB - yB - 4), 90);
    if (L !== (st.hemLen || 0)) warnings.push('短身長度太短，已限制為腰線以上 ' + f1(-L) + ' cm。');
    var flare = st.hemShape === 'aline' ? Math.max(0, st.flare || 0) : 0;

    function makePiece(isFront) {
      var w = isFront ? fw : bw;
      var ext = isFront && st.opening ? Math.max(0.5, st.ext || 2) : 0; // 門襟只喺前片
      var U = P(w, yB);
      var yWc = isFront ? yWF : yWB;  // 中線腰位
      var sideW = P(noDarts ? w : w - side, yWB);
      var hipW = Math.max(isFront ? hwF : hwB, sideW.x);
      var hipP = P(hipW, yWB + m.waistToHip);
      var yHs = yWB + L, yHc = yWc + L;
      var notches = [];

      // 側縫：夾底 → 腰（最窄、垂直）→ 臀（弧形、垂直）→ 下擺，全部順弧
      var sideBez = [];
      var dUW = sideW.y - U.y;
      var tU = G.norm(G.add(G.mul(G.norm(G.sub(sideW, U)), 0.5), P(0, 0.5)));
      var upper = Math.abs(U.x - sideW.x) < 0.05 ? lineBez(U, sideW)
        : [U, G.add(U, G.mul(tU, dUW * 0.35)), P(sideW.x, sideW.y - dUW * 0.4), sideW];
      if (L <= 0) {
        sideBez.push(L < 0 ? cutBezAtY(upper, yHs) : upper);
      } else {
        sideBez.push(upper);
        var hh = hipP.y - sideW.y;
        var hipCurve = Math.abs(hipP.x - sideW.x) < 0.05 ? lineBez(sideW, hipP)
          : [sideW, P(sideW.x, sideW.y + hh * 0.35), P(hipP.x, hipP.y - hh * 0.45), hipP];
        if (flare > 0) {
          var baseX = L <= m.waistToHip ? bezPointAtY(hipCurve, yHs).x : hipW;
          var hemF = P(baseX + flare, yHs);
          if (L > m.waistToHip && lineX(sideW, hemF, hipP.y) < hipW - 0.01) {
            sideBez.push(hipCurve, lineBez(hipP, hemF));
          } else {
            var dl = G.dist(sideW, hemF), dd = G.norm(G.sub(hemF, sideW));
            sideBez.push([sideW, P(sideW.x, sideW.y + dl * 0.3), G.sub(hemF, G.mul(dd, dl * 0.3)), hemF]);
          }
        } else if (L <= m.waistToHip) {
          sideBez.push(cutBezAtY(hipCurve, yHs));
        } else {
          sideBez.push(hipCurve, lineBez(hipP, P(hipW, yHs)));
        }
        notches.push({ edge: 'side', p: sideW, count: 1 });
      }
      var sideEdge = bezEdge('side', sideBez);
      var sidePts = sideEdge.pts;
      var sideHem = sidePts[sidePts.length - 1];

      // 腰褶
      var darts = [], hemDartFeet = [];
      var dW = isFront ? dartF : dartB;
      var dX = isFront ? m.bust / 10 + 0.5 : sideW.x * 0.5;
      var apex = isFront ? P(dX, yB + 4) : P(dX, yB - 2);
      var footL = P(dX - dW / 2, yWc), footR = P(dX + dW / 2, yWc);
      if (dW > 0.05) {
        if (L <= 0) {
          var l2 = P(lineX(apex, footL, yHc), yHc), r2 = P(lineX(apex, footR, yHc), yHc);
          darts.push({ pts: [l2, apex, r2], closed: false, w: r2.x - l2.x, apex: apex, labelAt: apex });
          hemDartFeet = [r2, l2];
          notches.push({ edge: 'hem', p: l2, count: 1 }, { edge: 'hem', p: r2, count: 1 });
        } else {
          var low = P(dX, yWc + Math.min(L > 6 ? L - 3 : L, 14));
          darts.push({ pts: [apex, footR, low, footL], closed: true, w: dW, apex: apex, labelAt: apex, low: low });
        }
      }

      // 下擺
      var cx = -ext;
      var hemPts = [sideHem];
      if (hemDartFeet.length) hemPts = hemPts.concat(hemDartFeet);
      else if (isFront && yHc - yHs > 0.05) hemPts.push(P(Math.min(dX + dW / 2, sideHem.x - 1), yHc));
      var C = isFront ? cF : cB, S = isFront ? snpF : snpB;

      // 後中（唔對摺嘅修身／合身款）：腰位收入，由胸圍線順弧落腰，再順返出臀
      var centerEdge = { name: 'center', pts: [P(cx, yHc), P(cx, C.y)] };
      var cbIn = !isFront && !st.cbFold && !noDarts ? (st.fit === 'fitted' ? 1 : 0.6) : 0;
      var cHem = P(cx, yHc);
      if (cbIn > 0) {
        var cW = P(cbIn, yWB), cTop = P(0, yB);
        var up = [cW, P(cbIn, yWB - (yWB - yB) * 0.4), P(0, yB + (yWB - yB) * 0.45), cTop]; // 由腰向上
        var cList;
        if (L < 0) {
          var rev = [cTop, up[2], up[1], cW];               // 由上至下
          var left = splitCubic(rev, bezTAtY(rev, yHc))[0];  // 胸圍線 → 下擺
          var seg = [left[3], left[2], left[1], left[0]];
          cHem = seg[0];
          cList = [seg, lineBez(cTop, P(0, C.y))];
        } else if (L === 0) {
          cHem = cW;
          cList = [up, lineBez(cTop, P(0, C.y))];
        } else {
          var yHipC = Math.min(yHc, yWB + m.waistToHip);
          var hipC = P(cbIn * Math.max(0, 1 - (yHipC - yWB) / m.waistToHip) * 0.5, yHipC);
          cList = [];
          if (yHc > yHipC + 0.05) { cList.push(lineBez(P(hipC.x, yHc), hipC)); }
          cList.push([hipC, P(hipC.x + (cbIn - hipC.x) * 0.3, hipC.y - (hipC.y - yWB) * 0.5), P(cbIn, yWB + (hipC.y - yWB) * 0.3), cW]);
          cList.push(up, lineBez(cTop, P(0, C.y)));
          cHem = cList[0][0];
        }
        centerEdge = bezEdge('center', cList);
      }
      hemPts.push(P(cbIn > 0 ? cHem.x : 0, yHc));
      if (ext) hemPts.push(P(cx, yHc));
      var nType = st.neckline;
      if (!isFront && (nType === 'v' || nType === 'square')) nType = 'round';
      var edges = [
        neckEdge(nType, C, S, isFront ? fDir : bDir),
        { name: 'shoulder', pts: [S, isFront ? SF : SB] },
        bezEdge('armhole', isFront ? arm.f : arm.b),
        sideEdge,
        { name: 'hem', pts: hemPts },
        centerEdge
      ];
      if (ext) edges.push({ name: 'extTop', pts: [P(cx, C.y), C] });
      var armMid = (isFront ? arm.f : arm.b)[0][3];
      notches.unshift({ edge: 'armhole', p: armMid, count: isFront ? 1 : 2 });

      // 輔助線
      var guides = [{ pts: [P(0, yB), U], dash: [0.6, 0.3] }];
      if (L > 0.5) {
        var wl = [P(0, yWc)];
        if (isFront && yWc > yWB + 0.05) wl.push(P(Math.min(dX + dW / 2, sideW.x - 1), yWc));
        wl.push(sideW);
        guides.push({ pts: wl, dash: [0.6, 0.3], zh: '腰線', en: 'WAIST' });
      }
      if (L > m.waistToHip + 0.5) {
        guides.push({ pts: [P(0, hipP.y), P(xOnPolyline(sidePts, hipP.y), hipP.y)], dash: [0.6, 0.3], zh: '臀圍線', en: 'HIP' });
      }
      var marks = [];
      if (isFront) marks.push({ type: 'bp', p: P(dX, yB + 2) });
      if (ext) {
        guides.push({ pts: [C, P(0, yHc)], dash: [1, 0.3, 0.2, 0.3], zh: '前中線', en: 'CF' });
        var b0 = C.y + 1.5, b1 = yHc - Math.min(8, Math.max(2, L + 4));
        if (b1 - b0 > 6) {
          var nB = Math.max(2, Math.round((b1 - b0) / 9) + 1);
          for (var i = 0; i < nB; i++) marks.push({ type: 'button', p: P(0, b0 + (b1 - b0) * i / (nB - 1)) });
        }
      }

      var fold = isFront ? (!ext && st.cfFold) : st.cbFold;
      var gx = isFront ? Math.min(w - 4, dX + dW / 2 + 4) : Math.max(3, dX - dW / 2 - 4);
      var gy1 = Math.min(yHc, yHs) - 3;
      var pc = {
        key: isFront ? 'front' : 'back', zh: isFront ? '前片' : '後片', en: isFront ? 'FRONT BODICE' : 'BACK BODICE',
        mirror: isFront, edges: edges, fold: fold ? 'center' : null, darts: darts, guides: guides, marks: marks,
        notches: notches, grain: [P(gx, Math.min(yB - 6, gy1 - 4)), P(gx, gy1)],
        foldZh: (isFront ? '前中' : '後中') + '對摺線', foldEn: (isFront ? 'CF' : 'CB') + ' PLACE ON FOLD',
        label: { p: P(w * 0.5, yB - 7.5) },
        cut: fold ? 1 : 2, bustW: w, yB: yB, hemY: yHc, sideHem: sideHem, center: [P(cx, C.y), P(cx, yHc)],
        waistW: isFront ? wwF : wwB, hipW: hipW, L: L, dartW: dW, saEdge: { hem: st.hemSa },
        _: { C: C, S: S, dir: isFront ? fDir : bDir, tip: isFront ? SF : SB, ext: ext, yHc: yHc, dX: dX, dW: dW, w: w, G: armMid, L: L }
      };
      pc.dims = [
        { kind: 'dim', a: pc.center[0], b: pc.center[1], side: 'left', zh: (isFront ? '前中長 ' : '後中長 ') + f1(yHc - C.y), en: (isFront ? 'CF ' : 'CB ') + f1(yHc - C.y) },
        { kind: 'text', p: P(w * 0.72, yB - 0.45), zh: '胸寬 ' + f1(w), en: 'Bust ' + f1(w) },
        {
          kind: 'below', a: P(cx, yHc), b: sideHem,
          zh: L === 0 ? '腰寬 ' + f1(sideHem.x) + (dW > 0.05 ? '（不計褶）' : '') : '下擺寬 ' + f1(sideHem.x - cx),
          en: L === 0 ? 'Waist ' + f1(sideHem.x) : 'Hem ' + f1(sideHem.x - cx)
        },
        { kind: 'edge', edge: 'shoulder', zh: '肩', en: 'Shoulder' },
        { kind: 'edge', edge: 'armhole', zh: '夾圈', en: 'Armhole', frac: 0.35 },
        { kind: 'edge', edge: 'neck', zh: '領', en: 'Neck', inside: true },
        { kind: 'edge', edge: 'side', zh: '側縫', en: 'Side' }
      ];
      return pc;
    }

    var back = makePiece(false), front = makePiece(true);
    return {
      back: back, front: front,
      armB: arm.b, armF: arm.f,
      info: {
        armDepth: yB - Math.max(SB.y, SF.y), bustLineFromNape: yB - nk.riseB,
        armBack: edgeLen(back, 'armhole'), armFront: edgeLen(front, 'armhole'),
        neckBack: basicNeck(ns.x).lenB, neckFront: basicNeck(ns.x).lenF,
        neckBackStyled: edgeLen(back, 'neck'), neckFrontStyled: edgeLen(front, 'neck'),
        shoulderBack: shB - widen, shoulderFront: shB - SHOULDER_EASE - widen,
        dartBack: dartB, dartFront: dartF, sideTake: side,
        bustTotal: (bw + fw) * 2, waistTotal: noDarts ? (bw + fw) * 2 : (wwB + wwF) * 2,
        hipTotal: (back.hipW + front.hipW) * 2,
        sideLen: G.polyLen(back.edges[3].pts), frontDrop: yWF - yWB, hemLen: L
      }
    };
  }

  /* ---------- 袖 ---------- */
  function sleeve(m, st, bod, warnings) {
    var fit = FIT[st.fit] || FIT.fitted;
    var ahB = cubicLen(bod.armB[0]) + cubicLen(bod.armB[1]);
    var ahF = cubicLen(bod.armF[0]) + cubicLen(bod.armF[1]);
    var AH = ahB + ahF;
    var puff = Math.max(0, st.sleevePuff || 0);
    var h = fit.capH(AH) + puff * 0.35;

    // 袖山弧（前 = 左邊 −x，後 = 右邊 +x）
    function cap(k) {
      var T = P(0, 0);
      var Lf = ahF * k, Lb = (ahB + 0.3) * k;
      var wf = Math.sqrt(Math.max(1, Lf * Lf - h * h)), wb = Math.sqrt(Math.max(1, Lb * Lb - h * h));
      var Uf = P(-wf, h), Ub = P(wb, h);
      var Jf = G.lerp(T, Uf, 0.5), Jb = G.lerp(T, Ub, 0.45);
      var df = G.norm(G.sub(Uf, T)), db = G.norm(G.sub(Ub, T));
      var front = [
        [T, P(-wf * 0.32, 0), G.sub(Jf, G.mul(df, Lf * 0.17)), Jf],
        [Jf, G.add(Jf, G.mul(df, Lf * 0.17)), P(Uf.x + wf * 0.28, h), Uf]
      ];
      var back = [
        [T, P(wb * 0.34, 0), G.sub(Jb, G.mul(db, Lb * 0.17)), Jb],
        [Jb, G.add(Jb, G.mul(db, Lb * 0.2)), P(Ub.x - wb * 0.22, h), Ub]
      ];
      return { front: front, back: back, Uf: Uf, Ub: Ub, T: T };
    }
    function capLen(c) { return c.front.concat(c.back).reduce(function (s, b) { return s + cubicLen(b); }, 0); }
    var ks = G.solve(function (k) { return capLen(cap(k)); }, AH + fit.capEase + puff, 0.75, 1.6);
    var c = cap(ks.x);

    // 剪口位：由夾底量返衣身夾圈下半段長度
    var lowF = cubicLen(bod.armF[1]), lowB = cubicLen(bod.armB[1]);
    // 前：Uf → T 方向
    var fRev = reverseBez(c.front); // [Uf→Jf, Jf→T]
    var capF;
    if (lowF + 0.2 < cubicLen(fRev[0])) { var sf = splitAtLen(fRev[0], lowF + 0.2); capF = [sf[0], sf[1], fRev[1]]; }
    else capF = fRev;
    var nF = capF[0][3];
    // 後：T → Ub；由 Ub 量起
    var bRev = reverseBez(c.back); // [Ub→Jb, Jb→T]
    var capB;
    if (lowB + 0.3 < cubicLen(bRev[0])) { var sb = splitAtLen(bRev[0], lowB + 0.3); capB = [sb[0], sb[1], bRev[1]]; }
    else capB = bRev;
    var nB = capB[0][3];
    var capList = capF.concat(reverseBez(capB)); // Uf → T → Ub

    // 袖身
    var useCuff = st.cuff === 'band' && (st.sleeve === 'long' || st.sleeve === 'elbow');
    var cuffH = clamp(st.cuffH || 5, 2, 12);
    var len = Math.max(h + 3, (st.sleeveLen || 20) - (useCuff ? cuffH : 0));
    var bicep = c.Ub.x - c.Uf.x;
    if (bicep < m.upperArm + 3) warnings.push('袖寬（' + f1(bicep) + ' cm）比上臂圍＋3 cm 細，袖可能太緊，可以加夾圈放鬆量。');
    var longW = Math.min(bicep, m.wrist + fit.sleeveEase);
    var hemW;
    if (len >= m.armLen * 0.9) hemW = longW;
    else if (len <= h + 15) hemW = bicep - 2;
    else hemW = bicep - (bicep - longW) * clamp((len - h - 15) / (m.armLen * 0.9 - h - 15), 0, 1);
    var cuffLen = m.wrist + 4;           // 袖頭完成長（唔計搭位）
    var pleat = 2.5, nPleat = 2;
    var slitX = 0, pleatPts = [];
    var gather = Math.max(0, st.sleeveGather || 0);
    if (useCuff) {
      hemW = gather > 0 ? cuffLen + gather : Math.min(bicep, cuffLen + nPleat * pleat);
      slitX = hemW / 4;                  // 袖衩喺後半中間
    } else if (gather > 0) {
      hemW += gather;
    }
    var hF = P(-hemW / 2, len), hB = P(hemW / 2, len);
    var hemPts = [hB];
    if (useCuff) {
      // 袖衩 + 兩個褶（褶向袖衩方向倒）；收碎褶就唔做褶
      hemPts.push(P(slitX, len));
      for (var k = 0; k < (gather > 0 ? 0 : nPleat); k++) {
        var x0 = slitX - 2.5 - k * (pleat + 1.5);
        pleatPts.push(P(x0, len), P(x0 - pleat, len));
      }
      hemPts = hemPts.concat(pleatPts);
    }
    hemPts.push(hF);

    var edges = [
      bezEdge('cap', capList),
      { name: 'seamB', pts: [c.Ub, hB] },
      { name: 'hem', pts: hemPts },
      { name: 'seamF', pts: [hF, c.Uf] }
    ];
    var pc = {
      key: 'sleeve', zh: '袖', en: 'SLEEVE', mirror: false, edges: edges, fold: null, darts: [],
      guides: [{ pts: [c.Uf, c.Ub], dash: [0.6, 0.3] }].concat(puff > 0 ? [
        { pts: [nF, P(nF.x * 0.5, nF.y * 0.35), P(0, 0.9), P(nB.x * 0.5, nB.y * 0.35), nB].map(function (p) { return P(p.x, p.y + 0.9); }), dash: [0.3, 0.3], zh: '袖山收碎褶', en: 'GATHER' }
      ] : []).concat(gather > 0 ? [
        { pts: [P(-hemW / 2 + 1.5, len - 1.2), P(hemW / 2 - 1.5, len - 1.2)], dash: [0.3, 0.3], zh: '袖口收碎褶', en: 'GATHER' }
      ] : []).concat(useCuff ? [
        { pts: [P(slitX, len), P(slitX, len - 10)], dash: null, zh: '袖衩', en: 'SLIT' }
      ] : []),
      marks: [],
      notches: [{ edge: 'cap', p: nF, count: 1 }, { edge: 'cap', p: c.T, count: 1 }, { edge: 'cap', p: nB, count: 2 }]
        .concat(pleatPts.map(function (p) { return { edge: 'hem', p: p, count: 1 }; })),
      grain: useCuff ? [P(1.5, h + 2), P(1.5, len - 2.5)]
        : [P(c.Ub.x * 0.35, Math.min(h * 0.6, len - 6)), P(c.Ub.x * 0.35, len - 2.5)],
      label: { p: P(c.Uf.x * 0.3, len - h >= 10 ? h + 4 : h * 0.45) },
      cut: 2, center: null, hemY: len, cutPair: true, saEdge: { hem: useCuff ? null : st.hemSa }
    };
    var capTotal = G.polyLen(edges[0].pts);
    pc.dims = [
      { kind: 'dim', a: P(c.Ub.x, 0), b: P(c.Ub.x, len), side: 'right', zh: '袖長 ' + f1(len), en: 'Length ' + f1(len) },
      { kind: 'text', p: P(c.Ub.x * 0.45, h - 0.45), zh: '袖寬 ' + f1(bicep), en: 'Bicep ' + f1(bicep) },
      { kind: 'below', a: hF, b: hB, zh: '袖口 ' + f1(hemW), en: 'Cuff ' + f1(hemW) },
      { kind: 'edge', edge: 'cap', zh: '袖山', en: 'Cap', frac: 0.3 },
      { kind: 'text', p: P(0.5, h * 0.6), zh: '袖山高 ' + f1(h), en: 'Cap ht ' + f1(h), angle: -90 }
    ];
    pc.info = { capHeight: h, capLen: capTotal, capEase: capTotal - AH, bicep: bicep, hemW: hemW, len: len,
      cuff: useCuff ? { len: cuffLen, h: cuffH } : null };
    if (st.cuff === 'band' && !useCuff) warnings.push('袖頭只適用於長袖或七分袖，已略過。');
    return pc;
  }

  /* ---------- 企領、恤衫領、翻領、西裝領 ---------- */
  // 將曲線喺指定長度位切開（等剪口有點放）
  function splitListAt(list, lengths) {
    var out = [], acc = 0, k = 0;
    lengths = lengths.slice().sort(function (a, b) { return a - b; });
    list.forEach(function (b) {
      var cur = b, start = acc, Lb = cubicLen(b);
      while (k < lengths.length && lengths[k] > start + 0.05 && lengths[k] < start + Lb - 0.05) {
        var parts = splitAtLen(cur, lengths[k] - start);
        out.push(parts[0]); start += cubicLen(parts[0]); cur = parts[1]; Lb = cubicLen(cur) + start - acc; k++;
      }
      out.push(cur); acc += cubicLen(b);
    });
    return out;
  }
  function bandPiece(o) {
    // o: key, zh, en, len, h, rise, roundEnd, notchAt[], cutZh, cutEn
    var L = o.len, h = o.h, rise = o.rise;
    var neck = [P(0, 0), P(L * 0.5, 0), P(L * 0.85, -rise * 0.4), P(L, -rise)];
    var t1 = G.norm(G.sub(neck[3], neck[2])), n1 = P(t1.y, -t1.x), n0 = P(0, -1);
    var topB = [G.add(neck[0], G.mul(n0, h)), G.add(neck[1], G.mul(n0, h)), G.add(neck[2], G.mul(n1, h)), G.add(neck[3], G.mul(n1, h))];
    var front = o.roundEnd
      ? [[topB[3], G.add(topB[3], G.mul(t1, h * 0.55)), G.add(neck[3], G.mul(t1, h * 0.55)), neck[3]]]
      : [lineBez(topB[3], neck[3])];
    var neckParts = splitListAt([neck], o.notchAt || []);
    var notchPts = [];
    var acc = 0;
    neckParts.slice(0, -1).forEach(function (b) { acc += cubicLen(b); notchPts.push(b[3]); });
    var pc = {
      key: o.key, zh: o.zh, en: o.en, mirror: false, fold: 'center', darts: [], marks: o.marks || [],
      edges: [bezEdge('top', [topB]), bezEdge('front', front), bezEdge('neck', reverseBez(neckParts)), { name: 'center', pts: [P(0, 0), P(0, -h)] }],
      guides: [], notches: notchPts.map(function (p) { return { edge: 'neck', p: p, count: 1 }; }),
      grain: [P(1.5, -h * 0.85), P(1.5, -h * 0.15)].map(function (p) { return p; }),
      label: { p: P(L * 0.45, -h * 0.5) }, foldZh: '後中對摺', foldEn: 'CB FOLD',
      cut: 1, qty: 2, cutZh: o.cutZh || '裁 2 片對摺（面＋裡）＋燙朴', cutEn: o.cutEn || 'CUT 2 ON FOLD', small: true
    };
    pc.grain = [P(L * 0.12, -h * 0.5 + 0), P(L * 0.12 + Math.min(10, L * 0.3), -h * 0.5)];
    pc.dims = [{ kind: 'edge', edge: 'neck', zh: '領底', en: 'Neck', frac: 0.5 }];
    return pc;
  }
  function fallCollar(o) {
    // o: key, zh, en, len, w, bottomDrop（正數 = 前端落低，負數 = 升高）, pointOut, pointUp, notchAt[]
    var L = o.len, w = o.w, d = o.bottomDrop;
    var bottom = [P(0, 0), P(L * 0.5, 0), P(L * 0.85, d * 0.35), P(L, d)];
    var Pt = P(L + o.pointOut, -w - o.pointUp);
    var outer = [P(0, -w), P(L * 0.5, -w), P(L * 0.85, -w - o.pointUp * 0.3), Pt];
    var bParts = splitListAt([bottom], o.notchAt || []);
    var notchPts = bParts.slice(0, -1).map(function (b) { return b[3]; });
    var pc = {
      key: o.key, zh: o.zh, en: o.en, mirror: false, fold: 'center', darts: [], marks: [],
      edges: [bezEdge('outer', [outer]), { name: 'front', pts: [Pt, bottom[3]] }, bezEdge('neck', reverseBez(bParts)), { name: 'center', pts: [P(0, 0), P(0, -w)] }],
      guides: o.rollAt ? [{ pts: [P(0, -o.rollAt), P(L * 0.7, -o.rollAt - d * 0.1)], dash: [0.6, 0.3], zh: '翻摺線', en: 'ROLL LINE' }] : [],
      notches: notchPts.map(function (p) { return { edge: 'neck', p: p, count: 1 }; }),
      grain: [P(1.5, -w * 0.85), P(1.5, -w * 0.2)],
      label: { p: P(L * 0.5, -w * 0.55) }, foldZh: '後中對摺', foldEn: 'CB FOLD',
      cut: 1, qty: 2, cutZh: '裁 2 片對摺（面領＋底領）＋燙朴', cutEn: 'CUT 2 ON FOLD', small: true
    };
    pc.dims = [{ kind: 'edge', edge: 'neck', zh: '領底', en: 'Neck', frac: 0.5 }, { kind: 'edge', edge: 'outer', zh: '領邊', en: 'Edge', frac: 0.5 }];
    return pc;
  }
  function otherCollars(st, back, front, warnings) {
    var type = st.collar;
    if (type === 'none' || type === 'peterpan' || type === 'notched') return [];
    var nb = G.polyLen(back.edges[0].pts), nf = G.polyLen(front.edges[0].pts);
    var n = nb + nf, ext = front._.ext || 0;
    if (type === 'mandarin') {
      return [bandPiece({ key: 'collar', zh: '企領', en: 'MANDARIN COLLAR', len: n + ext, h: clamp(st.collarW || 3.5, 2, 6), rise: 1.5,
        roundEnd: true, notchAt: [nb, n] })];
    }
    if (type === 'shirt') {
      var stand = bandPiece({ key: 'collarStand', zh: '領座', en: 'COLLAR STAND', len: n + ext, h: 3, rise: 1.5, roundEnd: true,
        notchAt: [nb, n], marks: ext ? [{ type: 'buttonhole', p: P(n + ext * 0.4, -1.5) }] : [] });
      var fall = fallCollar({ key: 'collar', zh: '恤衫領', en: 'SHIRT COLLAR', len: n - 0.3, w: clamp(st.collarW || 4.5, 3, 9),
        bottomDrop: 0.9, pointOut: 1.5, pointUp: 0.8, notchAt: [nb] });
      return [fall, stand];
    }
    if (type === 'convertible') {
      return [fallCollar({ key: 'collar', zh: '翻領', en: 'CONVERTIBLE COLLAR', len: n, w: clamp(st.collarW || 7, 4, 12),
        bottomDrop: -1.2, pointOut: 2, pointUp: 0.6, notchAt: [nb], rollAt: 2.8 })];
    }
    return [];
  }

  /* ---------- 西裝領：駁頭（平駁頭） ---------- */
  function lapel(st, front, warnings) {
    var d = front._, ext = d.ext, S = d.S, f = d.dir;
    var yBreak = clamp(front.yB + 1, d.C.y + 8, d.yHc - 12);
    var Bp = P(-ext, yBreak);
    var Rp = G.sub(S, G.mul(f, 2));                      // 翻摺線頂：側頸點再入 2 cm
    var r = G.norm(G.sub(Rp, Bp)), Lr = G.dist(Bp, Rp);
    var q = P(-r.y, r.x); if (q.x > 0) q = G.mul(q, -1);  // 指向前中外面
    var at = function (u, v) { return G.add(Bp, G.add(G.mul(r, u * Lr), G.mul(q, v))); };
    var lw = clamp(st.lapelW || 9, 5, 12);
    var Lp = at(0.82, lw), Nc = at(0.75, lw * 0.5);
    // 領口：由側頸點量起 40% 做駁頭接位
    var neckE = front.edges[0];
    var nb = neckE.bez ? neckE.bez[0] : null;
    if (!nb) { warnings.push('西裝領要用圓領口。'); return null; }
    var Lneck = cubicLen(nb);
    var parts = splitAtLen(nb, Lneck * 0.6);              // C → Ng，Ng → S
    var Ng = parts[1][0];
    var lapelEdge = [
      [Bp, G.add(Bp, G.add(G.mul(r, Lr * 0.3), G.mul(q, lw * 0.35))), G.sub(Lp, G.mul(r, Lr * 0.18)), Lp],
      lineBez(Lp, Nc), lineBez(Nc, Ng)
    ];
    var edges = front.edges;
    var ci = edges.map(function (e) { return e.name; }).indexOf('center');
    var hemPt = edges[ci].pts[0];
    var newEdges = [bezEdge('neck', [parts[1]])].concat(edges.slice(1, ci))
      .concat([{ name: 'center', pts: [hemPt, Bp] }, bezEdge('lapel', lapelEdge)]);
    front.edges = newEdges;
    // 記號：鈕由翻摺點開始
    var btns = [], nB = Math.max(1, Math.round((d.yHc - 8 - yBreak) / 10) + 1);
    for (var i = 0; i < nB; i++) btns.push({ type: 'button', p: P(0, yBreak + (nB > 1 ? (d.yHc - 8 - yBreak) * i / (nB - 1) : 0)) });
    front.marks = front.marks.filter(function (mk) { return mk.type !== 'button'; }).concat(btns);
    front.guides = front.guides.filter(function (gd) { return gd.zh !== '前中線'; });
    front.guides.push({ pts: [P(0, yBreak), P(0, d.yHc)], dash: [1, 0.3, 0.2, 0.3], zh: '前中線', en: 'CF' });
    front.guides.push({ pts: [Bp, at(0.86, 0)], dash: [0.6, 0.3], zh: '翻摺線', en: 'ROLL LINE' });
    front.notches.push({ edge: 'neck', p: Ng, count: 1 }, { edge: 'lapel', p: Nc, count: 1 });
    front.dims = front.dims.filter(function (x) { return x.kind !== 'dim'; }).concat([
      { kind: 'edge', edge: 'lapel', zh: '駁頭', en: 'Lapel', frac: 0.3 }
    ]);
    front.zh = '前片（連駁頭）';
    return { Bp: Bp, Ng: Ng, Nc: Nc, Lp: Lp, neckToGorge: cubicLen(parts[1]), roll: [Bp, Rp] };
  }
  function notchedCollar(st, back, li) {
    var nb = G.polyLen(back.edges[0].pts);
    var L = nb + li.neckToGorge;
    var pc = fallCollar({ key: 'collar', zh: '西裝領', en: 'NOTCHED COLLAR', len: L, w: clamp(st.collarW || 7.5, 5, 12),
      bottomDrop: -1.0, pointOut: 3, pointUp: -(clamp(st.collarW || 7.5, 5, 12) - 4.5), notchAt: [nb], rollAt: 3 });
    pc.cutZh = '面領 1 片＋底領 1 片（底領斜紋），對摺';
    return pc;
  }
  function jacketFacing(front, li) {
    var d = front._;
    var A = G.add(d.S, G.mul(d.dir, Math.min(3.5, G.dist(d.S, d.tip) - 2)));
    var Bh = P(Math.min(9, d.dX - d.dW / 2 - 1), d.yHc + 5);
    var pc = PM.modify.splitByLine(front, P(Bh.x, Bh.y), A, li.Bp, 'facingLine', {
      key: 'facing', zh: '前貼邊（連駁頭）', en: 'FRONT FACING', cut: 2, cutZh: '裁 2 片＋燙朴 2 片', cutEn: 'CUT 2 + 2 INTERFACING', small: true
    });
    if (!pc) return null;
    pc.marks = []; pc.darts = [];
    pc.guides = (pc.guides || []).filter(function (gd) { return gd.zh === '翻摺線'; });
    pc.dims = [{ kind: 'edge', edge: 'lapel', zh: '駁頭', en: 'Lapel', frac: 0.3 }];
    pc.saEdge = { hem: st0.hemSa };
    return pc;
  }
  var st0 = {};

  /* ---------- 彼得潘圓領 ---------- */
  // 傳統做法：前後片喺側頸點對齊，肩點重疊 2 cm，沿領口描出領底線，再向外畫領闊
  function collar(st, back, front, warnings) {
    if (st.neckline === 'v' || st.neckline === 'square') {
      warnings.push('彼得潘圓領只配圓領／一字領領口，V 領／方領已略過衣領。');
      return null;
    }
    var w = clamp(st.collarW || 7, 3, 15);
    var bN = back.edges[0], fN = front.edges[0];
    var Sb = back._.S, b = back._.dir, Sf = front._.S, f = front._.dir;
    var pb = P(-b.y, b.x), pf = P(-f.y, f.x);
    var shLen = G.dist(Sb, back._.tip);
    function L(v) { var a = v.x * f.x + v.y * f.y, c = v.x * pf.x + v.y * pf.y; return G.sub(G.mul(b, a), G.mul(pb, c)); }
    function rot(v, t) { return P(v.x * Math.cos(t) - v.y * Math.sin(t), v.x * Math.sin(t) + v.y * Math.cos(t)); }
    var th = 2 / shLen;
    var tipTest = rot(L(G.sub(front._.tip, Sf)), th);
    if (tipTest.x * pb.x + tipTest.y * pb.y < 0) th = -th;
    function map(p) { return G.add(Sb, rot(L(G.sub(p, Sf)), th)); }

    var neckBez = bN.bez.concat(reverseBez(fN.bez.map(function (bz) { return bz.map(map); })));
    var neck = bezEdge('neck', neckBez);
    var np = neck.pts, n = np.length;
    // 外邊：向外（遠離頸）偏移 w
    function nrm(i) {
      var a = np[Math.max(0, i - 1)], c = np[Math.min(n - 1, i + 1)];
      var t = G.norm(G.sub(c, a)); return P(-t.y, t.x);
    }
    var outer = np.map(function (p, i) { return G.add(p, G.mul(nrm(i), w)); });
    // 前端圓角
    var CF = np[n - 1], nEnd = nrm(n - 1), r = w * 0.9;
    var outerLen = G.polyLen(outer);
    var A = G.pointAt(outer, outerLen - r);
    var frontEdge = [[A.p, G.add(A.p, G.mul(A.t, r * 0.6)), G.add(CF, G.mul(nEnd, w * 0.55)), CF]];
    // 外邊用 4 段平滑曲線（由 CB 到 A）
    var cut = [];
    for (var i = 0; i <= 4; i++) cut.push(G.pointAt(outer, (outerLen - r) * i / 4));
    cut[0] = { p: outer[0], t: P(1, 0) };
    cut[4] = A;
    var outerBez = [];
    for (i = 0; i < 4; i++) {
      var p0 = cut[i], p1 = cut[i + 1], d = G.dist(p0.p, p1.p) / 3;
      outerBez.push([p0.p, G.add(p0.p, G.mul(p0.t, d)), G.sub(p1.p, G.mul(p1.t, d)), p1.p]);
    }
    var edges = [
      neck,
      bezEdge('front', reverseBez(frontEdge)),
      bezEdge('outer', reverseBez(outerBez)),
      { name: 'center', pts: [outer[0], np[0]] }
    ];
    var pc = {
      key: 'collar', zh: '衣領', en: 'COLLAR', mirror: false, edges: edges, fold: 'center', darts: [],
      guides: [], marks: [], notches: [{ edge: 'neck', p: Sb, count: 1 }],
      grain: [P(1.5, np[0].y + 0.8), P(1.5, outer[0].y - 0.8)],
      foldZh: '後中對摺', foldEn: 'CB FOLD',
      label: { p: G.lerp(np[Math.floor(n * 0.35)], outer[Math.floor(n * 0.35)], 0.45) },
      cut: 1, qty: 2, cutZh: '裁 2 片對摺（面領＋底領）', cutEn: 'CUT 2 ON FOLD (UPPER + UNDER)', small: true
    };
    pc.dims = [
      { kind: 'edge', edge: 'neck', zh: '領底', en: 'Neck', inside: true, frac: 0.6 },
      { kind: 'text', p: G.add(outer[0], P(3.5, 0.9)), zh: '領闊 ' + f1(w), en: 'Width ' + f1(w) }
    ];
    return pc;
  }

  /* ---------- 前貼邊 ---------- */
  function facing(st, front) {
    var d = front._, C = d.C, S = d.S, ext = d.ext, yHc = d.yHc;
    var fw = Math.min(7, d.dX - d.dW / 2 - 1, d.w - 3);
    var Ps = G.add(S, G.mul(d.dir, Math.min(3, G.dist(S, d.tip) - 2)));
    var perp = P(-d.dir.y, d.dir.x);
    var yJ = Math.min(front.yB, yHc - 3);
    var Q = P(fw, yJ);
    var inner = [[Ps, G.add(Ps, G.mul(perp, (yJ - Ps.y) * 0.5)), P(fw, yJ - (yJ - Ps.y) * 0.45), Q]];
    var neck = front.edges[0];
    var edges = [
      neck.bez ? bezEdge('neck', neck.bez) : { name: 'neck', pts: neck.pts.slice() },
      { name: 'shoulder', pts: [S, Ps] },
      bezEdge('inner', inner),
      { name: 'innerLine', pts: [Q, P(fw, yHc)] },
      { name: 'hem', pts: [P(fw, yHc), P(0, yHc), P(-ext, yHc)] },
      { name: 'center', pts: [P(-ext, yHc), P(-ext, C.y)] },
      { name: 'extTop', pts: [P(-ext, C.y), C] }
    ];
    var pc = {
      key: 'facing', zh: '前貼邊', en: 'FRONT FACING', mirror: true, edges: edges, fold: null, darts: [],
      guides: [{ pts: [C, P(0, yHc)], dash: [1, 0.3, 0.2, 0.3], zh: '前中線', en: 'CF' }],
      marks: [], notches: [],
      grain: [P(fw * 0.55, Math.max(C.y, S.y + 6) + 2), P(fw * 0.55, yHc - 3)],
      label: { p: P(fw * 0.4, (front.yB + yHc) / 2) },
      cut: 2, cutZh: '裁 2 片＋燙朴 2 片', cutEn: 'CUT 2 + 2 INTERFACING', small: true, saEdge: { hem: st.hemSa }
    };
    pc.dims = [{ kind: 'edge', edge: 'center', zh: '長', en: 'Length' }];
    return pc;
  }

  /* ---------- 袖頭 ---------- */
  function cuffPiece(info) {
    var Lc = info.len + 2.5, H = info.h; // 搭位 2.5
    var edges = [
      { name: 'top', pts: [P(0, 0), P(Lc, 0)] },
      { name: 'right', pts: [P(Lc, 0), P(Lc, 2 * H)] },
      { name: 'bottom', pts: [P(Lc, 2 * H), P(0, 2 * H)] },
      { name: 'left', pts: [P(0, 2 * H), P(0, 0)] }
    ];
    var pc = {
      key: 'cuff', zh: '袖頭', en: 'CUFF', mirror: false, edges: edges, fold: null, darts: [],
      guides: [{ pts: [P(0, H), P(Lc, H)], dash: [1, 0.3, 0.2, 0.3], zh: '摺線', en: 'FOLD LINE' }],
      marks: [{ type: 'button', p: P(Lc - 1.25, H / 2) }, { type: 'buttonhole', p: P(1.25, H / 2) }],
      notches: [], grain: null,
      label: { p: P(Lc * 0.4, H + 1.3) },
      cut: 2, cutZh: '裁 2 片＋燙朴 2 片', cutEn: 'CUT 2 + 2 INTERFACING', small: true
    };
    // 布紋線同長邊平行
    pc.grain = [P(2.5, 2 * H - 0.9), P(Lc - 2.5, 2 * H - 0.9)];
    pc.dims = [{ kind: 'below', a: P(0, 2 * H), b: P(Lc, 2 * H), zh: '袖頭長 ' + f1(Lc) + '（連搭位 2.5）', en: 'Cuff ' + f1(Lc) }];
    return pc;
  }

  /* ---------- 胸前貼袋 ---------- */
  function pocketPiece(st, m, front) {
    var w = clamp(Math.round(m.bust / 8), 9, 15), h = w + 1, top = 3, ch = 1.5;
    var edges = [
      { name: 'top', pts: [P(0, 0), P(w, 0)] },
      { name: 'right', pts: [P(w, 0), P(w, top + h - ch)] },
      { name: 'bottom', pts: [P(w, top + h - ch), P(w / 2, top + h), P(0, top + h - ch)] },
      { name: 'left', pts: [P(0, top + h - ch), P(0, 0)] }
    ];
    var both = st.pocket === 'both';
    var pc = {
      key: 'pocket', zh: '貼袋', en: 'POCKET', mirror: false, edges: edges, fold: null, darts: [],
      guides: [{ pts: [P(0, top), P(w, top)], dash: [1, 0.3, 0.2, 0.3], zh: '向內摺', en: 'FOLD' }],
      marks: [], notches: [],
      grain: [P(w * 0.8, top + 1.5), P(w * 0.8, top + h - 2.5)],
      label: { p: P(w * 0.42, top + h * 0.45) },
      cut: both ? 2 : 1, cutZh: both ? '裁 2 片' : '裁 1 片', cutEn: both ? 'CUT 2' : 'CUT 1', small: true
    };
    // 前片上嘅口袋位
    var d = front._;
    var cx = d.dX + 1.5, y0 = front.yB - 7;
    var side = { left: '左胸', right: '右胸', both: '兩邊胸' }[st.pocket];
    var pts = [P(cx - w / 2, y0), P(cx + w / 2, y0), P(cx + w / 2, y0 + h - ch), P(cx, y0 + h), P(cx - w / 2, y0 + h - ch)];
    front.guides.push({ pts: pts, dash: [0.5, 0.3], closed: true, zh: side + '口袋位', en: 'POCKET' });
    pc.dims = [{ kind: 'below', a: P(0, top + h), b: P(w, top + h), zh: '袋闊 ' + w, en: 'Width ' + w }];
    return pc;
  }

  /* ---------- 通用設計工具（育克、加褶、公主線、荷葉邊） ---------- */
  function applyTopMods(st, back, front, warnings) {
    var M = PM.modify;
    var backs = [back], fronts = [front];
    if (st.princess) {
      if (st.fit === 'loose') warnings.push('寬鬆款冇腰褶，做唔到公主線，已略過。');
      else {
        var pb = M.princess(back, { center: ['後中片', 'CENTER BACK'], side: ['後側片', 'SIDE BACK'] });
        var pf = M.princess(front, { center: ['前中片', 'CENTER FRONT'], side: ['前側片', 'SIDE FRONT'] });
        if (pb) backs = [pb.center, pb.side];
        if (pf) fronts = [pf.center, pf.side];
        if (!pb || !pf) warnings.push('呢個款式做唔到公主線（褶位唔夠），部份已略過。');
      }
    }
    function yoke(list, y, isFront) {
      var out = [], yokes = [];
      list.forEach(function (pc, i) {
        var r = M.splitAtY(pc, y, 'yokeSeam', {
          key: (isFront ? 'frontYoke' : 'backYoke') + (i ? 'Side' : ''),
          zh: (isFront ? '前育克' : '後育克') + (i ? '（側）' : ''), en: isFront ? 'FRONT YOKE' : 'BACK YOKE',
          cutZh: pc.fold ? '裁 2 片對摺（面＋裡）' : '裁 4 片（面＋裡，左右對稱）', cutEn: pc.fold ? 'CUT 2 ON FOLD' : 'CUT 4', qty: pc.fold ? 2 : 4, small: true,
          cutZhNoFold: '裁 4 片（面＋裡，左右對稱）', cutEnNoFold: 'CUT 4', qtyNoFold: 4
        });
        if (r) { yokes.push(r.upper); out.push(r.lower); } else out.push(pc);
      });
      if (!yokes.length) warnings.push((isFront ? '前' : '後') + '育克位置唔啱，已略過。');
      return { yokes: yokes, rest: out };
    }
    var res = [];
    if (st.yoke === 'back' || st.yoke === 'both') {
      var yb = yoke(backs, back._.C.y + clamp(st.yokeDepthB || 9, 3, 25), false);
      backs = yb.rest; res = res.concat(yb.yokes);
      if (st.yokeFull > 0 && yb.yokes.length) {
        var bc = backs.filter(function (p) { return p.edges.some(function (e) { return e.name === 'center'; }); })[0];
        if (bc) PM.modify.addFullness(bc, st.yokeFull / 2, st.yokeFullType);
      }
    }
    if (st.yoke === 'front' || st.yoke === 'both') {
      var yf = yoke(fronts, clamp(st.yokeDepthF || 7, 3, 20), true);
      fronts = yf.rest; res = res.concat(yf.yokes);
      if (st.yokeFull > 0 && yf.yokes.length && !st.opening) {
        var fc = fronts.filter(function (p) { return p.edges.some(function (e) { return e.name === 'center'; }); })[0];
        if (fc) PM.modify.addFullness(fc, st.yokeFull / 2, st.yokeFullType);
      }
    }
    if (st.yoke !== 'none' && st.yokeFull > 0 && !res.length) warnings.push('冇育克，所以冇加碎褶／褶。');
    return backs.concat(fronts).concat(res);
  }

  function rufflePieces(st, body, sl, warnings) {
    if (!st.ruffle || st.ruffle === 'none') return [];
    var M = PM.modify, W = clamp(st.ruffleW || 6, 2, 30), R = clamp(st.ruffleRatio || 1.8, 1, 3);
    var sumEdge = function (pcs, name) {
      return pcs.reduce(function (s, pc) {
        return s + pc.edges.filter(function (e) { return e.name === name; }).reduce(function (t, e) { return t + G.polyLen(e.pts); }, 0);
      }, 0);
    };
    var bodyMain = body.filter(function (p) { return !/Yoke/.test(p.key); });
    if (st.ruffle === 'hem') {
      return [M.ruffle('ruffle', '下擺荷葉邊', 'HEM RUFFLE', sumEdge(bodyMain, 'hem'), W, R, 2, '（前後各半件）')];
    }
    if (st.ruffle === 'sleeve') {
      if (!sl) { warnings.push('無袖，冇得加袖口荷葉邊。'); return []; }
      return [M.ruffle('ruffle', '袖口荷葉邊', 'SLEEVE RUFFLE', sumEdge([sl], 'hem'), W, R, 2)];
    }
    if (st.ruffle === 'neck') {
      return [M.ruffle('ruffle', '領口荷葉邊', 'NECK RUFFLE', sumEdge(body, 'neck'), W, R, 2, '（左右各半）')];
    }
    return [];
  }

  /* ---------- 連身裙 ---------- */
  var FULL_SHAPES = ['aline', 'gathered', 'pleated', 'halfcircle', 'circle'];
  function draftDress(m, ease, st) {
    var zipBack = st.zip !== 'side';
    if (st.dressType === 'shift') {
      // 無腰線：衣身直接長落去
      var sh = Object.assign({}, st, {
        garment: 'top', hemLen: st.skirtLen || 58,
        hemShape: FULL_SHAPES.indexOf(st.skirtShape) >= 0 ? 'aline' : 'straight',
        flare: FULL_SHAPES.indexOf(st.skirtShape) >= 0 ? Math.max(4, st.skirtFlare || 6) : 0,
        cbFold: zipBack ? false : st.cbFold
      });
      var r1 = draft(m, ease, sh);
      if (zipBack) r1.warnings.push('後中裝隱形拉鏈，由後頸向下約 55 cm。');
      if (st.slit && st.slit !== 'none') r1.warnings.push('無腰線連身裙暫時唔做開衩，已略過。');
      if (['gathered', 'pleated', 'halfcircle', 'circle'].indexOf(st.skirtShape) >= 0) r1.warnings.push('無腰線連身裙做唔到碎褶／百褶／圓裙，已用 A 字下擺代替。');
      r1.garment = 'dress'; r1.info.garment = 'dress'; r1.info.dressType = 'shift';
      return r1;
    }
    // 有腰線：上身（腰位）＋ 裙
    var stTop = Object.assign({}, st, { garment: 'top', hemLen: 0, lengthPreset: 'waist', hemShape: 'straight', flare: 0,
      cbFold: zipBack ? false : st.cbFold, ruffle: st.ruffle === 'hem' ? 'none' : st.ruffle });
    var top = draft(m, ease, stTop);
    var seam = function (keys) {
      return top.pieces.filter(function (p) { return keys.indexOf(p.key) >= 0; }).reduce(function (sum, p) {
        var hem = p.edges.filter(function (e) { return e.name === 'hem'; })[0];
        if (!hem) return sum;
        var Lh = G.polyLen(hem.pts);
        (p.darts || []).forEach(function (d) { if (!d.closed) Lh -= G.dist(d.pts[0], d.pts[d.pts.length - 1]); });
        if (p._ && p._.ext) Lh -= p._.ext;
        return sum + Lh;
      }, 0);
    };
    var wB = seam(['back', 'backSide']), wF = seam(['front', 'frontSide']);
    var stSk = Object.assign({}, st, {
      garment: 'skirt', noBand: true, waistOverride: { back: wB, front: wF },
      dartXs: { back: top.back._.dX, front: top.front._.dX }, frontDrop: top.info.frontDrop || 0,
      zip: zipBack ? 'back' : 'side'
    });
    var easeSk = Object.assign({}, ease);
    var sk = PM.draftSkirt(m, easeSk, stSk);
    var pieces = top.pieces.concat(sk.pieces);
    // 下擺荷葉邊：跟裙下擺
    if (st.ruffle === 'hem' && PM.modify) {
      var hemL = sk.pieces.reduce(function (s2, p) {
        return s2 + p.edges.filter(function (e) { return e.name === 'hem'; }).reduce(function (t, e) { return t + G.polyLen(e.pts); }, 0);
      }, 0);
      pieces.push(PM.modify.ruffle('ruffle', '下擺荷葉邊', 'HEM RUFFLE', hemL, clamp(st.ruffleW || 6, 2, 30), clamp(st.ruffleRatio || 1.8, 1, 3), 2, '（前後各半件）'));
    }
    var warnings = top.warnings.concat(sk.warnings);
    if (zipBack) warnings.push('後中裝隱形拉鏈：上身後中至裙拉鏈止點（腰下約 18 cm）。');
    if (st.opening) warnings.push('前中開胸只做上身；裙前中照對摺。');
    var info = Object.assign({}, top.info, {
      garment: 'dress', dressType: 'waist', skirt: sk.info,
      waistSeamTop: (wB + wF) * 2,
      waistSeamSkirt: sk.pieces.reduce(function (s3, p) {
        var w = p.edges.filter(function (e) { return e.name === 'waist'; })[0];
        var Lw = G.polyLen(w.pts);
        (p.darts || []).forEach(function (d) { Lw -= G.dist(d.pts[0], d.pts[d.pts.length - 1]); });
        return s3 + Lw;
      }, 0) * 2
    });
    return { pieces: pieces, back: top.back, front: top.front, warnings: warnings, style: st, garment: 'dress', info: info };
  }

  function draft(m, ease, style) {
    var st = Object.assign({}, DEFAULT_STYLE, style || {});
    st0 = st;
    if (st.garment === 'skirt' && PM.draftSkirt) return PM.draftSkirt(m, ease, st);
    if (st.garment === 'trousers' && PM.draftTrousers) return PM.draftTrousers(m, ease, st);
    if (st.garment === 'dress') return draftDress(m, ease, st);
    var warnings = [];
    if (['mandarin', 'shirt', 'convertible'].indexOf(st.collar) >= 0 && (st.neckline !== 'round' || st.neckDropF > 2 || st.neckWiden > 1.5)) {
      st.neckline = 'round'; st.neckWiden = 0; st.neckDropF = 0; st.neckDropB = 0;
      warnings.push('企領／恤衫領／翻領要配貼頸圓領口，已將領口改返基本圓領。');
    }
    if (st.collar === 'notched' && !st.opening) { st.opening = true; st.ext = Math.max(st.ext || 2, 2.5); }
    var bod = bodice(m, ease, st, warnings);
    var lapelInfo = st.collar === 'notched' ? lapel(st, bod.front, warnings) : null;
    var pieces = [bod.back, bod.front];
    var sl = null;
    if (st.sleeve && st.sleeve !== 'none') { sl = sleeve(m, st, bod, warnings); pieces.push(sl); }
    var info = bod.info;
    if (sl) Object.assign(info, { sleeve: sl.info });
    var extras = [];
    if (st.collar === 'peterpan') { var col = collar(st, bod.back, bod.front, warnings); if (col) extras.push(col); }
    extras = extras.concat(otherCollars(st, bod.back, bod.front, warnings));
    if (lapelInfo) {
      extras.push(notchedCollar(st, bod.back, lapelInfo));
      var jf = jacketFacing(bod.front, lapelInfo);
      if (jf) extras.push(jf); else warnings.push('前貼邊畫唔到，請自己按駁頭畫。');
    } else if (st.opening && st.facing) extras.push(facing(st, bod.front));
    if (sl && sl.info.cuff) extras.push(cuffPiece(sl.info.cuff));
    if (st.pocket && st.pocket !== 'none') extras.push(pocketPiece(st, m, bod.front));
    var body = applyTopMods(st, bod.back, bod.front, warnings);
    pieces = body.concat(sl ? [sl] : []);
    extras = extras.concat(rufflePieces(st, body, sl, warnings));
    pieces = pieces.concat(extras);
    return { back: bod.back, front: bod.front, sleeve: sl, pieces: pieces, info: info, warnings: warnings, style: st };
  }

  PM.draft = draft;
  PM.DEFAULT_STYLE = DEFAULT_STYLE;
  PM.fmt = f1;
  PM.bez = {
    split: splitCubic, len: cubicLen, pts: cubicPts, edge: bezEdge, line: lineBez, at: bezAt,
    pointAtY: bezPointAtY, cutAtY: cutBezAtY, reverse: reverseBez
  };
})(typeof window !== 'undefined' ? window : globalThis);
