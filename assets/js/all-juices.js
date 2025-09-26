document.addEventListener('DOMContentLoaded', () => {
	// Populate juice grid with performance optimizations
	const juiceGrid = document.querySelector('.juice-grid');

	// Remove skeleton loaders
	const skeletons = document.querySelectorAll('.juice-card-skeleton');
	skeletons.forEach(skeleton => skeleton.remove());

	// Sort juices to show in-stock items first
	const sortedJuices = [...juices].sort((a, b) => {
		if (a.inStock && !b.inStock) return -1;
		if (!a.inStock && b.inStock) return 1;
		return 0;
	});

	// Create juice cards with optimized loading
	sortedJuices.forEach((juice, index) => {
		const outOfStockClass = juice.inStock ? '' : ' out-of-stock';
		const addToCartButton = juice.inStock ? `<button class="home__button add-to-cart" data-id="${juice.id}" style="transform: translate(0px, 0px); opacity: 1; background-color: ${juice.color};">Add to Cart</button>` : `<button class="home__button add-to-cart" disabled style="transform: translate(0px, 0px); opacity: 1; background-color: #ccc; color: #666;">Out of Stock</button>`;

		const juiceCard = `
            <div class="juice-card${outOfStockClass} juice-card-hidden" data-juice-id="${juice.id}" data-index="${index}">
                <div class="juice-card-content">
                    <a href="/juices/${juice.slug}" class="juice-image-link">
                        <div class="juice-image">
                            <img src="${juice.imageUrl}" alt="${juice.name}" class="all-juices juice-bottle" loading="lazy" decoding="async">
                            <img src="/assets/img/splash/${juice.slug}-splash.svg" alt="" class="juice-splash" loading="lazy" decoding="async">
                            ${juice.ingredients
								.slice(0, 2)
								.map(
									(ingredient, index) => `
                                <img src="/assets/img/ingredients/${ingredient.toLowerCase().replace(/ /g, '-')}.svg" 
                                    alt="${ingredient}" 
                                    class="juice-ingredient ingredient-${index + 1}" loading="lazy" decoding="async">
                            `
								)
								.join('')}
                        </div>
                    </a>
                    <div class="juice-info">
                        <h3 style="color:${juice.color}; font-weight: bold; font-family: var(--second-font); margin: 3rem 0 1rem 0;">${juice.name}</h3>
                        <p class="juice-description" style="margin-bottom: 1rem;">${juice.description}</p>
                        <div class="ingredients-preview">
                            ${juice.ingredients
								.map(
									ingredient => `
                                <span class="ingredient-tag">
                                    <img src="/assets/img/ingredients/${ingredient.toLowerCase().replace(/ /g, '-')}.svg" 
                                        alt="${ingredient}" 
                                        class="ingredient-icon" loading="lazy" decoding="async">
                                    ${ingredient}
                                </span>
                            `
								)
								.join('')}
                        </div>
                        <div class="juice-footer">
                            <span class="juice-price" style="color: black; font-weight: bold; margin-top: 0;">$${juice.price.toFixed(2)}</span>
                            ${addToCartButton}
                        </div>
                    </div>
                </div>
            </div>
        `;
		juiceGrid.insertAdjacentHTML('beforeend', juiceCard);
	});

	// Wait for GSAP to be available before running animations
	waitForGSAPAndAnimate();
});

function waitForGSAPAndAnimate() {
	if (typeof TweenMax !== 'undefined') {
		// Create a smooth, elegant header animation
		const headerTl = new TimelineMax();
		headerTl.from('.catalog-header', 1.5, {
			opacity: 0,
			y: 40,
			scale: 0.95,
			ease: Power3.easeOut,
			delay: 0.3
		});

		// Add a subtle bounce to the title for freshness
		headerTl.to(
			'.catalog-header .home__title',
			0.4,
			{
				scale: 1.02,
				ease: Power2.easeOut
			},
			'-=0.3'
		);

		headerTl.to('.catalog-header .home__title', 0.4, {
			scale: 1,
			ease: Power2.easeInOut
		});

		// Set up scroll-triggered animations for juice cards
		setupScrollAnimations();

		// Animate benefit cards with smooth, staggered entrance
		const benefitCards = document.querySelectorAll('.benefit-card');
		benefitCards.forEach((card, index) => {
			const cardTl = new TimelineMax();
			cardTl.from(card, 1.2, {
				opacity: 0,
				y: 50,
				scale: 0.9,
				rotationY: 10,
				ease: Power3.easeOut,
				delay: 0.8 + index * 0.2
			});

			// Add a gentle float effect
			cardTl.to(
				card,
				0.3,
				{
					scale: 1.02,
					ease: Power2.easeOut
				},
				'-=0.2'
			);

			cardTl.to(card, 0.3, {
				scale: 1,
				ease: Power2.easeInOut
			});
		});
	} else {
		setTimeout(waitForGSAPAndAnimate, 50);
	}
}

function setupScrollAnimations() {
	// Create intersection observer for scroll-triggered animations
	const observer = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					const card = entry.target;
					const index = parseInt(card.dataset.index);

					// Preload images for this card when it comes into view
					preloadCardImages(card);

					// Remove hidden class and animate in with smooth, elegant animation
					card.classList.remove('juice-card-hidden');

					// Create a smooth, juice-inspired animation
					const tl = new TimelineMax();

					// Initial state
					tl.set(card, {
						opacity: 0,
						y: 80,
						scale: 0.9,
						rotationX: 15,
						transformOrigin: 'center bottom'
					});

					// Smooth entrance animation
					tl.to(card, 1.2, {
						opacity: 1,
						y: 0,
						scale: 1,
						rotationX: 0,
						ease: Power3.easeOut,
						delay: index * 0.15 // Stagger animations more smoothly
					});

					// Add a subtle bounce at the end for juice-like freshness
					tl.to(
						card,
						0.3,
						{
							scale: 1.02,
							ease: Power2.easeOut
						},
						'-=0.2'
					);

					tl.to(card, 0.3, {
						scale: 1,
						ease: Power2.easeInOut
					});

					// Animate individual elements within the card for extra smoothness
					const juiceImage = card.querySelector('.juice-image');
					const juiceInfo = card.querySelector('.juice-info');

					if (juiceImage && juiceInfo) {
						// Animate image with a gentle float
						tl.from(
							juiceImage,
							0.8,
							{
								y: 30,
								opacity: 0,
								ease: Power2.easeOut
							},
							'-=0.8'
						);

						// Animate info with a smooth slide
						tl.from(
							juiceInfo,
							0.6,
							{
								y: 20,
								opacity: 0,
								ease: Power2.easeOut
							},
							'-=0.6'
						);
					}

					// Unobserve after animation
					observer.unobserve(card);
				}
			});
		},
		{
			threshold: 0.2,
			rootMargin: '150px 0px -100px 0px' // Start loading earlier for smoother experience
		}
	);

	// Observe all juice cards
	const juiceCards = document.querySelectorAll('.juice-card');
	juiceCards.forEach(card => {
		observer.observe(card);
	});
}

function preloadCardImages(card) {
	// Get all images in the card
	const images = card.querySelectorAll('img[data-src]');
	images.forEach(img => {
		if (img.dataset.src) {
			img.src = img.dataset.src;
			img.removeAttribute('data-src');
		}
	});
}
