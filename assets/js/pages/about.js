import { ready } from '../site.js';
import { escapeHtml as e } from '../lib/catalog.js';
import { icon } from '../lib/icons.js';

ready.then(({ juices, settings }) => {
	const photographed = juices.filter(j => j.image);
	const photo = document.querySelector('[data-portrait-photo]');
	if (settings.aboutPhoto) {
		photo.innerHTML = `<img src="${e(settings.aboutPhoto)}" alt="Hunter, founder of SiponPressed" decoding="async">`;
	} else {
		// No photo of Hunter yet: show his bottles on the river until he uploads one in /admin
		document.querySelector('[data-portrait]').classList.add('portrait--empty');
		photo.innerHTML = `
			<img src="/assets/img/backdrops/riverfront-sm.webp" alt="" decoding="async">
			${photographed[0] ? `<img src="${photographed[0].imageSmall || photographed[0].image}" alt="" class="portrait__bottle" decoding="async">` : ''}`;
		photo.insertAdjacentHTML('afterend', '<span class="stamp stamp--coming-soon portrait__soon">Photo of Hunter soon</span>');
	}

	const lineup = photographed.slice(0, 3);
	document.querySelector('[data-about-bottles]').innerHTML = lineup
		.map((juice, i) => `<a href="/juices/${juice.slug}" tabindex="-1" class="${i === (lineup.length - 1) / 2 ? 'is-mid' : ''}" style="--i: ${i}"><img src="${juice.image}" alt="" loading="lazy" decoding="async"></a>`)
		.join('');
});

/* Press-day clip: plays muted while it's on screen, with play/pause and sound buttons */
const video = document.querySelector('[data-press-video]');
if (video) {
	const playBtn = document.querySelector('[data-video-play]');
	const soundBtn = document.querySelector('[data-video-sound]');
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let userPaused = reduced;

	const sync = () => {
		const playing = !video.paused;
		playBtn.innerHTML = icon(playing ? 'pause' : 'play');
		playBtn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
		soundBtn.innerHTML = icon(video.muted ? 'soundOff' : 'soundOn');
		soundBtn.setAttribute('aria-label', video.muted ? 'Turn sound on' : 'Turn sound off');
		video.closest('.press-day__phone').classList.toggle('is-playing', playing);
	};
	['play', 'pause', 'volumechange'].forEach(type => video.addEventListener(type, sync));

	playBtn.addEventListener('click', () => {
		userPaused = !video.paused;
		video.paused ? video.play() : video.pause();
	});
	soundBtn.addEventListener('click', () => {
		video.muted = !video.muted;
		if (!video.muted && video.paused) {
			userPaused = false;
			video.play();
		}
	});
	video.addEventListener('click', () => playBtn.click());

	new IntersectionObserver(([entry]) => {
		if (entry.isIntersecting && !userPaused) video.play().catch(() => {});
		else if (!entry.isIntersecting) video.pause();
	}, { threshold: 0.35 }).observe(video);
	sync();
}
