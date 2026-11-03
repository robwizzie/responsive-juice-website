import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampView, cropRect } from '../assets/js/admin/cropper.js';

const photo = { width: 3000, height: 2000 }; // a landscape photo
const frame = { width: 400, height: 500 }; // going into a 4:5 portrait frame

test('at no zoom the frame covers the full height, and moving stays inside the photo', () => {
	// Centered: the frame shows the middle slice of the photo
	const scale = 500 / 2000;
	const centered = clampView(photo, frame, { zoom: 1, x: (400 - 3000 * scale) / 2, y: 0 });
	const r = cropRect(photo, frame, centered);
	assert.equal(Math.round(r.sh), 2000);
	assert.equal(Math.round(r.sw), 1600);
	assert.equal(Math.round(r.sx), 700);
	// Dragging too far right or down never shows an empty edge
	const pushed = clampView(photo, frame, { zoom: 1, x: 900, y: 300 });
	assert.deepEqual([pushed.x, pushed.y], [0, 0]);
	const pulled = clampView(photo, frame, { zoom: 1, x: -9999, y: -9999 });
	const end = cropRect(photo, frame, pulled);
	assert.equal(Math.round(end.sx + end.sw), 3000);
	assert.equal(Math.round(end.sy + end.sh), 2000);
});

test('zooming in crops a smaller part of the photo, same shape as the frame', () => {
	const r = cropRect(photo, frame, clampView(photo, frame, { zoom: 2, x: -400, y: -300 }));
	assert.equal(Math.round(r.sh), 1000);
	assert.equal(Math.round(r.sw), 800);
	assert.ok(Math.abs(r.sw / r.sh - 0.8) < 1e-9);
});
