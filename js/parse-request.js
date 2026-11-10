/*
 * 唔使 AI 嘅文字要求讀取
 * 認常用字眼（廣東話／書面語，繁簡都得），轉做款式設定。
 *
 * PM.parseRequest(text, cur) → { set: {欄位: 值}, done: [已明白], cannot: [做唔到], unknown: [唔明] }
 *   cur：而家嘅表單數值（用嚟計「長啲」「大少少」）
 */
(function (g) {
  'use strict';
  var PM = (g.PM = g.PM || {});

  // 繁簡通用
  var VARIANTS = {
    '領': '领', '長': '长', '闊': '阔', '寬': '宽', '鬆': '松', '無': '无', '鈕': '钮', '腳': '脚', '邊': '边',
    '後': '后', '頭': '头', '擺': '摆', '開': '开', '貼': '贴', '門': '门', '兩': '两', '總': '总', '緊': '紧',
    '線': '线', '圓': '圆', '單': '单', '雙': '双', '對': '对', '稱': '称', '鏈': '链', '褶': '褶', '鬚': '须',
    '裡': '里', '連': '连', '時': '时', '來': '来', '個': '个', '襯': '衬', '帶': '带', '飾': '饰', '蘇': '苏',
    '條': '条', '腰': '腰', '臀': '臀', '屁': '屁', '膝': '膝', '髀': '髀', '靚': '靓', '橫': '横', '駁': '驳'
  };
  function Z(src, flags) {
    var out = '';
    for (var i = 0; i < src.length; i++) {
      var c = src[i], v = VARIANTS[c];
      out += v && v !== c ? '(?:' + c + '|' + v + ')' : c;
    }
    return new RegExp(out, flags || 'gi');
  }

  var NUM = '(\\d+(?:\\.\\d+)?)\\s*(?:cm|厘米|釐米|公分)?';
  var MORE = '(?:啲|D|多啲|多少少|少少|一啲|一點|些|點)';
  var NEG = '(?:唔要|不要|冇|無|没有|去咗|去掉|拎走|取消|唔使|不用|免)';

  var FIT_EASE = {
    fitted: { easeBust: 6, easeWaist: 4, easeHip: 4 },
    regular: { easeBust: 10, easeWaist: 12, easeHip: 8 },
    loose: { easeBust: 16, easeWaist: 16, easeHip: 12 }
  };
  var FIT_ORDER = ['fitted', 'regular', 'loose'];
  var FIT_ZH = { fitted: '修身', regular: '合身', loose: '寬鬆' };
  var SLEEVE_ZH = { none: '無袖', short: '短袖', elbow: '七分袖', long: '長袖' };

  // 做唔到嘅設計
  var CANNOT = [
    ['育克|膊頭拼|上背橫駁|背駁', '育克（上背橫駁）'], ['碎褶|打褶|皺褶|抽褶', '碎褶'], ['泡泡袖|燈籠袖|蓬蓬袖', '泡泡袖'],
    ['荷葉', '荷葉邊'], ['公主線', '公主線'], ['不對稱|唔對稱', '不對稱設計'], ['交叉|包身|綁帶|綁帶', '交叉／綁帶設計'],
    ['袋蓋', '袋蓋'], ['側袋|插袋|褲袋', '側袋'], ['蝴蝶結', '蝴蝶結'], ['流蘇|毛邊', '流蘇／毛邊'],
    ['恤衫領|襯衫領|翻領|企領|立領|中式領|唐裝領|西裝領|水手領|海軍領|大翻領', '呢款衣領'], ['連帽|帽', '帽'],
    ['拉鏈|zip', '拉鏈（可以用前中開胸加鈕代替）'], ['開叉|開衩|叉位', '下擺開叉'], ['腰帶|腰頭', '腰帶'], ['蕾絲|花邊', '花邊']
  ];

  function parseRequest(text, cur) {
    var src = String(text || '');
    var c = Object.assign({}, cur);           // 工作副本（相對改動會累積）
    var set = {}, done = [], cannot = [], neg = {};
    var used = new Array(src.length);

    function put(k, v) { set[k] = v; c[k] = v; }
    function mark(m) { for (var i = m.index; i < m.index + m[0].length; i++) used[i] = true; }
    function each(re, fn) {
      var r = Z(re), m;
      while ((m = r.exec(src)) !== null) { if (!m[0]) { r.lastIndex++; continue; } mark(m); fn(m); }
    }
    function num(s) { return s == null ? null : parseFloat(s); }
    function round(v) { return Math.round(v * 2) / 2; }
    var aline = false, fitSet = false;
    function setFit(f) { fitSet = true; put('fit', f); var e = FIT_EASE[f]; Object.keys(e).forEach(function (k) { put(k, e[k]); }); }
    function sleeveDefault(t) {
      return { none: 0, short: 20, elbow: Math.round((c.armLen || 56) * 0.75), long: c.armLen || 56 }[t];
    }

    /* ---- 做唔到 ---- */
    CANNOT.forEach(function (it) { each(it[0], function () { if (cannot.indexOf(it[1]) < 0) cannot.push(it[1]); }); });

    /* ---- 否定（「唔要 XX」）---- */
    each(NEG + '\\s*(?:左|右|兩邊|兩個|胸前|胸)?\\s*(?:口袋|貼袋|胸袋|袋)', function () { neg.pocket = true; put('pocket', 'none'); done.push('唔要口袋'); });
    each(NEG + '\\s*(?:衣領|領)(?!口)', function () { neg.collar = true; put('collar', 'none'); done.push('唔要衣領'); });
    each(NEG + '\\s*(?:開胸|開襟|門襟|鈕扣|鈕)', function () { neg.opening = true; put('opening', false); done.push('唔要前中開胸'); });
    each(NEG + '\\s*貼邊', function () { neg.facing = true; put('facing', false); done.push('唔要貼邊'); });
    each(NEG + '\\s*袖頭', function () { neg.cuff = true; put('cuff', 'none'); done.push('唔要袖頭'); });
    each(NEG + '\\s*(?:A\\s*字|A-?line)', function () { neg.aline = true; put('hemShape', 'straight'); done.push('直腳下擺'); });
    each('(?:' + NEG + '\\s*袖(?!頭|長|口)|無袖|冇袖|背心|sleeveless)', function () {
      neg.sleeve = true; put('sleeve', 'none'); put('sleeveLen', 0); done.push('無袖');
    });

    /* ---- 領口 ---- */
    each('V\\s*字?\\s*領|v\\s*neck', function () { put('neckline', 'v'); if (c.neckDropF < 6) put('neckDropF', 6); done.push('V 領'); });
    each('方領|square\\s*neck', function () { put('neckline', 'square'); if (c.neckDropF < 4) put('neckDropF', 4); done.push('方領'); });
    each('一字領|船領|船型領|boat\\s*neck', function () {
      put('neckline', 'boat'); if (c.neckWiden < 4) put('neckWiden', 4); if (c.neckDropF > -2) put('neckDropF', -2); done.push('一字領');
    });
    each('(?<!小)圓領|round\\s*neck', function () { put('neckline', 'round'); done.push('圓領'); });
    // 領口闊度
    each('領(?:口(?:開|加|再)?|開|加)\\s*(?:闊|寬|大)' + MORE + '?\\s*(?:' + NUM + ')?', function (m) {
      var n = num(m[1]);
      put('neckWiden', round(n != null ? n : (c.neckWiden || 0) + 1.5)); done.push('領口加闊 ' + c.neckWiden + ' cm');
    });
    each('領口?\\s*(?:收|細|窄|小)' + MORE + '?', function () {
      put('neckWiden', round(Math.max(0, (c.neckWiden || 0) - 1.5))); done.push('領口收細（加闊 ' + c.neckWiden + ' cm）');
    });
    // 領深
    each('後領口?\\s*(?:開|挖|再)?\\s*(?:深|低)' + MORE + '?\\s*(?:' + NUM + ')?', function (m) {
      var n = num(m[1]);
      put('neckDropB', round(n != null ? n : (c.neckDropB || 0) + 2)); done.push('後領加深 ' + c.neckDropB + ' cm');
    });
    each('(?<!後)(?:前)?領口?\\s*(?:開|挖|再)?\\s*(?:深|低)' + MORE + '?\\s*(?:' + NUM + ')?', function (m) {
      var n = num(m[1]);
      put('neckDropF', round(n != null ? n : (c.neckDropF || 0) + 3)); done.push('前領加深 ' + c.neckDropF + ' cm');
    });
    each('領口?\\s*(?:高|淺)' + MORE, function () {
      put('neckDropF', round((c.neckDropF || 0) - 2)); done.push('前領升高（加深 ' + c.neckDropF + ' cm）');
    });

    /* ---- 衣領 ---- */
    if (!neg.collar) {
      each('彼得潘|娃娃領|圓角領|peter\\s*pan', function () {
        put('collar', 'peterpan');
        if (c.neckline === 'v' || c.neckline === 'square') { put('neckline', 'round'); put('neckDropF', 0); }
        done.push('彼得潘圓領');
      });
    }
    each('(?:衣)?領(?!口)\\s*(?:嘅)?\\s*(?:闊|寬)\\s*(?:度)?\\s*' + NUM, function (m) {
      put('collarW', round(num(m[1]))); if (!neg.collar && c.collar === 'none') put('collar', 'peterpan');
      done.push('領闊 ' + c.collarW + ' cm');
    });

    /* ---- 袖 ---- */
    if (!neg.sleeve) {
      each('短袖|short\\s*sleeve', function () { put('sleeve', 'short'); put('sleeveLen', sleeveDefault('short')); done.push('短袖'); });
      each('(?:七分|五分|中)袖|3/4', function () { put('sleeve', 'elbow'); put('sleeveLen', sleeveDefault('elbow')); done.push('七分袖'); });
      each('長袖|long\\s*sleeve', function () { put('sleeve', 'long'); put('sleeveLen', sleeveDefault('long')); done.push('長袖'); });
      each('袖長\\s*' + NUM, function (m) {
        var n = num(m[1]); put('sleeveLen', round(n));
        if (c.sleeve === 'none') put('sleeve', n < 30 ? 'short' : n < 45 ? 'elbow' : 'long');
        done.push('袖長 ' + c.sleeveLen + ' cm');
      });
      each('袖(?:長' + MORE + '|再長)', function () {
        if (c.sleeve === 'none') { cannot.push('袖長啲（而家係無袖，請講明短袖／七分袖／長袖）'); return; }
        put('sleeveLen', round((c.sleeveLen || 0) + 5)); done.push('袖長加長至 ' + c.sleeveLen + ' cm');
      });
      each('袖(?:短' + MORE + '?|再短)', function () {
        if (c.sleeve === 'none') { cannot.push('袖短啲（而家係無袖）'); return; }
        put('sleeveLen', round(Math.max(8, (c.sleeveLen || 0) - 5))); done.push('袖長縮短至 ' + c.sleeveLen + ' cm');
      });
    }

    /* ---- 袖頭 ---- */
    if (!neg.cuff) {
      each('袖頭\\s*(?:闊|寬|高)\\s*' + NUM, function (m) { put('cuffH', round(num(m[1]))); put('cuff', 'band'); done.push('袖頭闊 ' + c.cuffH + ' cm'); });
      each('袖頭(?!\\s*(?:闊|寬|高))|袖口收褶|恤衫袖口|cuff', function () { put('cuff', 'band'); done.push('袖頭'); });
    }

    /* ---- 衫長 ---- */
    each('腰(?:線)?(?:以)?下\\s*' + NUM, function (m) {
      put('hemLen', round(num(m[1]))); put('lengthPreset', 'custom'); done.push('腰下 ' + c.hemLen + ' cm');
    });
    each('腰(?:線)?(?:以)?上\\s*' + NUM, function (m) {
      put('hemLen', -round(num(m[1]))); put('lengthPreset', 'custom'); done.push('腰上 ' + (-c.hemLen) + ' cm');
    });
    each('(?<!袖|腰下|腰上)(?:衫|總|全|成件|衣|身)?長(?:度)?\\s*(?:係|為|=|:|：)?\\s*' + NUM, function (m) {
      var t = num(m[1]);
      put('hemLen', round(t - c.backLen)); put('lengthPreset', 'custom');
      done.push('衫總長 ' + t + ' cm（腰下 ' + c.hemLen + ' cm）');
    });
    [['短身|露腰|crop', 'cropped', -6, '短身'], ['及腰|到腰', 'waist', 0, '及腰'],
      ['及臀|到臀|蓋臀|蓋屁股', 'hip', (c.waistToHip || 18) + 2, '及臀'],
      ['長身|到大髀|大髀', 'tunic', (c.waistToHip || 18) + 18, '長身'], ['連身裙|裙長|及膝', 'dress', 58, '連身裙長']
    ].forEach(function (L) {
      each(L[0], function () { put('lengthPreset', L[1]); put('hemLen', L[2]); done.push(L[3]); });
    });
    each('(?<!袖)(?:衫)?(?:長' + MORE + '|再長)', function () {
      put('hemLen', round((c.hemLen || 0) + 5)); put('lengthPreset', 'custom'); done.push('衫長加長 5 cm');
    });
    each('(?<!袖)(?:衫)?(?:短' + MORE + '|再短)', function () {
      put('hemLen', round((c.hemLen || 0) - 5)); put('lengthPreset', 'custom'); done.push('衫長縮短 5 cm');
    });

    /* ---- 下擺 ---- */
    if (!neg.aline) {
      each('A\\s*字(?:下擺|擺|裙)?\\s*(?:放出)?\\s*(?:' + NUM + ')?|A-?line', function (m) {
        var n = num(m[1]);
        aline = true; put('hemShape', 'aline'); put('flare', round(n != null ? n : (c.flare > 0 ? c.flare : 4)));
        done.push('A 字下擺（每邊放出 ' + c.flare + ' cm）');
      });
      each('放出\\s*' + NUM, function (m) { if (aline) return; put('hemShape', 'aline'); put('flare', round(num(m[1]))); done.push('下擺每邊放出 ' + c.flare + ' cm'); });
    }
    each('直腳|直身|直擺|直下擺', function () { put('hemShape', 'straight'); done.push('直腳下擺'); });

    /* ---- 鬆緊度 ---- */
    each('修身|貼身|收身|fitted', function () { setFit('fitted'); done.push('修身'); });
    each('合身|regular', function () { setFit('regular'); done.push('合身'); });
    each('寬鬆|闊身|鬆身|寬身|oversize[d]?|loose', function () { setFit('loose'); done.push('寬鬆'); });
    var fitAbs = fitSet;
    each('(?<!領|口|開|加|袖|衫)(?:鬆|寬|闊)' + MORE, function () {
      if (fitAbs) return;
      var i = Math.min(2, FIT_ORDER.indexOf(c.fit) + 1); setFit(FIT_ORDER[i]); done.push('鬆啲（' + FIT_ZH[c.fit] + '）');
    });
    each('(?<!領|口|袖)(?:緊|窄)' + MORE, function () {
      if (fitAbs) return;
      var i = Math.max(0, FIT_ORDER.indexOf(c.fit) - 1); setFit(FIT_ORDER[i]); done.push('緊啲（' + FIT_ZH[c.fit] + '）');
    });

    /* ---- 開胸 ---- */
    if (!neg.opening) {
      each('開胸|開襟|開衫|前開|門襟|門筒|鈕扣|鈕|button', function () {
        put('opening', true); if (!neg.facing) put('facing', true);
        if (done.indexOf('前中開胸（門襟＋鈕）') < 0) done.push('前中開胸（門襟＋鈕）');
      });
      each('門襟\\s*(?:闊|寬)\\s*' + NUM, function (m) { put('ext', round(num(m[1]))); put('opening', true); done.push('門襟闊 ' + c.ext + ' cm'); });
    }
    if (!neg.facing) each('(?<!唔要|不要|冇|無)貼邊', function () { put('facing', true); });

    /* ---- 口袋 ---- */
    if (!neg.pocket) {
      each('(兩邊|兩個|雙|左右|左|右)?\\s*(?:邊|胸|面|胸前)?\\s*(?<!插|側|褲)(?:口袋|貼袋|胸袋|袋|pocket)(?!蓋)', function (m) {
        var side = m[1] || '';
        var v = /兩|雙|左右/.test(side) || /两|双/.test(side) ? 'both' : /右/.test(side) ? 'right' : 'left';
        put('pocket', v); done.push({ left: '左胸貼袋', right: '右胸貼袋', both: '兩邊胸貼袋' }[v]);
      });
    }

    // 唔明嘅部份
    var left = '';
    for (var i = 0; i < src.length; i++) left += used[i] ? ' ' : src[i];
    var unknown = left.split(/[，,。.；;、\n!！?？]+/).map(function (seg) {
      var core = seg.replace(/[\s\d.~～:：=+\-]|cm|厘米|公分|要|想|我|件|衫|衣服|啲|少少|一啲|的|個|个|係|改|做|加|同|和|及|仲有|再|都|唔該|請|请|好|有|啦|呀|吖|喎|嘅|咗|返|多|少|點|点|一|款|整|成|而且|然後|然后|可以|希望|最好|比較|比较|啱啱|就|得|佢|嗰|呢|個|啲|左右|大約|大约|約|约|左|右|面|邊|边|身/g, '');
      return core.length >= 2 ? seg.trim() : '';
    }).filter(Boolean);

    // 去除重覆
    done = done.filter(function (d, i) { return done.indexOf(d) === i; });
    return { set: set, done: done, cannot: cannot, unknown: unknown };
  }

  PM.parseRequest = parseRequest;
  PM.SLEEVE_ZH = SLEEVE_ZH;
})(typeof window !== 'undefined' ? window : globalThis);
