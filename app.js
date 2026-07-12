(function () {
  const grid = document.getElementById("grid");
  const world = document.getElementById("world");
  const viewport = document.getElementById("viewport");
  const zoomLabel = document.getElementById("zoomLabel");

  const { tileWidth, tileHeight, overlap, rows, cols, tiles } = MAP_CONFIG;

  const stepX = tileWidth - overlap;
  const stepY = tileHeight - overlap;
  const mapWidth = stepX * (cols - 1) + tileWidth;
  const mapHeight = stepY * (rows - 1) + tileHeight;

  grid.style.width = mapWidth + "px";
  grid.style.height = mapHeight + "px";

  // Будуємо тайли. z-index зростає зліва направо, зверху вниз,
  // тож кожне наступне фото трохи перекриває шов попереднього.
  tiles.forEach((t) => {
    const el = document.createElement("div");
    el.className = "tile";
    el.style.left = t.col * stepX + "px";
    el.style.top = t.row * stepY + "px";
    el.style.width = tileWidth + "px";
    el.style.height = tileHeight + "px";
    el.style.zIndex = t.row * cols + t.col + 1;

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

  function placeholder(t) {
    const p = document.createElement("div");
    p.className = "placeholder";
    p.textContent = `${t.row}_${t.col}`;
    p.style.background = `hsl(${(t.row * cols + t.col) * 47 % 360}, 35%, 22%)`;
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

  // Зум відносно позиції курсора (як у Google Maps)
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

  // Перетягування мишею
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

  // Тач (мобільні): панорамування одним пальцем, зум щипком
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

  // Кнопки
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
