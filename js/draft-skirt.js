/*
 * 半截裙打版：前裙片、後裙片（腰褶、臀位弧線）、腰頭
 * 單位：厘米；每塊紙樣喺自己嘅座標系（中線 x = 0，腰線約 y = 0，下擺 y = 裙長）。
 *
 * m：waist, hip, waistToHip
 * ease：waist, hip
 * st：skirtShape (straight 直身 | pencil 窄身 | aline A 字), skirtLen（腰下裙長）,
 *     skirtFlare（A 字每邊放出）, slit (none | back | front | side), slitLen,
 *     zip (back | side), bandW（腰頭闊）
 */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});
  var G = PM.geom, P = G.P, B = PM.bez, f1 = PM.fmt;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /** 曲線（x 由小至大）去到 x 嘅參數 t */
  function tAtX(bz, x) {
    var lo = 0, hi = 1;
    for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (B.at(bz, mid).x < x) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  /** 將曲線喺幾個 x 位切開 */
  function splitAtXs(bz, xs) {
    var out = [], rest = bz;
    xs.forEach(function (x) {
      var parts = B.split(rest, tAtX(rest, x));
      out.push(parts[0]); rest = parts[1];
    });
    out.push(rest);
    return out;
  }

  function draftSkirt(m, ease, st) {
    var warnings = [];
    var Wt = m.waist + ease.waist, Ht = m.hip + ease.hip, D = m.waistToHip;
    var len = clamp(st.skirtLen || 60, 25, 120);
    if (len < D + 3) warnings.push('裙長短過腰至臀，臀位會唔夠位，建議最少 ' + f1(D + 3) + ' cm。');
    var shape = st.skirtShape || 'straight';
    var flare = shape === 'aline' ? Math.max(1, st.skirtFlare || 6) : 0;
    var taper = shape === 'pencil' ? 2 : 0;
    var slit = st.slit || 'none', slitLen = clamp(st.slitLen || 18, 5, len - D - 2);
    var zip = st.zip || 'back';
    var hemSa = st.hemSa;

    function piece(isFront) {
      var waistW = isFront ? Wt / 4 + 0.5 : Wt / 4 - 0.5;
      var hipW = isFront ? Ht / 4 + 0.5 : Ht / 4 - 0.5;
      var excess = hipW - waistW;
      if (excess < 0) warnings.push('腰圍大過臀圍，裙會冇收腰。');
      // 側縫收一部份，其餘做褶（每個褶最多 3.5 cm）
      var side = clamp(excess * 0.4, 0, 3.5);
      var dartTotal = Math.max(0, excess - side);
      var n = dartTotal < 0.3 ? 0 : (dartTotal > (isFront ? 3 : 2.5) ? 2 : 1);
      if (n && dartTotal / n > 3.5) { side += dartTotal - 3.5 * n; dartTotal = 3.5 * n; }
      var dw = n ? dartTotal / n : 0;

      var sx = waistW + dartTotal;                 // 側腰點（褶未收）
      var cy = isFront ? 0 : 0.6;                  // 後中腰線落 0.6
      var Sw = P(sx, -0.7);                        // 側腰升 0.7
      var C = P(0, cy);
      var waistCurve = [C, P(sx * 0.5, cy), P(sx * 0.82, -0.7 + 0.12), Sw];

      // 臀位弧線 + 側縫
      var hipP = P(hipW, D);
      var hipCurve = [Sw, P(sx + (hipW - sx) * 0.65, -0.7 + D * 0.3), P(hipW, D * 0.6), hipP];
      var sideHemX = hipW - taper + flare;
      var sideHemY = len - (flare ? flare * 0.12 : 0);
      var sideHem = P(sideHemX, sideHemY);
      var sideList = [hipCurve];
      var sideSlitP = null;
      if (slit === 'side') {
        sideSlitP = G.lerp(hipP, sideHem, (sideHem.y - slitLen - hipP.y) / (sideHem.y - hipP.y));
        sideList.push(B.line(hipP, sideSlitP), B.line(sideSlitP, sideHem));
      } else {
        sideList.push(B.line(hipP, sideHem));
      }

      // 下擺（A 字時同側縫成直角）
      var hemList;
      if (flare) {
        var d = G.norm(G.sub(sideHem, hipP)), inward = P(-d.y, d.x);
        if (inward.x > 0) inward = G.mul(inward, -1);
        hemList = [[sideHem, G.add(sideHem, G.mul(inward, sideHemX * 0.3)), P(sideHemX * 0.4, len), P(0, len)]];
      } else {
        hemList = [B.line(sideHem, P(0, len))];
      }

      // 腰褶位置（由中線計，佔中線至側腰嘅比例）
      var fr = n === 2 ? (isFront ? [0.38, 0.68] : [0.33, 0.62]) : (isFront ? [0.5] : [0.45]);
      var dLen = isFront ? [10, 9] : [14, 13];
      var darts = [], feet = [], notches = [];
      var xs = [];
      if (n) {
        fr.forEach(function (f, i) {
          var x = sx * f;
          xs.push(x - dw / 2, x + dw / 2);
          var l = B.at(waistCurve, tAtX(waistCurve, x - dw / 2));
          var r = B.at(waistCurve, tAtX(waistCurve, x + dw / 2));
          var apex = P(x, B.at(waistCurve, tAtX(waistCurve, x)).y + dLen[i]);
          darts.push({ pts: [l, apex, r], closed: false, w: dw, apex: apex });
          feet.push(l, r);
        });
      }
      // 腰線：依次為「布、褶、布、褶、布」，褶口用直線跨過
      var waistList = splitAtXs(waistCurve, xs).map(function (bz, j) {
        return j % 2 === 0 ? bz : B.line(bz[0], bz[3]);
      });
      feet.forEach(function (p) { notches.push({ edge: 'waist', p: p, count: 1 }); });

      // 中線（下擺 → 腰），加開衩同拉鏈止點
      var cPts = [P(0, len)];
      var isBack = !isFront;
      var centerSlit = (slit === 'back' && isBack) || (slit === 'front' && isFront);
      if (centerSlit) cPts.push(P(0, len - slitLen));
      var zipEnd = null;
      if (isBack && zip === 'back') { zipEnd = P(0, cy + 18); cPts.push(zipEnd); }
      cPts.push(C);
      if (centerSlit) notches.push({ edge: 'center', p: P(0, len - slitLen), count: 2 });
      if (zipEnd) notches.push({ edge: 'center', p: zipEnd, count: 1 });
      if (sideSlitP) notches.push({ edge: 'side', p: sideSlitP, count: 2 });
      // 臀圍線剪口；側拉鏈時用雙剪口做拉鏈止點（約喺臀圍線）
      notches.push({ edge: 'side', p: hipP, count: zip === 'side' ? 2 : 1 });

      var fold = isFront ? !centerSlit : (zip !== 'back' && !centerSlit);
      var edges = [
        B.edge('waist', waistList),
        B.edge('side', sideList),
        B.edge('hem', hemList),
        { name: 'center', pts: cPts }
      ];
      var guides = [{ pts: [P(0, D), hipP], dash: [0.6, 0.3], zh: '臀圍線', en: 'HIP' }];
      if (zip === 'side') guides.push({ pts: [G.add(hipP, P(-2.5, -1)), G.add(hipP, P(-0.8, -1))], dash: null, zh: '拉鏈止點', en: 'ZIP END' });
      if (zipEnd) guides.push({ pts: [P(0.8, zipEnd.y), P(2.5, zipEnd.y)], dash: null, zh: '拉鏈止點', en: 'ZIP END' });
      if (centerSlit) guides.push({ pts: [P(0.8, len - slitLen), P(2.5, len - slitLen)], dash: null, zh: '開衩止點', en: 'SLIT' });
      if (sideSlitP) guides.push({ pts: [G.add(sideSlitP, P(-2.5, 0)), G.add(sideSlitP, P(-0.8, 0))], dash: null, zh: '開衩止點', en: 'SLIT' });

      var gx = Math.max(3, (xs.length ? xs[0] : sx * 0.4) - 3);
      var pc = {
        key: isFront ? 'skirtFront' : 'skirtBack', zh: isFront ? '前裙片' : '後裙片', en: isFront ? 'SKIRT FRONT' : 'SKIRT BACK',
        mirror: isFront, edges: edges, fold: fold ? 'center' : null, darts: darts, guides: guides, marks: [],
        notches: notches, grain: [P(gx, D + 3), P(gx, len - 6)],
        foldZh: (isFront ? '前中' : '後中') + '對摺線', foldEn: (isFront ? 'CF' : 'CB') + ' PLACE ON FOLD',
        label: { p: P(hipW * 0.55, D + 6) }, cut: fold ? 1 : 2,
        saEdge: { hem: hemSa }
      };
      pc.dims = [
        { kind: 'dim', a: P(0, C.y), b: P(0, len), side: 'left', zh: (isFront ? '前中長 ' : '後中長 ') + f1(len - C.y), en: (isFront ? 'CF ' : 'CB ') + f1(len - C.y) },
        { kind: 'text', p: P(hipW * 0.72, D - 0.45), zh: '臀寬 ' + f1(hipW), en: 'Hip ' + f1(hipW) },
        { kind: 'below', a: P(0, len), b: sideHem, zh: '下擺寬 ' + f1(sideHemX), en: 'Hem ' + f1(sideHemX) },
        { kind: 'edge', edge: 'side', zh: '側縫', en: 'Side', frac: 0.55 },
        { kind: 'edge', edge: 'waist', zh: '腰（連褶）', en: 'Waist', inside: true, frac: 0.5 }
      ];
      pc.info = { waistW: waistW, hipW: hipW, dartW: dw, darts: n, side: side, hemW: sideHemX };
      return pc;
    }

    var back = piece(false), front = piece(true);

    // 腰頭：對摺，連搭位 3 cm
    var bw = clamp(st.bandW || 3, 2, 8), over = 3;
    var Lb = Wt + over;
    var qB = back.info.waistW, qF = front.info.waistW;
    var marks = zip === 'back'
      ? [qB, qB + qF, qB + 2 * qF, Wt]          // 後中 → 側 → 前中 → 側 → 後中
      : [2 * qF, 2 * qF + qB, Wt];             // 側（左）→ 前 → 側 → 後中 → 側
    var top = [P(0, 0)].concat(marks.map(function (x) { return P(x, 0); })).concat([P(Lb, 0)]);
    var band = {
      key: 'band', zh: '腰頭', en: 'WAISTBAND', mirror: false,
      edges: [
        { name: 'top', pts: top },
        { name: 'right', pts: [P(Lb, 0), P(Lb, 2 * bw)] },
        { name: 'bottom', pts: [P(Lb, 2 * bw), P(0, 2 * bw)] },
        { name: 'left', pts: [P(0, 2 * bw), P(0, 0)] }
      ],
      fold: null, darts: [],
      guides: [{ pts: [P(0, bw), P(Lb, bw)], dash: [1, 0.3, 0.2, 0.3], zh: '摺線', en: 'FOLD LINE' }],
      marks: [{ type: 'button', p: P(Lb - over / 2, bw / 2) }, { type: 'buttonhole', p: P(over / 2 + 0.3, bw / 2) }],
      notches: marks.map(function (x) { return { edge: 'top', p: P(x, 0), count: 1 }; }),
      grain: [P(3, 2 * bw - 0.7), P(Math.min(Lb - 3, 30), 2 * bw - 0.7)],
      label: { p: P(Math.min(Lb * 0.5, 22), bw + 1.4) },
      cut: 1, cutZh: '裁 1 片＋燙朴 1 片', cutEn: 'CUT 1 + 1 INTERFACING', small: true
    };
    band.dims = [{ kind: 'below', a: P(0, 2 * bw), b: P(Lb, 2 * bw), zh: '腰頭長 ' + f1(Lb) + '（連搭位 3）', en: 'Band ' + f1(Lb) }];

    var pieces = [back, front, band];
    return {
      pieces: pieces, back: back, front: front, warnings: warnings, style: st, garment: 'skirt',
      info: {
        garment: 'skirt', waistTotal: (back.info.waistW + front.info.waistW) * 2, hipTotal: (back.info.hipW + front.info.hipW) * 2,
        hemTotal: (back.info.hemW + front.info.hemW) * 2, len: len,
        dartsBack: back.info.darts + ' × ' + f1(back.info.dartW), dartsFront: front.info.darts + ' × ' + f1(front.info.dartW),
        sideTake: back.info.side, bandLen: Lb,
        sideLen: G.polyLen(back.edges[1].pts), sideLenF: G.polyLen(front.edges[1].pts)
      }
    };
  }

  PM.draftSkirt = draftSkirt;
})(typeof window !== 'undefined' ? window : globalThis);
