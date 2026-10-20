export interface PdfPoint {
  x: number;
  y: number;
}

/** Builds a pdf-lib drawSvgPath-compatible "M.. L.. L.." string from PDF-space
 * (Y-up) points. drawSvgPath interprets the path with Y increasing downward
 * relative to its own (x, y) anchor, so each point's Y must be negated. */
export function pointsToSvgPath(points: PdfPoint[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const cmds = [`M ${first.x} ${-first.y}`];
  for (const p of rest) cmds.push(`L ${p.x} ${-p.y}`);
  return cmds.join(" ");
}

export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}
