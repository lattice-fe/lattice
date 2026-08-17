# Lattice Theme Tokens & Palette Reference

This document catalogs all **11 built-in themes** in Lattice, mapping their raw seed tokens (`ThemeTokens`), derived CSS custom properties, and file tile color combinations.

---

## 1. Token Schema & Architecture

Lattice uses a **hybrid seed-and-derive** theming model: authors specify a compact seed of 10 color tokens and tile overrides; the engine (`engine.ts`) compiles the remaining intermediate shades via linear perceptual color mixing.

### Core Seed Tokens (`ThemeTokens`)

| Token | CSS Variable | UI Purpose |
| :--- | :--- | :--- |
| `bg` | `--ink` | Root app background, window chassis |
| `surface` | `--card` | Cards, side panels, dropdown menus, modals |
| `surfaceHover` | `--card-hi` | Active tab background, card/row hover surface |
| `border` | `--border` | Dividers, search box borders, panel edges |
| `text` | `--paper` | Primary body text, headlines, active labels |
| `textDim` | `--dim` | Secondary metadata, dates, file sizes, shortcuts |
| `accent` | `--terracotta` | Primary brand accent, selected item highlights |
| `accent2` | `--amber` | Secondary warm accent, Watson pill, warning states |
| `accent3` | `--teal` | Tertiary accent, quick metrics, success accents |
| `danger` | `--danger` | Destructive buttons, close hover, delete actions |

### Derived Engine Properties

| Derived Variable | Formula | Purpose |
| :--- | :--- | :--- |
| `--ink-2` | `mix(bg, surface, 0.50)` | Mid-depth surface, table alternate rows, header bars |
| `--ink-3` | `mix(bg, surface, 0.22)` | Subtle container fill, secondary buttons |
| `--border-soft` | `mix(border, bg, 0.45)` | Subtle list row dividers, inner borders |
| `--paper-dim` | `mix(text, textDim, 0.50)`| Medium emphasis text, breadcrumbs |
| `--dim-2` | `mix(textDim, bg, 0.40)` | Muted timestamps, disabled controls |
| `--glow` | `alpha(glow ?? accent2, strength)` | Ambient top window glow gradient |
| `--spot-bg` | `alpha(bg, dark ? 0.82 : 0.90)` | Spotlight / command palette frosted glass background |
| `--spot-border` | `alpha(text, dark ? 0.10 : 0.18)` | Spotlight frosted border |

---

## 2. Master Comparison Matrix

| Theme | Type | `bg` | `surface` | `surfaceHover` | `border` | `text` | `textDim` | `accent` | `accent2` | `accent3` | `danger` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Ink** *(Default)* | Dark | `#1a1815` | `#24211c` | `#2a251f` | `#322c25` | `#f4eee2` | `#9a917f` | `#c05f3c` | `#e2a64c` | `#4f9a8a` | `#c0392b` |
| **Paper** | Light | `#f4eee2` | `#e7ddca` | `#dcceb4` | `#d7c9b0` | `#241f18` | `#7c7360` | `#b6542e` | `#b97e28` | `#3c8072` | `#b23320` |
| **Canvas** | Light | `#faf7f2` | `#f0eadd` | `#e6dec1` | `#d7c9b0` | `#2a241e` | `#6d6355` | `#a07550` | `#b08560` | `#7a8a70` | `#b23320` |
| **Slate** | Dark | `#1f2329` | `#2b313b` | `#363c47` | `#3d4551` | `#e5e9f0` | `#9aa5b1` | `#6c7a89` | `#8f9bb3` | `#5f8a87` | `#c0392b` |
| **Copper** | Dark | `#2d2119` | `#3d2d22` | `#4a3a2d` | `#5a493a` | `#f1e6d6` | `#b89b7c` | `#c77c48` | `#d48c5a` | `#a08058` | `#b85c4a` |
| **Amber** | Dark | `#241e17` | `#312a20` | `#3e362b` | `#4f473a` | `#f1e6d6` | `#b89b7c` | `#c78c48` | `#d49c5a` | `#a07058` | `#b85c4a` |
| **Sepia** | Dark | `#2d2720` | `#3d352b` | `#4a4136` | `#5a4e40` | `#f0e6d6` | `#b8a99c` | `#a07c58` | `#b08c68` | `#8a6c48` | `#b85c4a` |
| **Forest** | Dark | `#1a211d` | `#232d28` | `#2d3b35` | `#364942` | `#e0e9e0` | `#9ca9a0` | `#7a9a7a` | `#8bb08b` | `#6b8a6b` | `#b85c4a` |
| **Midnight** | Dark | `#0f1115` | `#1a1d24` | `#242832` | `#2d323d` | `#d0d5dc` | `#8b94a0` | `#5a6b9a` | `#6b7bb3` | `#4a5b8a` | `#c0392b` |
| **Ash** | Dark | `#1c1d21` | `#282a2f` | `#33353b` | `#3d4049` | `#d0d3d9` | `#8b8e96` | `#6e7a89` | `#7e8a99` | `#5e6a79` | `#c0392b` |
| **Graphite** | Dark | `#121212` | `#1e1e1e` | `#2a2a2a` | `#333333` | `#e0e0e0` | `#9e9e9e` | `#5f6b78` | `#6b7b89` | `#4f5b68` | `#c0392b` |

