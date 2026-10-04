#!/usr/bin/env python3
"""
Bake the approved LOGO MASTER into generated catalog raster assets.

Rules:
- visual master = the Hidden Doors logo from ARC model page 19;
- final visual scale/margins are taken from the user-approved live ARC 18–19 spread;
- replace only pages that already contain a catalog logo, preserving which side that page used;
- special approved pilot exception: page 05 also receives the master logo on the right;
- 36 mm interior/full-bleed pages stay logo-free;
- cover, back cover and hidden source pages stay untouched;
- only the historical logo/header branding zone is cleared; page content is not reflowed.
"""
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw

GREEN_MIN = 105

# Approved visual reference from the live ARC 18–19 spread screenshot.
# Measured against the visible page-19 sheet:
# logo width ≈ 19.44% of page width
# outer margin ≈ 3.10% of page width
# top margin ≈ 5.39% of page height
TARGET_WIDTH_RATIO = 0.1944
TARGET_OUTER_RATIO = 0.0310
TARGET_TOP_RATIO = 0.0539

HIDDEN_PHYSICAL = {24, 25, 26}
COVER_PAGES = {1, 44}

# 36 mm collection spreads: the interior/full-bleed half intentionally has no logo.
NO_LOGO_36_INTERIORS = {6, 9, 10, 13, 14, 17, 18, 21}

# Page 05 was explicitly approved as the pilot spread companion and receives the logo
# even though the historical source page did not contain one.
FORCED_LOGO_SIDE = {5: "right"}


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def is_green(r, g, b):
    return g >= GREEN_MIN and (g - r) >= 24 and (g - b) >= 18 and r <= 195


def green_mask(region: Image.Image) -> Image.Image:
    src = region.convert("RGB")
    out = Image.new("L", src.size, 0)
    sp = src.load()
    op = out.load()
    for yy in range(src.height):
        for xx in range(src.width):
            if is_green(*sp[xx, yy]):
                op[xx, yy] = 255
    return out


def components(mask: Image.Image):
    w, h = mask.size
    px = mask.load()
    seen = bytearray(w * h)
    out = []

    for yy in range(h):
        row = yy * w
        for xx in range(w):
            idx = row + xx
            if seen[idx] or px[xx, yy] == 0:
                continue

            q = deque([(xx, yy)])
            seen[idx] = 1
            x0 = x1 = xx
            y0 = y1 = yy
            count = 0

            while q:
                x, y = q.popleft()
                count += 1
                x0 = min(x0, x); x1 = max(x1, x)
                y0 = min(y0, y); y1 = max(y1, y)

                for ny in (y - 1, y, y + 1):
                    if ny < 0 or ny >= h:
                        continue
                    base = ny * w
                    for nx in (x - 1, x, x + 1):
                        if nx < 0 or nx >= w:
                            continue
                        ni = base + nx
                        if not seen[ni] and px[nx, ny] != 0:
                            seen[ni] = 1
                            q.append((nx, ny))

            out.append((x0, y0, x1 + 1, y1 + 1, count))

    return out


def detect_existing_logo(im: Image.Image):
    """
    Detect the existing Hidden Doors logo in the upper-left or upper-right header.

    The brand mark is uniquely useful here: it contains several tall green components
    followed immediately by a dark wordmark. Thin green heading rules are ignored.
    Returns (side, bbox) in page pixels, or None.
    """
    W, H = im.size
    top_h = round(H * 0.18)
    candidates = []

    # Wide corner windows are intentional: some historical pages placed the logo
    # noticeably inward instead of against the trim edge.
    windows = (
        ("left", 0, round(W * 0.45)),
        ("right", round(W * 0.55), W),
    )

    for side, rx0, rx1 in windows:
        region = im.crop((rx0, 0, rx1, top_h)).convert("RGB")
        mask = green_mask(region)

        tall = []
        for x0, y0, x1, y1, area in components(mask):
            bw = x1 - x0
            bh = y1 - y0
            if bh < H * 0.020 or bh > H * 0.130:
                continue
            if bw < W * 0.0015 or bw > W * 0.065:
                continue
            if area < 12 or y0 > H * 0.130:
                continue
            tall.append((x0, y0, x1, y1, area))

        # Connect nearby tall green strokes into a candidate brand icon.
        n = len(tall)
        adjacency = [set() for _ in range(n)]
        for i, a in enumerate(tall):
            acy = (a[1] + a[3]) / 2
            for j, b in enumerate(tall):
                if i == j:
                    continue
                bcy = (b[1] + b[3]) / 2
                hgap = max(0, max(b[0] - a[2], a[0] - b[2]))
                if abs(acy - bcy) <= H * 0.040 and hgap <= W * 0.040:
                    adjacency[i].add(j)

        visited = set()
        groups = []
        for i in range(n):
            if i in visited:
                continue
            stack = [i]
            visited.add(i)
            inds = []
            while stack:
                k = stack.pop()
                inds.append(k)
                for j in adjacency[k]:
                    if j not in visited:
                        visited.add(j)
                        stack.append(j)

            if len(inds) < 3:
                continue

            group = [tall[k] for k in inds]
            gx0 = min(c[0] for c in group)
            gy0 = min(c[1] for c in group)
            gx1 = max(c[2] for c in group)
            gy1 = max(c[3] for c in group)

            if gx1 - gx0 > W * 0.150 or gy1 > H * 0.180:
                continue
            groups.append((gx0, gy0, gx1, gy1, group))

        rp = region.load()
        for gx0, gy0, gx1, gy1, group in groups:
            # Hidden Doors wordmark sits immediately to the right of the green mark.
            x2 = min(region.width, round(gx1 + W * 0.19))
            ylo = max(0, round(gy0 - H * 0.020))
            yhi = min(top_h, round(gy1 + H * 0.035))

            dark = []
            for yy in range(ylo, yhi):
                for xx in range(gx1, x2):
                    r, g, b = rp[xx, yy]
                    if r < 120 and g < 120 and b < 120:
                        dark.append((xx, yy))

            if len(dark) < 70:
                continue

            dx0 = min(x for x, _ in dark)
            dy0 = min(y for _, y in dark)
            dx1 = max(x for x, _ in dark) + 1
            dy1 = max(y for _, y in dark) + 1

            bx0 = rx0 + gx0
            by0 = min(gy0, dy0)
            bx1 = rx0 + max(gx1, dx1)
            by1 = max(gy1, dy1)

            score = len(group) * 1000 + len(dark)
            candidates.append((score, side, (bx0, by0, bx1, by1)))

    if not candidates:
        return None

    _, side, bbox = max(candidates, key=lambda item: item[0])
    return side, bbox


