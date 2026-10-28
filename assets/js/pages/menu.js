import { ready } from '../site.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { juiceCard, waysToOrder } from '../lib/components.js';

const ROWS = [
	['Calories', j => j.nutrition.calories],
	['Sugars (natural)', j => `${j.nutrition.sugars} g`],
	['Carbs', j => `${j.nutrition.carbs} g`],
	['Protein', j => `${j.nutrition.protein} g`],
	['Sodium', j => `${j.nutrition.sodium} mg`]
];

function compareTable(juices) {
	return `
		<div class="compare__scroll">
			<table class="compare__table">
				<thead><tr><th scope="col"><span class="visually-hidden">Nutrient</span></th>${juices
					.map(j => `<th scope="col" style="--c: ${j.color}"><a href="/juices/${j.slug}"><img src="${j.imageSmall || j.image}" alt="" loading="lazy">${e(j.name)}</a></th>`)
					.join('')}</tr></thead>
				<tbody>
					${ROWS.map(([label, value]) => `<tr><th scope="row">${label}</th>${juices.map(j => `<td>${value(j)}</td>`).join('')}</tr>`).join('')}
					<tr><th scope="row">Standouts</th>${juices
						.map(j => `<td><ul class="compare__vits">${j.vitamins.slice(0, 2).map(v => `<li><strong>${v.dv}%</strong> ${e(v.name)}</li>`).join('')}</ul></td>`)
						.join('')}</tr>
				</tbody>
			</table>
		</div>`;
}

ready.then(({ juices, settings }) => {
	document.querySelector('[data-menu]').innerHTML = juices.map((juice, i) => juiceCard(juice, { eager: i < 3 })).join('');
	document.querySelector('[data-flavor-count]').textContent = juices.length;
	document.querySelector('[data-compare]').innerHTML = compareTable(juices);
	document.querySelector('[data-ways]').innerHTML = waysToOrder(settings);
});
