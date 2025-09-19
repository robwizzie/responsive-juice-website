import CarouselManager from '/assets/js/components/carousel-manager.js';

/*=============== SHOW MENU ===============*/
const navMenu = document.getElementById('nav-menu'),
	navToggle = document.getElementById('nav-toggle'),
	navClose = document.getElementById('nav-close');

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if (navToggle) {
	navToggle.addEventListener('click', () => {
		navMenu.classList.add('show-menu');
	});
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if (navClose) {
	navClose.addEventListener('click', () => {
		navMenu.classList.remove('show-menu');
	});
}

/*=============== REMOVE MENU MOBILE ===============*/
const navLink = document.querySelectorAll('.nav__link');

function linkAction() {
	const navMenu = document.getElementById('nav-menu');
	// When we click on each nav__link, we remove the show-menu class
	navMenu.classList.remove('show-menu');
}
navLink.forEach(n => n.addEventListener('click', linkAction));

document.addEventListener('DOMContentLoaded', function () {
	console.log('Juice.js loaded');

	// Get the juice slug from the URL path
	const slug = window.location.pathname.split('/').pop();
	console.log('Current slug:', slug);

	if (typeof juices === 'undefined' || !juices) {
		console.error('Juices array is not defined. Ensure juices-database.js is loaded.');
		return;
	}
	console.log('Available juices:', juices);

	const juice = juices.find(j => j.slug === slug);
	console.log('Found juice:', juice);

	if (!juice) {
		window.location.href = '/';
		console.warn('Juice not found for slug:', slug);
		return;
	}

	// Update SEO metadata
	updateSEOMetadata(juice);

	// Populate main product details
	const juicePage = document.getElementById('juicePage');
	juicePage.innerHTML = `
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
                            <img src="/assets/img/ingredients/${ingredient.toLowerCase().replace(/ /g, '-')}.svg" 
                                alt="${ingredient}" 
                                style="width: 50px; height: 50px; vertical-align: middle;" loading="lazy" decoding="async">
                            ${ingredient}
                        </li>
                    `
						)
						.join('')}
                </ul>
            </div>
            <p class="product__price">$${juice.price.toFixed(2)}</p>
            ${
				juice.inStock
					? `<button class="home__button add-to-cart" data-id="${juice.id}" style="transform: translate(0px, 0px); opacity: 1; background-color: ${juice.color}">
                <span style="margin-right: 5px; font-size: 1rem;">Add to Cart</span> <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
            </button>`
					: `<button class="home__button add-to-cart" disabled style="transform: translate(0px, 0px); opacity: 1; background-color: #ccc; color: #666;">
                <span style="margin-right: 5px; font-size: 1rem;">Out of Stock</span>
            </button>`
			}
        </div>

        <div class="home__images">
            <img src="/assets/img/splash/${juice.slug}-splash.svg" alt="Liquid image" class="home__liquid">
            <div class="home__juice-animate" style="z-index: 3; position: relative;">
                <img src="${juice.imageUrl}" alt="${juice.name}" class="home__juice" loading="lazy" decoding="async">
            </div>
            ${juice.ingredients
				.slice(0, 2)
				.map(
					(ingredient, index) => `
                <img src="/assets/img/ingredients/${ingredient.toLowerCase().replace(/ /g, '-')}.svg" 
                    alt="${ingredient}" 
                    class="home__apple${index + 1}" style="z-index: 0;" loading="lazy" decoding="async">
            `
				)
				.join('')}
            <div>
                <img src="/assets/img/leaf.png" alt="Leaf image" class="home__leaf">
                <img src="/assets/img/leaf.png" alt="Leaf image" class="home__leaf">
                <img src="/assets/img/leaf.png" alt="Leaf image" class="home__leaf">
                <img src="/assets/img/leaf.png" alt="Leaf image" class="home__leaf">
            </div>
        </div>
    `;

	// Populate nutrition section
	const nutritionSection = document.querySelector('.nutrition-content');

	nutritionSection.innerHTML = `
            <div class="magnifier-container" style="border: 3px solid ${juice.color}33;">
                <img src="/assets/img/nutrition-facts/${juice.slug}-facts.png" 
                    alt="${juice.name} Nutrition Facts" 
                    class="nutrition-image"
                    loading="lazy">
            </div>
    `;

	// Add animation for the nutrition image
	TweenMax.from('.nutrition-image', 1, {
		delay: 1.5,
		opacity: 0,
		y: 20,
		ease: Expo.easeInOut
	});

	// Initialize carousel with filtered juices using CarouselManager
	window.relatedCarousel = new CarouselManager({
		trackSelector: '#relatedJuices',
		carouselSelector: '#relatedCarousel',
		prevButtonSelector: '.carousel-button.prev',
		nextButtonSelector: '.carousel-button.next',
		juices: typeof juices !== 'undefined' ? juices : [],
		currentSlug: slug,
		isHomePage: false,
		dynamicWordSelector: '#dynamic-other-juices-word'
	});

	// Initialize GSAP animations
	TweenMax.from('.ingredients-list', 1, { delay: 0.3, opacity: 0, y: 20, ease: Expo.easeInOut });
	TweenMax.from('.product__price', 1, { delay: 0.4, opacity: 0, y: 20, ease: Expo.easeInOut });
	TweenMax.from('.home__button:not(.add-to-cart)', 1, { delay: 0.5, opacity: 0, y: 20, ease: Expo.easeInOut });
	TweenMax.from('.home__liquid', 1, { delay: 0.7, opacity: 0, y: 200, ease: Expo.easeInOut });
	TweenMax.from('.home__juice-animate', 1, { delay: 1.2, opacity: 0, y: -800, ease: Expo.easeInOut });
	TweenMax.from('.home__apple1', 1, { delay: 1.5, opacity: 0, y: -800, ease: Expo.easeInOut });
	TweenMax.from('.home__apple2', 1, { delay: 1.6, opacity: 0, y: -800, ease: Expo.easeInOut });
});

// Legacy carousel function removed - now using CarouselManager

// Function to update SEO metadata dynamically
function updateSEOMetadata(juice) {
	const currentUrl = window.location.href;
	const baseUrl = window.location.origin;

	// Update title
	document.title = `${juice.name} - Premium Cold-Pressed Juice | Sip On Pressed`;

	// Create comprehensive description
	const description = `Try our delicious ${juice.name} cold-pressed juice made with ${juice.ingredients.join(', ')}. Fresh, organic, and packed with nutrients. Only $${juice.price.toFixed(2)} - ${juice.inStock ? 'Available now' : 'Coming soon'}!`;

	// Create keywords from ingredients and juice name
	const keywords = `${juice.name}, ${juice.ingredients.join(', ')}, cold-pressed juice, organic juice, fresh juice, healthy drinks, nutrient-rich, ${juice.inStock ? 'buy online' : 'coming soon'}`;

	// Update meta description
	updateMetaTag('name', 'description', description);
	updateMetaTag('name', 'keywords', keywords);

	// Generate dynamic OG image URL
	const ogImageUrl = `${baseUrl}/.netlify/functions/generate-og-image?slug=${juice.slug}`;

	// Update Open Graph tags
	updateMetaTag('property', 'og:title', `${juice.name} - Premium Cold-Pressed Juice`);
	updateMetaTag('property', 'og:description', description);
	updateMetaTag('property', 'og:image', ogImageUrl);
	updateMetaTag('property', 'og:image:width', '1200');
	updateMetaTag('property', 'og:image:height', '630');
	updateMetaTag('property', 'og:image:type', 'image/svg+xml');
	updateMetaTag('property', 'og:url', currentUrl);

	// Update Twitter Card tags
	updateMetaTag('name', 'twitter:title', `${juice.name} - Premium Cold-Pressed Juice`);
	updateMetaTag('name', 'twitter:description', description);
	updateMetaTag('name', 'twitter:image', ogImageUrl);

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
	const ogImageUrl = `${baseUrl}/.netlify/functions/generate-og-image?slug=${juice.slug}`;

	const structuredData = {
		'@context': 'https://schema.org/',
		'@type': 'Product',
		name: juice.name,
		description: `Fresh cold-pressed juice made with ${juice.ingredients.join(', ')}`,
		image: [`${baseUrl}${juice.imageUrl}`, ogImageUrl, `${baseUrl}/assets/img/nutrition-facts/${juice.slug}-facts.png`],
		brand: {
			'@type': 'Brand',
			name: 'Sip On Pressed'
		},
		category: 'Cold-Pressed Juice',
		offers: {
			'@type': 'Offer',
			price: juice.price.toFixed(2),
			priceCurrency: 'USD',
			availability: juice.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
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
