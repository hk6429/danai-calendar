export const quoteIndex = doy => Math.min(Math.max(doy, 1), 365);
export const pickLine = (day, n) => day.lines[((n % day.lines.length) + day.lines.length) % day.lines.length];
