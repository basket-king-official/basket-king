export const W = 540;
export const H = 960;
export const VERSION = '0.9';

export const COLORS = {
  gold: '#ffd23f',
  text: '#ffffff',
  stroke: '#1a1030',
  danger: '#ff3b4e',
  green: '#3ee07a',
  boost2x: '#2f8cff',
  boost3x: '#b44dff',
  purple: '#5b2bb5',
  skyTop: 0x5fbfff,
  skyBottom: 0xfff6dc,
};

export const FONT = 'Poppins, "Segoe UI", Arial, sans-serif';

// Fruit Ninja style: bold white text with a thick dark outline.
export function textStyle(size, color = COLORS.text, extra = {}) {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: '800',
    color,
    stroke: COLORS.stroke,
    strokeThickness: Math.max(4, Math.round(size / 6)),
    ...extra,
  };
}
