// Stylized (cartoon) notes only — never exact copies of real banknotes.
export const CURRENCIES = {
  XAF: {
    code: 'XAF',
    format: (v) => `${v.toLocaleString('fr-FR')}F`,
    notes: [
      { value: 500, weight: 4, color: '#3fbf6f', dark: '#1f7a43' },
      { value: 1000, weight: 3, color: '#4aa3ff', dark: '#1f5fa8' },
      { value: 2000, weight: 2, color: '#ff9f43', dark: '#b3621a' },
      { value: 5000, weight: 1, color: '#c56cf0', dark: '#7d2fa3' },
    ],
  },
  NGN: {
    code: 'NGN',
    format: (v) => `₦${v.toLocaleString('en-NG')}`,
    notes: [
      { value: 100, weight: 4, color: '#3fbf6f', dark: '#1f7a43' },
      { value: 200, weight: 3, color: '#4aa3ff', dark: '#1f5fa8' },
      { value: 500, weight: 2, color: '#ff9f43', dark: '#b3621a' },
      { value: 1000, weight: 1, color: '#c56cf0', dark: '#7d2fa3' },
    ],
  },
  USD: {
    code: 'USD',
    format: (v) => `$${v.toLocaleString('en-US')}`,
    notes: [
      { value: 1, weight: 4, color: '#3fbf6f', dark: '#1f7a43' },
      { value: 5, weight: 3, color: '#4aa3ff', dark: '#1f5fa8' },
      { value: 10, weight: 2, color: '#ff9f43', dark: '#b3621a' },
      { value: 20, weight: 1, color: '#c56cf0', dark: '#7d2fa3' },
    ],
  },
};

export const DEFAULT_CURRENCY = 'XAF';

export function noteLabel(currency, value) {
  return currency.format(value);
}

export function averageNoteValue(currency) {
  const total = currency.notes.reduce((s, n) => s + n.weight, 0);
  return currency.notes.reduce((s, n) => s + n.value * n.weight, 0) / total;
}
