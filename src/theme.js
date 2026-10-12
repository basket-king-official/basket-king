export const W = 540;
export const H = 960;

export const COLORS = {
  bg: '#1b1033',
  gold: '#ffd54a',
  text: '#ffffff',
  muted: '#b9a9e0',
  danger: '#ff4d5e',
  boost2x: '#2f8cff',
  boost3x: '#a64dff',
};

export const FONT = 'Poppins, "Segoe UI", Arial, sans-serif';

export function textStyle(size, color = COLORS.text, extra = {}) {
  return { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color, ...extra };
}
