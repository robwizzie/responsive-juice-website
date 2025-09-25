// cart.js
class Cart {
	constructor() {
		console.log('Cart constructor called');
		this.items = JSON.parse(localStorage.getItem('cart')) || {};
		this.init();
	}

	init() {
		console.log('Initializing cart...');
		this.addCartToDOM();
		// Wait a bit for carousel to initialize
		setTimeout(() => {
			this.initializeEventListeners();
			this.updateCartUI();
		}, 100);
	}

	addCartToDOM() {
		console.log('Adding cart elements to DOM...');
		// Add cart button to navigation if it doesn't exist
		const existingButton = document.querySelector('.cart-button');
		console.log('Existing cart button:', existingButton);

		if (!existingButton) {
			const navList = document.querySelector('.nav__list');
			console.log('Nav list element:', navList);

			if (navList) {
				navList.insertAdjacentHTML(
					'beforeend',
					`
                    <li class="nav__item">
                        <button class="cart-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" class="bi bi-cart-fill" viewBox="0 0 16 16">
                                <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5M5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
                            </svg> <span class="cart-count" data-count="0"></span>
                        </button>
                    </li>
                `
				);
				console.log('Cart button added to navigation');
			}
		}

		// Add cart container to body if it doesn't exist
		const existingOverlay = document.getElementById('cartOverlay');
		console.log('Existing cart overlay:', existingOverlay);

		if (!existingOverlay) {
			document.body.insertAdjacentHTML(
				'beforeend',
				`
                <div id="cartOverlay" class="cart-overlay">
                    <div id="cartContainer" class="cart-container" onclick="event.stopPropagation()">
                        <p>Your cart is empty</p>
                    </div>
                </div>
            `
			);
			console.log('Cart overlay added to body');
		}
	}

	initializeEventListeners() {
		console.log('Initializing event listeners...');

		// Add to cart buttons
		const addToCartButtons = document.querySelectorAll('.add-to-cart');
		console.log('Found add-to-cart buttons:', addToCartButtons.length);

		addToCartButtons.forEach(button => {
			const juiceId = button.dataset.id;
			console.log('Setting up listener for juice ID:', juiceId);

			// Remove old listeners by cloning the button
			const newButton = button.cloneNode(true);
			button.parentNode.replaceChild(newButton, button);

			newButton.addEventListener('click', e => {
				console.log('Add to cart button clicked');
				e.preventDefault();
				e.stopPropagation();
				const id = parseInt(e.currentTarget.dataset.id);
				console.log('Attempting to add juice ID:', id);
				this.addItem(id);
			});
		});

		// Cart toggle
		const cartButton = document.querySelector('.cart-button');
		console.log('Cart toggle button:', cartButton);

		if (cartButton) {
			// Remove old listeners by cloning
			const newCartButton = cartButton.cloneNode(true);
			cartButton.parentNode.replaceChild(newCartButton, cartButton);

			newCartButton.addEventListener('click', () => {
				console.log('Cart button clicked');
				this.toggleCart();
			});
		}

		// Cart overlay close
		const cartOverlay = document.getElementById('cartOverlay');
		console.log('Cart overlay element:', cartOverlay);

		if (cartOverlay) {
			cartOverlay.addEventListener('click', e => {
				console.log('Cart overlay clicked');
				if (e.target === cartOverlay) {
					this.toggleCart();
				}
			});
		}
	}

	addItem(juiceId) {
		console.log('Adding item to cart:', juiceId);

		// Check if juice is in stock
		const juice = juices.find(j => j.id === parseInt(juiceId));
		if (!juice || !juice.inStock) {
			console.log('Item out of stock, cannot add to cart');
			return;
		}

		console.log('Current items:', this.items);

		if (!this.items[juiceId]) {
			this.items[juiceId] = 0;
		}
		this.items[juiceId]++;

		console.log('Updated items:', this.items);
		this.saveCart();
		this.updateCartUI();
		this.showAddedToCartFeedback(juiceId);

		// Update specific item quantity in UI if cart is open
		this.updateItemQuantityUI(juiceId);

		// Only open cart on first add
		this.openCart();
	}

