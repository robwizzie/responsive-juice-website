class Footer {
	static async render() {
		const currentYear = new Date().getFullYear();

		// Use locations from the global scope (loaded via script tag)
		const activeLocations = typeof getActiveLocations !== 'undefined' ? getActiveLocations() : [];

		const footerHTML = `
            <footer class="footer">
                <div class="footer__container" style="padding: 2rem;">
                    <!-- Main Footer Content -->
                    <div class="footer__content">
                        <!-- Brand Section -->
                        <div class="footer__section">
                            <div class="footer__logo">
                                <img src="/assets/img/branding/logo.png" alt="Pressed By J & H" class="footer__logo-img">
                                <h3 class="footer__brand">Pressed By J & H</h3>
                            </div>
                            <p class="footer__description">
                                Fresh pressed juices made daily with love. Embrace the sip and fuel your vitality with nature's powerhouse.
                            </p>
                            <div class="footer__social">
                                <a href="https://www.instagram.com/siponpressed" class="footer__social-link" title="Instagram" target="_blank" rel="noopener noreferrer">
                                    <i class="ri-instagram-line"></i>
                                </a>
                            </div>
                        </div>

                        <!-- Quick Links -->
                        <div class="footer__section">
                            <h4 class="footer__title">Quick Links</h4>
                            <ul class="footer__links">
                                <li><a href="/" class="footer__link">Home</a></li>
                                <li><a href="/about" class="footer__link">About Us</a></li>
                                <li><a href="/juices" class="footer__link">Our Juices</a></li>
                                <li><a href="/contact" class="footer__link">Contact</a></li>
                            </ul>
                        </div>

                        <!-- Our Locations -->
                        <div class="footer__section">
                            <h4 class="footer__title">Our Locations</h4>
                            <div class="footer__locations">
                                ${activeLocations
									.map(
										location => `
                                    <div class="footer__location">
                                        <h5 class="footer__location-name" style="color: ${location.color};">
                                            <i class="ri-map-pin-line"></i>
                                            ${location.name}
                                        </h5>
                                        <p class="footer__location-address">${location.address}</p>
                                        <p class="footer__location-desc">${location.description}</p>
                                        <p class="footer__location-phone">
                                            <i class="ri-phone-line"></i>
                                            <a href="tel:${location.contactPhone}">${location.contactPhone}</a>
                                        </p>
                                        <p class="footer__location-hours">
                                            <i class="ri-time-line"></i>
                                            <strong>Today:</strong> ${typeof getTodaysHours !== 'undefined' ? getTodaysHours(location.slug) : 'Call for hours'}
                                        </p>
                                        <div class="footer__location-links">
                                            <a href="${location.googleMapsLink}" target="_blank" class="footer__location-link">
                                                <i class="ri-map-pin-2-line"></i>
                                                Get Directions
                                            </a>
                                            ${
												location.website
													? `
                                                <a href="${location.website}" target="_blank" class="footer__location-link">
                                                    <i class="ri-external-link-line"></i>
                                                    Visit Website
                                                </a>
                                            `
													: ''
											}
                                        </div>
                                    </div>
                                `
									)
									.join('')}
                            </div>
                        </div>

                        <!-- Important Info -->
                        <div class="footer__section">
                            <h4 class="footer__title">Important Info</h4>
                            <div class="footer__info">
                                <div class="footer__order-notice">
                                    <i class="ri-store-2-line"></i>
                                    <strong>PICKUP & DELIVERY</strong>
                                    <p>Pickup at our NJ locations or delivery within 30 miles of Blackwood</p>
                                </div>
                                <div class="footer__info-item">
                                    <i class="ri-leaf-line"></i>
                                    <span>Fresh pressed daily</span>
                                </div>
                                <div class="footer__info-item">
                                    <i class="ri-shield-check-line"></i>
                                    <span>100% natural ingredients</span>
                                </div>
                                <div class="footer__info-item">
                                    <i class="ri-timer-line"></i>
                                    <span>Made to order</span>
                                </div>
                                <div class="footer__info-item">
                                    <i class="ri-heart-line"></i>
                                    <span>No preservatives</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Bottom -->
                    <div class="footer__bottom">
                        <div class="footer__bottom-content">
                            <p class="footer__copyright">
                                © ${currentYear} Pressed By J & H. All rights reserved.
                            </p>
                        </div>
                    </div>
                </div>
            </footer>
        `;

		return footerHTML;
	}

	static init() {
		// Add any footer-specific functionality here
		const socialLinks = document.querySelectorAll('.footer__social-link');
		socialLinks.forEach(link => {
			link.addEventListener('click', e => {
				if (link.getAttribute('href') === '#') {
					e.preventDefault();
					// Could add actual social media links here
				}
			});
		});

		// Make phone numbers clickable
		const phoneLinks = document.querySelectorAll('.footer__location-phone a');
		phoneLinks.forEach(link => {
			link.addEventListener('click', e => {
				// Phone links will work automatically with tel: protocol
			});
		});
	}

	static async create() {
		// Create and insert footer into the page
		const footerHTML = await this.render();

		// Find the body or main content area
		const body = document.body;
		const main = document.querySelector('main');

		// Insert footer after main content or at end of body
		if (main) {
			main.insertAdjacentHTML('afterend', footerHTML);
		} else {
			body.insertAdjacentHTML('beforeend', footerHTML);
		}

		// Initialize footer functionality
		this.init();
	}
}

// Auto-initialize when DOM is ready (only if locations database is loaded)
document.addEventListener('DOMContentLoaded', () => {
	// Wait a bit for other scripts to load
	setTimeout(() => {
		Footer.create();
	}, 100);
});

// Export for manual usage if needed
if (typeof module !== 'undefined' && module.exports) {
	module.exports = Footer;
}
