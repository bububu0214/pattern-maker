// Line-drawing placeholders for garments. Replace with real photos later.

let artId = 0;

function texPattern(id, tex) {
  const w = "rgba(255,255,255,.22)", b = "rgba(0,0,0,.10)";
  switch (tex) {
    case "linen":
      return `<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 1h4M2 0v4" stroke="${b}" stroke-width=".6"/><path d="M0 3h4" stroke="${w}" stroke-width=".5"/></pattern>`;
    case "twill":
      return `<pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v5" stroke="${w}" stroke-width="1.4"/></pattern>`;
    case "herring":
      return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L4 0M4 0l4 8" stroke="${w}" stroke-width="1"/></pattern>`;
    case "stripe":
      return `<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M1 0v9" stroke="rgba(255,255,255,.65)" stroke-width="1.4"/></pattern>`;
    default:
      return `<pattern id="${id}" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 1.5h3" stroke="${b}" stroke-width=".4"/></pattern>`;
  }
}

const SHAPES = {
  shirt: {
    body: "M70 40 L52 48 L22 98 L38 108 L60 82 L60 212 Q100 220 140 212 L140 82 L162 108 L178 98 L148 48 L130 40 Q100 56 70 40 Z",
    detail: `<path d="M76 40 Q100 52 124 40 L124 32 Q100 44 76 32 Z" class="fill"/>
      <path d="M100 50 V214" />
      ${[72, 100, 128, 156, 184].map(y => `<circle cx="104" cy="${y}" r="2.4" fill="#f3ede3"/>`).join("")}
      <path d="M114 86 h18 v20 h-18 z" />`,
    stitch: "M64 204 Q100 211 136 204 M28 98 L40 105 M172 98 L160 105",
  },
  trousers: {
    body: "M62 28 L138 28 L148 220 L110 220 L100 92 L90 220 L52 220 Z",
    detail: `<path d="M62 28 h76 v13 h-76 z" class="fill"/>
      <path d="M80 41 L84 90 M120 41 L116 90 M100 41 V70" />
      <path d="M66 46 Q74 60 70 70 M134 46 Q126 60 130 70" />`,
    stitch: "M55 212 L89 212 M111 212 L145 212",
  },
  jacket: {
    body: "M68 38 L48 46 L26 156 L45 160 L62 92 L60 200 L140 200 L138 92 L155 160 L174 156 L152 46 L132 38 L100 74 Z",
    detail: `<path d="M68 38 L84 28 L100 74 L116 28 L132 38" class="fill"/>
      <path d="M100 74 V200" />
      <path d="M70 140 h24 v26 h-24 z M106 140 h24 v26 h-24 z M110 92 h18 v18 h-18 z" />
      ${[96, 124, 152, 180].map(y => `<circle cx="104" cy="${y}" r="2.6" fill="#f3ede3"/>`).join("")}`,
    stitch: "M64 192 L136 192 M30 150 L45 153 M170 150 L155 153",
  },
  dress: {
    body: "M80 28 L88 28 Q100 46 112 28 L120 28 L126 82 L118 104 L162 226 Q100 236 38 226 L82 104 L74 82 Z",
    detail: `<path d="M82 104 Q100 110 118 104" /><path d="M100 110 V140" />`,
    stitch: "M46 218 Q100 228 154 218",
  },
  apron: {
    body: "M76 32 L124 32 L126 82 L150 92 L150 222 L50 222 L50 92 L74 82 Z",
    detail: `<path d="M78 32 Q100 0 122 32" fill="none"/>
      <path d="M50 96 L24 110 M150 96 L176 110" />
      <path d="M66 132 h68 v38 h-68 z M100 132 v38" />`,
    stitch: "M56 214 L144 214 M56 98 L56 214 M144 98 L144 214",
  },
  skirt: {
    body: "M66 42 L134 42 L162 220 Q100 230 38 220 Z",
    detail: `<path d="M66 42 h68 v12 h-68 z" class="fill"/>
      <path d="M84 54 L74 222 M100 54 V226 M116 54 L126 222" />`,
    stitch: "M45 212 Q100 222 155 212",
  },
};

function garment(type, fabricKey) {
  const f = FABRICS[fabricKey] || { color: "#e6dccb", tex: "plain" };
  const s = SHAPES[type] || SHAPES.shirt;
  const id = "tx" + (++artId);
  return `<svg viewBox="0 0 200 240" role="img" aria-label="${f.name || ""}" fill="none"
      stroke="#2a2420" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
    <defs>${texPattern(id, f.tex)}</defs>
    <style>.fill{fill:${f.color};}</style>
    <path d="${s.body}" fill="${f.color}"/>
    <path d="${s.body}" fill="url(#${id})" stroke="none"/>
    <path d="${s.body}"/>
    ${s.detail}
    <path d="${s.stitch}" stroke-dasharray="3 3" stroke-width="1" opacity=".7"/>
  </svg>`;
}

// Simple figure used to show where to measure.
function bodyGuide() {
  const lines = {
    height: "M108 10 V250",
    neck: "M51 42 H69",
    shoulder: "M34 54 H86",
    chest: "M36 80 H84",
    waist: "M41 112 H79",
    hip: "M37 140 H83",
    sleeve: "M88 56 L95 140",
    length: "M100 44 V172",
    leg: "M74 114 V248",
  };
  return `<svg viewBox="0 0 120 260" fill="none" stroke="#2a2420" stroke-width="1.3" stroke-linejoin="round">
    <circle cx="60" cy="22" r="13"/>
    <path d="M54 35 V44 L38 51 Q31 55 31 66 L26 140 L33 141 L40 78 L42 112 L37 142 L42 248 L56 248 L60 160 L64 248 L78 248 L83 142 L78 112 L80 78 L87 141 L94 140 L89 66 Q89 55 82 51 L66 44 V35"/>
    ${Object.entries(lines).map(([k, d]) => `<path class="hl" data-zone="${k}" d="${d}"/>`).join("")}
  </svg>`;
}
