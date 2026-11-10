// All product data lives here. In the real shop this comes from Shopify.
// Prices, lead times and stock are placeholders — change them to the real ones.

const FABRICS = {
  snowcat: { name: "白雪公主貓貓", desc: "深藍底，白雪公主同七個小矮人都係貓貓，棉質", extra: 0, swatch: "img/sw-snowcat.jpg", tile: "img/fab-snowwhite.jpg", tileScale: 0.27 },
  alice:   { name: "愛麗絲貓貓（黑）", desc: "黑底，愛麗絲夢遊仙境貓貓、時鐘、撲克牌同蘑菇印花，棉質", extra: 0, swatch: "img/sw-alice.jpg", tile: "img/fab-alice.jpg", tileScale: 0.28 },
  embroid: { name: "藍花刺繡蕾絲", desc: "米白棉麻底，藍色花朵刺繡配菱形蕾絲", extra: 120, swatch: "img/sw-embroid.jpg" },
  cats:    { name: "手繪貓咪印花", desc: "白底，紅藍手繪貓咪，棉質", extra: 0, swatch: "img/sw-cats.jpg" },
  stripe:  { name: "粉藍條紋刺繡", desc: "粉藍細條紋，白色小花刺繡", extra: 80, swatch: "img/sw-stripe.jpg" },
  floral:  { name: "啡底花草", desc: "朱古力啡底，粉紫小花葉印花", extra: 0, swatch: "img/sw-floral.jpg" },
  denim:   { name: "流蘇菱格牛仔", desc: "藍白條紋牛仔布，手工剪出菱格流蘇", extra: 180, swatch: "img/sw-denim.jpg" },
  plaid:   { name: "繽紛格仔斜紋", desc: "紫、綠、橙、藍格仔，斜紋布，有少少厚度", extra: 0, swatch: "img/sw-plaid.jpg" },
};

// Every measurement a style might ask for. min/max are used for the "looks wrong" hint.
const MEASURES = {
  height:   { label: "身高", min: 140, max: 200, tip: "除鞋企直量", zone: "height" },
  shoulder: { label: "肩寬", min: 32, max: 56, tip: "由左肩骨量到右肩骨", zone: "shoulder" },
  chest:    { label: "胸圍", min: 70, max: 140, tip: "經過胸口最闊位置，軟尺保持水平", zone: "chest" },
  waist:    { label: "腰圍", min: 55, max: 130, tip: "肚臍上方最窄位置", zone: "waist" },
  hip:      { label: "臀圍", min: 75, max: 145, tip: "臀部最闊位置", zone: "hip" },
  sleeve:   { label: "袖長", min: 45, max: 70, tip: "由肩骨沿手臂量到手腕骨", zone: "sleeve" },
  top_len:  { label: "衫長", min: 40, max: 90, tip: "由後頸骨量到想要嘅長度", zone: "length" },
  pant_len: { label: "褲長", min: 70, max: 115, tip: "由腰量到想要嘅長度", zone: "leg" },
};