---

## 3. Detailed Per-Theme Palette & Tile Breakdown

### 1. Ink (Dark · Default)
*The signature warm-dark editorial theme of Lattice. Rich espresso chassis with terracotta & amber highlights.*

- **Surfaces**: `bg: #1a1815`, `surface: #24211c`, `surfaceHover: #2a251f`
- **Borders & Text**: `border: #322c25`, `text: #f4eee2`, `textDim: #9a917f`
- **Accents**: `accent: #c05f3c` (Terracotta), `accent2: #e2a64c` (Amber), `accent3: #4f9a8a` (Teal), `danger: #c0392b`
- **Effects**: `glow: #e0a64c` (0.035), `shadowStrength: 0.70`, `radius: 11px`
- **File Tile Palette**:
  - `rust` (Code): `bg: #331f14` · `fg: #d8794a`
  - `amber` (Folders/Archives): `bg: #33260f` · `fg: #e2a64c`
  - `green` (Images): `bg: #22271f` · `fg: #9db98a`
  - `violet` (Audio): `bg: #282132` · `fg: #b199d6`
  - `red` (Video/Binary): `bg: #301c1a` · `fg: #cf6f5b`
  - `neutral` (Docs): `bg: #26221d` · `fg: #a99f8e`

---

### 2. Paper (Light)
*Warm vintage book-paper aesthetic with high legibility and rich ochre & rust accents.*

- **Surfaces**: `bg: #f4eee2`, `surface: #e7ddca`, `surfaceHover: #dcceb4`
- **Borders & Text**: `border: #d7c9b0`, `text: #241f18`, `textDim: #7c7360`
- **Accents**: `accent: #b6542e` (Deep Rust), `accent2: #b97e28` (Warm Ochre), `accent3: #3c8072` (Sage), `danger: #b23320`
- **Effects**: `glow: #d69a3e` (0.050), `shadowStrength: 0.15`, `radius: 11px`
- **File Tile Palette**:
  - `rust` (Code): `bg: #f0ddd0` · `fg: #b6542e`
  - `amber` (Folders/Archives): `bg: #f1e6c9` · `fg: #9c7220`
  - `green` (Images): `bg: #e0e8d6` · `fg: #5e7d47`
  - `violet` (Audio): `bg: #e7e0f0` · `fg: #6f589c`
  - `red` (Video/Binary): `bg: #f1dbd3` · `fg: #b04f30`
  - `neutral` (Docs): `bg: #e7e0d3` · `fg: #6d6455`

