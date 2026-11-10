# pattern-maker

服裝網店示意原型（Little Hap.B）。

- `site/index.html`：直接用瀏覽器打開即可
- 兩個區：度身訂製（揀款 → 揀布 → 入尺寸 → 確認，全額付款）、現成款（S/M/L）
- 款式、布料、尺寸範圍都喺 `site/data.js`，改呢個檔就得
- 圖片係線稿示意（`site/art.js`），正式版換實物相
- 上傳布料試身：`site/tryon.js`，而家支援 V 領背心同小圓領恤衫前幅。
  加新款要喺 `tools/make_tryon_layers.py` 描好件衫嘅輪廓，再行一次個 script。

## 落單流程
客人揀好貨 → 填姓名、電話、取貨方式 → 㩒掣打開 WhatsApp，訂單內容自動寫好 → 店主確認後傳 FPS / PayMe 付款資料。

開張前要改 `site/data.js` 最頂嘅 `SHOP.whatsapp`，填店舖 WhatsApp 號碼（852 加 8 位數字，唔使加號）。

## 放上網（GitHub Pages，免費）
1. 將呢個分支合併入 `main`
2. GitHub repo → Settings → Pages → Source 揀「GitHub Actions」
3. 之後每次 `main` 有改動，網站會自動更新