// Section 1: styles the shop designs, customer picks fabric + enters size.
// photos: one photo per fabric, so the preview changes when the customer picks a fabric.
// liveFabrics: fabrics with no photo yet; shown by laying the fabric onto the try-on photo.
const CUSTOM_STYLES = [
  {
    id: "collar-blouse", en: "Peter Pan Collar Blouse", name: "小圓領拼布恤衫", base: 680, days: "21–28",
    desc: "前幅用印花或刺繡布，袖用素色布拼接，袖口收褶。",
    cover: "img/blouse-collage.jpg",
    tryon: { key: "blouse", base: "img/blouse-embroid.jpg", part: "前幅" },
    liveFabrics: ["alice"],
    photos: { snowcat: "img/blouse-snowcat.jpg", embroid: "img/blouse-embroid.jpg", cats: "img/blouse-cats.jpg", stripe: "img/blouse-stripe.jpg", floral: "img/blouse-floral.jpg" },
    note: "領型、口袋同袖嘅拼色會按布料配搭，以相片為準。",
    measures: ["height", "shoulder", "chest", "sleeve", "top_len"],
  },
  {
    id: "v-vest", en: "V-neck Vest", name: "V 領背心", base: 580, days: "18–25",
    desc: "短身 V 領，三粒金屬鈕，內裡用黑色棉布。",
    cover: "img/plaid-vest.jpg",
    tryon: { key: "vest", base: "img/plaid-vest.jpg", part: "成件" },
    liveFabrics: ["snowcat", "alice"],
    photos: { plaid: "img/plaid-vest.jpg", denim: "img/denim-vest.jpg" },
    measures: ["height", "shoulder", "chest", "waist", "top_len"],
  },
  {
    id: "straight-pants", en: "High-waist Straight Trousers", name: "高腰直腳褲", base: 620, days: "18–25",
    desc: "高腰，前中一粒鈕，褲腳微窄，九分長度。",
    cover: "img/plaid-pants.jpg",
    photos: { plaid: "img/plaid-pants.jpg", denim: "img/denim-pants.jpg" },
    gallery: { plaid: ["img/plaid-pants-worn.jpg"] },
    measures: ["height", "waist", "hip", "pant_len"],
  },
  {
    id: "vest-set", en: "Vest & Trouser Set", name: "背心褲套裝", base: 1120, days: "25–32",
    desc: "V 領背心配高腰直腳褲，同一款布，一套買平啲。",
    cover: "img/plaid-set.jpg",
    photos: { plaid: "img/plaid-set.jpg", denim: "img/denim-set.jpg" },
    measures: ["height", "shoulder", "chest", "waist", "hip", "top_len", "pant_len"],
  },
];

// Section 2: fixed ready-made styles with standard sizes.
const READY = [
  { id: "r-lace", en: "Scallop Lace Shell Top", name: "波浪蕾絲背心上衣", price: 780, cat: "上衣", sizes: { S: 1, M: 2, L: 1 },
    photos: ["img/lace-top.jpg"], fabric: "黑白網紗蕾絲，波浪刺繡，內裡黑色襯布", desc: "層層波浪花邊，下擺透少少，單著或者疊恤衫都得。" },
  { id: "r-london", en: "London Garden Tee", name: "倫敦花園短袖上衣", price: 520, cat: "上衣", sizes: { S: 2, M: 3, L: 0 },
    photos: ["img/london-top.jpg"], fabric: "米色棉麻，鬱金香配倫敦塔橋印花", desc: "闊身短袖，後背一排紫色鈕。" },
  { id: "r-vintage", en: "Vintage Girls Split Shirt", name: "復古女孩拼條紋恤衫", price: 680, cat: "上衣", sizes: { S: 1, M: 1, L: 1 },
    photos: ["img/vintage-shirt.jpg"], fabric: "復古女孩印花棉 × 紅白細條紋棉", desc: "左右兩邊用唔同布，袖口收褶。" },
  { id: "r-bird", en: "Moon & Bird Dress", name: "月亮小鳥連身裙", price: 880, cat: "連身裙", sizes: { S: 0, M: 2, L: 1 },
    photos: ["img/bird-dress.jpg"], fabric: "深紫底，白月亮同小鳥印花", desc: "小圓領，前排鈕，配同色腰帶。" },
  { id: "r-skirt", en: "Royal Stripe Skirt", name: "寶藍條紋半截裙", price: 620, cat: "下身", sizes: { S: 2, M: 2, L: 2 },
    photos: ["img/stripe-skirt.jpg"], fabric: "米白泡泡布 × 寶藍條紋，寶藍腰頭", desc: "闊腰頭，側邊一個鬆緊袋口嘅口袋。" },
];

const SIZE_CHART = {
  上衣:   { head: ["", "S", "M", "L"], rows: [["胸圍", 96, 104, 112], ["肩寬", 40, 42, 44], ["衫長", 58, 61, 64]] },
  下身:   { head: ["", "S", "M", "L"], rows: [["腰圍", 64, 70, 76], ["臀圍", 94, 100, 106], ["長度", 80, 82, 84]] },
  連身裙: { head: ["", "S", "M", "L"], rows: [["胸圍", 92, 100, 108], ["腰圍", 80, 88, 96], ["裙長", 110, 113, 116]] },
};
