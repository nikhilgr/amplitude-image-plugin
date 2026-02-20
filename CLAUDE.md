# Amplitude Image Plugin - Project Memory

## Project Overview
- **Type**: Figma plugin (early-stage, scaffolded from official template)
- **Name**: Amplitude Image Gen (plugin ID: `1605114189749493356`)
- **Status**: Boilerplate only — no Amplitude/image-gen logic implemented yet
- **Goal**: Evolve into an image generation plugin for Amplitude's design workflows

## Key Files
- `code.ts` — Main plugin logic (source of truth, compiles to `code.js`)
- `ui.html` — Plugin UI (plain HTML/JS in Figma iframe sandbox)
- `manifest.json` — Figma plugin descriptor
- `package.json` — NPM config, build scripts
- `tsconfig.json` — TypeScript config (ES6, strict)

## Tech Stack
- Figma Plugin API, TypeScript 5.3, plain HTML/JS UI
- ESLint with Figma-specific rules
- No frontend frameworks, no runtime dependencies
- Network access disabled (`allowedDomains: ["none"]`)

## Architecture
- `code.ts` runs in Figma sandbox, shows UI via `figma.showUI(__html__)`
- `ui.html` communicates back via `parent.postMessage()`
- Document access: `dynamic-page` (current page only)

## Build Commands
- `npm run build` — one-time compile
- `npm run watch` — watch mode
- `npm run lint` / `npm run lint:fix` — linting

## Progress Tracker
- [x] Project scaffolded from Figma plugin template
- [ ] Replace boilerplate rectangle logic with image gen functionality
- [ ] Design and implement custom UI
- [ ] Enable network access for image generation API calls
- [ ] Add Amplitude-specific branding/features
- [ ] Testing and iteration

## User Preferences
_(To be updated as preferences are expressed)_

## Decisions & Notes
- `code.js` is gitignored; only `code.ts` is tracked
- README is stock Figma quickstart — needs project-specific docs eventually

---

## Figma Plugin Best Practices (from official docs)

### 1. How Plugins Run
- **Two-context architecture**: main thread (sandbox) has Figma API access but NO browser APIs; `<iframe>` UI has full browser APIs but NO direct Figma access
- Communication between contexts is exclusively via **message passing**
- The sandbox supports ES6+, JSON, Promises, `Uint8Array`, and a minimal `console` — but no DOM, no XMLHttpRequest
- **Always call `figma.closePlugin()`** when done — forgetting it leaves the plugin running indefinitely
- Pages load on demand; only load additional pages when truly needed for performance
- Network requests to domains not listed in `manifest.json` are silently blocked via CSP

### 2. Accessing the Document
- Node tree: `DocumentNode` → `PageNode` → layer nodes
- Access current page: `figma.currentPage`; selection: `figma.currentPage.selection`
- **Always handle 3 selection cases**: nothing, one node, multiple nodes
- **Dynamic page loading**: calling `.children` on an unloaded page throws an exception — always `await page.loadAsync()` first
- `node.findOne(fn)` and `node.findAll(fn)` for searching; avoid full-document traversal unless necessary
- Skip instance sublayers in traversals for performance
- **Avoid `figma.loadAllPagesAsync()`** unless performing document-wide operations (find-replace, stats)

### 3. Editing Properties
- **Core rule**: clone → modify clone → reassign to property (never mutate in place)
- Scalar properties (`node.x`, `node.opacity`) can be set directly
- Complex properties (fills, selection, etc.) are readonly — must replace the entire value
- `node.fills[0].color.r = 0.5` silently does nothing / throws — always clone first
- Use `JSON.parse(JSON.stringify(obj))` for deep cloning, or a custom recursive clone for `Uint8Array`
- For arrays: use `.slice()`, `.concat()`, `.map()` (returns new array); never `.push()` on the original
- Build new arrays completely before assigning (avoid repeated reassignments)
- `figma.util.solidPaint("#FF00FF")` for CSS-style color creation
- **Dev Mode restrictions**: can only modify `pluginData`, `relaunchData`, and `exportAsync()`

