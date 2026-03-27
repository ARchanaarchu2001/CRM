export const convertScientificToPlainString = (value) => {
  const input = String(value ?? '').trim();

  if (!input || !/[eE]/.test(input)) {
    return input;
  }

  const match = input.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!match) {
    return input;
  }

  const [, sign, integerPart, fractionalPart = '', exponentString] = match;
  const digits = `${integerPart}${fractionalPart}`;
  const exponent = Number(exponentString);
  const decimalIndex = integerPart.length + exponent;

  if (decimalIndex <= 0) {
    return `${sign}0.${'0'.repeat(Math.abs(decimalIndex))}${digits}`.replace(/\.$/, '');
  }

  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  }

  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`.replace(/\.$/, '');
};

export const formatContactDisplay = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }

  return convertScientificToPlainString(value);
};
