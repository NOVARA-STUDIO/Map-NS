#!/usr/bin/env python3
"""
align_photos.py — автоматично обчислює точні координати (x, y) для фото-мапи
та генерує config.js.

Навіщо: реальні фото рідко накладаються одне на одне рівно по прямій сітці —
буває невеликий діагональний зсув, а на самому фото шукати збіг "по пікселях"
ненадійно (повторювані текстури: ліс, трава, вода — усе це виглядає схоже).
Тому скрипт шукає збіг характерних деталей (ORB feature matching) — доріг,
будівель, берегової лінії — і через RANSAC відкидає помилкові збіги.
Якщо у вас на фото є "віньєтка" — затемнені/розмиті краї — вона ігнорується
автоматично, бо скрипт не спирається на кольори країв, лише на деталі.

Вимоги:
    pip install numpy opencv-python-headless pillow --break-system-packages

Використання:
    1. Покладіть фото в одну папку з іменами row_col.png (наприклад
       0_0.png, 0_1.png, 1_0.png, 1_1.png — рядок_стовпець, нумерація з 0).
    2. Запустіть:
         python3 align_photos.py --dir photos --out config.js
    3. Готовий config.js буде записано поруч.
"""

import argparse
import glob
import json
import os
import re
import sys
from pathlib import Path

import numpy as np
import cv2
from PIL import Image


def load_gray(path):
    return np.array(Image.open(path).convert("L"))


def find_shift(kp_desc, bf, a_pos, b_pos, min_matches=8, ransac_thresh=4.0):
    """Повертає (tx, ty, n_inliers) — переміщення фічей з a у b, або None."""
    kpA, descA = kp_desc[a_pos]
    kpB, descB = kp_desc[b_pos]
    if descA is None or descB is None or len(descA) < 2 or len(descB) < 2:
        return None
    matches = bf.knnMatch(descA, descB, k=2)
    good = [m for m, n in matches if m.distance < 0.75 * n.distance]
    if len(good) < min_matches:
        return None
    ptsA = np.float32([kpA[m.queryIdx].pt for m in good])
    ptsB = np.float32([kpB[m.trainIdx].pt for m in good])
    M, inliers = cv2.estimateAffinePartial2D(
        ptsA, ptsB, method=cv2.RANSAC, ransacReprojThreshold=ransac_thresh
    )
    if M is None:
        return None
    n_inliers = int(inliers.sum()) if inliers is not None else 0
    scale = (M[0, 0] ** 2 + M[1, 0] ** 2) ** 0.5
    if not (0.9 < scale < 1.1):
        return None  # явно неправильний збіг (масштаб мав би бути ~1)
    return M[0, 2], M[1, 2], n_inliers


