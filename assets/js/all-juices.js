function initializeAllJuicesPage() {
	console.log('All juices page loaded');

	if (typeof window.juices === 'undefined' || !window.juices) {
		console.error('Juices array is not defined. Ensure juices-database.js is loaded.');
		return;
	}

	const juiceGrid = document.querySelector('.juice-grid');
	if (!juiceGrid) {
		console.error('Juice grid container not found');
		return;
	}

	// Clear existing content
	juiceGrid.innerHTML = '';

	// Add juice cards
	window.juices.forEach(juice => {
		const card = document.createElement('div');
		card.className = 'juice-card';
		card.innerHTML = `
            <a href="/juices/${juice.slug}" class="juice-link">
                <div class="juice-image-container" style="background-color: ${juice.color}10">
                    <img src="${juice.imageUrl}" alt="${juice.name}" class="juice-image">
                </div>
                <div class="juice-info">
                    <h3 class="juice-name">${juice.name}</h3>
                    <div class="ingredients-preview">
                        ${juice.ingredients
							.map(
								ingredient => `
                            <span class="ingredient-tag">
                                <img src="/assets/img/ingredients/${ingredient.toLowerCase().replace(/ /g, '-')}.svg" 
                                    alt="${ingredient}" 
                                    class="ingredient-icon">
                                <span class="ingredient-name">${ingredient}</span>
                            </span>
                        `
							)
							.join('')}
                    </div>
                    <p class="juice-price">$${juice.price.toFixed(2)}</p>
                </div>
            </a>
            <button class="add-to-cart-btn" data-id="${juice.id}" style="background-color: ${juice.color}">
                Add to Cart
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </button>
        `;

		// Add to cart functionality
		const addToCartBtn = card.querySelector('.add-to-cart-btn');
		addToCartBtn.addEventListener('click', e => {
			e.preventDefault();
			if (window.cart) {
				window.cart.addItem(juice.id, 1);
			}
		});

		juiceGrid.appendChild(card);
	});

	// Add click event listeners to juice links
	const juiceLinks = document.querySelectorAll('.juice-link');
	juiceLinks.forEach(link => {
		link.addEventListener('click', e => {
			e.preventDefault();
			const path = link.getAttribute('href');
			window.router.navigate(path);
		});
	});
}

// Initialize the page when loaded
document.addEventListener('DOMContentLoaded', initializeAllJuicesPage);

// Export the initialize function for the router
window.initializeAllJuicesPage = initializeAllJuicesPage;