def logo_master_from_arc(page19: Path):
    ref = Image.open(page19).convert("RGB")
    detected = detect_existing_logo(ref)
    if not detected:
        raise RuntimeError("LOGO MASTER: could not detect ARC page 19 logo")

    _, (x0, y0, x1, y1) = detected
    W, H = ref.size

    # Tiny optical padding preserves anti-aliasing while keeping the crop tight.
    px = max(1, round(W * 0.0015))
    py = max(1, round(H * 0.0015))
    x0 = max(0, x0 - px)
    y0 = max(0, y0 - py)
    x1 = min(W, x1 + px)
    y1 = min(H, y1 + py)

    logo = ref.crop((x0, y0, x1, y1))
    return {
        "image": logo,
        "source_width_ratio": logo.width / W,
    }


def clear_historical_logo(im: Image.Image, bbox):
    """
    Erase only the old logo/header branding around the detected logo.

    The extra bottom padding intentionally catches legacy green underlines and
    legacy factory taglines used on early technical pages.
    """
    W, H = im.size
    x0, y0, x1, y1 = bbox

    pad_x = round(W * 0.015)
    pad_top = round(H * 0.010)
    pad_bottom = round(H * 0.060)

    x0 = clamp(x0 - pad_x, 0, W - 1)
    y0 = clamp(y0 - pad_top, 0, H - 1)
    x1 = clamp(x1 + pad_x, x0 + 1, W)
    y1 = clamp(y1 + pad_bottom, y0 + 1, H)

    ImageDraw.Draw(im).rectangle((x0, y0, x1, y1), fill=(255, 255, 255))


def place_master_logo(im: Image.Image, side: str, master):
    W, H = im.size
    source = master["image"]

    target_w = max(1, round(W * TARGET_WIDTH_RATIO))
    target_h = max(1, round(target_w * source.height / source.width))
    logo = source.resize((target_w, target_h), Image.Resampling.LANCZOS)

    outer = round(W * TARGET_OUTER_RATIO)
    top = round(H * TARGET_TOP_RATIO)
    x = outer if side == "left" else W - outer - target_w

    # The master crop comes from a white catalog header, so pasting it also
    # guarantees no historical logo fragments remain immediately underneath.
    im.paste(logo, (x, top))


def process_image(path: Path, physical: int, master):
    im = Image.open(path).convert("RGB")

    if physical in HIDDEN_PHYSICAL or physical in COVER_PAGES:
        return None
    if physical in NO_LOGO_36_INTERIORS:
        return None

    detected = detect_existing_logo(im)
    forced_side = FORCED_LOGO_SIDE.get(physical)

    if detected:
        side, bbox = detected
        clear_historical_logo(im, bbox)
    elif forced_side:
        side = forced_side
    else:
        # Preserve intentional logo absence on pages that historically had no logo.
        return None

    place_master_logo(im, side, master)
    im.save(path, "WEBP", quality=95, method=6)
    return side


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True, help="Generated catalog site directory")
    args = ap.parse_args()

    site = Path(args.site)
    page19 = site / "assets" / "pages" / "page-019.webp"
    if not page19.exists():
        raise SystemExit(f"LOGO MASTER: reference page missing: {page19}")

    # Capture the approved artwork before page 19 itself is replaced.
    master = logo_master_from_arc(page19)

    replaced = []
    for physical in range(1, 45):
        name = f"page-{physical:03d}.webp"
        page = site / "assets" / "pages" / name
        thumb = site / "assets" / "thumbs" / name

        if not page.exists():
            continue

        side = process_image(page, physical, master)
        if side:
            replaced.append((physical, side))
            if thumb.exists():
                process_image(thumb, physical, master)

    formatted = ", ".join(f"{p:02d}:{s}" for p, s in replaced)
    print(
        "LOGO MASTER rollout complete. "
        f"Replaced {len(replaced)} page logo(s): {formatted}. "
        f"Master width={TARGET_WIDTH_RATIO*100:.2f}%, "
        f"outer={TARGET_OUTER_RATIO*100:.2f}%, top={TARGET_TOP_RATIO*100:.2f}%. "
        f"ARC source artwork crop={master['source_width_ratio']*100:.2f}% of source page."
    )


if __name__ == "__main__":
    main()
