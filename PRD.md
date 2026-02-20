# Amplitude Image Gen — Product Requirements Document

## Context

Amplitude's design and marketing teams need stylized product abstraction illustrations for website hero images, blog posts, social media, and paid ads. Currently, creating these requires manual design work for each size/format. This plugin automates generation by leveraging Gemini 2.0 Flash to produce SVG illustrations directly on the Figma canvas, using reference designs and brand guidelines as context.

The codebase is currently a clean Figma plugin boilerplate (rectangle creator template) — every file will be replaced or modified.

---

## Architecture

```
FIGMA SANDBOX (code.ts)              UI IFRAME (ui.html)
├── figma.showUI(450×750)            ├── Amplitude-branded UI
├── Export selection → 2x PNG        ├── File uploads + thumbnails
├── Place SVG via createNodeFromSvg  ├── Gemini API calls (fetch)
├── Position/name/select frames      ├── State management (session)
└── Message router (switch)          └── Error handling + status
         ↕ postMessage (pluginMessage) ↕
```

All network requests go through the iframe. code.ts has zero network access.

---

## Files to Modify

| File | Change | Size Estimate |
|------|--------|---------------|
| `manifest.json` | Update `allowedDomains` to enable Gemini + Google Fonts | Small |
| `code.ts` | Full rewrite — message router, selection export, SVG placement | ~120-160 lines |
| `ui.html` | Full rewrite — Amplitude-branded UI, Gemini integration, all form logic | ~600-900 lines |
| `package.json` | Update `description` field | 1 line |

No new files needed. The plugin lives entirely in `code.ts` + `ui.html` + config.

---

## Implementation Steps

### Step 1: Project Setup
- Run `npm install` to get type definitions
- Update `manifest.json`: change `allowedDomains` from `["none"]` to `["generativelanguage.googleapis.com", "fonts.googleapis.com", "fonts.gstatic.com"]`
- Update `package.json` description

### Step 2: code.ts — Plugin Controller
Replace the boilerplate entirely. New structure:

- **Show UI**: `figma.showUI(__html__, { width: 450, height: 750, themeColors: false })` — Amplitude custom branding, not Figma theming
- **Typed message router**: `switch` on `msg.type` — no more `figma.closePlugin()` after every message (plugin stays open)
- **`get-selection` handler**: Filter `figma.currentPage.selection` to FrameNode + nodes with image fills only. Export each at 2x PNG via `node.exportAsync()`. Convert `Uint8Array` to `number[]` and send to UI
- **`place-svg` handler**: `figma.createNodeFromSvg(svg)` wrapped in try/catch. Set `frame.name`, `frame.resize(width, height)`, position frames in horizontal row with 100px gaps. Accumulate placed nodes — after the last one, `figma.currentPage.selection = allPlacedNodes` and `figma.viewport.scrollAndZoomIntoView(allPlacedNodes)`
- **`close-plugin` handler**: Only place `figma.closePlugin()` is called

### Step 3: ui.html — Complete UI Rebuild
Replace the boilerplate entirely. Single self-contained HTML file with `<style>`, markup, and `<script>`.

**UI Sections (scrollable, top to bottom):**

1. **Header** — "Amplitude Image Gen" with Amplitude branding
2. **API Key** — `type="password"`, session-only (JS variable, no persistence), "Stored locally in this session only" label
3. **Reference Designs** — "Upload Files" (file input, PNG/JPG) + "Use Figma Selection" button. Thumbnail grid with remove buttons. Files read via `FileReader.readAsDataURL()`. Selection images arrive as byte arrays, converted to base64 in chunks (avoid stack overflow)
4. **Brand Guidelines (Optional)** — Image uploads only (no PDF). Thumbnail grid. "Additional Notes" textarea sent as distinct "Brand Context:" section in prompt
5. **Category (Multi-Select)** — Custom dropdown with checkboxes (pure HTML/CSS/JS):
   - Website Product Feature (4:3) — 1920×1440
   - Website Product Feature (16:9) — 1920×1080
   - Blog Standard (4:3) — 1920×1440
   - Blog Featured Image (16:9) — 1920×1080
   - Social Organic Square — 1080×1080
   - Stories — 1080×1920
   - Paid Social/Link Ads — 1200×628
6. **Frame Name** — Editable text input, default: "Amplitude — Generated"
7. **Design Brief** — Large textarea, required field
8. **Advanced Settings** — Collapsible, contains editable system prompt textarea
9. **Generate Button** — Disabled until API key + category + brief are filled. Large Amplitude-branded primary button
10. **Status Area** — Step-by-step progress messages during generation. Error display with "Retry" button. Post-success "Regenerate" + "New Design" buttons
11. **Session History** — Collapsible panel, in-memory only, shows recent generations with category/timestamp/status

