---
name: Chimaera
description: A quiet dark-glass game launcher where cover art carries the colour and one accent carries the action.
colors:
  accent: "#0a84ff"
  accent-text: "#5eb0ff"
  on-accent: "#ffffff"
  ground: "#000000"
  glass-thin: "#0a0a0a"
  glass-regular: "#0f0f0f"
  glass-thick: "#141414"
  text: "rgb(255 255 255 / 0.92)"
  text-muted: "rgb(235 235 245 / 0.62)"
  text-faint: "rgb(235 235 245 / 0.34)"
  line: "rgb(255 255 255 / 0.1)"
  line-strong: "rgb(255 255 255 / 0.2)"
  fill: "rgb(255 255 255 / 0.08)"
  fill-hover: "rgb(255 255 255 / 0.14)"
  danger: "#ff6961"
  good: "#30d158"
  warn: "#ffb340"
typography:
  section-title:
    fontFamily: "SF Pro Text, -apple-system, Segoe UI Variable Text, Segoe UI, Noto Sans, sans-serif"
    fontSize: "20px"
    fontWeight: 700
  body:
    fontFamily: "SF Pro Text, -apple-system, Segoe UI Variable Text, Segoe UI, Noto Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  button-label:
    fontFamily: "SF Pro Text, -apple-system, Segoe UI Variable Text, Segoe UI, Noto Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  hint:
    fontFamily: "SF Pro Text, -apple-system, Segoe UI Variable Text, Segoe UI, Noto Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  small:
    fontFamily: "SF Pro Text, -apple-system, Segoe UI Variable Text, Segoe UI, Noto Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 400
rounded:
  count: "6px"
  skeleton: "8px"
  field: "10px"
  segment: "9px"
  segmented: "11px"
  surface: "16px"
  pill: "999px"
spacing:
  unit: "8px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-default:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.text}"
    typography: "{typography.button-label}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  button-default-hover:
    backgroundColor: "{colors.fill-hover}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button-label}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#1a0000"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  text-field:
    backgroundColor: "rgb(255 255 255 / 0.04)"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "8px"
    height: "40px"
  chip:
    textColor: "{colors.text-muted}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  modal:
    backgroundColor: "{colors.glass-thick}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.surface}"
    padding: "24px 16px"
  panel:
    backgroundColor: "{colors.glass-thin}"
    rounded: "{rounded.surface}"
    padding: "16px 18px"
---

# Design System: Chimaera

## Overview

**Creative North Star: "The Dark Glass Console"**

Chimaera is a game launcher that behaves like a quiet console. The ground is near-black, panels are tinted glass separated by hairline rims, and a single accent marks what can be acted on. Game artwork supplies the colour; the interface stays out of its way. The source states the lineage directly: "Apple-style dark glass tokens".

The mood is quiet, precise and Apple-like. Surfaces are rounded at 16px, buttons are soft pills, text is set in the platform's native UI face, and motion is short and eased rather than showy. Nothing shouts. Hierarchy comes from brightness steps of white text and from the glass ladder, not from competing hues.

Everything routes through runtime tokens (`--bg`, `--glass-*`, `--accent`, and so on) so that theme presets (OLED, Crimson, Midnight, Glass) and user custom themes recolour every component, not just a few. Treat a hard-coded colour as a defect.

**Key Characteristics:**

