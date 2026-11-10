// All product data lives here. In the real shop this comes from Shopify.

const FABRICS = {
  "linen-natural": { name: "原色亞麻", origin: "立陶宛", weight: "中厚", season: "春夏", feel: "愈洗愈軟", extra: 0, color: "#cbbca1", tex: "linen" },
  "linen-ink":     { name: "墨黑亞麻", origin: "立陶宛", weight: "中厚", season: "春夏", feel: "挺身、透氣", extra: 0, color: "#34302c", tex: "linen" },
  "rust-cotton":   { name: "鐵鏽棉麻", origin: "日本", weight: "中", season: "四季", feel: "柔軟、微皺", extra: 120, color: "#9c4a2e", tex: "plain" },
  "indigo":        { name: "岡山靛染棉", origin: "日本岡山", weight: "中", season: "四季", feel: "手工靛染，會慢慢褪色", extra: 220, color: "#2f3d58", tex: "twill" },
  "silk-cotton":   { name: "米白絲棉", origin: "意大利", weight: "薄", season: "夏", feel: "有光澤、垂墜", extra: 260, color: "#ece3d2", tex: "plain" },
  "moss-wool":     { name: "苔綠羊毛呢", origin: "英國", weight: "厚", season: "秋冬", feel: "人字紋，保暖", extra: 380, color: "#5e6b4e", tex: "herring" },
  "stripe":        { name: "細條紋棉", origin: "日本", weight: "薄", season: "春夏", feel: "爽身", extra: 80, color: "#8b9bb0", tex: "stripe" },
};

// Every measurement a style might ask for. min/max are used for the "looks wrong" hint.
const MEASURES = {
  height:   { label: "身高", min: 140, max: 200, tip: "除鞋企直量", zone: "height" },
  neck:     { label: "頸圍", min: 30, max: 50, tip: "喉核下方圍一圈，留一隻手指位", zone: "neck" },
  shoulder: { label: "肩寬", min: 34, max: 56, tip: "由左肩骨量到右肩骨", zone: "shoulder" },
  chest:    { label: "胸圍", min: 70, max: 140, tip: "經過胸口最闊位置，軟尺保持水平", zone: "chest" },
  waist:    { label: "腰圍", min: 55, max: 130, tip: "肚臍上方最窄位置", zone: "waist" },
  hip:      { label: "臀圍", min: 75, max: 145, tip: "臀部最闊位置", zone: "hip" },
  sleeve:   { label: "袖長", min: 50, max: 70, tip: "由肩骨沿手臂量到手腕骨", zone: "sleeve" },
  top_len:  { label: "衫長", min: 55, max: 90, tip: "由後頸骨量到想要嘅長度", zone: "length" },
  pant_len: { label: "褲長", min: 80, max: 115, tip: "由腰量到腳眼", zone: "leg" },
  dress_len:{ label: "裙長", min: 80, max: 140, tip: "由肩頂量到想要嘅長度", zone: "length" },
};

// Section 1: styles the shop designs, customer picks fabric + enters size.
const CUSTOM_STYLES = [
  {
    id: "band-shirt", name: "立領手縫襯衫", art: "shirt", base: 980, days: "21–28",
    desc: "簡單立領，貝殼鈕，手縫鈕門。可以入褲或者散著。",
    fabrics: ["linen-natural", "linen-ink", "indigo", "silk-cotton", "stripe"],
    measures: ["height", "neck", "shoulder", "chest", "sleeve", "top_len"],
  },
  {
    id: "wide-trousers", name: "麻質闊腳褲", art: "trousers", base: 880, days: "18–25",
    desc: "高腰雙褶，褲腳闊而垂，行路有風。",
    fabrics: ["linen-natural", "linen-ink", "rust-cotton", "indigo", "moss-wool"],
    measures: ["height", "waist", "hip", "pant_len"],
  },
  {
    id: "work-jacket", name: "工匠短褸", art: "jacket", base: 1680, days: "28–35",
    desc: "參考舊式工作褸，三個貼袋，可以著好多年。",
    fabrics: ["indigo", "linen-ink", "moss-wool", "rust-cotton"],
    measures: ["height", "shoulder", "chest", "sleeve", "top_len"],
  },
  {
    id: "long-dress", name: "無袖長裙", art: "dress", base: 1280, days: "21–28",
    desc: "A 字剪裁，腰身微收，後背開衩。",
    fabrics: ["linen-natural", "rust-cotton", "silk-cotton", "indigo", "stripe"],
    measures: ["height", "chest", "waist", "hip", "dress_len"],
  },
];

// Section 2: fixed ready-made styles with standard sizes.
const READY = [
  { id: "r-apron", name: "帆布工作圍裙", art: "apron", price: 520, fabric: "rust-cotton", cat: "雜貨", sizes: { F: 6 }, desc: "皮革吊帶，兩個大口袋。" },
  { id: "r-shirt", name: "亞麻立領襯衫", art: "shirt", price: 860, fabric: "linen-natural", cat: "上衣", sizes: { S: 3, M: 0, L: 2 }, desc: "訂製款嘅標準尺碼版本。" },
  { id: "r-skirt", name: "靛染半截裙", art: "skirt", price: 780, fabric: "indigo", cat: "下身", sizes: { S: 2, M: 4, L: 1 }, desc: "鬆緊腰頭，有側袋。" },
  { id: "r-trousers", name: "墨黑闊腳褲", art: "trousers", price: 760, fabric: "linen-ink", cat: "下身", sizes: { S: 0, M: 3, L: 3 }, desc: "高腰，前褶，褲腳可以摺起。" },
  { id: "r-jacket", name: "苔綠羊毛短褸", art: "jacket", price: 1580, fabric: "moss-wool", cat: "外套", sizes: { S: 1, M: 2, L: 0 }, desc: "人字紋羊毛呢，內裡用棉布。" },
  { id: "r-dress", name: "條紋長裙", art: "dress", price: 1080, fabric: "stripe", cat: "上衣", sizes: { S: 2, M: 2, L: 2 }, desc: "夏天一件就夠。" },
];

const SIZE_CHART = {
  上衣: { head: ["", "S", "M", "L"], rows: [["胸圍", 96, 104, 112], ["肩寬", 42, 45, 48], ["衫長", 68, 71, 74]] },
  下身: { head: ["", "S", "M", "L"], rows: [["腰圍", 66, 72, 78], ["臀圍", 96, 102, 108], ["長度", 94, 97, 100]] },
  外套: { head: ["", "S", "M", "L"], rows: [["胸圍", 104, 112, 120], ["肩寬", 44, 47, 50], ["衫長", 64, 67, 70]] },
  雜貨: { head: ["", "F"], rows: [["長度", 85], ["闊度", 70]] },
};