def solve_positions(nodes, edges, fixed_node):
    """Зважений МНК: знаходить (x,y) кожного тайлу з набору парних зсувів.
    edges: список (a, b, tx, ty, weight); constraint: pos[a] - pos[b] = (tx,ty)
    """
    free_nodes = [n for n in nodes if n != fixed_node]
    fidx = {n: i for i, n in enumerate(free_nodes)}

    def solve_axis(axis):
        rows, rhs, weights = [], [], []
        for a, b, tx, ty, w in edges:
            t = tx if axis == 0 else ty
            row = np.zeros(len(free_nodes))
            if a in fidx:
                row[fidx[a]] += 1
            if b in fidx:
                row[fidx[b]] -= 1
            rows.append(row)
            rhs.append(t)
            weights.append(np.sqrt(w))
        A = np.array(rows) * np.array(weights)[:, None]
        b_ = np.array(rhs) * np.array(weights)
        sol, *_ = np.linalg.lstsq(A, b_, rcond=None)
        return sol

    sol_x = solve_axis(0)
    sol_y = solve_axis(1)
    positions = {fixed_node: (0.0, 0.0)}
    for n in free_nodes:
        positions[n] = (sol_x[fidx[n]], sol_y[fidx[n]])
    return positions


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="photos", help="Папка з фото row_col.png")
    ap.add_argument("--out", default="config.js", help="Куди записати config.js")
    ap.add_argument("--ext", default="png", help="Розширення файлів (png/jpg/...)")
    ap.add_argument("--features", type=int, default=6000, help="К-сть ORB-фічей на фото")
    args = ap.parse_args()

    folder = Path(args.dir)
    pattern = re.compile(rf"^(\d+)_(\d+)\.{re.escape(args.ext)}$")

    files = {}
    for f in folder.iterdir():
        m = pattern.match(f.name)
        if m:
            files[(int(m.group(1)), int(m.group(2)))] = f

    if not files:
        print(f"Не знайдено файлів виду row_col.{args.ext} у {folder}", file=sys.stderr)
        sys.exit(1)

    rows = max(r for r, c in files) + 1
    cols = max(c for r, c in files) + 1
    print(f"Знайдено {len(files)} фото, сітка {rows}x{cols}")

    with Image.open(next(iter(files.values()))) as im:
        tile_w, tile_h = im.size
    print(f"Розмір тайлу: {tile_w}x{tile_h}")

    gray = {pos: load_gray(p) for pos, p in files.items()}

    orb = cv2.ORB_create(nfeatures=args.features)
    kp_desc = {pos: orb.detectAndCompute(g, None) for pos, g in gray.items()}
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

    edges = []
    for (row, col) in files:
        for nb, label in [((row, col + 1), "right"), ((row + 1, col), "below")]:
            if nb not in files:
                continue
            res = find_shift(kp_desc, bf, (row, col), nb)
            if res is None:
                print(f"  {row}_{col} -> {nb[0]}_{nb[1]}: не вдалося знайти збіг")
                continue
            tx, ty, n_inl = res
            print(f"  {row}_{col} -> {nb[0]}_{nb[1]}: зсув=({tx:.1f},{ty:.1f}) інлаєрів={n_inl}")
            edges.append(((row, col), nb, tx, ty, n_inl))

    if not edges:
        print("Жодного зв'язку між фото не знайдено — перевірте назви файлів.", file=sys.stderr)
        sys.exit(1)

    # Перевіряємо, що граф зв'язний (усі тайли досяжні один з одного)
    nodes = list(files.keys())
    adj = {n: [] for n in nodes}
    for a, b, *_ in edges:
        adj[a].append(b)
        adj[b].append(a)
    start = nodes[0]
    seen = {start}
    stack = [start]
    while stack:
        cur = stack.pop()
        for nb in adj[cur]:
            if nb not in seen:
                seen.add(nb)
                stack.append(nb)
    unreachable = set(nodes) - seen
    if unreachable:
        print(f"Увага: ці тайли не вдалося прив'язати до решти: {unreachable}", file=sys.stderr)

    fixed = nodes[0]
    positions = solve_positions([n for n in nodes if n in seen], edges, fixed)

    minx = min(p[0] for p in positions.values())
    miny = min(p[1] for p in positions.values())

    lines = []
    lines.append("// Автоматично згенеровано align_photos.py (ORB + RANSAC feature matching) —")
    lines.append("// координати обчислені з реального збігу деталей на фото, не редагуйте x/y вручну.")
    lines.append("const MAP_CONFIG = {")
    lines.append(f"  tileWidth: {tile_w},")
    lines.append(f"  tileHeight: {tile_h},")
    lines.append("")
    lines.append("  edgeFade: true,")
    lines.append("  fadeWidth: null,")
    lines.append("")
    lines.append("  tiles: [")
    for (row, col) in sorted(positions.keys()):
        x, y = positions[(row, col)]
        x = round(x - minx)
        y = round(y - miny)
        src = files[(row, col)].name
        lines.append(f'    {{ row: {row}, col: {col}, x: {x}, y: {y}, src: "photos/{src}" }},')
    lines.append("  ],")
    lines.append("};")

    Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nГотово: {args.out}")


if __name__ == "__main__":
    main()
