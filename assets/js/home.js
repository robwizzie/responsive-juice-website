import JuiceShowcase from '/assets/js/components/juice-showcase.js';
import { initIntros, initParallax } from '/assets/js/effects.js';

new JuiceShowcase(document.querySelector('[data-juice-showcase]'), {
	juices,
	accent: document.querySelector('[data-showcase-accent]')
});

initIntros();
initParallax();