	removeItem(juiceId) {
		if (this.items[juiceId]) {
			this.items[juiceId]--;
			if (this.items[juiceId] === 0) {
				delete this.items[juiceId];
			}
			this.saveCart();

			// If there are no items left, update entire cart UI
			if (Object.keys(this.items).length === 0) {
				this.updateCartUI();
			} else {
				// Otherwise just update the specific item and total
				this.updateItemQuantityUI(juiceId);
				this.updateCartTotal();
			}
		}
	}

	updateItemQuantityUI(juiceId) {
		const cartContainer = document.getElementById('cartContainer');
		if (!cartContainer) return;

		// Update quantity display for specific item
		const itemContainer = cartContainer.querySelector(`.cart-item[data-juice-id="${juiceId}"]`);
		if (itemContainer) {
			const juice = juices.find(j => j.id === parseInt(juiceId));
			const quantity = this.items[juiceId] || 0;

			if (quantity === 0) {
				// If quantity is 0, remove the item element
				itemContainer.remove();
				if (Object.keys(this.items).length === 0) {
					this.updateCartUI(); // Update entire cart if empty
				}
			} else {
				// Update quantity display
				const quantitySpan = itemContainer.querySelector('.quantity-controls span');
				if (quantitySpan) {
					quantitySpan.textContent = quantity;
				}
				// Update price display
				const priceDisplay = itemContainer.querySelector('.cart-item-details p');
				if (priceDisplay) {
					priceDisplay.textContent = `$${juice.price.toFixed(2)} × ${quantity}`;
				}
			}
		}

		// Update cart button count
		const itemsCount = Object.values(this.items).reduce((a, b) => a + b, 0);
		const cartButton = document.querySelector('.cart-button');
		if (cartButton) {
			cartButton.setAttribute('data-count', itemsCount);
		}
	}

	updateCartTotal() {
		const cartContainer = document.getElementById('cartContainer');
		if (!cartContainer) return;

		const subtotal = this.getTotal();

		// Update order summary elements
		const orderSummary = cartContainer.querySelector('.order-summary');
		if (orderSummary) {
			const summaryLines = orderSummary.querySelectorAll('.summary-line span:last-child');
			if (summaryLines.length >= 2) {
				summaryLines[0].textContent = `$${subtotal.toFixed(2)}`; // Subtotal
				summaryLines[1].textContent = `$${subtotal.toFixed(2)}`; // Total
			}
		}
	}

	openCart() {
		const overlay = document.getElementById('cartOverlay');
		if (overlay && !overlay.classList.contains('show')) {
			overlay.classList.add('show');
			this.updateCartUI();
		}
	}

	closeCart() {
		const overlay = document.getElementById('cartOverlay');
		if (overlay && overlay.classList.contains('show')) {
			overlay.classList.remove('show');
		}
	}

	toggleCart() {
		const overlay = document.getElementById('cartOverlay');
		if (overlay.classList.contains('show')) {
			this.closeCart();
		} else {
			this.openCart();
		}
	}

