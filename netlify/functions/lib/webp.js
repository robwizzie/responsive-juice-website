import sharp from 'sharp';

/**
 * Re-encodes an uploaded photo as WebP. Safari can't make WebP in the browser, so uploads from an
 * iPhone or Mac arrive as PNG, several times the size. Transparency is kept (bottle cut-outs).
 */
export const toWebp = input => sharp(Buffer.from(input)).rotate().webp({ quality: 84, alphaQuality: 90, effort: 4 }).toBuffer();