---

### 3. Canvas (Light)
*Clean, modern off-white gallery canvas with neutral sand accents.*

- **Surfaces**: `bg: #faf7f2`, `surface: #f0eadd`, `surfaceHover: #e6dec1`
- **Borders & Text**: `border: #d7c9b0`, `text: #2a241e`, `textDim: #6d6355`
- **Accents**: `accent: #a07550` (Sand), `accent2: #b08560` (Bronze), `accent3: #7a8a70` (Olive), `danger: #b23320`
- **Effects**: `glow: #a07550` (0.040), `shadowStrength: 0.12`, `radius: 11px`
- **File Tile Palette**:
  - `rust` (Code): `bg: #efe2d6` · `fg: #a07550`
  - `amber` (Folders/Archives): `bg: #f2eadd` · `fg: #b08560`
  - `green` (Images): `bg: #e0eadd` · `fg: #7a8a70`
  - `violet` (Audio): `bg: #eaddf0` · `fg: #8a7a9a`
  - `red` (Video/Binary): `bg: #f2d6d6` · `fg: #b23320`
  - `neutral` (Docs): `bg: #eaddde` · `fg: #6d6355`

---

### 4. Slate (Dark)
*Cool Nordic dark theme with steel blue tones and ice-slate accents.*

- **Surfaces**: `bg: #1f2329`, `surface: #2b313b`, `surfaceHover: #363c47`
- **Borders & Text**: `border: #3d4551`, `text: #e5e9f0`, `textDim: #9aa5b1`
- **Accents**: `accent: #6c7a89` (Slate Blue), `accent2: #8f9bb3` (Ice Blue), `accent3: #5f8a87` (Seafoam), `danger: #c0392b`
- **Effects**: `glow: #5f8a87` (0.030), `shadowStrength: 0.65`, `radius: 11px`
- **File Tile Palette**:
  - `rust` (Code): `bg: #2b2320` · `fg: #8d6e63`
  - `amber` (Folders/Archives): `bg: #2e2820` · `fg: #ffb74d`
  - `green` (Images): `bg: #202623` · `fg: #81c784`
  - `violet` (Audio): `bg: #26212d` · `fg: #b39ddb`
  - `red` (Video/Binary): `bg: #2e1f21` · `fg: #e57373`
  - `neutral` (Docs): `bg: #2a2422` · `fg: #a0a0a0`

---

### 5. Copper (Dark)
*Rich metallic copper and toasted ember tones with glowing orange highlights.*

- **Surfaces**: `bg: #2d2119`, `surface: #3d2d22`, `surfaceHover: #4a3a2d`
- **Borders & Text**: `border: #5a493a`, `text: #f1e6d6`, `textDim: #b89b7c`
- **Accents**: `accent: #c77c48` (Copper), `accent2: #d48c5a` (Bright Amber), `accent3: #a08058` (Brass), `danger: #b85c4a`
- **Effects**: `glow: #c77c48` (0.040), `shadowStrength: 0.70`, `radius: 11px`
- **File Tile Palette**:
  - `rust` (Code): `bg: #3d2d22` · `fg: #e0a070`
  - `amber` (Folders/Archives): `bg: #423426` · `fg: #ffcc80`
  - `green` (Images): `bg: #28312b` · `fg: #a5d6a7`
  - `violet` (Audio): `bg: #342a39` · `fg: #ce93d8`
  - `red` (Video/Binary): `bg: #3d2626` · `fg: #e57373`
  - `neutral` (Docs): `bg: #3b312b` · `fg: #c7b090`

---

### 6. Amber (Dark)
*Deep honeyed wood background with golden amber glow.*

