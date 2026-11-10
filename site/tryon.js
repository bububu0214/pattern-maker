// Put an uploaded fabric photo onto a garment photo, in the browser.
// Each garment has three prepared layers (see img/tryon-*):
//   mask  – where the fabric goes (alpha)
//   shade – light and shadow from the original photo, multiplied over the fabric
//   lines – seams, edges and button rims drawn on top

const TryOn = (() => {
  const cache = {};
  const load = src => cache[src] || (cache[src] = new Promise((ok, fail) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = fail;
    im.src = src;
  }));

  // scale: width of one repeat as a share of the photo width (0.1 = small print, 0.6 = big print)
  async function render(canvas, cfg, fabricSrc, scale, mirror = false) {
    const [base, mask, shade, lines, fab] = await Promise.all([
      load(cfg.base), load(`img/tryon-${cfg.key}-mask.png`), load(`img/tryon-${cfg.key}-shade.png`),
      load(`img/tryon-${cfg.key}-lines.png`), load(fabricSrc),
    ]);
    const W = base.naturalWidth, H = base.naturalHeight;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(base, 0, 0);

    // one tile of fabric at the chosen size
    const tw = Math.max(20, Math.round(W * scale));
    const th = Math.round(tw * fab.naturalHeight / fab.naturalWidth);
    // mirror: 2x2 flipped tile, so edges meet without a seam (but prints turn symmetrical)
    const n = mirror ? 2 : 1;
    const tile = document.createElement("canvas");
    tile.width = tw * n; tile.height = th * n;
    const t = tile.getContext("2d");
    for (const [sx, sy] of mirror ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 1]]) {
      t.setTransform(sx, 0, 0, sy, sx < 0 ? tw * 2 : 0, sy < 0 ? th * 2 : 0);
      t.drawImage(fab, 0, 0, tw, th);
    }
    t.setTransform(1, 0, 0, 1, 0, 0);

    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const o = off.getContext("2d");
    o.fillStyle = o.createPattern(tile, "repeat");
    o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = "multiply";
    o.drawImage(shade, 0, 0);
    o.globalCompositeOperation = "destination-in";
    o.drawImage(mask, 0, 0);

    ctx.drawImage(off, 0, 0);
    ctx.drawImage(lines, 0, 0);
  }

  // small picture for the cart; may fail if the browser blocks reading the canvas
  function thumb(canvas) {
    try {
      const t = document.createElement("canvas");
      t.width = 300; t.height = Math.round(300 * canvas.height / canvas.width);
      t.getContext("2d").drawImage(canvas, 0, 0, t.width, t.height);
      return t.toDataURL("image/jpeg", 0.8);
    } catch { return null; }
  }

  return { render, thumb };
})();
