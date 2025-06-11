// Lightweight client-side router to gracefully handle navigation without causing full page reloads when unnecessary.
// Currently, this script only exists to avoid failing requests to /assets/js/router.js referenced by several pages.
// If more advanced SPA-style routing is required in the future, build on top of this skeleton.

// Detect clicks on links or buttons that have an href attribute but are NOT <a> elements, e.g., <button href="/juices">.
// We simply forward the browser to the desired location.
document.addEventListener('click', event => {
	const target = event.target.closest('[href]'); // Matches elements that carry an href attribute (buttons, custom elements, etc.)
	if (!target) return;

	// Ignore normal anchor tags – let the browser handle them natively.
	if (target.tagName.toLowerCase() === 'a') return;

	const url = target.getAttribute('href');
	if (!url || url.trim() === '' || url.startsWith('#')) return;

	event.preventDefault();
	window.location.assign(url);
});
