// Pixel icons for the tool buttons beside the minimap (touch and desktop): a folded map, a gear and the four corners of a frame.
const icon = body => `<svg class="tool-icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
export const TOOL_ICONS = {
  map: icon('<path d="M1 3h4l3 1 3-1h4v11h-4l-3-1-3 1H1z" fill="#2b3345"/><path d="M2 4h3v9H2zM6 5h2v8H6zM9 5h2v8H9zM12 4h2v9h-2z" fill="#f6ecd2"/><path d="M6 5h2v8H6z" fill="#e0cf9f"/><path d="M12 4h2v9h-2z" fill="#e0cf9f"/><path d="M3 6h1v1H3zM10 8h1v1h-1zM12 10h1v1h-1z" fill="#c43c36"/>'),
  gear: icon('<path d="M7 1h2v2h2l1-1 2 2-1 1v2h2v2h-2v2l1 1-2 2-1-1h-2v2H7v-2H5l-1 1-2-2 1-1V9H1V7h2V5L2 4l2-2 1 1h2z" fill="#2b3345"/><path d="M7 4h2v1h2v2h1v2h-1v2H9v1H7v-1H5V9H4V7h1V5h2z" fill="#c79a3e"/><path d="M7 6h2v1h1v2H9v1H7V9H6V7h1z" fill="#2b3345"/>'),
  fullscreen: icon('<path d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3z" fill="#2b3345"/>'),
  coin: icon('<path d="M5 1h6v1h2v2h1v8h-1v2h-2v1H5v-1H3v-2H2V4h1V2h2z" fill="#2b3345"/><path d="M5 2h6v1h1v2h1v6h-1v2h-1v1H5v-1H4v-2H3V5h1V3h1z" fill="#e0b048"/><path d="M7 4h2v1h1v6H9v1H7v-1H6V5h1z" fill="#c79a3e"/><path d="M5 4h1v3H5z" fill="#fff4d6"/>')
};