	updateCartUI() {
		console.log('Updating cart UI');
		console.log('Current items:', this.items);

		const cartContainer = document.getElementById('cartContainer');
		if (!cartContainer) {
			console.log('Cart container not found');
			return;
		}

		const itemsCount = Object.values(this.items).reduce((a, b) => a + b, 0);
		console.log('Total items count:', itemsCount);

		const cartButton = document.querySelector('.cart-button');
		if (cartButton) {
			cartButton.setAttribute('data-count', itemsCount);
			console.log('Updated cart button count:', itemsCount);
		}

		if (itemsCount === 0) {
			cartContainer.innerHTML = `
                <div class="empty-cart">
                    <h2>Your Cart</h2>
                    <p>Your cart is empty</p>
                    <button onclick="cart.closeCart()" class="checkout-button home__button">Continue Shopping</button>
                </div>
            `;
			return;
		}

		const subtotal = this.getTotal();

		let cartHTML = `
            <div class="cart-header">
                <h2>Your Cart</h2>
                <button onclick="cart.closeCart()" class="close-button">×</button>
            </div>
            <div class="order-notice">
                <div class="order-alert" style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 1rem; margin: 0rem 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="ri-store-2-line"></i>
                        <strong>PICKUP & DELIVERY</strong>
                    </div>
                    <span style="font-size: 0.8rem; opacity: 0.9;">Delivery within 30 miles of Blackwood</span>
                </div>
            </div>
            <div class="cart-items">
                ${Object.entries(this.items)
					.map(([juiceId, quantity]) => {
						const juice = juices.find(j => j.id === parseInt(juiceId));
						if (!juice) return '';
						return `
                        <div class="cart-item" data-juice-id="${juice.id}" style="border-left: 4px solid ${juice.color};">
                            <img src="${juice.imageUrl}" alt="${juice.name}" style="width: 80px; padding-left: 20px;">
                            <div class="cart-item-details">
                                <h3 style="color: ${juice.color}; font-family: var(--second-font); font-size: 1rem;">${juice.name}</h3>
                                <p>$${juice.price.toFixed(2)} × ${quantity}</p>
                            </div>
                            <div class="quantity-controls">
                                <button onclick="cart.removeItem(${juice.id})" style="background-color: ${juice.color}">-</button>
                                <span>${quantity}</span>
                                <button onclick="cart.addItem(${juice.id})" style="background-color: ${juice.color}">+</button>
                            </div>
                        </div>
                    `;
					})
					.join('')}
            </div>
            <div class="cart-total">
                <div class="order-summary">
                    <div class="summary-line total-line">
                        <span>Total:</span>
                        <span>$${subtotal.toFixed(2)}</span>
                    </div>
                </div>
                <button id="checkoutButton" class="checkout-button home__button" style="transform: translate(0px, 0px);">Proceed to Checkout</button>
            </div>
        `;

		cartContainer.innerHTML = cartHTML;

		// Add checkout button listener
		document.getElementById('checkoutButton')?.addEventListener('click', () => this.checkout());
	}

	showAddedToCartFeedback(juiceId) {
		const juice = juices.find(j => j.id === juiceId);
		const button = document.querySelector(`.add-to-cart[data-id="${juiceId}"]`);

		if (button && juice) {
			// Cache original state once
			if (!button.dataset.origHtml) {
				button.dataset.origHtml = button.innerHTML;
				button.dataset.origBg = button.style.backgroundColor || '#ffffff';
			}

			button.style.backgroundColor = '#4CAF50';
			button.innerHTML = '✓';
			button.style.fontSize = '20px';

			setTimeout(() => {
				button.style.backgroundColor = button.dataset.origBg;
				button.innerHTML = button.dataset.origHtml;
				button.style.fontSize = '';
			}, 1000);
		}
	}

	saveCart() {
		localStorage.setItem('cart', JSON.stringify(this.items));
	}

	getTotal() {
		return Object.entries(this.items).reduce((total, [juiceId, quantity]) => {
			const juice = juices.find(j => j.id === parseInt(juiceId));
			return total + juice.price * quantity;
		}, 0);
	}

	getTomorrowDate() {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		return tomorrow.toISOString().split('T')[0];
	}

	async checkout() {
		// Redirect to checkout page
		window.location.href = '/checkout';
	}
}

// Single initialization
document.addEventListener('DOMContentLoaded', function () {
	console.log('DOM Content Loaded - Initializing Cart');
	window.cart = new Cart();
	console.log('Cart initialized:', window.cart);
});

// Make cart available globally
if (typeof module !== 'undefined' && module.exports) {
	module.exports = Cart;
}