- **Surfaces**: `bg: #241e17`, `surface: #312a20`, `surfaceHover: #3e362b`
- **Borders & Text**: `border: #4f473a`, `text: #f1e6d6`, `textDim: #b89b7c`
- **Accents**: `accent: #c78c48` (Honey Amber), `accent2: #d49c5a` (Gold), `accent3: #a07058` (Warm Oak), `danger: #b85c4a`
- **Effects**: `glow: #c78c48` (0.040), `shadowStrength: 0.70`, `radius: 11px`
- **File Tile Palette**:
  - `rust` (Code): `bg: #3d2d22` · `fg: #e0a070`
  - `amber` (Folders/Archives): `bg: #423426` · `fg: #ffcc80`
  - `green` (Images): `bg: #28312b` · `fg: #a5d6a7`
  - `violet` (Audio): `bg: #342a39` · `fg: #ce93d8`
  - `red` (Video/Binary): `bg: #3d2626` · `fg: #e57373`
  - `neutral` (Docs): `bg: #3b312b` · `fg: #c7b090`

---

### 7. Sepia (Dark)
*Warm vintage photographic sepia with muted parchment undertones.*

- **Surfaces**: `bg: #2d2720`, `surface: #3d352b`, `surfaceHover: #4a4136`
- **Borders & Text**: `border: #5a4e40`, `text: #f0e6d6`, `textDim: #b8a99c`
- **Accents**: `accent: #a07c58` (Vintage Sepia), `accent2: #b08c68` (Caramel), `accent3: #8a6c48` (Umber), `danger: #b85c4a`
- **Effects**: `glow: #a07c58` (0.035), `shadowStrength: 0.65`, `radius: 11px`
- **File Tile Palette**:
  - `rust` (Code): `bg: #3d3126` · `fg: #d7ccc8`
  - `amber` (Folders/Archives): `bg: #423a26` · `fg: #ffecb3`
  - `green` (Images): `bg: #2b3631` · `fg: #b0bec5`
  - `violet` (Audio): `bg: #36313d` · `fg: #e1bee7`
  - `red` (Video/Binary): `bg: #3d2b2d` · `fg: #e57373`
  - `neutral` (Docs): `bg: #3a3631` · `fg: #c7b090`

---

### 8. Forest (Dark)
*Deep pine and moss-green dark theme with natural botanical accents.*

- **Surfaces**: `bg: #1a211d`, `surface: #232d28`, `surfaceHover: #2d3b35`
- **Borders & Text**: `border: #364942`, `text: #e0e9e0`, `textDim: #9ca9a0`
- **Accents**: `accent: #7a9a7a` (Sage Green), `accent2: #8bb08b` (Moss), `accent3: #6b8a6b` (Dark Pine), `danger: #b85c4a`
- **Effects**: `glow: #7a9a7a` (0.030), `shadowStrength: 0.60`, `radius: 11px`
- **File Tile Palette**:
  - `rust` (Code): `bg: #2d2420` · `fg: #d7ccc8`
  - `amber` (Folders/Archives): `bg: #312d20` · `fg: #ffecb3`
  - `green` (Images): `bg: #202d28` · `fg: #a5d6a7`
  - `violet` (Audio): `bg: #282431` · `fg: #e1bee7`
  - `red` (Video/Binary): `bg: #2d2022` · `fg: #e57373`
  - `neutral` (Docs): `bg: #2a312d` · `fg: #b0beb5`

---

### 9. Midnight (Dark)
*Ultra-deep navy chassis with subtle indigo and violet accents.*

- **Surfaces**: `bg: #0f1115`, `surface: #1a1d24`, `surfaceHover: #242832`
- **Borders & Text**: `border: #2d323d`, `text: #d0d5dc`, `textDim: #8b94a0`
- **Accents**: `accent: #5a6b9a` (Indigo), `accent2: #6b7bb3` (Soft Violet), `accent3: #4a5b8a` (Deep Slate), `danger: #c0392b`
- **Effects**: `glow: #5a6b9a` (0.025), `shadowStrength: 0.75`, `radius: 11px`
- **File Tile Palette**:
  - `rust` (Code): `bg: #241d20` · `fg: #bcaaa4`
  - `amber` (Folders/Archives): `bg: #2a2420` · `fg: #d7ccc8`
  - `green` (Images): `bg: #1d2422` · `fg: #b0bec5`
  - `violet` (Audio): `bg: #221d28` · `fg: #d1c4e9`
  - `red` (Video/Binary): `bg: #2a1d20` · `fg: #e57373`
  - `neutral` (Docs): `bg: #222028` · `fg: #a0a0a0`

