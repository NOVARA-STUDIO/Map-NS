(function () {
  const grid = document.getElementById("grid");
  const world = document.getElementById("world");
  const viewport = document.getElementById("viewport");
  const zoomLabel = document.getElementById("zoomLabel");

  const { tileWidth, tileHeight, tiles, edgeFade, fadeWidth } = MAP_CONFIG;

  // Індекс по row/col для пошуку сусідів
  const byRC = {};
  tiles.forEach((t) => (byRC[t.row + "_" + t.col] = t));
  const neighbor = (t, dr, dc) => byRC[(t.row + dr) + "_" + (t.col + dc)];

  // Межі всієї мапи за реальними координатами тайлів
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  tiles.forEach((t) => {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + tileWidth);
    maxY = Math.max(maxY, t.y + tileHeight);
  });
  const mapWidth = maxX - minX;
  const mapHeight = maxY - minY;

  grid.style.width = mapWidth + "px";
  grid.style.height = mapHeight + "px";

  // Наскільки два тайли фактично перекриваються по заданому боку (px)
  function overlapAmount(t, dir) {
    if (dir === "right") {
      const o = neighbor(t, 0, 1);
      return o ? Math.max(0, t.x + tileWidth - o.x) : 0;
    }
    if (dir === "left") {
      const o = neighbor(t, 0, -1);
      return o ? Math.max(0, o.x + tileWidth - t.x) : 0;
    }
    if (dir === "bottom") {
      const o = neighbor(t, 1, 0);
      return o ? Math.max(0, t.y + tileHeight - o.y) : 0;
    }
    if (dir === "top") {
      const o = neighbor(t, -1, 0);
      return o ? Math.max(0, o.y + tileHeight - t.y) : 0;
    }
    return 0;
  }

  tiles.forEach((t) => {
    const el = document.createElement("div");
    el.className = "tile";
    el.style.left = t.x - minX + "px";
    el.style.top = t.y - minY + "px";
    el.style.width = tileWidth + "px";
    el.style.height = tileHeight + "px";
    // Пізніші (нижче/правіше) тайли малюються поверх — приховують шов знизу
    el.style.zIndex = t.row * 1000 + t.col + 1;

    if (edgeFade) {
      const sides = {
        left: overlapAmount(t, "left"),
        right: overlapAmount(t, "right"),
        top: overlapAmount(t, "top"),
        bottom: overlapAmount(t, "bottom"),
      };
      applyEdgeFade(el, sides);
    }

    if (t.src) {
      const img = document.createElement("img");
      img.src = t.src;
      img.alt = `Фото ${t.row}_${t.col}`;
      img.onerror = () => {
        el.removeChild(img);
        el.appendChild(placeholder(t));
      };
      el.appendChild(img);
    } else {
      el.appendChild(placeholder(t));
    }

    grid.appendChild(el);
  });

  // Робить краї тайлу, де є сусід, плавно прозорими на ширину фактичного
  // накладення (або обмежену fadeWidth), щоб фото м'яко перетікали одне в
  // одне (crossfade) замість жорсткого шва.
  function applyEdgeFade(el, sides) {
    const w = (px) => (fadeWidth ? Math.min(px, fadeWidth) : px);
    const masks = [];
    if (sides.left > 0) masks.push(`linear-gradient(to right, transparent 0, #000 ${w(sides.left)}px)`);
    if (sides.right > 0) masks.push(`linear-gradient(to left, transparent 0, #000 ${w(sides.right)}px)`);
    if (sides.top > 0) masks.push(`linear-gradient(to bottom, transparent 0, #000 ${w(sides.top)}px)`);
    if (sides.bottom > 0) masks.push(`linear-gradient(to top, transparent 0, #000 ${w(sides.bottom)}px)`);
    if (!masks.length) return;

    const maskValue = masks.join(", ");
    const composite = masks.map(() => "intersect").join(", ");
    const webkitComposite = masks.slice(1).map(() => "source-in").join(", ") || "source-over";

    el.style.maskImage = maskValue;
    el.style.webkitMaskImage = maskValue;
    el.style.maskComposite = composite;
    el.style.webkitMaskComposite = webkitComposite;
    el.style.maskRepeat = "no-repeat";
    el.style.webkitMaskRepeat = "no-repeat";
    el.style.maskSize = "100% 100%";
    el.style.webkitMaskSize = "100% 100%";
  }

  function placeholder(t) {
    const p = document.createElement("div");
    p.className = "placeholder";
    p.textContent = `${t.row}_${t.col}`;
    p.style.background = `hsl(${((t.row * 7 + t.col) * 47) % 360}, 35%, 22%)`;
    return p;
  }

  // ---------- Пан і зум ----------
  let scale = 1;
  let originX = 0;
  let originY = 0;
  const minScale = 0.15;
  const maxScale = 2.5;

  function applyTransform() {
    world.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
    zoomLabel.textContent = Math.round(scale * 100) + "%";
  }

  function fitToScreen() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    scale = Math.min(vw / mapWidth, vh / mapHeight) * 0.95;
    scale = Math.max(minScale, Math.min(maxScale, scale));
    originX = (vw - mapWidth * scale) / 2;
    originY = (vh - mapHeight * scale) / 2;
    applyTransform();
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const newScale = Math.max(minScale, Math.min(maxScale, scale * factor));
    const ratio = newScale / scale;

    originX = x - (x - originX) * ratio;
    originY = y - (y - originY) * ratio;
    scale = newScale;
    applyTransform();
  }

  viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(e.clientX, e.clientY, factor);
    },
    { passive: false }
  );

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  viewport.addEventListener("mousedown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    viewport.classList.add("dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    originX += e.clientX - lastX;
    originY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
    viewport.classList.remove("dragging");
  });

  let touchState = null;

  viewport.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        touchState = { mode: "pan", x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        touchState = { mode: "pinch", dist: touchDist(e.touches) };
      }
    },
    { passive: true }
  );

  viewport.addEventListener(
    "touchmove",
    (e) => {
      if (!touchState) return;
      if (touchState.mode === "pan" && e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchState.x;
        const dy = e.touches[0].clientY - touchState.y;
        originX += dx;
        originY += dy;
        touchState.x = e.touches[0].clientX;
        touchState.y = e.touches[0].clientY;
        applyTransform();
      } else if (touchState.mode === "pinch" && e.touches.length === 2) {
        const newDist = touchDist(e.touches);
        const factor = newDist / touchState.dist;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomAt(cx, cy, factor);
        touchState.dist = newDist;
      }
    },
    { passive: true }
  );

  viewport.addEventListener("touchend", () => {
    touchState = null;
  });

  function touchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  document.getElementById("zoomIn").addEventListener("click", () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25);
  });
  document.getElementById("zoomOut").addEventListener("click", () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.25);
  });
  document.getElementById("zoomReset").addEventListener("click", fitToScreen);

  window.addEventListener("resize", fitToScreen);

  fitToScreen();
})();
