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

    function addPiece(pc, T, prefix, title, letter) {
      var seq = 0;
      var nm = function () { return prefix + (++seq); };
      var nodes = []; // {type, obj, before, after, passmark...}

      function pushPoint(p) {
        var pid = point(T(p), nm());
        var last = nodes[nodes.length - 1];
        if (!(last && last.type === 'NodePoint' && last.obj === pid)) nodes.push({ type: 'NodePoint', obj: pid });
        return nodes.length - 1;
      }

      var ranges = {};
      pc.edges.forEach(function (e) {
        var startIdx;
        if (e.bez) {
          e.bez.forEach(function (bz, i) {
            var i1 = pushPoint(bz[0]);
            if (i === 0) startIdx = i1;
            var p4 = point(T(bz[3]), nm());
            var sid = spline(bz.map(T), nodes[i1].obj, p4);
            nodes.push({ type: 'NodeSpline', obj: sid });
            nodes.push({ type: 'NodePoint', obj: p4 });
          });
        } else {
          var prev = null;
          e.pts.forEach(function (p, i) {
            var idx = pushPoint(p);
            if (i === 0) startIdx = idx;
            var pid = nodes[idx].obj;
            if (prev && prev !== pid) line(prev, pid, 'hair');
            prev = pid;
          });
        }
        ranges[e.name] = [startIdx, nodes.length - 1];
      });

      // 對摺邊：縫份 0
      if (pc.fold && ranges[pc.fold]) {
        nodes[ranges[pc.fold][0]].after = '0';
        nodes[ranges[pc.fold][1]].before = '0';
      }
      // 閉合：最後一點同第一點相同就刪走，設定併入第一點
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (last.type === 'NodePoint' && last.obj === first.obj) {
        nodes.pop();
        ['before', 'after'].forEach(function (k) { if (last[k] != null) first[k] = last[k]; });
      }

      // 剪口
      pc.notches.forEach(function (nt) {
        var pid = pointIds[key(T(nt.p))];
        nodes.forEach(function (nd) {
          if (nd.type === 'NodePoint' && nd.obj === pid) {
            nd.passmark = 'true'; nd.passmarkLine = nt.count === 2 ? 'two' : 'one'; nd.passmarkAngle = 'straightforward';
          }
        });
      });

      // 褶、輔助線、記號
      pc.darts.forEach(function (d) {
        var ids = d.pts.map(function (p) { return point(T(p), nm()); });
        for (var i = 1; i < ids.length; i++) line(ids[i - 1], ids[i]);
        if (d.closed) line(ids[ids.length - 1], ids[0]);
      });
      pc.guides.forEach(function (gd) {
        var ids = gd.pts.map(function (p) { return point(T(p), nm()); });
        for (var i = 1; i < ids.length; i++) if (ids[i] !== ids[i - 1]) line(ids[i - 1], ids[i], 'dashLine');
      });
      pc.marks.forEach(function (mk) { point(T(mk.p), prefix + (mk.type === 'bp' ? 'BP' : 'Btn') + (++seq)); });

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

      var gTop = T(pc.grain[0]), gBot = T(pc.grain[1]);
      var lab = T(pc.label.p);
      var did = ++id;
      var cutTxt = pc.cut === 1 ? 'Cut 1 on fold' : 'Cut 2 (mirror pair)';
      details.push(
        '<detail ' + attrs({
          closed: 1, forbidFlipping: 'false', hideMainPath: 'false', id: did, inLayout: 'true', mx: 0, my: 0,
          name: title, seamAllowance: opt.sa > 0 ? 'true' : 'false', united: 'false', version: 2, width: n(opt.sa)
        }) + '>\n' +
        '  <data ' + attrs({
          annotation: '', fontSize: 0, height: 4, letter: letter, mx: n((lab.x - 4.5) * PX), my: n(lab.y * PX),
          onFold: pc.fold ? 'true' : 'false', quantity: pc.cut, rotation: 0, visible: 'true', width: 9
        }) + '>\n' +
        '    <line ' + attrs({ alignment: 4, bold: 'true', italic: 'false', sfIncrement: 2, text: title }) + '/>\n' +
        '    <line ' + attrs({ alignment: 4, bold: 'false', italic: 'false', sfIncrement: 0, text: cutTxt }) + '/>\n' +
        '  </data>\n' +
        '  <grainline ' + attrs({
          arrows: 0, length: n(G.dist(gTop, gBot)), mx: n(gBot.x * PX), my: n(gBot.y * PX), rotation: 90, visible: 'true'
        }) + '/>\n' +
        '  <nodes>\n    ' + detNodes.join('\n    ') + '\n  </nodes>\n' +
        '</detail>');
    }

    // 由左至右排：後片、前片（鏡像，側縫相對）、袖
    var cursor = 0;
    var titles = { back: ['Back', 'A', 'B'], front: ['Front', 'B', 'F'], sleeve: ['Sleeve', 'C', 'S'] };
    res.pieces.forEach(function (pc) {
      var m = pc.mirror ? -1 : 1;
      var all = [];
      pc.edges.forEach(function (e) { all = all.concat(e.pts); });
      var xs = all.map(function (p) { return m * p.x; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var dx = cursor - x0;
      var t = titles[pc.key];
      addPiece(pc, function (p) { return P(m * p.x + dx, p.y); }, t[2], t[0], t[1]);
      cursor += (x1 - x0) + 8;
    });

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
