/**
 * Recolors a splash shape to any color while keeping its liquid look.
 *
 * The splash photos carry their own color, so to repaint one we keep only its light and shade:
 * each pixel's brightness relative to the splash's average brightness. Average-bright pixels
 * become the new color, darker ones a deeper shade of it, and the glossy highlights lift
 * toward white the way they do on the originals. Transparency is kept as is.
 *
 * Some shapes are much flatter in brightness than others (a bright yellow splash barely varies),
 * so the shading is stretched to the same contrast on every shape before it's applied.
 */
import sharp from 'sharp';

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Target spread of the shading (standard deviation of brightness / mean), and how far a flat
// shape may be stretched to reach it
const TARGET_CONTRAST = 0.32;
const MAX_STRETCH = 2.5;

export function hexToRgb(hex) {
	const value = parseInt(hex.replace('#', ''), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Returns WebP bytes of `source` (any image sharp reads) repainted in `hex`, optionally `width` wide. */
export async function recolorSplash(source, hex, { width } = {}) {
	let image = sharp(source).ensureAlpha();
	if (width) image = image.resize({ width, withoutEnlargement: true });
	const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

	// Average brightness of the visible splash, weighted by how opaque each pixel is
	let sum = 0;
	let weight = 0;
	for (let i = 0; i < data.length; i += 4) {
		const a = data[i + 3] / 255;
		sum += luminance(data[i], data[i + 1], data[i + 2]) * a;
		weight += a;
	}
	const mean = weight ? sum / weight : 128;

	let variance = 0;
	for (let i = 0; i < data.length; i += 4) {
		const a = data[i + 3] / 255;
		variance += (luminance(data[i], data[i + 1], data[i + 2]) / mean - 1) ** 2 * a;
	}
	const contrast = weight ? Math.sqrt(variance / weight) : TARGET_CONTRAST;
	const stretch = Math.min(MAX_STRETCH, Math.max(1, TARGET_CONTRAST / (contrast || TARGET_CONTRAST)));

	const [r, g, b] = hexToRgb(hex);
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] === 0) continue;
		const shade = 1 + (luminance(data[i], data[i + 1], data[i + 2]) / mean - 1) * stretch;
		if (shade <= 1) {
			// Shadows: a deeper version of the color (never fully black)
			const k = 0.25 + 0.75 * Math.max(0, shade);
			data[i] = r * k;
			data[i + 1] = g * k;
			data[i + 2] = b * k;
		} else {
			// Highlights: lift toward white
			const k = Math.min(1, (shade - 1) * 1.1);
			data[i] = r + (255 - r) * k;
			data[i + 1] = g + (255 - g) * k;
			data[i + 2] = b + (255 - b) * k;
		}
	}

	return sharp(data, { raw: info }).webp({ quality: 80, alphaQuality: 90, effort: 4 }).toBuffer();
}
