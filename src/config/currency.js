// Stylized money only — inspired by real coins/notes (colors, values) but never exact copies.
// kind: 'coin' or 'bill' decides how the item is drawn.
export const CURRENCIES = {
  XAF: {
    code: 'XAF',
    format: (v) => `${v.toLocaleString('fr-FR')}F`,
    notes: [
      { value: 100, weight: 5, kind: 'coin', color: '#f2c14e', dark: '#9a6a12' },
      { value: 200, weight: 4, kind: 'coin', color: '#dfe3e8', dark: '#6f7782' },
      { value: 500, weight: 3, kind: 'coin', color: '#ffd76a', dark: '#8a5a0a', ring: '#cfd6de' },
      { value: 1000, weight: 2, kind: 'bill', color: '#38b86a', dark: '#1b6b3b' },
      { value: 2000, weight: 1, kind: 'bill', color: '#3d8bff', dark: '#1a4fa8' },
    ],
  },
  NGN: {
    code: 'NGN',
    format: (v) => `₦${v.toLocaleString('en-NG')}`,
    notes: [
      { value: 10, weight: 5, kind: 'coin', color: '#f2c14e', dark: '#9a6a12' },
      { value: 20, weight: 4, kind: 'coin', color: '#dfe3e8', dark: '#6f7782' },
      { value: 50, weight: 3, kind: 'bill', color: '#3d8bff', dark: '#1a4fa8' },
      { value: 100, weight: 2, kind: 'bill', color: '#c56cf0', dark: '#7d2fa3' },
      { value: 200, weight: 1, kind: 'bill', color: '#38b86a', dark: '#1b6b3b' },
    ],
  },
  USD: {
    code: 'USD',
    format: (v) => `$${v.toLocaleString('en-US')}`,
    notes: [
      { value: 1, weight: 5, kind: 'coin', color: '#f2c14e', dark: '#9a6a12' },
      { value: 2, weight: 4, kind: 'coin', color: '#dfe3e8', dark: '#6f7782' },
      { value: 5, weight: 3, kind: 'bill', color: '#38b86a', dark: '#1b6b3b' },
      { value: 10, weight: 2, kind: 'bill', color: '#3d8bff', dark: '#1a4fa8' },
      { value: 20, weight: 1, kind: 'bill', color: '#c56cf0', dark: '#7d2fa3' },
    ],
  },
};

export const DEFAULT_CURRENCY = 'XAF';

export function averageNoteValue(currency) {
  const total = currency.notes.reduce((s, n) => s + n.weight, 0);
  return currency.notes.reduce((s, n) => s + n.value * n.weight, 0) / total;
}

export function noteKey(currency, note) {
  return `money_${currency.code}_${note.value}`;
}
