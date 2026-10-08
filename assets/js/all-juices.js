import { revealOnScroll, tiltOnHover } from '/assets/js/effects.js';

const ingredientIcon = name => `/assets/img/ingredients/${name.toLowerCase().replace(/ /g, '-')}.webp`;
const pad = n => String(n).padStart(2, '0');

function cardTemplate(juice, index) {
	const [garnishA, garnishB] = juice.ingredients;

	return `
		<li class="juice-tile" data-reveal style="--c: ${juice.color}">
			<a href="/juices/${juice.slug}" class="juice-tile__link">
				<div class="juice-tile__art" aria-hidden="true">
					<span class="juice-tile__glow"></span>
					<img src="/assets/img/splash/${juice.slug}-splash-sm.webp" alt="" class="juice-tile__splash" loading="lazy" decoding="async">
					<img src="${ingredientIcon(garnishA)}" alt="" class="juice-tile__garnish juice-tile__garnish--1" loading="lazy" decoding="async">
					<img src="${ingredientIcon(garnishB)}" alt="" class="juice-tile__garnish juice-tile__garnish--2" loading="lazy" decoding="async">
					<img src="${juice.imageUrl}" alt="" class="juice-tile__bottle" loading="${index < 3 ? 'eager' : 'lazy'}" decoding="async">
				</div>

				<div class="juice-tile__body">
					<p class="juice-tile__count">${pad(index + 1)}</p>
					<h2 class="juice-tile__name">${juice.name}</h2>
					<ul class="juice-tile__ingredients">
						${juice.ingredients.map(name => `<li><img src="${ingredientIcon(name)}" alt="" loading="lazy" decoding="async">${name}</li>`).join('')}
					</ul>
					<span class="juice-tile__cta">Explore <i class="ri-arrow-right-up-line"></i></span>
				</div>
			</a>
		</li>
	`;
}

const grid = document.querySelector('[data-catalog]');
grid.innerHTML = juices.map(cardTemplate).join('');
document.querySelector('[data-juice-count]').textContent = juices.length;

revealOnScroll(document.querySelectorAll('[data-reveal]'));
tiltOnHover(grid.querySelectorAll('.juice-tile__link'));
