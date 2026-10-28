import { ready } from '../site.js';
import { juiceStatus } from '../shared/catalog.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { bottleImage, juiceCard, waysToOrder } from '../lib/components.js';

const METERS = [
	['Natural sugars', 'sugars', 'g'],
	['Carbs', 'carbs', 'g'],
	['Protein', 'protein', 'g'],
	['Sodium', 'sodium', 'mg']
];

/** One column per juice; the bars are scaled against the biggest value on the menu. */
function compare(juices) {
	const listed = juices.filter(j => j.nutrition?.calories);
	const max = key => Math.max(1, ...listed.map(j => j.nutrition[key] || 0));
	return juices
		.map(j => {
			const n = j.nutrition || {};
			const known = Boolean(n.calories);
			return `
			<a href="/juices/${j.slug}" class="compare-col" style="--c: ${j.color}">
				${bottleImage(j, { small: true, className: 'compare-col__bottle' })}
				<h3 class="compare-col__name">${e(j.name)}</h3>
				${
					known
						? `<p class="compare-col__cal"><strong>${n.calories}</strong><span>calories</span></p>
				${METERS.map(
					([label, key, unit]) => `
					<div class="meter">
						<div class="meter__label"><span>${label}</span><span>${n[key]} ${unit}</span></div>
						<div class="meter__track"><span style="--w: ${Math.max(3, ((n[key] || 0) / max(key)) * 100)}%"></span></div>
					</div>`
				).join('')}
				${j.vitamins.length ? `<ul class="compare-col__vits">${j.vitamins.slice(0, 3).map(v => `<li><strong>${v.dv}%</strong> ${e(v.name)}</li>`).join('')}</ul>` : ''}`
						: `<p class="compare-col__soon">${juiceStatus(j) === 'coming-soon' ? 'Nutrition facts when it lands.' : 'Nutrition facts coming soon.'}</p>`
				}
			</a>`;
		})
		.join('');
}

ready.then(({ juices, settings }) => {
	document.querySelector('[data-menu]').innerHTML = juices.map((juice, i) => juiceCard(juice, { eager: i < 3 })).join('');
	// Header lineup: splashes on their own layer behind, so none paints over a neighbouring bottle
	const fan = document.querySelector('[data-fan]');
	const shown = juices.filter(j => j.image).slice(0, 3);
	const mid = (shown.length - 1) / 2;
	const slot = (j, i, back) => {
		const splash = back && j.splash && j.splash !== 'none' ? `<img src="/assets/img/splash/${j.splash}.webp" alt="" class="menu-card__splash" decoding="async">` : '';
		const tag = back ? 'span' : 'a';
		const href = back ? '' : ` href="/juices/${j.slug}" tabindex="-1"`;
		return `<${tag}${href} class="menu-card__bottle${i === mid ? ' is-mid' : ''}" style="--i: ${i}; --r: ${(i - mid) * 6}deg">${splash}<img src="${j.image}" alt="" class="menu-card__img${back ? ' is-ghost' : ''}" decoding="async"></${tag}>`;
	};
	// Each bottle casts a glow in its own color, and the flavors are listed as quick links
	const card = document.querySelector('.menu-card');
	shown.forEach((j, i) => card.style.setProperty(`--c${i + 1}`, j.color));
	document.querySelector('[data-menu-chips]').innerHTML = juices
		.map(j => `<a href="/juices/${j.slug}" class="menu-chip" style="--c: ${j.color}">${e(j.name)}</a>`)
		.join('');
	fan.innerHTML = `<div class="menu-card__layer">${shown.map((j, i) => slot(j, i, true)).join('')}</div><div class="menu-card__layer">${shown.map((j, i) => slot(j, i, false)).join('')}</div>`;
	const playIn = () => requestAnimationFrame(() => document.querySelector('[data-menu-hero]').classList.add('is-in'));
	Promise.race([Promise.all([...fan.querySelectorAll('.menu-card__img')].map(img => img.decode().catch(() => {}))), new Promise(r => setTimeout(r, 1500))]).then(playIn);
	const table = document.querySelector('[data-compare]');
	table.style.setProperty('--n', Math.min(juices.length, 4));
	table.innerHTML = compare(juices);
	document.querySelector('[data-ways]').innerHTML = waysToOrder(settings);
});
