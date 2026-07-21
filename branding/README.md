# Lattice — brand assets

The mark is a **3×3 node lattice** with the centre node lit **amber** — the "search hit" — lighting
the four edges that reach it: a structure, and retrieval pulling one result out of it.

**Palette**

| Token      | Hex       | Use                          |
|------------|-----------|------------------------------|
| Ink        | `#1A1815` | wordmark, dark grounds       |
| Terracotta | `#C05F3C` | the lattice / primary accent |
| Amber      | `#E2A64C` | the hit node · `i`-tittle    |
| Paper      | `#F4EEE2` | light ground / app-icon tile |

## Sources (edit these)

| File                     | What it is                                             |
|--------------------------|--------------------------------------------------------|
| `lattice-mark.svg`       | Primary mark, centre hit (48-unit grid)                |
| `lattice-mark-small.svg` | Simplified mark for ≤24 px (thicker, no halo)          |
| `lattice-icon.svg`       | App icon — paper squircle + mark (1024)                |
| `lattice-wordmark.svg`   | Drawn monoline wordmark "lattice"                      |
| `lattice-lockup.svg`     | Horizontal lockup (mark + wordmark)                    |

## Exports (generated — don't hand-edit)

- **App icon:** `icon-1024.png`, `icon-512.png`, `icon-256.png`, `apple-touch-icon.png` (180)
- **Favicons:** `favicon-48.png`, `favicon-32.png`, `favicon-16.png` (transparent mark), `favicon.ico` (16/32/48/256, squircle)
- **Docs:** `mark-512.png`, `wordmark-1024.png`, `lockup-1024.png` (all transparent)

Regenerate from the repo root with `node branding/build_brand.js` (it uses the
`sharp` already in `sidecar/web`'s deps, resolved by path — run it from anywhere).

## Wiring it in (when ready — nothing is wired yet)

- **Web (sidecar):** drop `favicon.ico`, `apple-touch-icon.png`, `favicon-32.png`, `favicon-16.png`
  into `sidecar/web/public/` (or use the Next `app/icon.png` / `app/apple-icon.png` convention).
- **iced window icon:** load `icon-256.png` at startup via `iced::window::icon::from_file_data`
  and set it on the window settings.
- **Windows `.exe` icon:** embed `favicon.ico` through a `build.rs` using the `winresource` crate.
