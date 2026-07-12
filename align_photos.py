#!/usr/bin/env python3
"""
align_photos.py — автоматично обчислює точні координати (x, y) для фото-мапи
та генерує config.js.

Навіщо: реальні фото рідко накладаються одне на одне рівно по прямій сітці —
буває невеликий діагональний зсув. Цей скрипт знаходить точний зсув між
сусідніми фото через кроскореляцію зображень (а не підбір "на око") і сам
пише готовий config.js.

Вимоги:
    pip install numpy scipy pillow --break-system-packages

Використання:
    1. Покладіть фото в одну папку з іменами row_col.jpg (наприклад
       0_0.jpg, 0_1.jpg, 1_0.jpg, 1_1.jpg — рядок_стовпець, нумерація з 0).
    2. Запустіть:
         python3 align_photos.py --dir photos --out config.js
    3. Готовий config.js буде записано поруч (не забудьте підставити його
       у ваш проєкт фото-мапи).
"""

import argparse
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.signal import fftconvolve


def load_gray(path):
    im = Image.open(path).convert("L")
    return np.asarray(im, dtype=np.float64)


def best_shift(a, b):
    """Повертає (dy, dx) — зсув b відносно a, знайдений кроскореляцією."""
    a = a - a.mean()
    b = b - b.mean()
    corr = fftconvolve(a, b[::-1, ::-1], mode="full")
    peak = np.unravel_index(np.argmax(corr), corr.shape)
    h, w = a.shape
    dy = int(peak[0] - (h - 1))
    dx = int(peak[1] - (w - 1))
    return dy, dx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="photos", help="Папка з фото row_col.jpg")
    ap.add_argument("--out", default="config.js", help="Куди записати config.js")
    ap.add_argument("--ext", default="jpg", help="Розширення файлів (jpg/png/...)")
    args = ap.parse_args()

    folder = Path(args.dir)
    pattern = re.compile(rf"^(\d+)_(\d+)\.{re.escape(args.ext)}$")

    files = {}
    for f in folder.iterdir():
        m = pattern.match(f.name)
        if m:
            row, col = int(m.group(1)), int(m.group(2))
            files[(row, col)] = f

    if not files:
        print(f"Не знайдено файлів виду row_col.{args.ext} у {folder}", file=sys.stderr)
        sys.exit(1)

    rows = max(r for r, c in files) + 1
    cols = max(c for r, c in files) + 1
    print(f"Знайдено {len(files)} фото, сітка {rows}x{cols}")

    with Image.open(next(iter(files.values()))) as im:
        tile_w, tile_h = im.size
    print(f"Розмір тайлу: {tile_w}x{tile_h}")

    gray = {}
    for pos, path in files.items():
        gray[pos] = load_gray(path)
        if gray[pos].shape != (tile_h, tile_w):
            print(f"Увага: {path.name} має інший розмір!", file=sys.stderr)

    # Обчислюємо зсуви між усіма горизонтальними та вертикальними сусідами
    edge_shift = {}  # (pos_a, pos_b) -> (dy, dx), b відносно a
    for (row, col), path in files.items():
        right = (row, col + 1)
        below = (row + 1, col)
        if right in files:
            dy, dx = best_shift(gray[(row, col)], gray[right])
            edge_shift[((row, col), right)] = (dy, dx)
            print(f"{row}_{col} -> {right[0]}_{right[1]}: dx={dx}, dy={dy}")
        if below in files:
            dy, dx = best_shift(gray[(row, col)], gray[below])
            edge_shift[((row, col), below)] = (dy, dx)
            print(f"{row}_{col} -> {below[0]}_{below[1]}: dx={dx}, dy={dy}")

    # BFS від (0,0), щоб отримати абсолютні координати кожного тайлу
    origin = min(files.keys())
    abs_pos = {origin: (0, 0)}
    frontier = [origin]
    while frontier:
        cur = frontier.pop()
        cx, cy = abs_pos[cur]
        for (a, b), (dy, dx) in edge_shift.items():
            if a == cur and b not in abs_pos:
                abs_pos[b] = (cx + dx, cy + dy)
                frontier.append(b)
            elif b == cur and a not in abs_pos:
                abs_pos[a] = (cx - dx, cy - dy)
                frontier.append(a)

    missing = set(files) - set(abs_pos)
    if missing:
        print(f"Увага: не вдалося прив'язати {missing} (немає спільного сусіда)", file=sys.stderr)

    minx = min(x for x, y in abs_pos.values())
    miny = min(y for x, y in abs_pos.values())

    lines = []
    lines.append("// Автоматично згенеровано align_photos.py — координати обчислені")
    lines.append("// кроскореляцією зображень, не редагуйте x/y вручну.")
    lines.append("const MAP_CONFIG = {")
    lines.append(f"  tileWidth: {tile_w},")
    lines.append(f"  tileHeight: {tile_h},")
    lines.append("")
    lines.append("  edgeFade: true,")
    lines.append("  fadeWidth: null,")
    lines.append("")
    lines.append("  tiles: [")
    for (row, col), path in sorted(files.items()):
        if (row, col) not in abs_pos:
            continue
        x, y = abs_pos[(row, col)]
        x -= minx
        y -= miny
        lines.append(
            f'    {{ row: {row}, col: {col}, x: {x}, y: {y}, src: "photos/{path.name}" }},'
        )
    lines.append("  ],")
    lines.append("};")

    Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nГотово: {args.out}")


if __name__ == "__main__":
    main()
