import JuiceShowcase from '/assets/js/components/juice-showcase.js';
import { initIntros, initParallax, revealOnScroll } from '/assets/js/effects.js';

const slug = window.location.pathname.split('/').pop().replace('.html', '');
const index = juices.findIndex(j => j.slug === slug);
const juice = juices[index];
const ingredientIcon = name => `/assets/img/ingredients/${name.toLowerCase().replace(/ /g, '-')}.webp`;

if (!juice) {
	window.location.href = '/juices';
} else {
	document.querySelector('.juice-page').style.setProperty('--c', juice.color);
	updateSEOMetadata(juice);
	renderHero(juice);
	renderInfo(juice);
	renderPager();

	new JuiceShowcase(document.querySelector('[data-juice-showcase]'), {
		juices,
		exclude: slug,
		accent: document.querySelector('[data-showcase-accent]')
	});

	initIntros();
	initParallax();
	revealOnScroll(document.querySelectorAll('[data-reveal]'));
}

function renderHero(juice) {
	const [first, second] = juice.ingredients;
	const leaves = [50, 35, 20, 40, 30, 55].map(depth => `<img src="/assets/img/leaf.webp" alt="" class="home__leaf" style="--depth: ${depth}">`).join('');

	document.getElementById('juiceHero').innerHTML = `
		<p class="juice-hero__backdrop" aria-hidden="true">${juice.name}</p>
		<div class="juice-hero__inner container">
			<div class="juice-hero__copy">
				<a href="/juices" class="juice-hero__back" data-intro-item><i class="ri-arrow-left-line"></i> All juices</a>
				<p class="hero__eyebrow">Cold-pressed &bull; 12 fl oz</p>
				<h1 class="juice-hero__name" data-intro-item>${juice.name}</h1>
				<p class="juice-hero__lede" data-intro-item>${juice.metaDescription}</p>
				<div class="juice-hero__meta" data-intro-item>
					<span class="juice-hero__price">$${juice.price.toFixed(2)}</span>
					<span class="ordering-closed"><i class="ri-store-2-line"></i> Online ordering is closed</span>
				</div>
			</div>

			<div class="home__images juice-hero__art" data-parallax style="--glow: ${juice.color}">
				<img src="/assets/img/splash/${juice.slug}-splash.webp" alt="" class="home__liquid" fetchpriority="high" style="--depth: 10">
				<div class="home__juice-animate" style="--depth: 18">
					<img src="${juice.imageUrl}" alt="${juice.name} bottle" class="home__juice" fetchpriority="high">
				</div>
				<img src="${ingredientIcon(first)}" alt="" class="home__apple1" style="--depth: 32">
				<img src="${ingredientIcon(second)}" alt="" class="home__apple2" style="--depth: 26">
				<div class="home__leaves">${leaves}</div>
			</div>
		</div>
	`;
}

function renderInfo(juice) {
	document.getElementById('juiceInfo').innerHTML = `
		<div class="juice-info__ingredients">
			<h2 class="juice-info__heading" data-reveal>What's inside</h2>
			<ul class="ingredient-grid">
				${juice.ingredients
					.map(
						name => `
					<li class="ingredient-card" data-reveal>
						<span class="ingredient-card__icon"><img src="${ingredientIcon(name)}" alt="" loading="lazy" decoding="async"></span>
						<span class="ingredient-card__name">${name}</span>
					</li>`
					)
					.join('')}
			</ul>
		</div>

		<div class="juice-info__nutrition" data-reveal>
			<h2 class="juice-info__heading">Nutrition facts</h2>
			<figure class="nutrition-card">
				<img src="/assets/img/nutrition-facts/${juice.slug}-facts.webp" alt="${juice.name} nutrition facts label" loading="lazy" decoding="async">
			</figure>
		</div>
	`;

	// Not every juice has a nutrition label photo; drop that column rather than show a broken image
	document.querySelector('.nutrition-card img').addEventListener('error', () => {
		document.querySelector('.juice-info__nutrition').remove();
		document.getElementById('juiceInfo').classList.add('juice-info--single');
	});
}

function renderPager() {
	const neighbour = delta => juices[(index + delta + juices.length) % juices.length];
	const link = (other, label, direction) => `
		<a href="/juices/${other.slug}" class="pager-card pager-card--${direction}" style="--c: ${other.color}" data-reveal>
			<img src="${other.imageUrl}" alt="" class="pager-card__bottle" loading="lazy" decoding="async">
			<span class="pager-card__text">
				<span class="pager-card__label">${direction === 'prev' ? '<i class="ri-arrow-left-line"></i>' : ''} ${label} ${direction === 'next' ? '<i class="ri-arrow-right-line"></i>' : ''}</span>
				<span class="pager-card__name">${other.name}</span>
			</span>
		</a>
	`;

	document.getElementById('juicePager').innerHTML = link(neighbour(-1), 'Previous', 'prev') + link(neighbour(1), 'Next', 'next');
}

