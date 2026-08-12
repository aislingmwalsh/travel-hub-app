const CURRENCY_SYMBOLS = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  AUD: '$',
  CAD: '$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  NZD: '$'
};

export function getCurrencySymbol(currencyCode = 'EUR') {
  if (!currencyCode) return '€';
  const normalizedCode = String(currencyCode).trim().toUpperCase();
  return CURRENCY_SYMBOLS[normalizedCode] || normalizedCode;
}
