import { ready, initParallax, revealOnScroll, t } from '../site.js';
import { BACKDROPS, DEFAULT_BACKDROP, ingredientPhoto, juiceStatus } from '../shared/catalog.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { rail } from '../lib/carousel.js';
import { bottleArt, juiceCard, money, statusStamp } from '../lib/components.js';
import { icon } from '../lib/icons.js';

const slug = location.pathname.replace(/\/$/, '').split('/').pop().replace(/\.html$/, '');
const root = document.querySelector('[data-juice-page]');

function chip(juice, name) {
	const src = ingredientPhoto(juice, name);
	return `<li class="chip">${src ? `<img src="${src}" alt="" loading="lazy" decoding="async">` : `<span class="chip__dot"></span>`}${e(name)}</li>`;
}

/**
 * The hero background Hunter picked. A color preset fills the whole hero; a photo (the riverfront
 * or one he uploaded) sits in a rounded frame behind the bottle, so it's never stretched past its
 * real resolution.
 */
function backdrop(juice) {
	const choice = juice.backdrop || DEFAULT_BACKDROP;
	const preset = BACKDROPS[choice];
	if (preset?.image) {
		return {
			kind: choice,
			photo: `<img src="${preset.image}" srcset="${preset.imageSmall} 645w, ${preset.image} 1290w" sizes="(max-width: 900px) 92vw, 560px" alt="" class="pdp-hero__photo" fetchpriority="high">`
		};
	}
	if (preset) return { kind: choice, photo: '' };
	return { kind: 'photo', photo: `<img src="${encodeURI(choice)}" alt="" class="pdp-hero__photo" fetchpriority="high">` };
}

function nutritionLabel(juice) {
	const n = juice.nutrition;
	const row = (label, amount, dv, indent = false) =>
		`<div class="label__row${indent ? ' label__row--indent' : ''}"><span><strong>${label}</strong> ${amount}</span><span>${dv ?? ''}</span></div>`;
	return `
		<div class="label" data-reveal>
			<h2 class="label__title">Nutrition Facts</h2>
			<p class="label__serving">1 bottle &middot; ${juice.sizeOz} fl oz</p>
			<div class="label__cal"><span>Calories</span><strong>${n.calories}</strong></div>
			<p class="label__dv">% Daily Value</p>
			${row('Total Fat', `${n.totalFat}g`, `${n.totalFatDv}%`)}
			${row('Sodium', `${n.sodium}mg`, `${n.sodiumDv}%`)}
			${row('Total Carbohydrate', `${n.carbs}g`, `${n.carbsDv}%`)}
			${row('Natural Sugars', `${n.sugars}g`, '', true)}
			${row('Protein', `${n.protein}g`, '')}
			<p class="label__foot">${e(t('juice.label.foot'))}</p>
		</div>`;
}

function vitaminBars(juice) {
	if (!juice.vitamins.length) return '';
	const top = Math.max(100, ...juice.vitamins.map(v => v.dv));
	return `
		<div class="vitamins" data-reveal>
			<h3 class="section-title--sm">${e(t('juice.vitamins.title'))}</h3>
			<ul class="vitamins__list">
				${juice.vitamins
					.map(
						(v, i) => `
					<li class="vitamin" style="--i: ${i}">
						<div class="vitamin__label"><span>${e(v.name)}</span><strong>${v.dv}%</strong></div>
						<div class="vitamin__track"><span style="--w: ${Math.max(4, (v.dv / top) * 100)}%"></span></div>
					</li>`
					)
					.join('')}
			</ul>
			<p class="vitamins__note">${e(t('juice.vitamins.note'))}</p>
		</div>`;
}

function buyBlock(juice, settings) {
	const status = juiceStatus(juice);
	if (status === 'coming-soon') {
		// The Instagram handle in the message links to the profile
		const handle = `@${e(settings.instagram)}`;
		const message = e(t('juice.comingSoon')).replace(handle, `<a href="https://instagram.com/${e(settings.instagram)}" target="_blank" rel="noopener">${handle}</a>`);
		return `${statusStamp(juice)}${juice.price ? `<span class="price price--lg">${money(juice.price)}</span>` : ''}
			<p class="pdp-panel__soon">${message}</p>`;
	}
	if (status === 'sold-out') {
		return `<span class="price price--lg">${money(juice.price)}</span>${statusStamp(juice)}
			<p class="pdp-panel__soon">${e(t('juice.soldOut'))}</p>`;
	}
	if (!settings.orderingEnabled) return `<span class="price price--lg">${money(juice.price)}</span><span class="stamp stamp--sold-out">Ordering paused</span>`;
	return `
		<span class="price price--lg">${money(juice.price)}</span>
		<div class="stepper stepper--lg" data-pdp-qty>
			<button type="button" class="stepper__btn" data-step="-1" aria-label="Fewer">${icon('minus')}</button>
			<span class="stepper__value">1</span>
			<button type="button" class="stepper__btn" data-step="1" aria-label="More">${icon('plus')}</button>
		</div>
		<button type="button" class="btn btn--ink btn--lg pdp-panel__add" data-add="${juice.slug}" data-qty="1">${icon('plus')} Add to cart</button>`;
}

