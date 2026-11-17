"""Turn Codex raw images (assets-src/raw/*.png) into clean, palette-snapped pixel art.

Usage: python3 -I assets-src/process.py
Outputs: public/assets/{bg,earth,sprites}/...
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets-src' / 'raw'
OUT = ROOT / 'public' / 'assets'

PALETTE = [
    '#0B1F15', '#113020', '#1E4A30', '#2F6B3F', '#8FE060', '#C9F2A8', '#F2F4EF', '#B8C2B4', '#5E6E64',
    '#2A3B33', '#6FB7D9', '#2D6A8C', '#F2C14E', '#E8833A', '#D9473B', '#7A3B4E', '#F0C29A', '#B9785A', '#6E4632',
]


def palette_image() -> Image.Image:
    flat: list[int] = []
    for h in PALETTE:
        flat += [int(h[i:i + 2], 16) for i in (1, 3, 5)]
    flat += flat[:3] * (256 - len(PALETTE))
    p = Image.new('P', (1, 1))
    p.putpalette(flat)
    return p


PAL = palette_image()


def snap(img: Image.Image) -> Image.Image:
    """Quantize RGB to the brand palette, no dithering."""
    return img.convert('RGB').quantize(palette=PAL, dither=Image.Dither.NONE).convert('RGB')


def crop_ratio(img: Image.Image, rw: int, rh: int) -> Image.Image:
    w, h = img.size
    target = rw / rh
    if w / h > target:
        nw = int(h * target)
        x = (w - nw) // 2
        return img.crop((x, 0, x + nw, h))
    nh = int(w / target)
    y = (h - nh) // 2
    return img.crop((0, y, w, y + nh))


def background(src: Path, dst: Path, size=(320, 180)) -> None:
    img = Image.open(src).convert('RGB')
    img = crop_ratio(img, *size)
    # Downscale in two steps: box filter keeps flat colour areas clean.
    img = img.resize(size, Image.Resampling.BOX)
    img = snap(img)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, optimize=True)


def to_rgba_keyed(img: Image.Image) -> Image.Image:
    """Ensure transparency: if the image has no real alpha, key out the border colour."""
    img = img.convert('RGBA')
    alpha = img.getchannel('A')
    if alpha.getextrema()[0] < 250:
        return img
    px = img.load()
    w, h = img.size
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)]
    border += [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    from collections import Counter

    key = Counter(c[:3] for c in border).most_common(1)[0][0]
    data = [
        (r, g, b, 0) if abs(r - key[0]) + abs(g - key[1]) + abs(b - key[2]) < 60 else (r, g, b, 255)
        for (r, g, b, _a) in img.getdata()
    ]
    img.putdata(data)
    return img


def components(img: Image.Image, merge: int) -> list[tuple[int, int, int, int]]:
    """Bounding boxes of sprites on a transparent sheet (dilated so a sprite's parts merge)."""
    mask = img.getchannel('A').point(lambda a: 255 if a > 40 else 0)
    small_scale = 4
    sm = mask.resize((mask.width // small_scale, mask.height // small_scale), Image.Resampling.BOX)
    sm = sm.point(lambda a: 255 if a > 20 else 0).filter(ImageFilter.MaxFilter(merge | 1))
    w, h = sm.size
    seen = bytearray(w * h)
    data = sm.load()
    boxes = []
    for y in range(h):
        for x in range(w):
            if data[x, y] and not seen[y * w + x]:
                stack = [(x, y)]
                seen[y * w + x] = 1
                x0 = x1 = x
                y0 = y1 = y
                while stack:
                    cx, cy = stack.pop()
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and data[nx, ny] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1
                            stack.append((nx, ny))
                if (x1 - x0) * (y1 - y0) > 30:
                    boxes.append((x0 * small_scale, y0 * small_scale, (x1 + 1) * small_scale, (y1 + 1) * small_scale))
    # Row-major order: group by rows (centre y), then x.
    boxes.sort(key=lambda b: ((b[1] + b[3]) // 2, b[0]))
    rows: list[list[tuple[int, int, int, int]]] = []
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        if rows and abs(((rows[-1][0][1] + rows[-1][0][3]) / 2) - cy) < (b[3] - b[1]) * 0.6:
            rows[-1].append(b)
        else:
            rows.append([b])
    return [b for row in rows for b in sorted(row, key=lambda b: b[0])]


def sprite(img: Image.Image, box, size: int) -> Image.Image:
    crop = img.crop(box)
    # Tight crop on alpha.
    bb = crop.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()
    if bb:
        crop = crop.crop(bb)
    w, h = crop.size
    scale = size / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    small = crop.resize((nw, nh), Image.Resampling.BOX)
    rgb = snap(small)
    alpha = small.getchannel('A').point(lambda a: 255 if a > 110 else 0)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    tile = rgb.convert('RGBA')
    tile.putalpha(alpha)
    out.paste(tile, ((size - nw) // 2, size - nh if size > nh else 0))
    return out


def sheet(src: Path, names: list[str], prefix: str, size: int, merge: int = 5) -> None:
    img = to_rgba_keyed(Image.open(src))
    boxes = components(img, merge)
    if len(boxes) != len(names):
        print(f'  ! {src.name}: found {len(boxes)} sprites, expected {len(names)} — check manually', file=sys.stderr)
    dst = OUT / 'sprites'
    dst.mkdir(parents=True, exist_ok=True)
    for name, box in zip(names, boxes):
        sprite(img, box, size).save(dst / f'{prefix}{name}.png', optimize=True)


SHEETS = {
    'sheet_sprouts.png': ('sprout_', 40, ['seed', 'tiny', 'sprout', 'sapling', 'tree', 'wilted', 'burnt']),
    'sheet_icons.png': ('icon_', 32, ['coin', 'heart', 'people', 'star', 'impact', 'lock', 'co2', 'plane', 'train', 'phone',
                                      'laptop', 'briefcase', 'cap', 'chip', 'thermometer', 'wave', 'bee', 'sun', 'trophy', 'hourglass']),
    'sheet_characters.png': ('char_', 48, ['pm', 'roommate', 'stranger', 'manager', 'friend', 'kid']),
    'sheet_employers.png': ('emp_', 32, ['surveillance', 'oil', 'bank', 'consulting', 'social', 'ai_startup', 'ngo', 'public_lab', 'agency']),
}


def main() -> None:
    done = 0
    for src in sorted(RAW.glob('*.png')):
        n = src.name
        if n.startswith('bg_'):
            background(src, OUT / 'bg' / (n[3:]))
        elif n.startswith('earth_'):
            background(src, OUT / 'earth' / n, size=(320, 180))
        elif n in SHEETS:
            prefix, size, names = SHEETS[n]
            sheet(src, names, prefix, size)
        else:
            continue
        done += 1
        print('  ✓', n)
    print(f'{done} source images processed → {OUT}')


if __name__ == '__main__':
    main()
