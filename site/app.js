(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = n => "HK$" + n.toLocaleString("en-US");
  const pic = (src, alt = "") => `<img src="${src}" alt="${esc(alt)}" loading="lazy">`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- storage (may be unavailable inside a sandboxed frame) ----------
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };

  // ---------- routing ----------
  const VIEWS = ["home", "custom", "ready"];
  function route() {
    const h = location.hash.slice(1);
    const v = VIEWS.includes(h) ? h : "home";
    VIEWS.forEach(n => $("#view-" + n).classList.toggle("on", n === v));
    $$("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === v && v !== "home"));
    window.scrollTo({ top: 0 });
  }
  window.addEventListener("hashchange", () => { closeAll(); route(); });

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("on"), 2200);
  }

  // ---------- overlays ----------
  function openModal(html) {
    $("#modalBody").innerHTML = html;
    $("#modal").classList.add("on");
    $("#scrim").classList.add("on");
  }
  function closeAll() {
    $("#modal").classList.remove("on");
    $("#drawer").classList.remove("on");
    $("#scrim").classList.remove("on");
  }
  $("#scrim").addEventListener("click", closeAll);
  document.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeAll(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });

  // ---------- cart ----------
  let cart = store.get("cart-v2", []);
  function saveCart() {
    store.set("cart-v2", cart);
    $("#cartCount").textContent = cart.length;
    renderCart();
  }
  function addToCart(item) {
    cart.push({ ...item, key: Date.now() + Math.random() });
    saveCart();
  }
  function renderCart() {
    const box = $("#cartItems");
    if (!cart.length) {
      box.innerHTML = `<p class="empty">購物袋仲係空嘅。<br>慢慢揀，唔使急。</p>`;
    } else {
      box.innerHTML = cart.map((it, i) => `
        <div class="item">
          <div class="thumb">${pic(it.img, it.name)}</div>
          <div>
            <b>${esc(it.name)}</b>
            <small>${esc(it.lines.join(" · "))}</small>
            <button class="rm" data-rm="${i}" type="button">移除</button>
          </div>
          <div>${money(it.price)}</div>
        </div>`).join("");
    }
    $("#cartTotal").textContent = money(cart.reduce((s, it) => s + it.price, 0));
    $("#checkoutBtn").disabled = !cart.length;
  }
  $("#cartItems").addEventListener("click", e => {
    const b = e.target.closest("[data-rm]");
    if (!b) return;
    cart.splice(+b.dataset.rm, 1);
    saveCart();
  });
  $("#cartBtn").addEventListener("click", () => {
    $("#drawer").classList.add("on");
    $("#scrim").classList.add("on");
  });
  $("#checkoutBtn").addEventListener("click", () => {
    const hasCustom = cart.some(it => it.custom);
    closeAll();
    setTimeout(() => openModal(`
      <div class="message">
        <div class="seal">Hap.B</div>
        <h2>多謝你</h2>
        <p class="lede">呢度係示意原型。正式版會喺呢一步轉去 Shopify 結帳頁，用信用卡、Apple Pay、FPS 等方式付款。</p>
        ${hasCustom ? `<p class="policy">訂製款需全額付款，我哋收到款後會用 WhatsApp 或者電郵同你確認尺寸先開工。</p>` : ""}
        <button class="btn" data-close type="button">返回</button>
      </div>`), 300);
  });

  // =========================================================
  // HOME
  // =========================================================

  // =========================================================
  // CUSTOM FLOW
  // =========================================================
  const flow = { step: 0, style: null, fabric: null, m: {}, note: "", agree: false, upload: null, scale: 0.22, mirror: false, thumb: null };
  const UPLOAD = { name: "你上傳嘅布料", desc: "電腦示意效果，實際效果會因布料厚薄、花紋大細同位置而有分別", extra: 0 };
  const DEMO_FABRICS = [["img/sw-cats.jpg", "貓咪"], ["img/sw-floral.jpg", "花草"], ["img/sw-snowcat.jpg", "童話"], ["img/sw-embroid.jpg", "刺繡"]];
  const fabricKeys = s => [...Object.keys(s.photos), ...(s.liveFabrics || [])];
  // fabric shown by laying it onto the photo (uploaded, or a shop fabric with no photo yet)
  const isLive = s => !!(s && s.tryon && flow.fabric && (flow.fabric === "upload" || !s.photos[flow.fabric]));
  const fabricInfo = () => flow.fabric === "upload" ? UPLOAD : flow.fabric ? FABRICS[flow.fabric] : null;

  const styleOf = () => CUSTOM_STYLES.find(s => s.id === flow.style);
  const priceOf = () => {
    const s = styleOf();
    if (!s) return 0;
    return s.base + (fabricInfo() ? fabricInfo().extra : 0);
  };
  const measureOk = key => {
    const v = parseFloat(flow.m[key]);
    const d = MEASURES[key];
    return !isNaN(v) && v >= d.min && v <= d.max;
  };
  const allMeasuresOk = () => styleOf() && styleOf().measures.every(measureOk);

  function canGo(step) {
    if (step <= 0) return true;
    if (step === 1) return !!flow.style;
    if (step === 2) return !!flow.style && !!flow.fabric;
    if (step === 3) return !!flow.fabric && allMeasuresOk();
    return false;
  }

  function goto(step) {
    if (!canGo(step)) return;
    flow.step = step;
    renderFlow();
    $("#steps").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#steps").addEventListener("click", e => {
    const li = e.target.closest("li");
    if (li) goto(+li.dataset.step);
  });

  function renderPreview() {
    const s = styleOf();
    const p = $("#preview");
    if (!s) {
      p.classList.remove("live");
      p.innerHTML = `<div class="pic">${pic("img/blouse-collage.jpg", "訂製款")}</div>
        <div class="info"><p class="hint">揀一個款式開始。</p></div>`;
      return;
    }
    const f = fabricInfo();
    const isUp = isLive(s);
    p.innerHTML = `<div class="pic">${isUp ? `<canvas id="tryCanvas" aria-label="試身效果"></canvas>` : pic((flow.fabric && s.photos[flow.fabric]) || s.cover, s.name)}</div>
      <div class="info">
        <h3>${esc(s.name)}<span class="en">${esc(s.en)}</span></h3>
        <div class="line"><span>布料</span><b>${f ? esc(f.name) : "—"}</b></div>
        <div class="line"><span>製作期</span><b>${s.days} 日</b></div>
        <div class="line"><span>價錢</span><b>${money(priceOf())}</b></div>
      </div>`;
    p.classList.toggle("live", !!isUp);
    if (isUp) drawTry();
  }

  function drawTry() {
    const c = $("#tryCanvas"), s = styleOf();
    if (!c || !isLive(s)) return;
    const up = flow.fabric === "upload";
    const fb = FABRICS[flow.fabric];
    if (up && !flow.upload) return;
    TryOn.render(c, s.tryon, up ? flow.upload : fb.tile, up ? flow.scale : fb.tileScale, up && flow.mirror)
      .then(() => { flow.thumb = TryOn.thumb(c); })
      .catch(() => toast("張相讀唔到，試吓另一張"));
  }

  // shrink big phone photos before using them
  function readFabric(file) {
    return new Promise((ok, fail) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 800 / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", 0.88));
      };
      im.onerror = fail;
      im.src = url;
    });
  }

  function stepStyle() {
    return `
      <div><h2>揀一個款式</h2><p class="hint">款式由我哋設計，你揀布料同提供尺寸，我哋照你身形裁剪。</p></div>
      <div class="style-list">
        ${CUSTOM_STYLES.map(s => `
          <button class="style-opt ${flow.style === s.id ? "on" : ""}" data-style="${s.id}" type="button">
            <div class="thumb">${pic(s.cover, s.name)}</div>
            <div><h3>${esc(s.name)}<span class="en">${esc(s.en)}</span></h3><p>${esc(s.desc)}</p><span class="tag">${fabricKeys(s).length} 款布料 · ${s.days} 日</span></div>
            <div class="price">由 ${money(s.base)}</div>
          </button>`).join("")}
      </div>
      <div class="flow-nav"><span></span><button class="btn" data-next type="button" ${flow.style ? "" : "disabled"}>下一步：揀布料</button></div>`;
  }

  function stepFabric() {
    const s = styleOf();
    const f = fabricInfo();
    const up = flow.fabric === "upload";
    return `
      <div><h2>揀布料</h2><p class="hint">呢款可以用以下布料。㩒一下，就會顯示用呢款布造出嚟嘅樣。${s.note ? esc(s.note) : ""}</p></div>
      <div class="fabrics">
        ${fabricKeys(s).map(k => {
          const fb = FABRICS[k];
          const live = !s.photos[k];
          return `<button class="fabric ${flow.fabric === k ? "on" : ""}" data-fabric="${k}" type="button">
            <div class="swatch">${pic(fb.swatch, fb.name)}</div>
            <div class="name">${esc(fb.name)}${live ? ` <span class="tag">新布</span>` : ""}</div>
            <div class="plus">${fb.extra ? "+" + money(fb.extra) : "不另加錢"}</div>
          </button>`;
        }).join("")}
        ${s.tryon ? `<label class="fabric upload ${up ? "on" : ""}">
            <input type="file" accept="image/*" data-upload hidden>
            <div class="swatch">${up && flow.upload ? `<img src="${flow.upload}" alt="">` : `<span class="plus-big">＋</span>`}</div>
            <div class="name">上傳你嘅布</div>
            <div class="plus">Upload fabric</div>
          </label>` : ""}
      </div>
      ${s.tryon ? `<div class="tryon-box">
          <p><b>想用自己鍾意嘅布？</b>上傳一張布嘅相，即刻睇到佢變成${esc(s.name)}${s.tryon.part === "前幅" ? "（換前幅，袖保留素色）" : ""}嘅樣。</p>
          <p class="hint">影相貼士：布平放、正面影、光線平均，唔好有影。</p>
          <div class="demo">未有相？試吓：${DEMO_FABRICS.map(([src, n]) => `<button class="chip" data-demo="${src}" type="button">${n}</button>`).join("")}</div>
          ${up ? `<label class="scale">印花大細 <small>Print size</small>
              <input type="range" min="0.08" max="0.6" step="0.01" value="${flow.scale}" data-scale>
            </label>
            <label class="check"><input type="checkbox" data-mirror ${flow.mirror ? "checked" : ""}> 鏡像拼接：見到布嘅接駁線先開，適合花草、格仔，人物動物圖案會變對稱</label>` : ""}
        </div>` : ""}
      ${f ? `<div class="fabric-note"><b>${esc(f.name)}</b>：${esc(f.desc)}。${up ? "落單後我哋會聯絡你，傾布料嘅安排。" : isLive(s) ? "呢塊布未有成品相，圖為電腦示意，以實物為準。" : ""}</div>` : ""}
      <div class="flow-nav">
        <button class="btn ghost" data-prev type="button">上一步</button>
        <button class="btn" data-next type="button" ${flow.fabric ? "" : "disabled"}>下一步：入尺寸</button>
      </div>`;
  }

  function stepMeasure() {
    const s = styleOf();
    return `
      <div><h2>你嘅尺寸</h2><p class="hint">用軟尺量淨身尺寸（唔使自己加鬆度，師傅會按款式加返）。單位係厘米。</p></div>
      <div class="measure-wrap">
        <div class="measures">
          ${s.measures.map(k => {
            const d = MEASURES[k];
            const v = flow.m[k] ?? "";
            const bad = v !== "" && !measureOk(k);
            return `<div class="field ${bad ? "bad" : ""}" data-field="${k}">
              <label for="m-${k}">${d.label}</label>
              <div class="input-unit">
                <input id="m-${k}" data-m="${k}" type="number" inputmode="decimal" step="0.5" min="${d.min}" max="${d.max}" value="${esc(v)}" placeholder="${Math.round((d.min + d.max) / 2)}">
                <span class="u">cm</span>
              </div>
              <div class="tip">${bad ? `呢個數字好似唔太啱，通常喺 ${d.min}–${d.max} cm 之間` : esc(d.tip)}</div>
            </div>`;
          }).join("")}
          <div class="field wide">
            <label for="m-note">備註 <span class="opt">選填</span></label>
            <textarea id="m-note" data-note placeholder="例如：想袖長短少少、平時著 M 碼、膊頭有少少高低……">${esc(flow.note)}</textarea>
          </div>
        </div>
        <div class="body-guide">${bodyGuide()}<p>㩒入格仔會顯示量邊度</p></div>
      </div>
      <div class="flow-nav">
        <button class="btn ghost" data-prev type="button">上一步</button>
        <button class="btn" data-next type="button" ${allMeasuresOk() ? "" : "disabled"}>下一步：確認</button>
      </div>`;
  }

  function stepConfirm() {
    const s = styleOf();
    const f = fabricInfo();
    return `
      <div><h2>確認你嘅訂單</h2><p class="hint">睇清楚先加入購物袋。</p></div>
      <div class="summary">
        <div class="row"><span>款式</span><span>${esc(s.name)}</span></div>
        <div class="row"><span>布料</span><span>${esc(f.name)}</span></div>
        <div class="row"><span>尺寸</span><span></span></div>
        <div class="mlist">${s.measures.map(k => `<span>${MEASURES[k].label}　${esc(flow.m[k])} cm</span>`).join("")}</div>
        ${flow.note ? `<div class="row"><span>備註</span><span>${esc(flow.note)}</span></div>` : ""}
        <div class="row"><span>製作期</span><span>約 ${s.days} 日</span></div>
        <div class="row"><span>款式</span><span>${money(s.base)}</span></div>
        <div class="row"><span>布料加價</span><span>${f.extra ? money(f.extra) : "—"}</span></div>
        <div class="row total"><span>全額付款</span><b>${money(priceOf())}</b></div>
      </div>
      <p class="policy">訂製款係按你嘅尺寸裁剪，需要全額付款，開工後恕不退款。收貨後如果唔合身，七日內可以免費修改一次。</p>
      <label class="check"><input type="checkbox" data-agree ${flow.agree ? "checked" : ""}> 我已經睇清楚以上尺寸同條款</label>
      <div class="flow-nav">
        <button class="btn ghost" data-prev type="button">上一步</button>
        <button class="btn" data-add type="button" ${flow.agree ? "" : "disabled"}>加入購物袋</button>
      </div>`;
  }

  function renderFlow() {
    $$("#steps li").forEach(li => {
      const n = +li.dataset.step;
      li.classList.toggle("on", n === flow.step);
      li.classList.toggle("done", n < flow.step || (n !== flow.step && canGo(n)));
    });
    const panel = $("#panel");
    panel.innerHTML = [stepStyle, stepFabric, stepMeasure, stepConfirm][flow.step]();
    renderPreview();
  }

  const panel = $("#panel");
  panel.addEventListener("click", e => {
    const t = e.target;
    const st = t.closest("[data-style]");
    if (st) {
      if (flow.style !== st.dataset.style) {
        flow.style = st.dataset.style;
        // keep fabric only if the new style offers it
        const ns = styleOf();
        if (!fabricKeys(ns).includes(flow.fabric) && !(flow.fabric === "upload" && ns.tryon)) flow.fabric = null;
      }
      renderFlow();
      return;
    }
    const fb = t.closest("[data-fabric]");
    if (fb) { flow.fabric = fb.dataset.fabric; flow.thumb = null; renderFlow(); return; }
    const demo = t.closest("[data-demo]");
    if (demo) { flow.upload = demo.dataset.demo; flow.fabric = "upload"; flow.thumb = null; renderFlow(); return; }
    if (t.closest(".fabric.upload") && flow.upload && flow.fabric !== "upload" && !t.matches("input")) {
      // already uploaded once: tapping selects it again; long way to re-upload is via the file picker
      flow.fabric = "upload"; renderFlow(); e.preventDefault(); return;
    }
    if (t.closest("[data-next]")) { goto(flow.step + 1); return; }
    if (t.closest("[data-prev]")) { goto(flow.step - 1); return; }
    if (t.closest("[data-add]")) {
      const s = styleOf();
      addToCart({
        custom: true, name: s.name + "（訂製）", price: priceOf(),
        img: isLive(s) ? (flow.thumb || s.tryon.base) : s.photos[flow.fabric],
        lines: [fabricInfo().name, ...s.measures.map(k => `${MEASURES[k].label}${flow.m[k]}`)],
      });
      toast("已加入購物袋");
      Object.assign(flow, { step: 0, style: null, fabric: null, note: "", agree: false });
      renderFlow();
      setTimeout(() => $("#cartBtn").click(), 500);
    }
  });

  panel.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.m) {
      flow.m[t.dataset.m] = t.value;
      // update just this field + next button, so typing isn't interrupted
      const field = t.closest(".field");
      const k = t.dataset.m, d = MEASURES[k];
      const bad = t.value !== "" && !measureOk(k);
      field.classList.toggle("bad", bad);
      $(".tip", field).textContent = bad ? `呢個數字好似唔太啱，通常喺 ${d.min}–${d.max} cm 之間` : d.tip;
      $("[data-next]", panel).disabled = !allMeasuresOk();
      $$("#steps li").forEach(li => { if (+li.dataset.step === 3) li.classList.toggle("done", canGo(3)); });
    }
    if (t.matches("[data-note]")) flow.note = t.value;
    if (t.matches("[data-scale]")) { flow.scale = +t.value; drawTry(); }
    if (t.matches("[data-mirror]")) { flow.mirror = t.checked; drawTry(); }
    if (t.matches("[data-agree]")) {
      flow.agree = t.checked;
      $("[data-add]", panel).disabled = !t.checked;
    }
  });

  panel.addEventListener("change", async e => {
    const t = e.target;
    if (!t.matches("[data-upload]") || !t.files[0]) return;
    try {
      flow.upload = await readFabric(t.files[0]); flow.thumb = null;
      flow.fabric = "upload";
      renderFlow();
    } catch { toast("張相讀唔到，試吓另一張"); }
  });

  // highlight where to measure
  panel.addEventListener("focusin", e => {
    const k = e.target.dataset && e.target.dataset.m;
    if (!k) return;
    $$(".body-guide .hl").forEach(p => p.classList.toggle("show", p.dataset.zone === MEASURES[k].zone));
  });

  // =========================================================
  // READY-MADE
  // =========================================================
  let cat = "全部";
  const cats = ["全部", ...new Set(READY.map(r => r.cat))];

  function renderReady() {
    $("#filters").innerHTML = cats.map(c => `<button class="chip ${c === cat ? "on" : ""}" data-cat="${c}" type="button">${c}</button>`).join("");
    const list = READY.filter(r => cat === "全部" || r.cat === cat);
    $("#readyGrid").innerHTML = list.map(r => {
      const stock = Object.values(r.sizes).reduce((a, b) => a + b, 0);
      return `<button class="card" data-ready="${r.id}" type="button">
        <div class="pic">${pic(r.photos[0], r.name)}</div>
        <div class="meta"><h3>${esc(r.name)}<span class="en">${esc(r.en)}</span></h3><span class="price">${money(r.price)}</span></div>
        <div class="sub">${esc(r.cat)} ${stock <= 3 ? `<span class="tag rust">只剩 ${stock} 件</span>` : ""}</div>
      </button>`;
    }).join("");
  }

  $("#filters").addEventListener("click", e => {
    const c = e.target.closest("[data-cat]");
    if (c) { cat = c.dataset.cat; renderReady(); }
  });

  $("#readyGrid").addEventListener("click", e => {
    const c = e.target.closest("[data-ready]");
    if (c) openProduct(READY.find(r => r.id === c.dataset.ready));
  });

  function openProduct(r) {
    const chart = SIZE_CHART[r.cat] || SIZE_CHART["上衣"];
    const firstInStock = Object.keys(r.sizes).find(k => r.sizes[k] > 0);
    let chosen = Object.keys(r.sizes).length === 1 ? firstInStock : null;

    openModal(`
      <div class="pd">
        <div class="pic">${pic(r.photos[0], r.name)}</div>
        <div class="body">
          <div class="eyebrow">ready to wear</div>
          <h2>${esc(r.name)}<span class="en">${esc(r.en)}</span></h2>
          <div>${money(r.price)}</div>
          <p class="lede">${esc(r.desc)}</p>
          <div class="fabric-note">${esc(r.fabric)}</div>
          <div>
            <p class="hint" style="font-size:14px;margin-bottom:8px">尺碼</p>
            <div class="sizes">
              ${Object.entries(r.sizes).map(([k, n]) => `<button class="size ${k === chosen ? "on" : ""}" data-size="${k}" type="button" ${n ? "" : "disabled"}>${k}</button>`).join("")}
            </div>
          </div>
          <details>
            <summary>尺碼表（cm）</summary>
            <table class="chart">
              <tr>${chart.head.map(h => `<th>${h}</th>`).join("")}</tr>
              ${chart.rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}
            </table>
          </details>
          <button class="btn block" id="addReady" type="button" ${chosen ? "" : "disabled"}>${chosen ? "加入購物袋" : "請先揀尺碼"}</button>
          <p class="hint" style="font-size:13px">現貨 2–3 個工作天寄出 · 七日內可退換</p>
        </div>
      </div>`);

    const body = $("#modalBody");
    body.onclick = e => {
      const sz = e.target.closest("[data-size]");
      if (sz && !sz.disabled) {
        chosen = sz.dataset.size;
        $$(".size", body).forEach(b => b.classList.toggle("on", b === sz));
        const add = $("#addReady");
        add.disabled = false;
        add.textContent = "加入購物袋";
      }
      if (e.target.id === "addReady" && chosen) {
        addToCart({ name: r.name, img: r.photos[0], price: r.price, lines: [`尺碼 ${chosen}`] });
        closeAll();
        toast("已加入購物袋");
      }
    };
  }

  // ---------- start ----------
  saveCart();
  renderFlow();
  renderReady();
  route();
})();
