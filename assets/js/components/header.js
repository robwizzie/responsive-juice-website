const NAV_LINKS = [
	{ href: '/', page: 'home', label: 'Home' },
	{ href: '/about', page: 'about', label: 'About' },
	{ href: '/juices', page: 'juices', label: 'Juices' },
	{ href: '/contact', page: 'contact', label: 'Contact' }
];

class Header {
	static render() {
		return `
            <header class="header" id="header">
                <nav class="nav container">
                    <a href="/" class="nav__logo">
                        <img src="/assets/img/branding/logo.webp" alt="J & H Logo">
                    </a>

                    <div class="nav__menu" id="nav-menu">
                        <ul class="nav__list">
                            ${NAV_LINKS.map(link => `<li class="nav__item"><a href="${link.href}" class="nav__link" data-page="${link.page}">${link.label}</a></li>`).join('')}
                        </ul>

                        <div class="nav__close" id="nav-close">
                            <i class="ri-close-line"></i>
                        </div>

                        <img src="/assets/img/nav-img.webp" alt="" class="nav__img">
                    </div>

                    <div class="nav__toggle" id="nav-toggle">
                        <i class="ri-menu-line"></i>
                    </div>
                </nav>
            </header>
        `;
	}

	static init() {
		const currentPage = window.location.pathname.split('/')[1].replace('.html', '') || 'home';
		document.querySelectorAll('.nav__link').forEach(link => {
			link.classList.toggle('active-link', link.dataset.page === currentPage);
		});

		const header = document.getElementById('header');
		const navMenu = document.getElementById('nav-menu');
		document.getElementById('nav-toggle')?.addEventListener('click', () => navMenu.classList.add('show-menu'));
		document.getElementById('nav-close')?.addEventListener('click', () => navMenu.classList.remove('show-menu'));
		document.querySelectorAll('.nav__link').forEach(link => link.addEventListener('click', () => navMenu.classList.remove('show-menu')));

		// Tighten the header once the page has scrolled
		const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
	}
}

export default Header;
