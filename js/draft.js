/*
 * 女裝基本上身原型（前片、後片，連腰褶）打版計算
 * 所有尺寸單位：厘米。座標 y 軸向下。
 *
 * 輸入（淨尺寸）：
 *   bust 胸圍, waist 腰圍, shoulder 肩寬（左肩點至右肩點）, backLen 背長（後頸點至腰）,
 *   frontLen 前長（側頸點經胸點至腰）, neck 領圍, armhole 夾圈
 * 放鬆量：bust, waist, neck, armhole
 */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});
  var G = PM.geom, P = G.P;
  var DEG = Math.PI / 180;

  var BACK_SLOPE = 18;   // 後肩斜度（度）
  var FRONT_SLOPE = 22;  // 前肩斜度（度）
  var SHOULDER_EASE = 0.5; // 後肩比前肩長（縮縫量）

  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  /* ---------- 領口 ---------- */
  function neckCurves(nwB) {
    var riseB = nwB / 3;
    var nwF = nwB - 0.2;
    var ndF = nwF + 0.5;
    // 後領：後頸點 (0, riseB) → 側頸點 (nwB, 0)
    var back = G.cubic(P(0, riseB), P(nwB * 0.6, riseB), P(nwB, riseB * 0.55), P(nwB, 0));
    // 前領：前頸點 (0, ndF) → 側頸點 (nwF, 0)
    var front = G.cubic(P(0, ndF), P(nwF * 0.58, ndF), P(nwF, ndF * 0.5), P(nwF, 0));
    return { nwB: nwB, riseB: riseB, nwF: nwF, ndF: ndF, back: back, front: front };
  }

  /* ---------- 夾圈（由肩點落到夾底） ---------- */
  function armCurve(S, shoulderDir, crossX, U, kv, kh) {
    var depth = U.y - S.y;
    var Gp = P(crossX, S.y + depth * 0.5);
    var perp = P(-shoulderDir.y, shoulderDir.x); // 垂直肩線向下
    var l1 = G.dist(S, Gp);
    var upper = G.cubic(S, G.add(S, G.mul(perp, l1 * 0.35)), P(Gp.x, Gp.y - l1 * 0.35), Gp, 24);
    var lower = G.cubic(Gp, P(Gp.x, Gp.y + (U.y - Gp.y) * kv), P(U.x - (U.x - Gp.x) * kh, U.y), U, 24);
    return upper.concat(lower.slice(1));
  }

  function draft(m, ease) {
    var warnings = [];
    var B = m.bust + ease.bust;
    var W = m.waist + ease.waist;

    /* 領口：調整領寬令前後領弧總長 = 領圍/2 */
    var neckTarget = (m.neck + ease.neck) / 2;
    var ns = G.solve(function (nw) {
      var n = neckCurves(nw);
      return G.polyLen(n.back) + G.polyLen(n.front);
    }, neckTarget, 3, 14);
    if (!ns.ok) warnings.push('領圍數值偏離常見範圍，領口已用最接近嘅尺寸。');
    var neck = neckCurves(ns.x);

    /* 肩線 */
    var bsx = m.shoulder / 2;
    if (bsx - neck.nwB < 6) warnings.push('肩寬相對領圍太細，肩線會好短，請檢查尺寸。');
    var bDir = P(Math.cos(BACK_SLOPE * DEG), Math.sin(BACK_SLOPE * DEG));
    var backShoulderLen = (bsx - neck.nwB) / bDir.x;
    var SB = P(bsx, backShoulderLen * bDir.y);
    var fDir = P(Math.cos(FRONT_SLOPE * DEG), Math.sin(FRONT_SLOPE * DEG));
    var frontShoulderLen = backShoulderLen - SHOULDER_EASE;
    var SF = G.add(P(neck.nwF, 0), G.mul(fDir, frontShoulderLen));

    /* 胸圍寬 */
    var bw = B / 4 - 0.5; // 後片
    var fw = B / 4 + 0.5; // 前片
    var crossB = Math.min(bsx - 1.5, bw - 1.5);
    var crossF = Math.min(SF.x - 1.5, fw - 2);

    /* 夾圈深：令前後夾圈總長 = 夾圈尺寸 */
    function arms(yB) {
      var a = armCurve(SB, bDir, crossB, P(bw, yB), 0.5, 0.55);
      var b = armCurve(SF, fDir, crossF, P(fw, yB), 0.6, 0.5);
      return { back: a, front: b };
    }
    var armTarget = m.armhole + ease.armhole;
    var yBmin = Math.max(SB.y, SF.y) + 10;
    var yBmax = Math.min(neck.riseB + m.backLen - 6, Math.max(SB.y, SF.y) + 32);
    var as = G.solve(function (y) {
      var a = arms(y);
      return G.polyLen(a.back) + G.polyLen(a.front);
    }, armTarget, yBmin, yBmax);
    if (!as.ok) warnings.push('夾圈尺寸同胸圍／肩寬唔太夾，夾圈深已限制喺合理範圍（實際夾圈長見下表）。');
    var yB = as.x;
    var arm = arms(yB);

    /* 腰線 */
    var yWB = neck.riseB + m.backLen; // 後腰（側頸點水平為 0）
    var yWF = Math.max(m.frontLen, yWB);
    if (m.frontLen < yWB - 0.5) warnings.push('前長比後片（背長＋後領高）仲短，前腰已同後腰齊平。');
    if (m.frontLen - yWB > 6) warnings.push('前長比後片長好多（' + f1(m.frontLen - yWB) + ' cm），建議改用胸褶原型。');

    var wwB = W / 4 - 0.5, wwF = W / 4 + 0.5;
    var exB = bw - wwB, exF = fw - wwF;
    var side = Math.max(-3, Math.min(2.5, Math.min(exB, exF) * 0.4));
    var dartB = Math.max(0, exB - side);
    var dartF = Math.max(0, exF - side);
    if (dartF > 6 || dartB > 6) warnings.push('胸腰差好大，腰褶超過 6 cm，可能要分開兩個褶。');

    /* ---------- 後片 ---------- */
    var sideWB = P(bw - side, yWB);
    var bDartX = (bw - side) * 0.5;
    var back = {
      key: 'back', zh: '後片', en: 'BACK BODICE', centerZh: '後中', centerEn: 'CB',
      edges: [
        { name: 'neck', pts: neck.back },
        { name: 'shoulder', pts: [P(neck.nwB, 0), SB] },
        { name: 'armhole', pts: arm.back },
        { name: 'side', pts: [P(bw, yB), sideWB] },
        { name: 'waist', pts: [sideWB, P(0, yWB)] },
        { name: 'center', pts: [P(0, yWB), P(0, neck.riseB)] }
      ],
      dart: dartB > 0.05 ? { l: P(bDartX - dartB / 2, yWB), apex: P(bDartX, yB - 2), r: P(bDartX + dartB / 2, yWB), w: dartB } : null,
      yB: yB, bustW: bw, waistW: wwB, centerTop: P(0, neck.riseB), centerBot: P(0, yWB),
      grainX: Math.max(3, bDartX - dartB / 2 - 4),
      notches: [{ edge: 'armhole', frac: 0.62, double: true }],
      sideLen: G.dist(P(bw, yB), sideWB)
    };

    /* ---------- 前片 ---------- */
    var sideWF = P(fw - side, yWB);
    var bpX = m.bust / 10 + 0.5;
    var fDartApex = P(bpX, yB + 4);
    var frontWaistPts = [sideWF];
    var fDart = null;
    if (dartF > 0.05) {
      fDart = { l: P(bpX - dartF / 2, yWF), apex: fDartApex, r: P(bpX + dartF / 2, yWF), w: dartF };
      frontWaistPts.push(fDart.r, fDart.l);
    } else if (yWF > yWB) {
      frontWaistPts.push(P(bpX, yWF));
    }
    frontWaistPts.push(P(0, yWF));
    var front = {
      key: 'front', zh: '前片', en: 'FRONT BODICE', centerZh: '前中', centerEn: 'CF',
      edges: [
        { name: 'neck', pts: neck.front },
        { name: 'shoulder', pts: [P(neck.nwF, 0), SF] },
        { name: 'armhole', pts: arm.front },
        { name: 'side', pts: [P(fw, yB), sideWF] },
        { name: 'waist', pts: frontWaistPts },
        { name: 'center', pts: [P(0, yWF), P(0, neck.ndF)] }
      ],
      dart: fDart, bp: P(bpX, yB + 2),
      yB: yB, bustW: fw, waistW: wwF, centerTop: P(0, neck.ndF), centerBot: P(0, yWF),
      grainX: Math.min(fw - 4, bpX + dartF / 2 + 4),
      notches: [{ edge: 'armhole', frac: 0.6, double: false }],
      sideLen: G.dist(P(fw, yB), sideWF)
    };

    var lenOf = function (pc, name) {
      return G.polyLen(pc.edges.filter(function (e) { return e.name === name; })[0].pts);
    };
    var info = {
      armDepth: yB - Math.max(SB.y, SF.y),
      bustLineFromNape: yB - neck.riseB,
      armBack: lenOf(back, 'armhole'), armFront: lenOf(front, 'armhole'),
      neckBack: lenOf(back, 'neck'), neckFront: lenOf(front, 'neck'),
      shoulderBack: backShoulderLen, shoulderFront: frontShoulderLen,
      dartBack: dartB, dartFront: dartF, sideTake: side,
      bustTotal: (bw + fw) * 2, waistTotal: (wwB + wwF) * 2,
      sideLen: back.sideLen, frontDrop: yWF - yWB
    };
    return { back: back, front: front, info: info, warnings: warnings };
  }

  PM.draft = draft;
  PM.fmt = f1;
})(typeof window !== 'undefined' ? window : globalThis);
