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
    var ov = st.waistOverride || null;          // 連身裙：裙腰跟上身腰圍
    if (ov) Wt = 2 * (ov.back + ov.front);
    var len = clamp(st.skirtLen || 60, 25, 120);
    if (len < D + 3) warnings.push('裙長短過腰至臀，臀位會唔夠位，建議最少 ' + f1(D + 3) + ' cm。');
    var shape = st.skirtShape || 'straight';
    var flare = shape === 'aline' ? Math.max(1, st.skirtFlare || 6) : 0;
    var taper = shape === 'pencil' ? 2 : 0;
    var slit = st.slit || 'none', slitLen = clamp(st.slitLen || 18, 5, len - D - 2);
    var zip = st.zip || 'back';
    if (ov && (zip === 'elastic' || zip === 'halfElastic')) { zip = 'back'; warnings.push('連身裙用拉鏈，橡筋腰只適用於半截裙。'); }
    var elasticAll = zip === 'elastic', elasticHalf = zip === 'halfElastic';
    var hemSa = st.hemSa;
    var frontFlat = Wt / 4 + 0.5;                 // 前平：前幅（半件）腰寬

    function piece(isFront) {
      var waistW = ov ? (isFront ? ov.front : ov.back) : (isFront ? Wt / 4 + 0.5 : Wt / 4 - 0.5);
      var hipW = isFront ? Ht / 4 + 0.5 : Ht / 4 - 0.5;
      // 橡筋腰：冇拉鏈，腰口要拉得過臀圍（全件最少臀圍 + 2）
      var elasticPiece = elasticAll || (elasticHalf && !isFront);
      if (elasticAll) waistW = hipW + 0.5;
      else if (elasticPiece) waistW = Math.max(hipW + 0.5, (Ht + 2) / 2 - frontFlat);
      var excess = elasticPiece ? 0 : hipW - waistW;
      if (excess < 0) warnings.push('腰圍大過臀圍，裙會冇收腰。');
      // 側縫收一部份，其餘做褶（每個褶最多 3.5 cm）
      var side = clamp(excess * 0.4, 0, 3.5);
      var dartTotal = Math.max(0, excess - side);
      if (elasticPiece) { side = hipW - waistW; dartTotal = 0; }
      var n = dartTotal < 0.3 ? 0 : (dartTotal > (st.dartXs ? 3.5 : (isFront ? 3 : 2.5)) ? 2 : 1);
      if (n && dartTotal / n > 3.5) { side += dartTotal - 3.5 * n; dartTotal = 3.5 * n; }
      var dw = n ? dartTotal / n : 0;

      var sx = waistW + dartTotal;                 // 側腰點（褶未收）
      var cy = isFront ? (st.frontDrop || 0) : (ov ? 0 : 0.6);   // 後中腰線落 0.6；連身裙前中跟上身落低
      var rise0 = elasticAll ? 0 : 0.7;
      if (elasticHalf && !isFront) {
        // 前平後橡筋：後幅腰闊過臀，側骨斜咗會長啲；將後側腰降低返等前後側骨一樣長
        rise0 = 0.7 - (Math.hypot(D + 0.7, sx - hipW) - (D + 0.7));
      }
      if (elasticPiece) cy = 0;
      var Sw = P(sx, -rise0);                      // 側腰升 0.7（橡筋腰唔升）
      var C = P(0, cy);
      var waistCurve = [C, P(sx * 0.5, cy), P(sx * 0.82, -rise0 + (rise0 ? 0.12 : 0)), Sw];

      // 臀位弧線 + 側縫
      var hipP = P(hipW, D);
      var hipCurve = sx > hipW + 0.3
        ? [Sw, P(sx - (sx - hipW) * 0.35, D * 0.3), P(hipW + (sx - hipW) * 0.08, D * 0.7), hipP]   // 橡筋後幅：腰闊過臀，順直落臀
        : [Sw, P(sx + (hipW - sx) * 0.65, -rise0 + D * 0.3), P(hipW, D * 0.6), hipP];
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
      var dx0 = st.dartXs && st.dartXs[isFront ? 'front' : 'back'];
      if (dx0 && n) {                              // 連身裙：褶位對齊上身
        var a0 = clamp(dx0 / sx, 0.2, 0.8);
        fr = n === 2 ? [a0, Math.min(0.85, a0 + 4.5 / sx)] : [a0];
      }
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

    /* ---- 特別裙款：碎褶裙、百褶裙、半圓／全圓裙 ---- */
    var Wsp = (elasticAll || elasticHalf) ? Math.max(Wt, Ht + 2) : Wt;   // 橡筋腰：腰口要過到臀
    function special(isFront) {
      var isBack = !isFront;
      var fold = isFront ? slit !== 'front' : (zip !== 'back' && slit !== 'back');
      var key = isFront ? 'skirtFront' : 'skirtBack';
      var zhName = isFront ? '前裙片' : '後裙片', enName = isFront ? 'SKIRT FRONT' : 'SKIRT BACK';
      var notches = [], guides = [], edges, dims, label, grain, info;
      var zipEnd = isBack && zip === 'back' ? 18 : null;
      if (shape === 'circle' || shape === 'halfcircle') {
        var phi = (shape === 'circle' ? 90 : 45) * Math.PI / 180;
        var r = Wsp / (shape === 'circle' ? 2 * Math.PI : Math.PI);
        var O = P(0, -r), R2 = r + len;
        var arc = function (rad, a0, a1) {   // 由角度 a0 去 a1（由垂直向下計，順時針向右）
          var n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 4))), out = [];
          for (var i = 0; i < n; i++) {
            var t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n, k = 4 / 3 * Math.tan((t1 - t0) / 4);
            var p0 = G.add(O, P(rad * Math.sin(t0), rad * Math.cos(t0))), p3 = G.add(O, P(rad * Math.sin(t1), rad * Math.cos(t1)));
            var d0 = P(Math.cos(t0), -Math.sin(t0)), d1 = P(Math.cos(t1), -Math.sin(t1));
            out.push([p0, G.add(p0, G.mul(d0, rad * k)), G.sub(p3, G.mul(d1, rad * k)), p3]);
          }
          return out;
        };
        var Sw = G.add(O, P(r * Math.sin(phi), r * Math.cos(phi))), Sh = G.add(O, P(R2 * Math.sin(phi), R2 * Math.cos(phi)));
        var sideL = [B.line(Sw, Sh)];
        var sideSlit = null;
        if (slit === 'side') { sideSlit = G.lerp(Sw, Sh, (len - slitLen) / len); sideL = [B.line(Sw, sideSlit), B.line(sideSlit, Sh)]; notches.push({ edge: 'side', p: sideSlit, count: 2 }); }
        var cP = [P(0, len)];
        if ((slit === 'back' && isBack) || (slit === 'front' && isFront)) { cP.push(P(0, len - slitLen)); notches.push({ edge: 'center', p: P(0, len - slitLen), count: 2 }); }
        if (zipEnd) { cP.push(P(0, zipEnd)); notches.push({ edge: 'center', p: P(0, zipEnd), count: 1 }); }
        cP.push(P(0, 0));
        edges = [B.edge('waist', arc(r, 0, phi)), B.edge('side', sideL), B.edge('hem', B.reverse(arc(R2, 0, phi))), { name: 'center', pts: cP }];
        var mid = G.add(O, P((r + len * 0.45) * Math.sin(phi * 0.45), (r + len * 0.45) * Math.cos(phi * 0.45)));
        label = { p: mid };
        grain = [P(2.5, len * 0.25), P(2.5, len * 0.8)];
        info = { waistW: Wsp / 4, hipW: null, hemW: R2 * phi, darts: 0, dartW: 0, side: 0 };
        dims = [
          { kind: 'dim', a: P(0, 0), b: P(0, len), side: 'left', zh: '裙長 ' + f1(len), en: 'Length ' + f1(len) },
          { kind: 'edge', edge: 'waist', zh: '腰', en: 'Waist', inside: true },
          { kind: 'edge', edge: 'hem', zh: '下擺', en: 'Hem', frac: 0.5 }
        ];
      } else {
        // 碎褶裙／百褶裙：長方形
        var ratio = shape === 'pleated' ? 3 : clamp(st.skirtRatio || 1.6, 1.2, 3);
        var base = Math.max(Wt, Ht) / 4;            // 每片（半幅）
        var w = shape === 'pleated' ? Wsp / 4 * 3 : Math.max(Ht / 4 + 2, base * ratio);
        var sideP = [P(w, 0)];
        var cPts = [P(0, len)];
        if ((slit === 'back' && isBack) || (slit === 'front' && isFront)) { cPts.push(P(0, len - slitLen)); notches.push({ edge: 'center', p: P(0, len - slitLen), count: 2 }); }
        if (zipEnd) { cPts.push(P(0, zipEnd)); notches.push({ edge: 'center', p: P(0, zipEnd), count: 1 }); }
        cPts.push(P(0, 0));
        if (slit === 'side') { sideP.push(P(w, len - slitLen)); notches.push({ edge: 'side', p: P(w, len - slitLen), count: 2 }); }
        sideP.push(P(w, len));
        var waistPts = [P(0, 0), P(w / 2, 0), P(w, 0)];
        notches.push({ edge: 'waist', p: P(w / 2, 0), count: 1 });
        if (shape === 'pleated') {
          // 順褶：每 4 cm 左右一個；每個褶 = 面 s + 入 2s
          var n = Math.max(3, Math.round((Wsp / 4) / 4)), sp = (Wsp / 4) / n;
          for (var i = 0; i < n; i++) {
            var x0 = i * 3 * sp;
            guides.push({ pts: [P(x0 + sp, 0.2), P(x0 + sp, len - 0.2)], dash: [0.6, 0.3], zh: i === 0 ? '摺線' : null, en: i === 0 ? 'FOLD' : null });
            guides.push({ pts: [P(x0 + 3 * sp, 0.2), P(x0 + 3 * sp, len - 0.2)], dash: null, zh: i === 0 ? '對齊線' : null, en: i === 0 ? 'PLACE' : null });
          }
          guides.forEach(function (gd) { if (!gd.zh) { delete gd.zh; delete gd.en; } });
        } else {
          guides.push({ pts: [P(1, 1.2), P(Math.min(w - 1, 18), 1.2)], dash: [0.3, 0.3], zh: (elasticAll || (elasticHalf && !isFront)) ? '腰位由橡筋收細' : '腰位收碎褶至 ' + f1(Wt / 4) + ' cm', en: 'GATHER' });
        }
        edges = [{ name: 'waist', pts: waistPts }, { name: 'side', pts: sideP }, { name: 'hem', pts: [P(w, len), P(0, len)] }, { name: 'center', pts: cPts }];
        label = { p: P(w * 0.5, len * 0.4) };
        grain = [P(Math.min(4, w * 0.2), len * 0.25), P(Math.min(4, w * 0.2), len * 0.8)];
        info = { waistW: shape === 'pleated' ? Wsp / 4 : Wt / 4, hipW: w, hemW: w, darts: 0, dartW: 0, side: 0 };
        if ((elasticAll || elasticHalf) && shape === 'gathered') info.waistW = w;
        dims = [
          { kind: 'dim', a: P(0, 0), b: P(0, len), side: 'left', zh: '裙長 ' + f1(len), en: 'Length ' + f1(len) },
          { kind: 'below', a: P(0, len), b: P(w, len), zh: '闊 ' + f1(w), en: 'Width ' + f1(w) }
        ];
      }
      if (zipEnd) guides.push({ pts: [P(0.8, zipEnd), P(2.5, zipEnd)], dash: null, zh: '拉鏈止點', en: 'ZIP END' });
      var pc = {
        key: key, zh: zhName, en: enName, mirror: isFront, edges: edges, fold: fold ? 'center' : null, darts: [], guides: guides,
        marks: [], notches: notches, grain: grain, label: label, cut: fold ? 1 : 2,
        foldZh: (isFront ? '前中' : '後中') + '對摺線', foldEn: (isFront ? 'CF' : 'CB') + ' PLACE ON FOLD',
        saEdge: { hem: shape === 'circle' || shape === 'halfcircle' ? Math.min(hemSa, 1.5) : hemSa }, dims: dims, info: info
      };
      return pc;
    }

    var isSpecial = ['gathered', 'pleated', 'circle', 'halfcircle'].indexOf(shape) >= 0;
    if (isSpecial) { flare = 0; taper = 0; }
    var back = isSpecial ? special(false) : piece(false), front = isSpecial ? special(true) : piece(true);

    var bw = clamp(st.bandW || 3, 2, 8), over = 3;
    var qB = back.info.waistW, qF = front.info.waistW;
    function rectBand(key, zh, en, L, H, opts) {
      var notchXs = opts.notchXs || [];
      var top = [P(0, 0)].concat(notchXs.map(function (x) { return P(x, 0); })).concat([P(L, 0)]);
      var pc = {
        key: key, zh: zh, en: en, mirror: false,
        edges: [{ name: 'top', pts: top }, { name: 'right', pts: [P(L, 0), P(L, 2 * H)] },
          { name: 'bottom', pts: [P(L, 2 * H), P(0, 2 * H)] }, { name: 'left', pts: [P(0, 2 * H), P(0, 0)] }],
        fold: null, darts: [],
        guides: [{ pts: [P(0, H), P(L, H)], dash: [1, 0.3, 0.2, 0.3], zh: opts.foldText || '摺線', en: 'FOLD LINE' }],
        marks: opts.marks || [],
        notches: notchXs.map(function (x) { return { edge: 'top', p: P(x, 0), count: 1 }; }),
        grain: [P(3, 2 * H - 0.7), P(Math.min(L - 3, 30), 2 * H - 0.7)],
        label: { p: P(Math.min(L * 0.5, 22), H + 1.4) },
        cut: 1, cutZh: opts.cutZh, cutEn: opts.cutEn || 'CUT 1', small: true
      };
      pc.dims = [{ kind: 'below', a: P(0, 2 * H), b: P(L, 2 * H), zh: opts.dimZh || ('長 ' + f1(L)), en: 'Length ' + f1(L) }];
      return pc;
    }
    var bands = [], Lb;
    var elasticLen = function (bodyCm) { return Math.round(bodyCm * 0.9); };
    if (elasticAll) {
      // 全橡筋：一條圈形腰頭（穿橡筋）
      Lb = (qB + qF) * 2 + 2;
      bands.push(rectBand('band', '橡筋腰頭', 'ELASTIC CASING', Lb, bw + 0.5, {
        notchXs: [qB, qB + qF, qB + 2 * qF], cutZh: '裁 1 片（頭尾駁成圈）',
        foldText: '摺線（穿 ' + f1(bw) + ' cm 橡筋，長約 ' + elasticLen(m.waist) + ' cm）', dimZh: '腰頭長 ' + f1(Lb) + '（連 2 cm 駁位）'
      }));
    } else if (elasticHalf) {
      // 前平後橡筋：前幅平腰頭（燙朴）＋ 後幅橡筋腰頭
      var Lf = 2 * qF + 2, Lbk = 2 * qB + 2;
      Lb = Lf + Lbk;
      bands.push(rectBand('band', '前腰頭（平）', 'FRONT WAISTBAND', Lf, bw, {
        notchXs: [1 + qF], cutZh: '裁 1 片＋燙朴 1 片', cutEn: 'CUT 1 + 1 INTERFACING', dimZh: '前腰頭 ' + f1(Lf) + '（連兩邊 1 cm 縫份）'
      }));
      bands.push(rectBand('bandBack', '後腰頭（橡筋）', 'BACK ELASTIC CASING', Lbk, bw + 0.5, {
        notchXs: [1 + qB], cutZh: '裁 1 片',
        foldText: '摺線（穿 ' + f1(bw) + ' cm 橡筋，長約 ' + elasticLen(m.waist + ease.waist - 2 * frontFlat) + ' cm，兩頭車死喺側骨）',
        dimZh: '後腰頭 ' + f1(Lbk) + '（連兩邊 1 cm 縫份）'
      }));
    } else {
      // 拉鏈：腰頭對摺，連搭位 3 cm
      Lb = Wt + over;
      var marks = zip === 'back'
        ? [qB, qB + qF, qB + 2 * qF, Wt]          // 後中 → 側 → 前中 → 側 → 後中
        : [2 * qF, 2 * qF + qB, Wt];             // 側（左）→ 前 → 側 → 後中 → 側
      bands.push(rectBand('band', '腰頭', 'WAISTBAND', Lb, bw, {
        notchXs: marks, cutZh: '裁 1 片＋燙朴 1 片', cutEn: 'CUT 1 + 1 INTERFACING',
        marks: [{ type: 'button', p: P(Lb - over / 2, bw / 2) }, { type: 'buttonhole', p: P(over / 2 + 0.3, bw / 2) }],
        dimZh: '腰頭長 ' + f1(Lb) + '（連搭位 3）'
      }));
    }
    if (elasticAll || elasticHalf) warnings.push((elasticAll ? '全橡筋' : '前平後橡筋') + '：冇拉鏈，腰口拉開最少 ' + f1(Ht + 2) + ' cm，套得過臀圍。');

    var pieces = st.noBand ? [back, front] : [back, front].concat(bands);
    return {
      pieces: pieces, back: back, front: front, warnings: warnings, style: st, garment: 'skirt',
      info: {
        garment: 'skirt', waistTotal: (back.info.waistW + front.info.waistW) * 2, hipTotal: isSpecial ? null : (back.info.hipW + front.info.hipW) * 2,
        hemTotal: (back.info.hemW + front.info.hemW) * 2, len: len, special: isSpecial ? shape : null,
        dartsBack: back.info.darts + ' × ' + f1(back.info.dartW), dartsFront: front.info.darts + ' × ' + f1(front.info.dartW),
        sideTake: back.info.side, bandLen: Lb,
        sideLen: G.polyLen(back.edges[1].pts), sideLenF: G.polyLen(front.edges[1].pts),
        hipTotalNote: isSpecial
      }
    };
  }

  PM.draftSkirt = draftSkirt;
})(typeof window !== 'undefined' ? window : globalThis);
