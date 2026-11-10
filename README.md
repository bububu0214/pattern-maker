# 紙樣生成器 Pattern Maker

繁體中文介面嘅網頁紙樣生成器。第一版：**女裝基本上身原型**（前片、後片，連腰褶）。

純前端網頁，唔使安裝、唔使上網、唔使伺服器。

## 點樣打開

**電腦：**
1. 喺 GitHub 呢個 repo 揀 branch `claude/womens-pattern-generator-o9bnqa`
2. 撳綠色「Code」→「Download ZIP」，解壓
3. 雙擊 `index.html`，會用瀏覽器（Chrome / Edge / Safari / Firefox）打開

**GitHub Pages（想有網址、用手機開）：**
Repo 嘅 Settings → Pages → Source 揀「Deploy from a branch」→ Branch 揀呢個 branch、資料夾 `/ (root)` → Save。
等一兩分鐘就可以用 `https://<你嘅帳號>.github.io/pattern-maker/` 打開。

## 用法

1. 輸入身體尺寸（厘米）：胸圍、腰圍、肩寬、背長、前長、領圍、夾圈
2. 設定放鬆量（預設：胸圍 +8、腰圍 +4、夾圈 +2、領圍 +0）
3. 設定縫份（預設 1 cm），揀前中／後中係咪對摺
4. 撳「生成紙樣」→ 畫面即刻顯示前片同後片
5. 下載：
   - **PDF（1:1 A4）**：第 1 頁有尺寸表、10 cm 測試方格同拼頁圖；之後每頁一格紙樣，有頁碼（A1、A2…）、對位圓圈記號同框線
   - **SVG**：實際尺寸（cm），分圖層，可以放入 Inkscape / Illustrator
   - **Seamly2D（.sm2d）**：Seamly2D 原生紙樣檔（亦開到 Valentina），詳見下面
   - **DXF**：R12 格式，單位 mm，分圖層（CUT 裁剪線、SEAM 縫線、DART 褶、GRAIN 布紋線、NOTCH 剪口、DIM 尺寸…），可以放入 CAD／紙樣軟件

### 用 Seamly2D 開

撳「下載 Seamly2D（.sm2d）」，然後喺 Seamly2D 用「File → Open」開個 `.sm2d` 檔。

- 用 v0.6.0 檔案格式，新舊版 Seamly2D 同 Valentina 都開到；新版開檔時會自動升級格式（可能會問你另存）
- **Draft 模式**：所有點、直線、腰褶、胸圍線，同埋可以拖動修改嘅曲線（領口、夾圈）
- **Piece 模式**：「Back」「Front」兩塊紙樣，已設定縫份；對摺邊縫份為 0；夾圈同褶位有剪口；有布紋線同紙樣標籤
- 所有點都由基準點 A 用「角度＋長度」定位，數值固定（未連結量身檔）
- 注意：Seamly2D 唔可以將 DXF／SVG 讀做可以改嘅紙樣，所以要用 .sm2d

### 打印 PDF 注意

- 打印設定揀 **「實際大小」／「100%」**，唔好揀「配合頁面／Fit to page」
- 印完用尺量第 1 頁嘅 10 cm 方格，啱先好剪
- 沿灰色框線剪走一邊頁邊，按頁碼排好，對齊半圓對位記號再貼

## 打版方法（簡述）

- 前片胸寬 = (胸圍 + 放鬆量) ÷ 4 + 0.5；後片 = ÷ 4 − 0.5
- 腰寬同樣分配；胸腰差一部份喺側縫收（每邊最多 2.5 cm），其餘做腰褶
- 領寬會自動調整，令前後領弧總長 = 領圍 ÷ 2
- 夾圈深會自動調整，令前後夾圈總長 = 夾圈尺寸
- 後肩斜 18°、前肩斜 22°；後肩比前肩長 0.5 cm（縮縫）
- 前長比後片長嘅差，用前腰線向下延伸處理

呢個係基本原型（block），試身後可以再按身形修改。

## 檔案結構

```
index.html          介面
css/style.css
js/geom.js          幾何工具（曲線、縫份偏移）
js/draft.js         打版計算
js/layout.js        標示、布紋線、縫份、排版
js/export-svg.js    SVG 輸出（亦用嚟做畫面預覽）
js/export-pdf.js    A4 分頁 PDF 輸出
js/export-dxf.js    DXF 輸出
js/export-seamly.js Seamly2D .sm2d 輸出
js/app.js           介面控制
```
