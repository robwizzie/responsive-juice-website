import { ready, initParallax, revealOnScroll } from '../site.js';
import { ingredientIcon } from '../shared/catalog.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { bottleArt, juiceCard, money } from '../lib/components.js';
import { icon } from '../lib/icons.js';

const slug = location.pathname.replace(/\/$/, '').split('/').pop().replace(/\.html$/, '');
const root = document.querySelector('[data-juice-page]');

function chip(name) {
	const src = ingredientIcon(name);
	return `<li class="chip">${src ? `<img src="${src}" alt="" loading="lazy" decoding="async">` : `<span class="chip__dot"></span>`}${e(name)}</li>`;
}

function nutritionPanel(juice) {
	const n = juice.nutrition;
	const row = (label, amount, dv, indent = false) =>
		`<div class="facts__row${indent ? ' facts__row--indent' : ''}"><span><strong>${label}</strong> ${amount}</span><span>${dv ?? ''}</span></div>`;
	return `
		<div class="facts" data-reveal>
			<div class="facts__head">
				<h2 class="facts__title">Nutrition facts</h2>
				<p>1 bottle &middot; ${juice.sizeOz} fl oz</p>
			</div>
			<div class="facts__calories"><span>Calories</span><strong>${n.calories}</strong></div>
			<div class="facts__dv">% Daily value</div>
			${row('Total fat', `${n.totalFat} g`, `${n.totalFatDv}%`)}
			${row('Sodium', `${n.sodium} mg`, `${n.sodiumDv}%`)}
			${row('Total carbohydrates', `${n.carbs} g`, `${n.carbsDv}%`)}
			${row('Natural sugars', `${n.sugars} g`, '', true)}
			${row('Protein', `${n.protein} g`, '')}
			<p class="facts__foot">No added sugar. Keep refrigerated and shake well.</p>
		</div>`;
}

function vitaminBars(juice) {
	if (!juice.vitamins.length) return '';
	const top = Math.max(100, ...juice.vitamins.map(v => v.dv));
	return `
		<div class="vitamins" data-reveal>
			<p class="eyebrow">Per bottle</p>
			<h2 class="section-title section-title--sm">What it <em>brings.</em></h2>
			<ul class="vitamins__list">
				${juice.vitamins
					.map(
						v => `
					<li class="vitamin">
						<div class="vitamin__label"><span>${e(v.name)}</span><strong>${v.dv}%</strong></div>
						<div class="vitamin__track"><span style="--w: ${Math.max(4, (v.dv / top) * 100)}%"></span></div>
					</li>`
					)
					.join('')}
			</ul>
			<p class="vitamins__note">Percent of your daily value, from a single bottle.</p>
		</div>`;
}

function render(juice, juices, settings) {
	document.title = `${juice.name} | SiponPressed`;
	document.querySelector('meta[name="description"]').content = `${juice.name}: ${juice.ingredients.join(', ')}. Cold-pressed in Philadelphia by SiponPressed.`;
	const others = juices.filter(j => j.slug !== juice.slug);
	const canOrder = juice.inStock && settings.orderingEnabled;

	root.innerHTML = `
		<section class="pdp-hero" style="--c: ${juice.color}">
			<div class="pdp-hero__bg" aria-hidden="true"></div>
			<div class="container pdp-hero__inner">
				<div class="pdp-hero__art">${bottleArt(juice, { size: 'xl', eager: true })}</div>
				<div class="pdp-panel">
					<a href="/juices" class="pdp-panel__back">${icon('arrowLeft')} The menu</a>
					<p class="eyebrow">Cold-pressed &middot; ${juice.sizeOz} fl oz${juice.nutrition.calories ? ` &middot; ${juice.nutrition.calories} cal` : ''}</p>
					<h1 class="pdp-panel__name">${e(juice.name)}</h1>
					${juice.tagline ? `<p class="pdp-panel__tagline">${e(juice.tagline)}</p>` : ''}
					<p class="pdp-panel__desc">${e(juice.description)}</p>
					<ul class="chips">${juice.ingredients.map(chip).join('')}</ul>
					<div class="pdp-panel__buy">
						<span class="price price--lg">${money(juice.price)}</span>
						${
							canOrder
								? `<div class="stepper stepper--lg" data-pdp-qty>
									<button type="button" class="stepper__btn" data-step="-1" aria-label="Fewer">${icon('minus')}</button>
									<span class="stepper__value">1</span>
									<button type="button" class="stepper__btn" data-step="1" aria-label="More">${icon('plus')}</button>
								</div>
								<button type="button" class="btn btn--ink btn--lg pdp-panel__add" data-add="${juice.slug}" data-qty="1">${icon('plus')} Add to cart</button>`
								: `<span class="tag tag--dark">${juice.inStock ? 'Ordering paused' : 'Sold out for now'}</span>`
						}
					</div>
					<ul class="badges">
						<li>${icon('snow')} Cold pressed</li>
						<li>${icon('drop')} No added sugar</li>
						<li>${icon('leaf')} 100% plant based</li>
					</ul>
				</div>
			</div>
		</section>

		${
			juice.nutrition.calories
				? `<section class="section">
			<div class="container pdp-details">
				${nutritionPanel(juice)}
				${vitaminBars(juice)}
			</div>
		</section>`
				: ''
		}

		${
			others.length
				? `<section class="section section--tint">
			<div class="container">
				<div class="section-head" data-reveal>
					<p class="eyebrow">Keep sipping</p>
					<h2 class="section-title">The rest of <em>the menu.</em></h2>
				</div>
				<div class="juice-grid juice-grid--${Math.min(others.length, 3)}">${others.map(j => juiceCard(j)).join('')}</div>
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
		const add = root.querySelector('.pdp-panel__add');
		add.dataset.qty = next;
	});

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
