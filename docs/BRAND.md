# RESPAWN brand

Logo: a pixel-art sprout (life that grows back = *respawn*). Files in `public/brand/`.

| File | Use |
|---|---|
| `icon.svg`, `icon-{32,180,192,512}.png`, `/favicon.svg`, `/apple-touch-icon.png` | App icon (sprout on forest green, rounded square) |
| `sprout.svg` (lime) / `sprout-ink.svg` (forest) | The sprout alone, pixel-exact 13×14 grid (`sprout-grid.txt`) — scale by integers |
| `wordmark-light.png` / `wordmark-dark.png` | Sprout + "respawn" wordmark on paper / on forest |
| `logo-sheet.png` | Original sheet from the team |

## Palette (from the logo, extended for the game)
Core (logo): **forest `#113020`**, **lime `#8FE060`**, **paper `#F2F4EF`**.

| Role | Hex |
|---|---|
| night / deepest | `#0B1F15` |
| forest (brand ink) | `#113020` |
| pine | `#1E4A30` |
| moss | `#2F6B3F` |
| lime (brand accent, life, positive) | `#8FE060` |
| mint (highlight) | `#C9F2A8` |
| paper (brand light) | `#F2F4EF` |
| stone | `#B8C2B4` |
| slate | `#5E6E64` |
| charcoal | `#2A3B33` |
| sky | `#6FB7D9` |
| sea | `#2D6A8C` |
| gold (money, fame) | `#F2C14E` |
| ember (warming) | `#E8833A` |
| heat (danger, 4 °C) | `#D9473B` |
| wine | `#7A3B4E` |
| skin light / mid / deep | `#F0C29A` `#B9785A` `#6E4632` |

Rules: forest + paper do 90% of the UI; lime is the single accent (life, the chosen option, positive arrows); ember/heat only for the planet warming and danger; gold for money/fame. No other colours.

## Motif
The sprout is the life icon: it grows through the life stages, wilts at death, and a new one pops at **RESPAWN**. Life-stage sprites: `public/assets/sprites/sprout_*.png`.

## Generated assets (`public/assets/`, pixel art, palette-snapped)
- `bg/` scene backgrounds 320×180: campus, lecture, party, library, dorm, airport, research, exchange_asia, exchange_west, finance, bigtech, lab, ngo, garage, home, burnout, beach, retirement, graveyard, stage, pandemic.
- `earth/` 2100 panoramas: earth_good (1.5 °C), earth_mid (2.7 °C), earth_bad (4 °C).
- `sprites/` sprout stages, UI icons, character busts, fictional employer emblems.

Scene `art` keys in content = the background file names without `bg_` (e.g. `"art": "lecture"`).
