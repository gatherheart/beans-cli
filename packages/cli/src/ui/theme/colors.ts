/**
 * UI Color Theme - Pastel palette
 */

export const colors = {
  // Primary
  primary: '#87CEFA',      // Light Sky Blue

  // Role colors
  user: '#DDA0DD',         // Plum
  assistant: '#98FB98',    // Pale Green
  system: '#F0E68C',       // Khaki

  // Status colors
  success: '#98FB98',      // Pale Green
  warning: '#F0E68C',      // Khaki
  error: '#FFB6C1',        // Light Pink

  // UI elements
  border: '#87CEFA',       // Light Sky Blue
  header: '#B0C4DE',       // Light Steel Blue
  muted: 'gray',           // Gray for secondary text

  // Tool colors for hash-based selection
  toolPalette: [
    '#87CEFA',  // Light Sky Blue
    '#DDA0DD',  // Plum
    '#98FB98',  // Pale Green
    '#F0E68C',  // Khaki
    '#FFB6C1',  // Light Pink
    '#B0C4DE',  // Light Steel Blue
  ],
} as const;

/**
 * Get a color for a tool name based on hash
 */
export function getToolColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return colors.toolPalette[Math.abs(hash) % colors.toolPalette.length];
}