### 4. TypeScript
- **Always check `node.type`** before accessing type-specific properties (prevents crashes)
- Use type narrowing: `if (node.type === 'FRAME') { ... }` — compiler narrows automatically
- Define union types for nodes sharing properties: `type NodeWithChildren = FrameNode | ComponentNode | ...`
- Use **type predicates** for reusable narrowing: `function supportsChildren(node): node is FrameNode | ...`
- Minimize `as any` — acceptable for prototyping, but clean up before shipping
- Use `@figma/eslint-plugin-figma-plugins` for Figma-specific lint rules
- Don't forget rare node types: BooleanOperationNode, SliceNode, etc.

### 5. Creating a User Interface
- `figma.showUI(__html__)` renders `ui.html` inside an iframe
- **UI → Plugin**: `parent.postMessage({ pluginMessage: data }, '*')` — must wrap in `pluginMessage` and use `'*'`
- **Plugin → UI**: `figma.ui.postMessage(data)` — UI receives via `onmessage = (e) => e.data.pluginMessage`
- Messages sent before iframe loads are automatically queued
- Supported transfer types: objects, arrays, primitives, `Date`, `Uint8Array` — NOT `Blob`, `ArrayBuffer`, or other TypedArrays
- Object prototypes/methods are not preserved across transfers (treat as JSON)
- For drag-and-drop: prefer `postMessage`-based `pluginDrop` for cross-environment compatibility
- For sensitive data in non-null origin iframes: specify `pluginId` and use `'https://www.figma.com'` as postMessage target

### 6. CSS Variables & Theming
- Enable with `figma.showUI(__html__, { themeColors: true })`
- Injects `figma-light` or `figma-dark` class on `<html>` plus a `<style id="figma-style">` block
- Token naming: `--figma-color-{type}-{role}-{prominence}-{interaction}`
  - Types: `bg`, `text`, `icon`, `border`
  - Roles: `brand`, `danger`, `warning`, `success`, `selected`, `disabled`, `inverse`
  - Prominence: `secondary`, `tertiary`, `strong`
  - Interaction: `hover`, `pressed`
- Key tokens: `--figma-color-bg` (background), `--figma-color-text` (text), `--figma-color-bg-brand` (primary button), `--figma-color-border-selected` (focused input)
- Variables update dynamically when user switches themes
- **Gotcha**: navigating the iframe to an external URL breaks theming; externally-hosted UIs don't get theme support

### 7. Plugin Parameters (Quick Actions Input)
- Define parameters in `manifest.json` with `name`, `key`, and optional `allowFreeform`/`optional` flags
- **Optional parameters must appear last** in the manifest array (or error is thrown)
- Handle `figma.parameters.on('input')` for suggestion mode and `figma.on('run')` for execution
- During query/suggestion mode: can read the document and make network calls but **cannot modify the document or show UI**
- `result.setSuggestions(...)` supports strings, icons, and hidden metadata (e.g., node IDs)
- Non-freeform parameters require the user to pick from suggestions — no free text
- `parameters` is `undefined` if the user bypasses parameter UI (e.g., "Run last plugin" shortcut)
- `parameterOnly: false` allows the plugin to run without parameters from most menus

### 8. Working with Images ⭐ (Critical for our plugin)
- **Supported formats**: PNG, JPG, GIF only; max 4096×4096 px
- **Images are fills, not standalone**: must be rendered as a fill on a node
  ```ts
  { type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }
  ```
- **Loading from URL**: `figma.createImageAsync(url)` → returns `Promise<Image>`
- **Getting dimensions**: `image.getSizeAsync()` — don't hardcode sizes
- **Image hashes**: every image identified by `image.hash`; retrieve with `figma.getImageByHash(hash)`
- **Creating from bytes**: `figma.createImage(uint8Array).hash`
- **Pixel manipulation**: must decode in iframe via `<canvas>` (browser API), modify pixel data `[R,G,B,A,...]`, re-encode, then send back to main thread
- **CORS**: can block URL fetches — Base64-encoded data avoids this
- **Clone paint objects** with `JSON.parse(JSON.stringify(paint))` before modifying
- **GIFs**: not supported by `<canvas>` — need a third-party library
- **Architecture for image work**: main thread ↔ iframe message passing is required since the main thread can't decode images
