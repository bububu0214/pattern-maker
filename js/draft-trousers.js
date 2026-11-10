/*
 * 褲原型：前片、後片（浪位、褲中線、腰褶）、腰頭、拉鏈貼
 * 單位：厘米；每塊紙樣：腰線 y = 0，向下為正；浪（股）喺左邊（x 細），側骨喺右邊。
 *
 * m：waist, hip, waistToHip, crotchDepth 股上（腰至坐位）, outseam 褲長（腰至腳踭）
 * st：trouserShape (straight 直腳 | slim 窄腳 | wide 闊腳), trouserLen（腰下褲長）,
 *     trouserWaist (zip 前拉鏈 | side 側拉鏈 | elastic 鬆緊帶), bandW
 */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});
  var G = PM.geom, P = G.P, B = PM.bez, f1 = PM.fmt;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function draftTrousers(m, ease, st) {
    var warnings = [];
    var Wt = m.waist + ease.waist, Ht = m.hip + ease.hip;
    var D = m.waistToHip, CD = (m.crotchDepth || 26) + 1;          // 股上加 1 cm 活動量
    var TL = m.outseam || 96;
    var L = clamp(st.trouserLen || TL, CD + 5, TL + 10);
    var K = CD + (TL - CD) / 2 - 5;                                  // 膝線
    var shape = st.trouserShape || 'straight';
    var elastic = st.trouserWaist === 'elastic';
    var hipScale = Ht / 96;
    var legs = { straight: [22, 21], slim: [19.5, 15.5], wide: [27, 31] }[shape] || [22, 21];
    var kneeF = legs[0] * hipScale, hemF = legs[1] * hipScale;
    var hemSa = st.hemSa;

    function piece(isFront, adj) {
      adj = adj || { out: 0, inn: 0 };
      var hipW = isFront ? Ht / 4 - 1 : Ht / 4 + 1;
      var ext = isFront ? 0.045 * Ht : 0.11 * Ht;                      // 前襠寬 0.045H、後襠寬 0.11H（中文褲原型常用）
      var drop = isFront ? 0 : 0.7;                                  // 後浪點落低
      var crotchP = P(-ext, CD + drop);
      var waistFin = isFront ? Wt / 4 - 0.5 : Wt / 4 + 0.5;
      var notches = [], darts = [], guides = [];

      // 中線（浪）頂點同腰
      var top = isFront ? P(1, 0) : P(3.5, -2.5);
      var hip0 = P(0, D);
      var sideW, dartW = 0;
      if (elastic) {
        sideW = P(hipW, 0);                                           // 鬆緊腰：側骨直上，冇褶（前後側骨一樣長）
        top = isFront ? P(0, 0) : P(2, -2);
      } else {
        // 側骨收 1 cm，其餘做褶（最多 3.5）；褶太多就再收側骨
        var sx = hipW - 1;
        var wy = isFront ? 0 : 0;
        var avail = function (x) { return G.dist(top, P(x, wy)); };
        dartW = avail(sx) - waistFin;
        if (dartW > 3.5) {
          var lo = top.x + 1, hi = sx;
          for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (avail(mid) - waistFin > 3.5) hi = mid; else lo = mid; }
          sx = (lo + hi) / 2; dartW = 3.5;
        } else if (dartW < 0) {
          var lo2 = sx, hi2 = hipW + 3;
          for (var j = 0; j < 40; j++) { var m2 = (lo2 + hi2) / 2; if (avail(m2) - waistFin < 0) lo2 = m2; else hi2 = m2; }
          sx = (lo2 + hi2) / 2; dartW = 0;
        }
        sideW = P(sx, wy);
      }

      // 浪位：腰 → 臀 → 浪點
      var crotchBez = [];
      crotchBez.push(B.line(top, hip0));
      if (isFront) {
        crotchBez.push([hip0, P(0, D + (CD - D) * 0.7), P(-ext * 0.55, CD), crotchP]);
      } else {
        var dirCB = G.norm(G.sub(hip0, top));
        crotchBez.push([hip0, G.add(hip0, G.mul(dirCB, (CD - D) * 0.6)), P(-ext * 0.5, crotchP.y), crotchP]);
      }

      // 褲腳
      var crease = (-ext + hipW) / 2;
      var kW = isFront ? kneeF : kneeF + 4, hW = isFront ? hemF : hemF + 4;
      var kneeIn = P(crease - kW / 2, K), kneeOut = P(crease + kW / 2, K);
      var hemIn, hemOut;
      var sideCrotch = P(hipW, CD);
      if (L >= K) {
        var t = (L - K) / Math.max(1, TL - K);
        var wAtL = kW + (hW - kW) * t;
        hemIn = P(crease - wAtL / 2, L); hemOut = P(crease + wAtL / 2, L);
      } else {
        var tt = (L - CD) / (K - CD);
        hemIn = G.lerp(crotchP, kneeIn, tt); hemIn = P(hemIn.x, L);
        hemOut = G.lerp(sideCrotch, kneeOut, tt); hemOut = P(hemOut.x, L);
      }

      // 後片褲腳角微調，令前後側骨、內浪一樣長
      hemOut = P(hemOut.x, hemOut.y + adj.out); hemIn = P(hemIn.x, hemIn.y + adj.inn);
      // 側骨：腰 →（臀位弧）→ 臀 → 浪位水平 → 膝 → 腳
      var hipP = P(hipW, D);
      var side = [];
      if (Math.abs(sideW.x - hipW) < 0.05) side.push(B.line(sideW, hipP));
      else {
        // 文化式：側骨喺側腰點同腰線成直角
        var wd = G.norm(G.sub(sideW, top)), down = P(-wd.y, wd.x); if (down.y < 0) down = G.mul(down, -1);
        side.push([sideW, G.add(sideW, G.mul(down, D * 0.35)), P(hipW, D * 0.6), hipP]);
      }
      side.push(B.line(hipP, sideCrotch));
      if (L >= K) {
        side.push([sideCrotch, P(hipW, CD + (K - CD) * 0.3), P(kneeOut.x, K - (K - CD) * 0.3), kneeOut]);
        if (L > K + 0.5) side.push(B.line(kneeOut, hemOut));
        notches.push({ edge: 'side', p: kneeOut, count: isFront ? 1 : 2 });
      } else {
        side.push(B.line(sideCrotch, hemOut));
      }
      notches.push({ edge: 'side', p: hipP, count: 1 });

      // 內浪（inseam）：腳 → 膝 → 浪點
      var inseam = [];
      if (L >= K) {
        if (L > K + 0.5) inseam.push(B.line(hemIn, kneeIn));
        inseam.push([kneeIn, P(kneeIn.x, K - (K - CD) * 0.35), P(crotchP.x + 1.5, crotchP.y + (K - crotchP.y) * 0.3), crotchP]);
        notches.push({ edge: 'inseam', p: kneeIn, count: isFront ? 1 : 2 });
      } else {
        inseam.push(B.line(hemIn, crotchP));
      }

      // 腰線（有褶就切開）
      var waistList;
      if (dartW > 0.05) {
        var dc = isFront ? Math.max(top.x + 3, Math.min(crease, sideW.x - 4)) : (top.x + sideW.x) / 2;
        var wl = B.line(top, sideW);
        var tAt = function (x) { return (x - top.x) / (sideW.x - top.x); };
        var lp = B.at(wl, tAt(dc - dartW / 2)), rp = B.at(wl, tAt(dc + dartW / 2));
        var dirW = G.norm(G.sub(sideW, top)), perp = P(-dirW.y, dirW.x);
        if (perp.y < 0) perp = G.mul(perp, -1);
        var apex = G.add(B.at(wl, tAt(dc)), G.mul(perp, isFront ? 9 : 12));
        darts.push({ pts: [lp, apex, rp], closed: false, w: dartW, apex: apex });
        waistList = [B.line(top, lp), B.line(lp, rp), B.line(rp, sideW)];
        notches.push({ edge: 'waist', p: lp, count: 1 }, { edge: 'waist', p: rp, count: 1 });
      } else if (elastic) {
        // 腰線喺側骨成直角（側骨垂直，所以腰線到側邊係水平）
        waistList = [[top, G.lerp(top, sideW, 0.35), P(sideW.x - (sideW.x - top.x) * 0.3, sideW.y), sideW]];
      } else {
        waistList = [B.line(top, sideW)];
      }

      // 拉鏈止點
      var zipEnd = null;
      if (!elastic && st.trouserWaist !== 'side' && isFront) {
        zipEnd = G.lerp(top, hip0, Math.min(0.95, 17 / D));
        // 浪位直線部份切開放剪口
        crotchBez[0] = B.line(top, zipEnd);
        crotchBez.splice(1, 0, B.line(zipEnd, hip0));
        notches.push({ edge: 'crotch', p: zipEnd, count: 1 });
        guides.push({ pts: [zipEnd, G.add(zipEnd, P(3.5, 0))], dash: null, zh: '拉鏈止點', en: 'ZIP END' });
        guides.push({ pts: [P(top.x + 3.5, top.y + 0.5), P(zipEnd.x + 3.5, zipEnd.y - 1.5), G.add(zipEnd, P(1, 0))], dash: [0.4, 0.3], zh: '門襟線', en: 'FLY' });
      }
      notches.push({ edge: 'crotch', p: hip0, count: isFront ? 1 : 2 });

      var edges = [
        B.edge('waist', waistList),
        B.edge('side', side),
        { name: 'hem', pts: [hemOut, hemIn] },
        B.edge('inseam', inseam),
        B.edge('crotch', B.reverse(crotchBez))
      ];
      guides.push({ pts: [P(0, D), hipP], dash: [0.6, 0.3], zh: '臀圍線', en: 'HIP' });
      guides.push({ pts: [crotchP, sideCrotch], dash: [0.6, 0.3], zh: '浪位線', en: 'CROTCH' });
      if (L >= K) guides.push({ pts: [kneeIn, kneeOut], dash: [0.6, 0.3], zh: '膝線', en: 'KNEE' });
      var pc = {
        key: isFront ? 'trouserFront' : 'trouserBack', zh: isFront ? '前褲片' : '後褲片', en: isFront ? 'TROUSER FRONT' : 'TROUSER BACK',
        mirror: false, edges: edges, fold: null, darts: darts, guides: guides, marks: [], notches: notches,
        grain: [P(crease, Math.max(D + 2, CD - 8)), P(crease, L - 4)],
        label: { p: P(crease + (isFront ? 0 : 1), Math.min(CD + 8, (CD + L) / 2)) }, cut: 2,
        cutZh: '裁 2 片（左右對稱）', saEdge: { hem: hemSa }
      };
      pc.dims = [
        { kind: 'edge', edge: 'inseam', zh: '內浪', en: 'Inseam', frac: 0.5 },
        { kind: 'edge', edge: 'side', zh: '側骨', en: 'Outseam', frac: 0.6 },
        { kind: 'edge', edge: 'crotch', zh: isFront ? '前浪' : '後浪', en: isFront ? 'Front rise' : 'Back rise', frac: 0.5, inside: true },
        { kind: 'below', a: hemIn, b: hemOut, zh: '褲腳 ' + f1(hemOut.x - hemIn.x), en: 'Hem ' + f1(hemOut.x - hemIn.x) },
        { kind: 'text', p: P(hipW * 0.6, D - 0.45), zh: '臀寬 ' + f1(hipW), en: 'Hip ' + f1(hipW) }
      ];
      pc.info = {
        hipW: hipW, waistFin: elastic ? null : waistFin, dartW: dartW, hemW: hemOut.x - hemIn.x, kneeW: kW,
        inseam: G.polyLen(edges[3].pts), outseam: G.polyLen(edges[1].pts), rise: G.polyLen(edges[4].pts),
        waistLen: G.polyLen(edges[0].pts) - dartW
      };
      return pc;
    }

    var front = piece(true), back = piece(false), adjB = { out: 0, inn: 0 };
    for (var it = 0; it < 3; it++) {
      adjB.out += front.info.outseam - back.info.outseam;
      adjB.inn += front.info.inseam - back.info.inseam;
      back = piece(false, adjB);
    }
    var diff = back.info.inseam - front.info.inseam;
    if (Math.abs(diff) > 1.5) warnings.push('前後內浪長度差 ' + f1(diff) + ' cm，車嘅時候要縮縫或者修順。');

    // 腰頭
    var bw = clamp(st.bandW || 3.5, 2, 8);
    var pieces = [back, front];
    if (elastic) {
      var casingLen = (back.info.waistLen + front.info.waistLen) * 2 + 2;
      var cw = bw + 0.5;
      pieces.push({
        key: 'band', zh: '鬆緊帶腰頭', en: 'ELASTIC CASING', mirror: false, fold: null, darts: [], marks: [],
        edges: [{ name: 'top', pts: [P(0, 0), P(casingLen, 0)] }, { name: 'right', pts: [P(casingLen, 0), P(casingLen, 2 * cw)] },
          { name: 'bottom', pts: [P(casingLen, 2 * cw), P(0, 2 * cw)] }, { name: 'left', pts: [P(0, 2 * cw), P(0, 0)] }],
        guides: [{ pts: [P(0, cw), P(casingLen, cw)], dash: [1, 0.3, 0.2, 0.3], zh: '摺線（穿 ' + f1(bw) + ' cm 鬆緊帶，長約腰圍 × 0.9）', en: 'FOLD' }],
        notches: [], grain: [P(3, 2 * cw - 0.7), P(Math.min(casingLen - 3, 30), 2 * cw - 0.7)],
        label: { p: P(Math.min(casingLen * 0.5, 25), cw + 1.4) }, cut: 1, cutZh: '裁 1 片', cutEn: 'CUT 1', small: true,
        dims: [{ kind: 'below', a: P(0, 2 * cw), b: P(casingLen, 2 * cw), zh: '長 ' + f1(casingLen), en: 'Length ' + f1(casingLen) }]
      });
    } else {
      var over = 3.5, Lb = Wt + over;
      var qF = front.info.waistFin, qB = back.info.waistFin;
      var marks = [over, over + qF, over + qF + 2 * qB, Wt + over - 0.0001].map(function (x) { return x; });
      var top = [P(0, 0)].concat(marks.slice(0, 3).map(function (x) { return P(x, 0); })).concat([P(Lb, 0)]);
      pieces.push({
        key: 'band', zh: '腰頭', en: 'WAISTBAND', mirror: false, fold: null, darts: [],
        edges: [{ name: 'top', pts: top }, { name: 'right', pts: [P(Lb, 0), P(Lb, 2 * bw)] },
          { name: 'bottom', pts: [P(Lb, 2 * bw), P(0, 2 * bw)] }, { name: 'left', pts: [P(0, 2 * bw), P(0, 0)] }],
        guides: [{ pts: [P(0, bw), P(Lb, bw)], dash: [1, 0.3, 0.2, 0.3], zh: '摺線', en: 'FOLD LINE' }],
        marks: [{ type: 'buttonhole', p: P(1.5, bw / 2) }, { type: 'button', p: P(Lb - 1.5, bw / 2) }],
        notches: marks.slice(0, 3).map(function (x) { return { edge: 'top', p: P(x, 0), count: 1 }; }),
        grain: [P(3, 2 * bw - 0.7), P(Math.min(Lb - 3, 30), 2 * bw - 0.7)],
        label: { p: P(Math.min(Lb * 0.5, 25), bw + 1.4) }, cut: 1, cutZh: '裁 1 片＋燙朴 1 片', cutEn: 'CUT 1 + 1 INTERFACING', small: true,
        dims: [{ kind: 'below', a: P(0, 2 * bw), b: P(Lb, 2 * bw), zh: '腰頭長 ' + f1(Lb) + '（連搭位 ' + over + '）', en: 'Band ' + f1(Lb) }]
      });
      if (st.trouserWaist !== 'side') {
        var fl = 20, fw = 5;
        pieces.push({
          key: 'fly', zh: '拉鏈貼', en: 'FLY SHIELD', mirror: false, fold: null, darts: [], marks: [], notches: [],
          edges: [{ name: 'top', pts: [P(0, 0), P(fw * 2, 0)] }, { name: 'right', pts: [P(fw * 2, 0), P(fw * 2, fl)] },
            { name: 'bottom', pts: [P(fw * 2, fl), P(0, fl)] }, { name: 'left', pts: [P(0, fl), P(0, 0)] }],
          guides: [{ pts: [P(fw, 0.5), P(fw, fl - 0.5)], dash: [1, 0.3, 0.2, 0.3], zh: '摺線', en: 'FOLD' }],
          grain: [P(fw * 1.5, 3), P(fw * 1.5, fl - 3)], label: { p: P(fw * 0.5, fl * 0.5) },
          cut: 2, cutZh: '門襟、底襟各 1', cutEn: 'CUT 2', small: true, dims: []
        });
      }
    }
    if (st.trouserWaist === 'side') warnings.push('側拉鏈：拉鏈裝喺左邊側骨，長約 18 cm。');

    return {
      pieces: pieces, back: back, front: front, warnings: warnings, style: st, garment: 'trousers',
      info: {
        garment: 'trousers', waistTotal: elastic ? null : (back.info.waistFin + front.info.waistFin) * 2,
        hipTotal: (back.info.hipW + front.info.hipW) * 2, len: L, crotchDepth: CD,
        inseamB: back.info.inseam, inseamF: front.info.inseam, outseamB: back.info.outseam, outseamF: front.info.outseam,
        riseB: back.info.rise, riseF: front.info.rise, hemTotal: back.info.hemW + front.info.hemW,
        dartsB: back.info.dartW, dartsF: front.info.dartW
      }
    };
  }

  PM.draftTrousers = draftTrousers;
})(typeof window !== 'undefined' ? window : globalThis);
