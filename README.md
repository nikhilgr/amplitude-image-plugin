# Amplitude Image Gen

A Figma plugin that generates branded SVG illustrations using Google's Gemini AI. Describe what you need, provide reference designs and brand guidelines, and get production-ready vector artwork placed directly on your Figma canvas — across multiple output sizes in one click.

---

## What it does

- **AI-powered generation** — Sends your design brief, reference images, and brand guidelines to Gemini 2.5 Flash, which returns a complete SVG illustration
- **Multi-size output** — Generate for multiple asset categories (website hero, blog, social, stories, paid ads) in a single generation run
- **Brand-aware** — Upload screenshots of your brand guidelines or color palettes so the model matches your visual identity
- **Reference designs** — Pull frames directly from your Figma selection or upload images to use as visual inspiration
- **Canvas placement** — Generated SVGs are placed directly on your current Figma page, selected and zoomed into view automatically
- **Session history** — Tracks all generations within the current plugin session with timestamps and pass/fail status

---

## Supported output sizes

| Category | Dimensions |
|---|---|
| Website Product Feature (4:3) | 1920 × 1440 |
| Website Product Feature (16:9) | 1920 × 1080 |
| Blog Standard (4:3) | 1920 × 1440 |
| Blog Featured Image (16:9) | 1920 × 1080 |
| Social Organic Square | 1080 × 1080 |
| Stories | 1080 × 1920 |
| Paid Social / Link Ads | 1200 × 628 |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) (includes npm)
- A [Google AI Studio](https://aistudio.google.com/) API key with access to Gemini 2.5 Flash

### Setup

```bash
# Install dependencies
npm install

# Build the plugin once
npm run build

# Or watch for changes during development
npm run watch
```

### Loading in Figma

1. Open Figma Desktop
2. Go to **Plugins → Development → Import plugin from manifest...**
3. Select the `manifest.json` file in this directory
4. Run the plugin from **Plugins → Development → Amplitude Image Gen**

---

## Using the plugin

1. **Enter your API key** — Paste your Google AI Studio key. It's stored in memory only and cleared when the plugin closes.

2. **Add reference designs** *(optional)* — Upload PNG/JPEG images or click **Use Figma Selection** to export frames from your current canvas. Up to 5 reference images are sent to the model as visual inspiration.

3. **Add brand guidelines** *(optional)* — Upload screenshots of brand rules, color palettes, or design token sheets. Add any extra context in the notes field.

4. **Select output sizes** — Pick one or more categories from the dropdown.

5. **Write a design brief** — Describe the illustration you want. Be specific about subject matter, mood, and style.
   > Example: *"Abstract product illustration showing a funnel visualization with colorful geometric shapes, gradient overlays, and data flow elements in Amplitude's brand style."*

6. **Click Generate Design** — The plugin calls Gemini sequentially for each selected size and places each SVG on your canvas as it completes.

### Advanced settings

Expand **Advanced Settings** to edit the system prompt sent to Gemini. The default prompt instructs the model to output clean, performant SVG using only inline styles and a constrained set of elements.

---

## Project structure

```
├── code.ts          # Plugin sandbox logic (source of truth)
├── code.js          # Compiled output — gitignored, do not edit
├── ui.html          # Plugin UI (runs in Figma iframe)
├── manifest.json    # Figma plugin descriptor
├── package.json     # Build scripts and dev dependencies
└── tsconfig.json    # TypeScript config
```

### Architecture

The plugin uses Figma's two-context model:

- **`code.ts` (sandbox)** — Has access to the Figma API. Handles selection export, SVG placement, and canvas manipulation. No browser APIs available here.
- **`ui.html` (iframe)** — Has full browser API access. Handles the UI, file uploads, image downscaling, and all Gemini API calls. Communicates with the sandbox via `postMessage`.

---

## Development

```bash
npm run lint        # Check for lint errors
npm run lint:fix    # Auto-fix lint errors
npm run build       # Compile code.ts → code.js
npm run watch       # Watch mode for development
```

TypeScript strict mode is enabled. The plugin targets ES6 and uses `@figma/plugin-typings` for Figma API types.

---

## Notes

- The Gemini API key is **never persisted** — it lives in JS memory for the current plugin session only
- Images uploaded as references are downscaled to a maximum of 1024px on the longest side before being sent to the API
- Generated SVGs are placed as native Figma vector frames using `figma.createNodeFromSvg()`
- Network access is scoped to `generativelanguage.googleapis.com` and Google Fonts only (enforced by Figma's CSP)
