/* DXF（R12 ASCII）輸出：單位 mm，按圖層分開 */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});

  var COLORS = { CUT: 7, SEAM: 1, DART: 7, GRAIN: 5, NOTCH: 7, GUIDE: 8, DIM: 3, TEXT: 7, TEST: 7 };

  function toDXF(model) {
    var H = model.height * 10;
    var o = [];
    function w(code, val) { o.push(String(code), String(val)); }
    function X(p) { return (p.x * 10).toFixed(3); }
    function Y(p) { return (H - p.y * 10).toFixed(3); }

    w(0, 'SECTION'); w(2, 'HEADER');
    w(9, '$ACADVER'); w(1, 'AC1009');
    w(9, '$INSUNITS'); w(70, 4);
    w(9, '$MEASUREMENT'); w(70, 1);
    w(9, '$EXTMIN'); w(10, 0); w(20, 0); w(30, 0);
    w(9, '$EXTMAX'); w(10, (model.width * 10).toFixed(3)); w(20, H.toFixed(3)); w(30, 0);
    w(0, 'ENDSEC');

    var layers = Object.keys(COLORS);
    w(0, 'SECTION'); w(2, 'TABLES');
    w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 1);
    w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, 0.0);
    w(0, 'ENDTAB');
    w(0, 'TABLE'); w(2, 'LAYER'); w(70, layers.length);
    layers.forEach(function (l) { w(0, 'LAYER'); w(2, l); w(70, 0); w(62, COLORS[l]); w(6, 'CONTINUOUS'); });
    w(0, 'ENDTAB');
    w(0, 'ENDSEC');

    w(0, 'SECTION'); w(2, 'ENTITIES');
    model.entities.forEach(function (e) {
      if (e.t === 'path') {
        w(0, 'POLYLINE'); w(8, e.layer); w(66, 1); w(10, 0); w(20, 0); w(30, 0); w(70, e.closed ? 1 : 0);
        e.pts.forEach(function (p) { w(0, 'VERTEX'); w(8, e.layer); w(10, X(p)); w(20, Y(p)); w(30, 0); });
        w(0, 'SEQEND'); w(8, e.layer);
      } else {
        var p = { x: e.x, y: e.y };
        w(0, 'TEXT'); w(8, e.layer);
        w(10, X(p)); w(20, Y(p)); w(30, 0);
        w(40, (e.size * 10 * 0.75).toFixed(2));
        w(1, e.en);
        w(50, (-e.angle).toFixed(2));
        w(72, 4);
        w(11, X(p)); w(21, Y(p)); w(31, 0);
      }
    });
    w(0, 'ENDSEC');
    w(0, 'EOF');
    return o.join('\r\n') + '\r\n';
  }

  PM.toDXF = toDXF;
})(typeof window !== 'undefined' ? window : globalThis);