- Near-black ground (#000000) with a three-step glass ladder (#0a0a0a, #0f0f0f, #141414).
- One accent, Dodger Blue (#0a84ff), that themes can swap wholesale.
- Hairline inset rims (0.5px) instead of outer shadows by default.
- Pill buttons, 16px surfaces, 10px fields.
- Native UI type, 14px body, weight 600 for actions.
- Motion on one shared easing curve, 0.18s to 0.2s.

## Colors

A monochrome white-on-black system with one saturated accent and three status colours used only for state.

### Primary

- **Dodger Console Blue** (#0a84ff / oklch(62% 0.206 255)): The accent. Fills primary buttons through a soft top-lit gradient, draws the 2px focus ring, tints text selection (50% mix), and sets the text caret. Themes replace it (OLED uses white, Crimson #e5303c, Midnight #6e8bff).
- **Lifted Accent Text** (#5eb0ff): The legible version of the accent for links and accent-coloured text on dark glass.
- **On-Accent White** (#ffffff): Text and icons placed on an accent fill. OLED flips this to black.

### Neutral

- **Void Black** (#000000): The window ground (`--bg`, `--backdrop`).
- **Thin Glass** (#0a0a0a): Default panel and sidebar surface, the lowest glass step.
- **Regular Glass** (#0f0f0f): Mid-level surfaces and the default `glass` mixin tint.
- **Thick Glass** (#141414): Modals and the highest layer.
- **Primary Text** (rgb(255 255 255 / 0.92)): Titles and values.
- **Muted Text** (rgb(235 235 245 / 0.62)): Body copy, labels, secondary content. Default `body` colour.
- **Faint Text** (rgb(235 235 245 / 0.34)): Hints, disabled and tertiary content.
- **Hairline** (rgb(255 255 255 / 0.1)): Dividers and borders.
- **Strong Hairline** (rgb(255 255 255 / 0.2)): Rims on buttons and fields.
- **Fill** (rgb(255 255 255 / 0.08)) and **Fill Hover** (rgb(255 255 255 / 0.14)): Resting and hovered backgrounds for controls.

### Status

- **Coral Danger** (#ff6961): Errors and destructive actions.
- **Signal Green** (#30d158): Success and online.
- **Amber Warning** (#ffb340): Cautions.

### Named Rules

**The Token-Only Rule.** Every colour comes from a CSS custom property. Presets and custom themes only work because components never hard-code a hex.

**The One Voice Rule.** The accent marks the single most important action or focus in a region. Everything else is white at a stated opacity.

**The White-Alpha Rule.** Fills, rims and dividers are white at fixed alphas (0.04, 0.08, 0.1, 0.14, 0.2). Do not introduce grey hexes between them.

## Typography

**Display Font:** none; the UI has no display face.
**Body Font:** SF Pro Text, then -apple-system, Segoe UI Variable Text, Segoe UI, Noto Sans, sans-serif. Noto Sans (400, 500, 700) is bundled as the final named fallback so Windows, Linux and macOS render consistently.

**Character:** The native system UI face on each platform, which makes the launcher feel like part of the OS. Hierarchy comes from weight and opacity, not from size jumps.

### Hierarchy

- **Section title** (700, 20px): Page and section headings (`section-title` mixin).
- **Body** (400, 14px): Default text, in Muted Text.
- **Button label** (600, 14px): Every button; weight 600 is the action signal.
- **Hint** (400, 13px): Helper text under fields.
- **Small** (400, 12px): Chips, counts, metadata.

### Named Rules

**The Weight-Over-Size Rule.** Steps in importance use weight (400, 600, 700) and text opacity before they use a bigger font size.

## Layout

An 8px spacing unit governs everything (`$spacing-unit`); common steps are 8, 16 and 24px. The shell is a fixed sidebar plus a scrolling content column, with a bottom panel and a title bar. Pages sit in a `container__content` that scrolls, and the app uses keep-alive for the main pages so state persists between tabs.

Controls share a 40px height (buttons and fields). Modals have a 400px minimum and 600px maximum width, with a 24px by 16px content padding. Panels use 16px by 18px padding. Layers stack through named z-indexes: bottom panel 3, title bar 4, backdrop 4, modal 5, toast 150.

Layouts are desktop-first and fluid inside the window; the Big Picture mode is a separate controller-driven UI and is not covered here.

## Elevation & Depth

Depth is tonal, not shadowed. Three glass tints (thin, regular, thick) separate layers, and a hairline inset rim (`inset 0 0 0 0.5px` at 10% white) defines each edge. The default `--lift` and `--blur` are `none`, so a stock theme is flat and crisp.

The Glass preset opts into real material: `blur(30px) saturate(180%)` backdrop filtering and a soft lift shadow. Users with `prefers-reduced-transparency` get opaque tints and no blur.

### Shadow Vocabulary

- **Rim** (`box-shadow: inset 0 0 0 0.5px rgb(255 255 255 / 0.1)`): Default edge on every glass surface.
- **Lift** (`none` by default; Glass preset: `0 10px 30px rgb(0 0 0 / 0.28), 0 2px 6px rgb(0 0 0 / 0.18)`): Outer elevation, only when a theme asks for it.
- **Primary highlight** (`inset 0 1px 0 rgb(255 255 255 / 0.35), 0 1px 2px rgb(0 0 0 / 0.3)`): The lit top edge on accent buttons.

### Named Rules

**The Flat-Until-Themed Rule.** Surfaces carry no outer shadow at rest. Shadows and blur come from the active theme through `--lift` and `--blur`, never from a component.

## Shapes

Soft, consistent rounding with one pill. Surfaces (panels, modals) use 16px (`--radius`). Fields use 10px, segmented controls 11px with 9px segments, counts 6px, skeletons 8px and progress bars 4px. Buttons and chips are full pills (999px). Edges are defined by 0.5px inset rims rather than 1px borders. Focus is the one heavy line: a 2px accent outline offset by 2px.

## Components

### Buttons

- **Shape:** Full pill (999px), 40px minimum height, 8px by 16px padding, 8px gap between icon and label.
- **Default:** Fill (white 8%) with a strong hairline rim and a faint top highlight; Primary Text; weight 600.
- **Primary:** Accent gradient, lighter at the top (`color-mix` of 80% accent with white into accent), white label, lit top edge.
- **Outline:** Transparent, same rim; hover fills with Fill.
- **Dark:** Quiet fill (white 4%) for low-emphasis actions.
- **Danger:** Solid Coral Danger with near-black text.
- **Hover / Press:** Hover steps the fill up to Fill Hover; press scales to 0.97; disabled drops to 45% opacity. All transitions run 0.18s on the shared easing.

### Chips

- **Style:** Pill, 3px by 10px padding, 12px text, strong hairline rim, no solid fill.

### Panels / Containers

- **Corner Style:** 16px.
- **Background:** Thin Glass by default (`--glass-1`); Regular and Thick for stacked layers.
- **Shadow Strategy:** Rim only; lift and blur come from the theme.
- **Internal Padding:** 16px by 18px.

### Inputs / Fields

- **Style:** 40px tall, 10px radius, faint fill (white 4%), 0.5px strong hairline rim, 8px inner padding.
- **Hover:** Rim brightens to Faint Text.
- **Focus:** 1px accent rim plus a 3px ring at 30% accent. The caret is accent-coloured.
- **Error:** 1px Coral Danger rim and a danger-coloured message below.

### Modals

- **Style:** Thick Glass, 16px radius, 400 to 600px wide, header with a hairline divider, scale-and-fade entrance over 0.2s (`cubic-bezier(0.33, 1, 0.68, 1)`).

### Navigation

- **Sidebar:** Void ground with a hairline right border, Muted Text, resizable. Hover on small controls fills with Hairline. Items sit on an 8px rhythm.

### Skeletons

- **Style:** 8px radius over Fill, with a soft white shimmer sweeping every 1.4s. The sweep stops under reduced motion.

## Do's and Don'ts

### Do:

- **Do** take every colour from a token (`--accent`, `--glass-*`, `--text`, `--muted`, `--line`) so presets and custom themes recolour the whole app.
- **Do** keep buttons as 40px pills with weight 600 labels.
- **Do** define edges with 0.5px inset rims at white 10% or 20%.
- **Do** use the 8px spacing unit and the 16px surface radius.
- **Do** keep the 2px accent focus outline visible on every interactive element.
- **Do** run state transitions on `--ease` (`cubic-bezier(0.2, 0.8, 0.2, 1)`) in 0.18s to 0.2s.
- **Do** honour `prefers-reduced-motion` and `prefers-reduced-transparency`.

### Don't:

- **Don't** hard-code a hex colour in a component; add or use a token.
- **Don't** add an outer drop shadow or backdrop blur to a component; the theme owns `--lift` and `--blur`.
- **Don't** use the accent on more than one primary action per region.
- **Don't** introduce a second brand hue; status colours are for state only.
- **Don't** replace the native UI font stack with a decorative face.
- **Don't** use 1px solid borders where a 0.5px inset rim fits.
