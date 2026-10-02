export const FALLBACK = 'img/fallback.webp';
export const sceneSrc = doy => `img/d${String(Math.min(Math.max(doy, 1), 365)).padStart(3, '0')}.webp`;
