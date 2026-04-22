# Cat sprite assets

Drop your sprite sheet and this folder’s `sprite.json` into `assets/cats/` in the app (next to this file).

## Layout

```
assets/cats/
  sprite.json
  cat.png          # or whatever filename you set in sprite.json → "image"
```

## `sprite.json` format

| Field | Meaning |
|--------|--------|
| `image` | Filename of the PNG sheet (same folder as `sprite.json`). |
| `frameWidth` / `frameHeight` | Size in **pixels** of one frame in the sheet. |
| `scale` | Integer scale when drawing (e.g. `2` = 2× size on screen). |
| `animations` | Named clips. Each row of the sheet is one animation. |

Each animation:

| Field | Meaning |
|--------|--------|
| `row` | Zero-based row index in the sheet (y = `row * frameHeight`). |
| `frames` | Number of frames in that row, left to right. |
| `fps` | Playback speed. |

### Required names

- **`idle`** — played while the cat pauses.
- **`walk_right`** — walk facing right.
- **`walk_left`** — optional. If omitted, the app will **horizontally flip** `walk_right` for leftward movement.

### Example (grid)

Row 0: idle (4 frames)  
Row 1: walk right (6 frames)  
Row 2: walk left (6 frames) — or omit and use flip

Edit the example [`sprite.json`](./sprite.json) to match your art (frame size, row indices, frame counts, and `image` filename).

## Transparency

Use a PNG with alpha. The app window is fully transparent except for the drawn cat.
