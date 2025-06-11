document.addEventListener('DOMContentLoaded', () => {
	// Populate juice grid
	const juiceGrid = document.querySelector('.juice-grid');

	juices.forEach(juice => {
		const juiceCard = `
            <div class="juice-card" data-juice-id="${juice.id}">
                <div class="juice-card-content">
                    <a href="/juices/${juice.slug}" class="juice-image-link">
                        <div class="juice-image">
                            <img src="${juice.imageUrl}" alt="${juice.name}" class="juice-bottle" loading="lazy" decoding="async">
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
                            <button class="home__button add-to-cart" data-id="${juice.id}"  
                                    style="transform: translate(0px, 0px); opacity: 1; background-color: ${juice.color};">
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
		juiceGrid.insertAdjacentHTML('beforeend', juiceCard);
	});

	// Animations
	TweenMax.from('.catalog-header', 1, { delay: 0.2, opacity: 0, y: 20, ease: Expo.easeInOut });

	const juiceCards = document.querySelectorAll('.juice-card');
	juiceCards.forEach((card, index) => {
		TweenMax.from(card, 1, {
			delay: 0.3 + index * 0.1,
			opacity: 0,
			y: 30,
			ease: Expo.easeInOut
		});
	});

	const benefitCards = document.querySelectorAll('.benefit-card');
	benefitCards.forEach((card, index) => {
		TweenMax.from(card, 1, {
			delay: 0.5 + index * 0.1,
			opacity: 0,
			y: 30,
			ease: Expo.easeInOut
		});
	});
});
