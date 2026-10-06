import JuiceShowcase from '/assets/js/components/juice-showcase.js';

const slug = window.location.pathname.split('/').pop().replace('.html', '');
const juice = juices.find(j => j.slug === slug);
const ingredientIcon = name => `/assets/img/ingredients/${name.toLowerCase().replace(/ /g, '-')}.svg`;

if (!juice) {
	window.location.href = '/';
} else {
	updateSEOMetadata(juice);
	renderDetails(juice);
	renderNutrition(juice);

	new JuiceShowcase(document.querySelector('[data-juice-showcase]'), {
		juices,
		exclude: slug,
		accent: document.querySelector('[data-showcase-accent]')
	});

	animateIn();
}

function renderDetails(juice) {
	document.getElementById('juicePage').innerHTML = `
        <div class="product__info">
            <h1 class="home__title" style="max-width: 550px;">
                ${juice.name} <span style="color: ${juice.color};">Details</span>
            </h1>
            <div class="ingredients-list">
                <h3 style="color:${juice.color}; margin-bottom: 1rem; font-size: 2.5rem;">Ingredients:</h3>
                <ul style="font-family: var(--second-font);">
                    ${juice.ingredients
						.map(
							ingredient => `
                        <li>
                            <img src="${ingredientIcon(ingredient)}" alt="" style="width: 50px; height: 50px; vertical-align: middle;" decoding="async">
                            ${ingredient}
                        </li>`
						)
						.join('')}
                </ul>
            </div>
            <p class="product__price">$${juice.price.toFixed(2)}</p>
            <p class="ordering-closed"><i class="ri-store-2-line"></i> Online ordering is closed &mdash; thanks for sipping with us!</p>
        </div>

        <div class="home__images" style="--glow: ${juice.color}">
            <img src="/assets/img/splash/${juice.slug}-splash.svg" alt="" class="home__liquid">
            <div class="home__juice-animate">
                <img src="${juice.imageUrl}" alt="${juice.name}" class="home__juice" decoding="async">
            </div>
            ${juice.ingredients
				.slice(0, 2)
				.map((ingredient, index) => `<img src="${ingredientIcon(ingredient)}" alt="" class="home__apple${index + 1}" style="z-index: 0;" decoding="async">`)
				.join('')}
            <div>
                <img src="/assets/img/leaf.png" alt="" class="home__leaf">
                <img src="/assets/img/leaf.png" alt="" class="home__leaf">
                <img src="/assets/img/leaf.png" alt="" class="home__leaf">
                <img src="/assets/img/leaf.png" alt="" class="home__leaf">
            </div>
        </div>
    `;
}

function renderNutrition(juice) {
	document.querySelector('.nutrition-content').innerHTML = `
        <div class="magnifier-container" style="border: 3px solid ${juice.color}33;">
            <img src="/assets/img/nutrition-facts/${juice.slug}-facts.png" alt="${juice.name} Nutrition Facts" class="nutrition-image" loading="lazy">
        </div>
    `;
}

function animateIn() {
	if (typeof gsap === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	gsap.timeline({ defaults: { duration: 1, ease: 'expo.out' } })
		.from('.product__info > *', { opacity: 0, y: 20, stagger: 0.1 }, 0.3)
		.from('.home__liquid', { opacity: 0, y: 200 }, 0.5)
		.from('.home__juice-animate', { opacity: 0, y: -800, duration: 1.4 }, 0.8)
		.from('.home__apple1, .home__apple2', { opacity: 0, y: -800, duration: 1.4, stagger: 0.1 }, 1)
		.from('.nutrition-image', { opacity: 0, y: 20 }, 1.2);
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
		image: [`${baseUrl}${juice.imageUrl}`, metaImage, `${baseUrl}/assets/img/nutrition-facts/${juice.slug}-facts.png`],
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