---

### 10. Ash (Dark)
*Neutral studio charcoal gray theme without color bias.*

- **Surfaces**: `bg: #1c1d21`, `surface: #282a2f`, `surfaceHover: #33353b`
- **Borders & Text**: `border: #3d4049`, `text: #d0d3d9`, `textDim: #8b8e96`
- **Accents**: `accent: #6e7a89` (Steel Gray), `accent2: #7e8a99` (Cool Ash), `accent3: #5e6a79` (Slate), `danger: #c0392b`
- **Effects**: `glow: #6e7a89` (0.020), `shadowStrength: 0.60`, `radius: 11px`
- **File Tile Palette**:
  - `rust` (Code): `bg: #2a2522` · `fg: #bcaaa4`
  - `amber` (Folders/Archives): `bg: #2d2a22` · `fg: #d7ccc8`
  - `green` (Images): `bg: #222a28` · `fg: #b0bec5`
  - `violet` (Audio): `bg: #2a252d` · `fg: #d1c4e9`
  - `red` (Video/Binary): `bg: #2d2225` · `fg: #e57373`
  - `neutral` (Docs): `bg: #2a2a2d` · `fg: #a0a0a0`

---

### 11. Graphite (Dark · OLED)
*Pure dark minimalist palette with high contrast monochrome surfaces.*

- **Surfaces**: `bg: #121212`, `surface: #1e1e1e`, `surfaceHover: #2a2a2a`
- **Borders & Text**: `border: #333333`, `text: #e0e0e0`, `textDim: #9e9e9e`
- **Accents**: `accent: #5f6b78` (Graphite), `accent2: #6b7b89` (Iron), `accent3: #4f5b68` (Lead), `danger: #c0392b`
- **Effects**: `glow: #5f6b78` (0.020), `shadowStrength: 0.80`, `radius: 11px`
- **File Tile Palette**:
  - `rust` (Code): `bg: #2a1f1a` · `fg: #bcaaa4`
  - `amber` (Folders/Archives): `bg: #2e261a` · `fg: #d7ccc8`
  - `green` (Images): `bg: #1a2622` · `fg: #b0bec5`
  - `violet` (Audio): `bg: #221a28` · `fg: #d1c4e9`
  - `red` (Video/Binary): `bg: #2e1a20` · `fg: #e57373`
  - `neutral` (Docs): `bg: #26201a` · `fg: #a0a0a0`

---

## 4. Observations & Tuning Suggestions

1. **Overlap Between Copper, Amber, and Sepia**:
   - `Copper` (`bg: #2d2119`), `Amber` (`bg: #241e17`), and `Sepia` (`bg: #2d2720`) share very close hue angles (orange-brown darks).
   - *Suggestion*: `Copper` could lean slightly more metallic/red-copper (`#321e17`), while `Amber` stays warm golden-honey, and `Sepia` gets slightly more desaturated antique parchment brown (`#28241f`).

2. **Ash vs. Graphite vs. Slate**:
   - `Ash` (`#1c1d21`) and `Slate` (`#1f2329`) are both cool dark grays, but `Slate` has a distinct blue undertone while `Ash` is neutral.
   - `Graphite` (`#121212`) is near true black, ideal for OLED displays.

3. **Light Themes (`Paper` vs `Canvas`)**:
   - `Paper` (`#f4eee2`) has rich golden-warm book tones.
   - `Canvas` (`#faf7f2`) is cleaner and more neutral with slightly lower contrast sand borders.