// Function to update SEO metadata dynamically
function updateSEOMetadata(juice) {
	const currentUrl = window.location.href;
	const baseUrl = window.location.origin;

	// Update title
	document.title = `${juice.name} - Premium Cold-Pressed Juice | Sip On Pressed`;

	// Use database metadata if available, otherwise fallback to generated content
	const description = juice.metaDescription || `Try our delicious ${juice.name} cold-pressed juice made with ${juice.ingredients.join(', ')}. Fresh, organic, and packed with nutrients.`;
	const keywords = juice.metaKeywords || `${juice.name}, ${juice.ingredients.join(', ')}, cold-pressed juice, organic juice, fresh juice, healthy drinks, nutrient-rich`;
	const metaImage = juice.metaImage ? `${baseUrl}${juice.metaImage}` : `${baseUrl}/assets/img/branding/logo.png`;

	// Update meta description
	updateMetaTag('name', 'description', description);
	updateMetaTag('name', 'keywords', keywords);

	// Update Open Graph tags
	updateMetaTag('property', 'og:title', `${juice.name} - Premium Cold-Pressed Juice`);
	updateMetaTag('property', 'og:description', description);
	updateMetaTag('property', 'og:image', metaImage);
	updateMetaTag('property', 'og:image:width', '1200');
	updateMetaTag('property', 'og:image:height', '630');
	updateMetaTag('property', 'og:image:type', 'image/png');
	updateMetaTag('property', 'og:url', currentUrl);

	// Update Twitter Card tags
	updateMetaTag('name', 'twitter:title', `${juice.name} - Premium Cold-Pressed Juice`);
	updateMetaTag('name', 'twitter:description', description);
	updateMetaTag('name', 'twitter:image', metaImage);

	// Update canonical URL
	let canonical = document.querySelector('link[rel="canonical"]');
	if (canonical) {
		canonical.href = currentUrl;
	} else {
		canonical = document.createElement('link');
		canonical.rel = 'canonical';
		canonical.href = currentUrl;
		document.head.appendChild(canonical);
	}

	// Add structured data (JSON-LD)
	addStructuredData(juice);
}

// Helper function to update meta tags
function updateMetaTag(attribute, attributeValue, content) {
	let metaTag = document.querySelector(`meta[${attribute}="${attributeValue}"]`);
	if (metaTag) {
		metaTag.content = content;
	} else {
		metaTag = document.createElement('meta');
		metaTag.setAttribute(attribute, attributeValue);
		metaTag.content = content;
		document.head.appendChild(metaTag);
	}
}

// Function to add structured data for better SEO
function addStructuredData(juice) {
	// Remove existing structured data
	const existingScript = document.querySelector('script[type="application/ld+json"]');
	if (existingScript) {
		existingScript.remove();
	}

	const baseUrl = window.location.origin;
	const metaImage = juice.metaImage ? `${baseUrl}${juice.metaImage}` : `${baseUrl}/assets/img/branding/logo.png`;

	const structuredData = {
		'@context': 'https://schema.org/',
		'@type': 'Product',
		name: juice.name,
		description: juice.metaDescription || `Fresh cold-pressed juice made with ${juice.ingredients.join(', ')}`,
		image: [`${baseUrl}${juice.imageUrl}`, metaImage, `${baseUrl}/assets/img/nutrition-facts/${juice.slug}-facts.webp`],
		brand: {
			'@type': 'Brand',
			name: 'Sip On Pressed'
		},
		category: 'Cold-Pressed Juice',
		offers: {
			'@type': 'Offer',
			price: juice.price.toFixed(2),
			priceCurrency: 'USD',
			availability: 'https://schema.org/Discontinued',
			seller: {
				'@type': 'Organization',
				name: 'Sip On Pressed'
			}
		},
		nutrition: {
			'@type': 'NutritionInformation',
			description: 'Rich in vitamins, minerals, and antioxidants from fresh organic ingredients'
		},
		additionalProperty: juice.ingredients.map(ingredient => ({
			'@type': 'PropertyValue',
			name: 'Ingredient',
			value: ingredient
		}))
	};

	const script = document.createElement('script');
	script.type = 'application/ld+json';
	script.textContent = JSON.stringify(structuredData);
	document.head.appendChild(script);
}
