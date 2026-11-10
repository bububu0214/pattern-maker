/* SVG 輸出（畫面預覽同下載共用，1 單位 = 1 cm） */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});

  var STYLE = {
    CUT: { stroke: '#111', w: 0.05 },
    SEAM: { stroke: '#d0342c', w: 0.03 },
    DART: { stroke: '#111', w: 0.035 },
    GRAIN: { stroke: '#1f5fbf', w: 0.035 },
    NOTCH: { stroke: '#111', w: 0.045 },
    GUIDE: { stroke: '#888', w: 0.025 },
    DIM: { stroke: '#2e7d32', w: 0.02 },
    TEXT: { stroke: '#111', w: 0.02 },
    TEST: { stroke: '#111', w: 0.035 }
  };
  var LAYER_NAMES = {
    CUT: '裁剪線', SEAM: '縫線', DART: '腰褶', GRAIN: '布紋線/對摺', NOTCH: '剪口',
    GUIDE: '輔助線', DIM: '尺寸標示', TEXT: '文字', TEST: '測試方格'
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function n(v) { return (Math.round(v * 1000) / 1000).toString(); }

  function toSVG(model, opts) {
    opts = opts || {};
    var lang = opts.lang || 'zh';
    var W = model.width, H = model.height;
    var groups = {};
    model.entities.forEach(function (e) {
      var st = STYLE[e.layer] || STYLE.TEXT;
      var s;
      if (e.t === 'path') {
        var d = e.pts.map(function (p, i) { return (i ? 'L' : 'M') + n(p.x) + ' ' + n(p.y); }).join('') + (e.closed ? 'Z' : '');
        s = '<path d="' + d + '" fill="none" stroke="' + st.stroke + '" stroke-width="' + n(st.w * (opts.screen ? 1.8 : 1)) + '"' +
          (e.dash ? ' stroke-dasharray="' + e.dash.join(' ') + '"' : '') + ' stroke-linejoin="round" stroke-linecap="round"/>';
      } else {
        var fill = e.layer === 'DIM' ? '#2e7d32' : (e.layer === 'GRAIN' ? '#1f5fbf' : '#111');
        s = '<text x="' + n(e.x) + '" y="' + n(e.y) + '" font-size="' + n(e.size) + '" text-anchor="middle" dominant-baseline="middle"' +
          ' fill="' + fill + '"' + (e.size >= 1 ? ' font-weight="bold"' : '') +
          (e.angle ? ' transform="rotate(' + n(e.angle) + ' ' + n(e.x) + ' ' + n(e.y) + ')"' : '') + '>' + esc(lang === 'en' ? e.en : e.zh) + '</text>';
      }
      (groups[e.layer] = groups[e.layer] || []).push(s);
    });
    var body = Object.keys(groups).map(function (k) {
      return '<g id="' + k + '" inkscape:groupmode="layer" inkscape:label="' + k + ' ' + (LAYER_NAMES[k] || '') + '">' + groups[k].join('') + '</g>';
    }).join('\n');
    var size = opts.screen ? 'width="' + n(W * 10) + '" height="' + n(H * 10) + '"' :
      'width="' + n(W) + 'cm" height="' + n(H) + 'cm"';
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ' + size +
      ' viewBox="0 0 ' + n(W) + ' ' + n(H) + '" font-family="\'Noto Sans TC\',\'PingFang TC\',\'Microsoft JhengHei\',sans-serif">\n' +
      (opts.screen ? '' : '<rect width="100%" height="100%" fill="#fff"/>\n') +
      body + '\n</svg>\n';
  }

  PM.toSVG = toSVG;
})(typeof window !== 'undefined' ? window : globalThis);
