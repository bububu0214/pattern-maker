// Drawing used in the measurement step to show where to measure.

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
