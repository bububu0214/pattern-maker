/*
 * 睇相快選：唔使 AI，睇住張相逐項撳圖示揀款式
 */
(function () {
  'use strict';
  var form = document.getElementById('form');
  var box = document.getElementById('quickPick');
  if (!form || !box || !window.PMApp) return;
  var App = window.PMApp;

  /* ---------- 小圖示（40×40） ---------- */
  var S = 'fill="none" stroke="#5a3a28" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
  function svg(inner) { return '<svg viewBox="0 0 40 40">' + inner + '</svg>'; }
  function p(d, extra) { return '<path d="' + d + '" ' + S + (extra || '') + '/>'; }
  var TEE = 'M14 6 L10 8 L4 14 L8 18 L12 15 L12 33 L28 33 L28 15 L32 18 L36 14 L30 8 L26 6';
  function tee(neck, bottom, sleeve) {
    var b = bottom || 33;
    var sl = sleeve || 'short';
    var L = { none: 'M14 6 L12 7 L12 ' + b, short: 'M14 6 L10 8 L4 14 L8 18 L12 15 L12 ' + b,
      elbow: 'M14 6 L10 8 L3 22 L7 24 L12 15 L12 ' + b, long: 'M14 6 L10 8 L4 33 L8 34 L12 16 L12 ' + b }[sl];
    var R = { none: 'M26 6 L28 7 L28 ' + b, short: 'M26 6 L30 8 L36 14 L32 18 L28 15 L28 ' + b,
      elbow: 'M26 6 L30 8 L37 22 L33 24 L28 15 L28 ' + b, long: 'M26 6 L30 8 L36 33 L32 34 L28 16 L28 ' + b }[sl];
    return p(L) + p(R) + p('M12 ' + b + ' L28 ' + b) + p(neck || 'M14 6 Q20 11 26 6');
  }
  var NECK = {
    round: 'M14 6 Q20 12 26 6', v: 'M14 6 L20 17 L26 6', square: 'M14 6 L14 12 L26 12 L26 6', boat: 'M12 7 Q20 9 28 7'
  };
  var ICON = {
    top: svg(tee()),
    skirt: svg(p('M14 7 L26 7 L32 34 L8 34 Z') + p('M14 10 L26 10')),
    trousers: svg(p('M12 6 L28 6 L30 34 L22 34 L20 15 L18 34 L10 34 Z') + p('M12 9 L28 9')),
    dress: svg(p('M15 5 L13 6 L13 16 L8 35 L32 35 L27 16 L27 6 L25 5 Q20 10 15 5') + p('M13 16 L27 16')),
    jacket: svg(tee('M14 6 L17 13 L20 25 L23 13 L26 6', 34, 'long') + p('M17 13 L15 14 M23 13 L25 14')),
    neck: function (k) { return svg(p('M4 12 L14 6') + p('M26 6 L36 12') + p('M8 11 L8 34 M32 11 L32 34') + p(NECK[k])); },
    depth: function (d) { return svg(p('M4 12 L14 6') + p('M26 6 L36 12') + p('M8 11 L8 34 M32 11 L32 34') + p('M14 6 Q20 ' + (8 + d) + ' 26 6')); },
    collar: function (k) {
      var base = p('M4 12 L14 6') + p('M26 6 L36 12') + p('M8 11 L8 34 M32 11 L32 34');
      var c = {
        none: p(NECK.round),
        peterpan: p('M14 6 C11 14 18 16 20 12 C22 16 29 14 26 6') + p('M14 6 Q20 9 26 6'),
        mandarin: p('M14 3 L14 7 Q20 10 26 7 L26 3 Q20 6 14 3 Z'),
        shirt: p('M14 5 L15 14 L20 10 L25 14 L26 5') + p('M14 5 Q20 8 26 5') + p('M20 10 L20 34', ' stroke-dasharray="1.5 2"'),
        convertible: p('M14 5 L12 14 L20 18 L28 14 L26 5') + p('M14 5 Q20 8 26 5'),
        notched: p('M14 5 L11 13 L14 14 L20 27 L26 14 L29 13 L26 5') + p('M14 5 Q20 8 26 5')
      }[k];
      return svg(base + c);
    },
    sleeve: function (k) { return svg(tee(null, 33, k)); },
    sleeveStyle: function (k) {
      var b = tee(null, 33, 'long');
      var x = {
        normal: '',
        puff: p('M10 8 Q6 3 4 12') + p('M30 8 Q34 3 36 12'),
        lantern: p('M6 22 Q0 28 5 33') + p('M34 22 Q40 28 35 33'),
        cuff: p('M3.5 30 L8.5 31 M31.5 31 L36.5 30', ' stroke-width="3"')
      }[k];
      return svg(b + x);
    },
    length: function (b) { return svg(tee(null, b, 'short')); },
    fit: function (k) {
      var side = { fitted: 'M12 15 Q16 24 12 33 M28 15 Q24 24 28 33', regular: 'M12 15 Q14 24 12 33 M28 15 Q26 24 28 33', loose: 'M11 15 L9 33 M29 15 L31 33' }[k];
      return svg(p('M14 6 L10 8 L4 14 L8 18 L12 15') + p('M26 6 L30 8 L36 14 L32 18 L28 15') + p(side) +
        p(k === 'loose' ? 'M9 33 L31 33' : 'M12 33 L28 33') + p(NECK.round));
    },
    opening: function (on) { return svg(tee() + (on ? p('M20 9 L20 33') + '<circle cx="21.5" cy="14" r="1" fill="#5a3a28"/><circle cx="21.5" cy="20" r="1" fill="#5a3a28"/><circle cx="21.5" cy="26" r="1" fill="#5a3a28"/>' : '')); },
    detail: function (k) {
      var x = {
        pocket: p('M22 16 L27 16 L27 22 L22 22 Z'),
        yoke: p('M12 12 L28 12'),
        princess: p('M16 7 Q17 20 16 33 M24 7 Q23 20 24 33'),
        ruffle: p('M11 33 Q13 37 15 33 Q17 37 19 33 Q21 37 23 33 Q25 37 27 33 Q29 37 31 33')
      }[k];
      return svg(tee() + x);
    },
    skirtShape: function (k) {
      var d = {
        straight: p('M13 6 L27 6 L28 34 L12 34 Z'),
        pencil: p('M13 6 L27 6 L29 18 L25 34 L15 34 L11 18 Z'),
        aline: p('M14 6 L26 6 L32 34 L8 34 Z'),
        gathered: p('M14 6 L26 6 L33 34 L7 34 Z') + p('M15 8 L14 12 M18 8 L17.5 12 M22 8 L22.5 12 M25 8 L26 12'),
        pleated: p('M12 6 L28 6 L31 34 L9 34 Z') + p('M16 7 L15 34 M20 7 L20 34 M24 7 L25 34'),
        halfcircle: p('M15 6 L25 6 Q34 20 36 34 Q20 37 4 34 Q6 20 15 6 Z'),
        circle: p('M16 6 L24 6 Q38 18 39 33 Q20 38 1 33 Q2 18 16 6 Z')
      }[k];
      return svg(d + p('M14 9 L26 9'));
    },
    skirtLen: function (b) { return svg(p('M14 4 L26 4 L' + (26 + (b - 4) * 0.2) + ' ' + b + ' L' + (14 - (b - 4) * 0.2) + ' ' + b + ' Z') + '<line x1="2" y1="22" x2="38" y2="22" stroke="#bbb" stroke-dasharray="2 2"/>'); },
    closure: function (k) {
      var base = p('M13 9 L27 9 L30 34 L10 34 Z');
      var band = {
        back: p('M13 5 L27 5 L27 9 L13 9 Z') + p('M20 9 L20 18', ' stroke-dasharray="1.2 1.2"'),
        side: p('M13 5 L27 5 L27 9 L13 9 Z') + p('M27 9 L28 18', ' stroke-dasharray="1.2 1.2"'),
        halfElastic: p('M13 5 L20 5 L20 9 L13 9 Z') + p('M20 6 Q21.5 4.5 23 6 Q24.5 7.5 26 6 Q27 5 27 6 M20 8.5 L27 8.5'),
        elastic: p('M13 6 Q14.5 4.5 16 6 Q17.5 7.5 19 6 Q20.5 4.5 22 6 Q23.5 7.5 25 6 Q26 5 27 6 M13 8.5 L27 8.5')
      }[k];
      return svg(base + band);
    },
    slit: function (k) {
      var base = p('M13 6 L27 6 L28 34 L12 34 Z');
      var x = { none: '', back: p('M20 34 L20 27', ' stroke-dasharray="1.2 1.2"'), front: p('M20 34 L20 26'), side: p('M27.6 34 L27.3 27') }[k];
      return svg(base + x);
    },
    trouser: function (k) {
      var d = {
        straight: 'M12 6 L28 6 L29 34 L22 34 L20 15 L18 34 L11 34 Z',
        slim: 'M12 6 L28 6 L26 34 L22 34 L20 15 L18 34 L14 34 Z',
        wide: 'M12 6 L28 6 L33 34 L22 34 L20 15 L18 34 L7 34 Z'
      }[k];
      return svg(p(d) + p('M12 9 L28 9'));
    },
    trouserLen: function (b) { return svg(p('M12 4 L28 4 L29 ' + b + ' L22 ' + b + ' L20 13 L18 ' + b + ' L11 ' + b + ' Z')); },
    trouserWaist: function (k) {
      var base = p('M12 9 L28 9 L29 34 L22 34 L20 17 L18 34 L11 34 Z');
      var x = { zip: p('M12 5 L28 5 L28 9 L12 9 Z') + p('M20 9 L20 16', ' stroke-dasharray="1.2 1.2"'), side: p('M12 5 L28 5 L28 9 L12 9 Z') + p('M28 9 L28.5 16', ' stroke-dasharray="1.2 1.2"'),
        elastic: p('M12 6 Q14 4.5 16 6 Q18 7.5 20 6 Q22 4.5 24 6 Q26 7.5 28 6 M12 8.5 L28 8.5') }[k];
      return svg(base + x);
    }
  };

  /* ---------- 工具 ---------- */
  function el(name) { return form.elements[name]; }
  function val(name) { var e = el(name); return e.type === 'checkbox' ? e.checked : e.value; }
  function set(name, v, fire) {
    var e = el(name);
    if (e.type === 'checkbox') e.checked = !!v; else e.value = v;
    if (fire) e.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function num(name) { return parseFloat(el(name).value) || 0; }

  /* ---------- 選項 ---------- */
  function groups() {
    var g = val('garment');
    var out = [{
      title: '① 衣物種類', items: [
        ['上衣', ICON.top, function () { set('garment', 'top', true); }, g === 'top'],
        ['半截裙', ICON.skirt, function () { set('garment', 'skirt', true); }, g === 'skirt'],
        ['褲', ICON.trousers, function () { set('garment', 'trousers', true); }, g === 'trousers'],
        ['連身裙', ICON.dress, function () { set('garment', 'dress', true); }, g === 'dress'],
        ['外套', ICON.jacket, function () { set('garment', 'jacket', true); }, g === 'jacket']
      ]
    }];
    var topLike = g === 'top' || g === 'dress' || g === 'jacket';
    if (topLike) {
      var nl = val('neckline'), dF = num('neckDropF');
      var dropCollar = function () { if (['mandarin', 'shirt', 'convertible', 'notched'].indexOf(val('collar')) >= 0) set('collar', 'none', true); };
      out.push({ title: '領口', items: [
        ['圓領', ICON.neck('round'), function () { set('neckline', 'round'); if (dF > 6) set('neckDropF', 2.5); set('neckWiden', 0); }, nl === 'round'],
        ['V 領', ICON.neck('v'), function () { dropCollar(); set('neckline', 'v'); if (dF < 6) set('neckDropF', 8); }, nl === 'v'],
        ['方領', ICON.neck('square'), function () { dropCollar(); set('neckline', 'square'); if (dF < 4) set('neckDropF', 6); set('neckWiden', 2); }, nl === 'square'],
        ['一字領', ICON.neck('boat'), function () { dropCollar(); set('neckline', 'boat'); set('neckWiden', 5); set('neckDropF', -2); set('neckDropB', 1); }, nl === 'boat']
      ] });
      if (nl === 'round' || nl === 'v' || nl === 'square') {
        var depths = nl === 'round' ? [0, 2.5, 6, 12] : nl === 'v' ? [6, 9, 12, 16] : [4, 6, 9, 12];
        out.push({ title: '領口深淺', items: ['高', '中', '低', '深'].map(function (t, i) {
          return [t, ICON.depth([1, 4, 8, 13][i]), function () { set('neckDropF', depths[i]); }, Math.abs(dF - depths[i]) < 0.6];
        }) });
      }
      var col = val('collar');
      out.push({ title: '衣領', items: [
        ['無', ICON.collar('none'), function () { set('collar', 'none', true); }, col === 'none'],
        ['彼得潘', ICON.collar('peterpan'), function () { set('collar', 'peterpan', true); }, col === 'peterpan'],
        ['企領', ICON.collar('mandarin'), function () { set('collar', 'mandarin', true); set('neckline', 'round'); set('neckDropF', 0); }, col === 'mandarin'],
        ['恤衫領', ICON.collar('shirt'), function () { set('collar', 'shirt', true); set('neckline', 'round'); set('neckDropF', 0); }, col === 'shirt'],
        ['翻領', ICON.collar('convertible'), function () { set('collar', 'convertible', true); set('neckline', 'round'); set('neckDropF', 0); }, col === 'convertible'],
        ['西裝領', ICON.collar('notched'), function () { set('collar', 'notched', true); set('neckline', 'round'); set('neckDropF', 0); }, col === 'notched']
      ] });
      var sl = val('sleeve');
      out.push({ title: '袖長', items: [['無袖', 'none'], ['短袖', 'short'], ['七分袖', 'elbow'], ['長袖', 'long']].map(function (o) {
        return [o[0], ICON.sleeve(o[1]), function () { set('sleeve', o[1], true); }, sl === o[1]];
      }) });
      if (sl !== 'none') {
        var puff = num('sleevePuff'), gat = num('sleeveGather'), cuff = val('cuff');
        var styleNow = puff > 0 && gat > 0 ? 'lantern' : puff > 0 ? 'puff' : cuff === 'band' ? 'cuff' : 'normal';
        var styles = [['普通', 'normal'], ['泡泡袖', 'puff'], ['燈籠袖', 'lantern']];
        if (sl === 'long' || sl === 'elbow') styles.push(['袖頭', 'cuff']);
        out.push({ title: '袖款', items: styles.map(function (o) {
          return [o[0], ICON.sleeveStyle(o[1]), function () {
            set('sleevePuff', o[1] === 'puff' || o[1] === 'lantern' ? 5 : 0);
            set('sleeveGather', o[1] === 'lantern' ? 8 : 0);
            set('cuff', o[1] === 'cuff' ? 'band' : 'none', true);
          }, styleNow === o[1]];
        }) });
      }
      if (g !== 'dress') {
        var lp = val('lengthPreset');
        out.push({ title: '衫長', items: [['短身', 'cropped', 24], ['及腰', 'waist', 28], ['及臀', 'hip', 33], ['長身', 'tunic', 37]].map(function (o) {
          return [o[0], ICON.length(o[2]), function () { set('lengthPreset', o[1], true); }, lp === o[1]];
        }) });
      }
      var fit = val('fit');
      out.push({ title: '鬆緊度', items: [['修身', 'fitted'], ['合身', 'regular'], ['寬鬆', 'loose']].concat(g === 'jacket' ? [['外套', 'jacket']] : []).map(function (o) {
        return [o[0], ICON.fit(o[1] === 'jacket' ? 'regular' : o[1]), function () { set('fit', o[1], true); }, fit === o[1]];
      }) });
      var op = val('opening');
      out.push({ title: '前中', items: [
        ['唔開胸', ICON.opening(false), function () { set('opening', false, true); }, !op],
        ['開胸＋鈕', ICON.opening(true), function () { set('opening', true, true); }, op]
      ] });
      out.push({ title: '細節（可以揀幾樣）', items: [
        ['胸前袋', ICON.detail('pocket'), function () { set('pocket', val('pocket') === 'none' ? 'left' : 'none'); }, val('pocket') !== 'none'],
        ['後育克', ICON.detail('yoke'), function () { set('yoke', val('yoke') === 'none' ? 'back' : 'none', true); }, val('yoke') !== 'none'],
        ['公主線', ICON.detail('princess'), function () { set('princess', !val('princess')); }, val('princess')],
        ['荷葉邊', ICON.detail('ruffle'), function () { set('ruffle', val('ruffle') === 'none' ? 'hem' : 'none', true); }, val('ruffle') !== 'none']
      ] });
    }
    if (g === 'dress') {
      var dt = val('dressType');
      out.push({ title: '連身裙款', items: [
        ['有腰線', ICON.dress, function () { set('dressType', 'waist'); }, dt === 'waist'],
        ['無腰線', svg(p('M15 5 L13 6 L11 35 L29 35 L27 6 L25 5 Q20 10 15 5')), function () { set('dressType', 'shift'); }, dt === 'shift']
      ] });
    }
    if (g === 'skirt' || g === 'dress') {
      var ss = val('skirtShape');
      out.push({ title: '裙型', items: [['直身', 'straight'], ['窄身', 'pencil'], ['A 字', 'aline'], ['碎褶', 'gathered'], ['百褶', 'pleated'], ['半圓', 'halfcircle'], ['全圓', 'circle']].map(function (o) {
        return [o[0], ICON.skirtShape(o[1]), function () { set('skirtShape', o[1], true); }, ss === o[1]];
      }) });
      var sp = val('skirtLenPreset');
      out.push({ title: '裙長', items: [['短裙', 'mini', 16], ['及膝', 'knee', 24], ['中長', 'midi', 30], ['長裙', 'long', 37]].map(function (o) {
        return [o[0], ICON.skirtLen(o[2]), function () { set('skirtLenPreset', o[1], true); }, sp === o[1]];
      }) });
      var z = val('zip');
      var cl = [['後中拉鏈', 'back'], ['側拉鏈', 'side']];
      if (g === 'skirt') cl.push(['前平後橡筋', 'halfElastic'], ['全橡筋', 'elastic']);
      out.push({ title: '腰／開口', items: cl.map(function (o) {
        return [o[0], ICON.closure(o[1]), function () { set('zip', o[1], true); }, z === o[1]];
      }) });
      var st = val('slit');
      out.push({ title: '開衩', items: [['無', 'none'], ['後中', 'back'], ['前中', 'front'], ['側邊', 'side']].map(function (o) {
        return [o[0], ICON.slit(o[1]), function () { set('slit', o[1], true); }, st === o[1]];
      }) });
    }
    if (g === 'trousers') {
      var ts = val('trouserShape'), tl = val('trouserLenPreset'), tw = val('trouserWaist');
      out.push({ title: '褲型', items: [['直腳', 'straight'], ['窄腳', 'slim'], ['闊腳', 'wide']].map(function (o) {
        return [o[0], ICON.trouser(o[1]), function () { set('trouserShape', o[1], true); }, ts === o[1]];
      }) });
      out.push({ title: '褲長', items: [['短褲', 'shorts', 16], ['七分', 'capri', 25], ['九分', 'ankle', 31], ['長褲', 'full', 36]].map(function (o) {
        return [o[0], ICON.trouserLen(o[2]), function () { set('trouserLenPreset', o[1], true); }, tl === o[1]];
      }) });
      out.push({ title: '腰', items: [['前拉鏈', 'zip'], ['側拉鏈', 'side'], ['鬆緊帶', 'elastic']].map(function (o) {
        return [o[0], ICON.trouserWaist(o[1]), function () { set('trouserWaist', o[1], true); }, tw === o[1]];
      }) });
    }
    return out;
  }

  function render() {
    var gs = groups();
    var prev = box.querySelector('details');
    var open = prev ? prev.open : true;
    var html = '<details' + (open ? ' open' : '') + '><summary><b>睇相快選（唔使 AI）</b>：撳開／收起</summary>' +
      '<p class="sub">睇住張相，逐項撳最似嘅圖示，下面嘅紙樣會即刻更新。</p>';
    gs.forEach(function (gr, gi) {
      html += '<h4>' + gr.title + '</h4><div class="row">';
      gr.items.forEach(function (it, ii) {
        html += '<button type="button" class="chip' + (it[3] ? ' on' : '') + '" data-g="' + gi + '" data-i="' + ii + '">' + it[1] + '<span>' + it[0] + '</span></button>';
      });
      html += '</div>';
    });
    html += '</details>';
    box.innerHTML = html;
    box._groups = gs;
  }

  box.addEventListener('click', function (e) {
    var b = e.target.closest('button.chip');
    if (!b || !box._groups) return;
    var it = box._groups[+b.dataset.g].items[+b.dataset.i];
    it[2]();
    App.syncControls();
    App.generate();
    render();
  });
  // 其他地方改咗表單（例如打字要求、AI）都更新快選
  form.addEventListener('change', function () { setTimeout(render, 0); });
  var ob = new MutationObserver(function () { setTimeout(render, 0); });
  var ai = document.getElementById('aiResult');
  if (ai) ob.observe(ai, { childList: true });
  render();
})();