**Styling:** Amplitude brand colors and typography. Load Inter via Google Fonts. Custom CSS variables (`--amp-*`). Dark or light theme matching Amplitude identity.

### Step 4: Gemini API Integration (within ui.html)
- **Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={apiKey}`
- **Sequential generation**: One API call per selected category (not parallel) — enables clear progress updates and avoids rate limits
- **Request structure**:
  - `system_instruction`: Configurable system prompt focused on SVG generation quality
  - `contents.parts`: Reference images (inline base64) + brand images (inline base64) + text prompt
  - `generationConfig`: `{ temperature: 0.8, maxOutputTokens: 8192 }`
- **Text prompt per category**: "Brand Context: {notes}\n\nDesign Brief: {brief}\n\nTarget: {w}×{h} ({name})\n\nGenerate SVG with viewBox='0 0 {w} {h}'."
- **SVG extraction**: Regex `/<svg[\s\S]*?<\/svg>/` from response text (handles markdown fencing)
- **Error mapping**: 401/403 → "Invalid API key", 429 → "Rate limited", missing SVG → "Model did not generate valid SVG"

### Step 5: Default System Prompt
Stored in JS, editable via Advanced Settings:
```
You are an expert SVG illustration designer. Generate stylized, abstract product illustrations in a modern flat design style.

Rules:
1. Output ONLY valid SVG markup. No markdown, no code fences, no explanations.
2. Use the exact viewBox dimensions specified in the request.
3. Use only: svg, g, defs, linearGradient, radialGradient, stop, path, rect, circle, ellipse, line, polyline, polygon, text, tspan.
4. Apply all styles as inline attributes (fill, stroke, opacity). No <style> blocks or CSS classes.
5. Create visually rich illustrations with gradients, geometric shapes, and layered compositions.
6. Fill the entire viewBox area.
7. No <image>, <foreignObject>, <filter>, <mask>, or <clipPath> elements.
8. Keep total path count under 200 for performance.
```

### Step 6: Polish & Edge Cases
- Disable generate button during generation (`isGenerating` flag)
- Downscale oversized reference images in iframe `<canvas>` before base64 encoding (target <2MB each)
- Limit reference images to 5, brand images to 3
- Limit design brief to 2000 characters
- Detect truncated SVG (unclosed tags) and report to user
- Chunk byte-to-base64 conversion (8KB segments) to avoid call stack overflow

---

## Message Protocol

| Direction | Type | Payload |
|-----------|------|---------|
| UI → Sandbox | `get-selection` | `{}` |
| Sandbox → UI | `selection-result` | `{ images: [{bytes: number[], name: string}] }` |
| Sandbox → UI | `selection-error` | `{ error: string }` |
| UI → Sandbox | `place-svg` | `{ svg, width, height, name, index, total }` |
| Sandbox → UI | `svg-placed` | `{ index, total }` |
| Sandbox → UI | `svg-error` | `{ error, index }` |
| UI → Sandbox | `close-plugin` | `{}` |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Model | gemini-2.0-flash | Fast, cost-effective for iteration |
| Output format | Native SVG via `createNodeFromSvg()` | Editable vectors on canvas |
| API key storage | Session-only | Security — cleared on plugin close |
| Multi-size handling | Separate generation per category | Best quality per size |
| Brand guidelines format | Images only (no PDF) | Avoids pdf.js bundle (~400KB) |
| Reference export | 2x PNG, frames + image nodes | Good quality/speed balance |
| UI theme | Amplitude branded | Stronger brand identity |
| Loading UX | Status messages per step | Clear user feedback |
| Post-generation | Stay open + Regenerate/New Design | Supports iteration workflow |
| History | Session only (in-memory) | Simple, no storage overhead |
| System prompt | Configurable via Advanced Settings | Power user flexibility |
| Audience | Internal-first, public-ready | Build once, publish later |
| Plugin window | 450×750 px | Comfortable layout with room for thumbnails |
| Allowed domains | Gemini API + Google Fonts | Minimal attack surface + font support |

---

## Verification Plan

1. `npm install && npm run build` — compiles without errors
2. Load plugin in Figma → window opens at 450×750 with Amplitude-branded UI
3. Enter a Gemini API key → field masks input, clears on plugin close
4. Upload reference images → thumbnails appear with remove buttons
5. Select frames in Figma → click "Use Figma Selection" → thumbnails appear
6. Select multiple categories → dropdown shows selections, checkboxes work
7. Write a design brief → Generate button enables
8. Click Generate → status messages update step by step
9. SVG appears on canvas as editable vector frame with correct name and dimensions
10. Multiple categories → multiple frames placed side by side
11. Error case: invalid API key → shows "Invalid API key" with Retry
12. Error case: malformed SVG → shows error, does not crash plugin
13. Regenerate button → re-runs same generation
14. Session history → shows previous generations
15. Advanced Settings → system prompt is editable and affects generation
