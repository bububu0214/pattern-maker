/*
 * Seamly2D 紙樣檔（.sm2d）輸出
 * 用 v0.6.0 格式（Seamly2D 同 Valentina 都開到，開檔時會自動升級到新版格式）。
 * 內容：所有點（由基準點 A 用角度＋長度定位）、直線、真正嘅貝茲曲線（可以拖動修改）、
 * 前後片 piece（連縫份、對摺邊無縫份、剪口、布紋線）。
 */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});
  var G = PM.geom, P = G.P;
  var PX = 96 / 2.54; // Seamly2D 畫面座標：1 cm = 37.795 px

  function n(v) { return String(Math.round(v * 10000) / 10000); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function attrs(o) {
    return Object.keys(o).map(function (k) { return k + '="' + esc(o[k]) + '"'; }).join(' ');
  }
  /** Seamly2D 角度：0° 向右、90° 向上（y 軸向下嘅畫面） */
  function angleTo(a, b) {
    var ang = Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI;
    return (ang + 360) % 360;
  }

  function toSeamly(res, opt) {
    var id = 0;
    var calc = [], modeling = [], details = [];
    var base = null; // 基準點
    var pointIds = {}; // 座標 → id（避免重覆點）

    function key(p) { return p.x.toFixed(3) + ',' + p.y.toFixed(3); }

    function point(p, name) {
      var k = key(p);
      if (pointIds[k]) return pointIds[k];
      var pid = ++id;
      if (!base) {
        base = p;
        calc.push('<point ' + attrs({ id: pid, mx: 0.13, my: 0.26, name: name, type: 'single', x: n(p.x), y: n(p.y) }) + '/>');
      } else {
        calc.push('<point ' + attrs({
          angle: n(angleTo(base, p)), basePoint: pointIds[key(base)], id: pid, length: n(G.dist(base, p)),
          lineColor: 'black', mx: 0.13, my: 0.26, name: name, type: 'endLine', typeLine: 'none'
        }) + '/>');
      }
      pointIds[k] = pid;
      return pid;
    }
    function line(a, b, style) {
      var lid = ++id;
      calc.push('<line ' + attrs({ firstPoint: a, id: lid, lineColor: 'black', secondPoint: b, typeLine: style || 'hair' }) + '/>');
      return lid;
    }
    function spline(bz, p1, p4) {
      var sid = ++id;
      calc.push('<spline ' + attrs({
        angle1: n(angleTo(bz[0], bz[1])), angle2: n(angleTo(bz[3], bz[2])),
        color: 'black', id: sid, length1: n(G.dist(bz[0], bz[1])), length2: n(G.dist(bz[3], bz[2])),
        point1: p1, point4: p4, type: 'simpleInteractive'
      }) + '/>');
      return sid;
    }

    function addPiece(pc, T, prefix, title, fold, letter) {
      var seq = 0;
      var nm = function () { return prefix + (++seq); };
      var tp = function (p) { return T(p); };
      var tb = function (bz) { return bz.map(T); };
      var nodes = []; // {type, obj, before, after, passmark}

      function pushPoint(p, extra) {
        var pid = point(tp(p), nm());
        var last = nodes[nodes.length - 1];
        if (last && last.type === 'NodePoint' && last.obj === pid) { Object.assign(last, extra || {}); return pid; }
        nodes.push(Object.assign({ type: 'NodePoint', obj: pid }, extra || {}));
        return pid;
      }

      pc.edges.forEach(function (e) {
        var extraStart = {};
        if (e.name === 'center' && fold) extraStart.after = '0';
        if (e.bez) {
          e.bez.forEach(function (bz, i) {
            var p1 = pushPoint(bz[0], i === 0 ? extraStart : null);
            var p4 = point(tp(bz[3]), nm());
            var sid = spline(tb(bz), p1, p4);
            nodes.push({ type: 'NodeSpline', obj: sid });
            nodes.push({ type: 'NodePoint', obj: p4 });
          });
        } else {
          var pts = e.pts.slice();
          // 後片腰線：加入褶位兩點（剪口用）
          if (e.name === 'waist' && pc.dart && pts.length === 2) {
            var a = pts[0], b = pts[1];
            var feet = [pc.dart.l, pc.dart.r].sort(function (u, v) { return G.dist(a, u) - G.dist(a, v); });
            pts = [a, feet[0], feet[1], b];
          }
          var prevId = null;
          pts.forEach(function (p, i) {
            var isDart = pc.dart && e.name === 'waist' && (key(p) === key(pc.dart.l) || key(p) === key(pc.dart.r));
            var extra = i === 0 ? extraStart : {};
            if (isDart) extra = Object.assign({}, extra, { passmark: 'true', passmarkLine: 'one', passmarkAngle: 'straightforward' });
            var pid = pushPoint(p, extra);
            if (prevId && prevId !== pid) line(prevId, pid, 'hair');
            prevId = pid;
          });
        }
      });
      // 閉合：最後一點同第一點相同就刪走，並把設定合併
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (last.type === 'NodePoint' && last.obj === first.obj) {
        nodes.pop();
        if (last.after != null) first.after = last.after;
      }
      if (fold) first.before = '0'; // 中線（對摺）喺最後一段：終點 = 第一點

      // 夾圈剪口：放喺夾圈中間嗰點（前片 1 個、後片 2 個）
      var arm = pc.edges.filter(function (e) { return e.name === 'armhole'; })[0];
      var midId = pointIds[key(tp(arm.bez[0][3]))];
      nodes.forEach(function (nd) {
        if (nd.type === 'NodePoint' && nd.obj === midId) {
          nd.passmark = 'true'; nd.passmarkLine = pc.key === 'back' ? 'two' : 'one'; nd.passmarkAngle = 'straightforward';
        }
      });

      // 腰褶線、胸圍線、胸點
      if (pc.dart) {
        var dl = point(tp(pc.dart.l), nm()), da = point(tp(pc.dart.apex), nm()), dr = point(tp(pc.dart.r), nm());
        line(dl, da); line(da, dr);
      }
      var bl0 = point(tp(P(0, pc.yB)), nm());
      var bl1 = point(tp(P(pc.bustW, pc.yB)), nm());
      line(bl0, bl1, 'dashLine');
      if (pc.bp) point(tp(pc.bp), prefix + 'BP');

      // modeling 複本 + piece
      var detNodes = nodes.map(function (nd) {
        var mid = ++id;
        modeling.push(nd.type === 'NodeSpline'
          ? '<spline ' + attrs({ id: mid, idObject: nd.obj, inUse: 'true', type: 'modelingSpline' }) + '/>'
          : '<point ' + attrs({ id: mid, idObject: nd.obj, inUse: 'true', mx: 0.13, my: 0.26, type: 'modeling' }) + '/>');
        var o = { idObject: mid, type: nd.type };
        if (nd.type === 'NodeSpline') o.reverse = 0;
        ['before', 'after', 'passmark', 'passmarkLine', 'passmarkAngle'].forEach(function (k) { if (nd[k] != null) o[k] = nd[k]; });
        return '<node ' + attrs(o) + '/>';
      });

      var gx = pc.grainX, gy0 = pc.yB - 6, gy1 = pc.centerBot.y - 4;
      var gTop = tp(P(gx, gy0)), gBot = tp(P(gx, gy1));
      var lab = tp(P(pc.bustW * 0.3, pc.yB - 9));
      var did = ++id;
      details.push(
        '<detail ' + attrs({
          closed: 1, forbidFlipping: 'false', hideMainPath: 'false', id: did, inLayout: 'true', mx: 0, my: 0,
          name: title, seamAllowance: opt.sa > 0 ? 'true' : 'false', united: 'false', version: 2, width: n(opt.sa)
        }) + '>\n' +
        '  <data ' + attrs({
          annotation: '', fontSize: 0, height: 4, letter: letter, mx: n(lab.x * PX), my: n(lab.y * PX),
          onFold: fold ? 'true' : 'false', quantity: fold ? 1 : 2, rotation: 0, visible: 'true', width: 9
        }) + '>\n' +
        '    <line ' + attrs({ alignment: 4, bold: 'true', italic: 'false', sfIncrement: 2, text: title }) + '/>\n' +
        '    <line ' + attrs({ alignment: 4, bold: 'false', italic: 'false', sfIncrement: 0, text: fold ? 'Cut 1 on fold' : 'Cut 2' }) + '/>\n' +
        '  </data>\n' +
        '  <grainline ' + attrs({
          arrows: 0, length: n(G.dist(gTop, gBot)), mx: n(gBot.x * PX), my: n(gBot.y * PX), rotation: 90, visible: 'true'
        }) + '/>\n' +
        '  <nodes>\n    ' + detNodes.join('\n    ') + '\n  </nodes>\n' +
        '</detail>');
    }

    // 後片：後中喺 x=0；前片鏡像放喺右邊（側縫相對）
    var X0 = res.back.bustW + 8 + res.front.bustW;
    addPiece(res.back, function (p) { return P(p.x, p.y); }, 'B', 'Back', opt.cbFold, 'A');
    addPiece(res.front, function (p) { return P(X0 - p.x, p.y); }, 'F', 'Front', opt.cfFold, 'B');

    var ind = function (arr, sp) { return arr.map(function (s) { return sp + s.replace(/\n/g, '\n' + sp); }).join('\n'); };
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<pattern>\n' +
      '    <!--Pattern created with Pattern Maker (women\'s basic bodice block).-->\n' +
      '    <version>0.6.0</version>\n' +
      '    <unit>cm</unit>\n' +
      '    <description>' + esc(opt.description || '') + '</description>\n' +
      '    <notes/>\n' +
      '    <measurements/>\n' +
      '    <increments/>\n' +
      '    <draw name="Bodice">\n' +
      '        <calculation>\n' + ind(calc, '            ') + '\n        </calculation>\n' +
      '        <modeling>\n' + ind(modeling, '            ') + '\n        </modeling>\n' +
      '        <details>\n' + ind(details, '            ') + '\n        </details>\n' +
      '    </draw>\n' +
      '</pattern>\n';
  }

  PM.toSeamly = toSeamly;
})(typeof window !== 'undefined' ? window : globalThis);
