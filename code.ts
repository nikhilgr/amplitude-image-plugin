// Amplitude Image Gen — Figma Sandbox Controller
// Handles: UI initialization, selection export, SVG placement on canvas

figma.showUI(__html__, { width: 450, height: 750, themeColors: false });

// Track placed nodes for batch selection/scroll after multi-size generation
let placedNodes: SceneNode[] = [];

// Type definitions for messages from the UI
interface GetSelectionMsg {
  type: 'get-selection';
}

interface PlaceSvgMsg {
  type: 'place-svg';
  svg: string;
  width: number;
  height: number;
  name: string;
  index: number;
  total: number;
}

interface ClosePluginMsg {
  type: 'close-plugin';
}

type PluginMessage = GetSelectionMsg | PlaceSvgMsg | ClosePluginMsg;

figma.ui.onmessage = async (msg: PluginMessage) => {
  switch (msg.type) {

    case 'get-selection': {
      const selection = figma.currentPage.selection;

      if (selection.length === 0) {
        figma.ui.postMessage({
          type: 'selection-error',
          error: 'No nodes selected. Select one or more frames in Figma first.'
        });
        return;
      }

      // Filter to frames and nodes with image fills
      const validNodes = selection.filter((node) => {
        if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
          return true;
        }
        // Check for nodes with image fills (rectangles, ellipses, etc.)
        if ('fills' in node) {
          const fills = node.fills as readonly Paint[];
          if (Array.isArray(fills)) {
            return fills.some((fill: Paint) => fill.type === 'IMAGE');
          }
        }
        return false;
      });

      if (validNodes.length === 0) {
        figma.ui.postMessage({
          type: 'selection-error',
          error: 'No valid frames or image nodes in selection. Select frames, components, or image-filled shapes.'
        });
        return;
      }

      // Export each valid node as 1x PNG (smaller payload for Gemini API)
      const images: Array<{ bytes: number[]; name: string }> = [];

      for (const node of validNodes) {
        try {
          const bytes = await node.exportAsync({
            format: 'PNG',
            constraint: { type: 'SCALE', value: 1 }
          });
          // Convert Uint8Array to number[] for safe postMessage transfer
          images.push({
            bytes: Array.from(bytes),
            name: node.name || 'Untitled'
          });
        } catch (e) {
          // Skip nodes that fail to export
          console.error(`Failed to export node "${node.name}":`, e);
        }
      }

      if (images.length === 0) {
        figma.ui.postMessage({
          type: 'selection-error',
          error: 'Failed to export any selected nodes. Try selecting different frames.'
        });
        return;
      }

      figma.ui.postMessage({
        type: 'selection-result',
        images
      });
      break;
    }

    case 'place-svg': {
      const { svg, width, height, name, index, total } = msg;

      // Reset accumulator on first item of a new batch
      if (index === 0) {
        placedNodes = [];
      }

      try {
        const frame = figma.createNodeFromSvg(svg);
        frame.name = name;

        // Resize to target dimensions if needed
        if (frame.width !== width || frame.height !== height) {
          frame.resize(width, height);
        }

        // Position: use viewport center for first frame, offset subsequent ones
        const viewportCenter = figma.viewport.center;
        frame.x = viewportCenter.x + index * (width + 100);
        frame.y = viewportCenter.y;

        figma.currentPage.appendChild(frame);
        placedNodes.push(frame);

        // On last item: select all placed nodes and scroll into view
        if (index === total - 1) {
          figma.currentPage.selection = placedNodes;
          figma.viewport.scrollAndZoomIntoView(placedNodes);
        }

        figma.ui.postMessage({
          type: 'svg-placed',
          index,
          total
        });
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error placing SVG on canvas';
        figma.ui.postMessage({
          type: 'svg-error',
          error: errorMsg,
          index
        });
      }
      break;
    }

    case 'close-plugin': {
      figma.closePlugin();
      break;
    }
  }
};