function render(juice, juices, settings) {
	document.title = `${juice.name} | SiponPressed`;
	const ingredients = juice.ingredients.length ? `${juice.ingredients.join(', ')}. ` : '';
	document.querySelector('meta[name="description"]').content = `${juice.name}: ${ingredients}Cold-pressed in Philadelphia by SiponPressed.`;
	const others = juices.filter(j => j.slug !== juice.slug);
	const status = juiceStatus(juice);
	const bg = backdrop(juice);

	root.innerHTML = `
		<section class="pdp-hero is-${status}" data-backdrop="${bg.kind}" style="--c: ${juice.color}">
			<div class="pdp-hero__bg" aria-hidden="true"></div>
			<div class="container pdp-hero__inner">
				<div class="pdp-hero__art${bg.photo ? ' pdp-hero__art--photo' : ''}">${bg.photo}${bottleArt(juice, { size: 'xl', eager: true })}</div>
				<div class="pdp-panel">
					<a href="/juices" class="pdp-panel__back">${icon('arrowLeft')} All juices</a>
					<p class="pdp-panel__meta">Cold pressed &middot; ${juice.sizeOz} fl oz${juice.nutrition?.calories ? ` &middot; ${juice.nutrition.calories} cal` : ''}</p>
					<h1 class="pdp-panel__name">${e(juice.name)}</h1>
					${juice.tagline ? `<p class="pdp-panel__tagline">${e(juice.tagline)}</p>` : ''}
					${juice.description ? `<p class="pdp-panel__desc">${e(juice.description)}</p>` : ''}
					${juice.ingredients.length ? `<ul class="chips">${juice.ingredients.map(name => chip(juice, name)).join('')}</ul>` : ''}
					<div class="pdp-panel__buy">${buyBlock(juice, settings)}</div>
					<ul class="badges">
						<li>${icon('snow')} ${e(t('juice.badge.1'))}</li>
						<li>${icon('drop')} ${e(t('juice.badge.2'))}</li>
						<li>${icon('leaf')} ${e(t('juice.badge.3'))}</li>
					</ul>
				</div>
			</div>
		</section>

		${
			juice.nutrition?.calories
				? `<section class="section" style="--c: ${juice.color}">
			<div class="container inside">
				<div>
					<div data-reveal>
						<p class="kicker" style="--kicker-dot: ${juice.color}">${e(t('juice.inside.kicker'))}</p>
						<h2 class="section-title">${e(t('juice.inside.title', { count: juice.ingredients.length }))}</h2>
					</div>
					<div class="ingredients" data-reveal>
						${juice.ingredients
							.map((name, i) => {
								const src = ingredientPhoto(juice, name);
								return `<div class="ingredient" style="--i: ${i}">${src ? `<img src="${src}" alt="" loading="lazy">` : '<span class="chip__dot"></span>'}${e(name)}</div>`;
							})
							.join('')}
					</div>
					${vitaminBars(juice)}
				</div>
				${nutritionLabel(juice)}
			</div>
		</section>`
				: ''
		}

		${
			others.length
				? `<section class="section section--tint">
			<div class="container rail" data-rail>
				<div class="section-head" data-reveal>
					<div>
						<p class="kicker">${e(t('juice.more.kicker'))}</p>
						<h2 class="section-title">${e(t('juice.more.title'))}</h2>
					</div>
					<div class="rail__nav">
						<button type="button" class="icon-btn rail__btn" data-rail-prev aria-label="Scroll back">${icon('arrowLeft')}</button>
						<button type="button" class="icon-btn rail__btn" data-rail-next aria-label="Scroll forward">${icon('arrowRight')}</button>
					</div>
				</div>
				<div class="rail__track">${others.map(j => juiceCard(j)).join('')}</div>
			</div>
		</section>`
				: ''
		}`;

	const qty = root.querySelector('[data-pdp-qty]');
	qty?.addEventListener('click', event => {
		const step = event.target.closest('[data-step]');
		if (!step) return;
		const value = qty.querySelector('.stepper__value');
		const next = Math.max(1, Math.min(48, Number(value.textContent) + Number(step.dataset.step)));
		value.textContent = next;
		root.querySelector('.pdp-panel__add').dataset.qty = next;
	});

	const railRoot = root.querySelector('[data-rail]');
	if (railRoot) rail(railRoot);
	revealOnScroll(root);
	initParallax(root);
}

ready.then(({ juices, settings }) => {
	const juice = juices.find(j => j.slug === slug);
	if (!juice) {
		location.replace('/juices');
		return;
	}
	render(juice, juices, settings);
});
