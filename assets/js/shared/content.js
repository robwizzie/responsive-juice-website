/**
 * The words (and a few photos) on every page that Hunter can change in /admin → Pages.
 *
 * Each field has a key; the HTML marks the element that shows it with data-copy="<key>", and
 * pages built in JavaScript read it with copyText(). The defaults below are what the site says
 * until Hunter saves his own version; only his edits are stored (Netlify Blobs, key "copy").
 *
 * Text can include {tokens} that fill in from the live settings, so a sentence like
 * "{deliveryDay} delivery" stays right when the delivery day changes.
 */
import { cutoffDay, pickupAddress, weekdayName } from './order-rules.js';

const money = value => (Number.isInteger(Number(value)) ? `$${Number(value)}` : `$${Number(value).toFixed(2)}`);

export const TOKENS = {
	price: { label: 'Bottle price', value: settings => money(settings.bottlePrice) },
	deliveryDay: { label: 'Delivery day', value: settings => weekdayName(settings.delivery.day) },
	deliveryArea: { label: 'Delivery area', value: settings => settings.delivery.areaLabel },
	pickupCity: { label: 'Pickup city', value: settings => settings.pickup.area.split(',')[0] },
	pickupAddress: { label: 'Pickup address', value: settings => pickupAddress(settings.pickup) },
	cutoffDay: { label: 'Last day to order for delivery', value: settings => weekdayName(cutoffDay(settings.delivery)) },
	minBottles: { label: 'Delivery minimum', value: settings => String(settings.delivery.minBottles) },
	deliveryRadius: { label: 'Delivery radius', value: settings => `${settings.delivery.radiusMiles} miles` },
	deliveryTowns: { label: 'Delivery towns', value: settings => settings.delivery.zones.map(zone => zone.label.split(',')[0]).join(' and ') },
	email: { label: 'Email', value: settings => settings.contactEmail },
	instagram: { label: 'Instagram', value: settings => `@${settings.instagram}` }
};

const text = (key, label, value, extra = {}) => ({ key, label, default: value, ...extra });
const long = (key, label, value, extra = {}) => text(key, label, value, { long: true, ...extra });
const photo = (key, label, hint) => ({ key, label, default: '', type: 'image', hint });

export const PAGES = [
	{
		id: 'home',
		label: 'Home',
		path: '/',
		sections: [
			{
				title: 'Top of the page',
				fields: [
					text('home.hero.kicker', 'Small line above the headline', 'Cold-pressed in Philadelphia · Est. 2026'),
					text('home.hero.line1', 'Headline, first line', 'Embrace', { max: 24 }),
					text('home.hero.line2', 'Headline, second line', 'the sip', { max: 24 }),
					long('home.hero.lede', 'Intro', 'Small-batch juice pressed by Hunter from whole fruit and greens. Nothing else in the bottle.'),
					text('home.hero.cta', 'Main button', 'Order now', { max: 28 }),
					text('home.hero.cta2', 'Second button', 'See the juices', { max: 28 })
				]
			},
			{
				title: 'Big statement',
				hint: 'Fruit photos sit between these pieces.',
				fields: [
					text('home.statement.a', 'Part 1', 'Cold-pressed juice made by Hunter in Philly'),
					text('home.statement.b', 'Part 2', 'from whole fruit'),
					text('home.statement.c', 'Part 3', 'and greens'),
					text('home.statement.d', 'Part 4 (faded)', 'with nothing else in the bottle')
				]
			},
			{
				title: 'Promise chips',
				fields: [
					text('home.fact.1', 'Chip 1', 'Cold pressed, never heated', { max: 40 }),
					text('home.fact.2', 'Chip 2', 'No added sugar', { max: 40 }),
					text('home.fact.3', 'Chip 3', '100% plant based', { max: 40 }),
					text('home.fact.4', 'Chip 4', 'Made in Philadelphia', { max: 40 })
				]
			},
			{
				title: 'Flavor carousel',
				fields: [
					text('home.lineup.kicker', 'Small heading', 'The lineup'),
					text('home.lineup.title', 'Title', 'Pick your bottle'),
					text('home.lineup.link', 'Link', 'Compare all juices', { max: 32 })
				]
			},
			{
				title: 'Pickup & delivery',
				fields: [
					text('home.ways.kicker', 'Small heading', 'Getting your juice'),
					text('home.ways.title', 'Title', 'Pickup in {pickupCity} or {deliveryDay} delivery')
				]
			},
			{
				title: 'Wholesale band',
				fields: [
					text('home.wholesale.kicker', 'Small heading', 'For yoga studios, gyms & cafes'),
					text('home.wholesale.title', 'Title', 'Put SiponPressed in your fridge'),
					long('home.wholesale.text', 'Text', "Fresh bottles every week for your members and customers. Let's set up a standing order."),
					text('home.wholesale.cta', 'Button', 'Ask about wholesale', { max: 28 })
				]
			},
			{
				title: 'Meet Hunter',
				fields: [
					text('home.story.kicker', 'Small heading', 'Created by Hunter'),
					text('home.story.title', 'Title', 'One guy, one press, every bottle'),
					long(
						'home.story.text',
						'Text',
						'SiponPressed is a one-person juice company. Hunter picks the produce and presses every bottle himself. The recipes are simple on purpose: a few whole ingredients that taste good and make you feel good.'
					),
					text('home.story.cta', 'Button', 'Meet Hunter', { max: 28 }),
					photo('home.story.photo', 'Photo', 'Leave empty to use the About page photo of you.')
				]
			}
		]
	},
	{
		id: 'juices',
		label: 'Juices',
		path: '/juices',
		sections: [
			{
				title: 'Top of the page',
				fields: [
					text('juices.hero.kicker', 'Small heading', 'The juices'),
					text('juices.hero.line1', 'Headline, first line', 'Pressed', { max: 24 }),
					text('juices.hero.line2', 'Headline, second line (green)', 'this week', { max: 24 }),
					long('juices.hero.lede', 'Intro', 'Small batches from whole fruit and greens. Every bottle is 16 fl oz, with no added sugar and nothing artificial.'),
					text('juices.hero.cta', 'Main button', 'Order now', { max: 28 }),
					text('juices.hero.cta2', 'Second button', 'Compare', { max: 28 })
				]
			},
			{
				title: 'Side by side',
				fields: [
					text('juices.compare.kicker', 'Small heading', 'Side by side'),
					text('juices.compare.title', 'Title', "What's in each bottle"),
					text('juices.compare.lede', 'Text', 'Per 16 fl oz bottle. Tap a juice for the full nutrition label.')
				]
			}
		]
	},
	{
		id: 'juice',
		label: 'Each juice page',
		path: '/juices/simply-orange',
		hint: 'These show on every juice page. Each juice\'s own name, description and ingredients are edited in Menu.',
		sections: [
			{
				title: 'Badges under the buy button',
				fields: [
					text('juice.badge.1', 'Badge 1', 'Cold pressed', { max: 28 }),
					text('juice.badge.2', 'Badge 2', 'No added sugar', { max: 28 }),
					text('juice.badge.3', 'Badge 3', '100% plant based', { max: 28 })
				]
			},
			{
				title: 'Messages',
				fields: [
					text('juice.soldOut', 'Sold out', 'This batch is gone. Check back soon, or grab another flavor below.'),
					text('juice.comingSoon', 'Coming soon', 'Not pressed yet. Follow {instagram} to hear when it drops.')
				]
			},
			{
				title: 'Inside the bottle',
				fields: [
					text('juice.inside.kicker', 'Small heading', 'Inside the bottle'),
					text('juice.inside.title', 'Title', "{count} ingredients. That's the whole list.", { hint: '{count} is the number of ingredients in that juice.' }),
					text('juice.vitamins.title', 'Vitamins title', 'What one bottle gives you'),
					text('juice.vitamins.note', 'Vitamins note', 'Percent of your daily value, from a single bottle.'),
					text('juice.label.foot', 'Bottom of the nutrition label', 'No added sugar. Keep refrigerated, shake well.')
				]
			},
			{
				title: 'More juices',
				fields: [text('juice.more.kicker', 'Small heading', 'Keep sipping'), text('juice.more.title', 'Title', 'More juices')]
			}
		]
	},
	{
		id: 'about',
		label: 'About',
		path: '/about',
		sections: [
			{
				title: 'Top of the page',
				fields: [
					text('about.hero.kicker', 'Small heading', 'About SiponPressed'),
					text('about.hero.line1', 'Headline, first line', "Hey, I'm", { max: 24 }),
					text('about.hero.line2', 'Headline, second line', 'Hunter', { max: 24 }),
					long(
						'about.hero.lede',
						'Intro',
						'SiponPressed is just me: one guy, a cold press and a fridge full of fruit. Every bottle you get was pressed and labeled by my hands, here in Philadelphia.'
					),
					text('about.hero.cta', 'Main button', 'Try the juices', { max: 28 }),
					text('about.hero.cta2', 'Second button', 'Say hi', { max: 28 }),
					text('about.hero.caption', 'Photo caption', 'Hunter · Philadelphia', { max: 40 })
				]
			},
			{
				title: 'The story',
				fields: [
					text('about.story.kicker', 'Small heading', 'The story'),
					text('about.story.title', 'Title', 'Real juice, no shortcuts'),
					long(
						'about.story.p1',
						'Paragraph 1',
						"I started pressing juice because I wanted something I'd actually drink every day: bright, filling and made from whole ingredients, not concentrate and sugar."
					),
					long(
						'about.story.p2',
						'Paragraph 2',
						"Friends kept asking for bottles, then their friends did, and SiponPressed was born. Now I'm based in Philly, bringing fresh bottles to yoga studios, small cafes and anyone who wants to feel a little better. I still do a {deliveryDay} delivery run to {deliveryArea}."
					),
					long(
						'about.story.p3',
						'Paragraph 3',
						'The menu is simple on purpose. Each flavor is built around a handful of ingredients that taste good together and do something good for you.'
					),
					text('about.story.signoff', 'Sign-off', 'Embrace the sip. — Hunter')
				]
			},
			{
				title: 'Behind the bottle',
				fields: [
					text('about.press.kicker', 'Small heading', 'Behind the bottle'),
					text('about.press.title', 'Title', 'From the market to your fridge'),
					text('about.press.badge', 'Badge on the video', 'Press day', { max: 24 }),
					text('about.press.step1.title', 'Step 1', 'Market run', { max: 28 }),
					text('about.press.step1.text', 'Step 1 text', 'Whole fruit and greens, picked out by hand that morning.'),
					text('about.press.step2.title', 'Step 2', 'Prep', { max: 28 }),
					text('about.press.step2.text', 'Step 2 text', 'Everything washed, peeled and cut. No concentrate, no shortcuts.'),
					text('about.press.step3.title', 'Step 3', 'Press', { max: 28 }),
					text('about.press.step3.text', 'Step 3 text', 'Slow cold press, then straight into the bottle and the fridge.')
				]
			},
			{
				title: 'Wholesale band',
				fields: [
					text('about.wholesale.kicker', 'Small heading', 'Studios, gyms & cafes'),
					text('about.wholesale.title', 'Title', 'Want SiponPressed in your space?'),
					long('about.wholesale.text', 'Text', "I'm working with yoga studios and small cafes around Philly. Reach out and I'll bring samples."),
					text('about.wholesale.cta', 'Button', 'Get in touch', { max: 28 }),
					photo('about.wholesale.photo', 'Background photo', 'A wide photo works best. Leave empty for the bottles-on-ice shot.')
				]
			},
			{
				title: 'What every bottle stands for',
				fields: [
					text('about.values.kicker', 'Small heading', 'What every bottle stands for'),
					text('about.values.title', 'Title', 'Real juice. Real health. Real you.'),
					text('about.value1.title', 'Value 1', 'Cold pressed', { max: 32 }),
					text('about.value1.text', 'Value 1 text', 'Pressed slowly and never heated, so the flavor and nutrients stay in the bottle.'),
					text('about.value2.title', 'Value 2', 'No added sugar', { max: 32 }),
					text('about.value2.text', 'Value 2 text', 'All the sweetness comes from the fruit. Nothing from a bag, nothing from a lab.'),
					text('about.value3.title', 'Value 3', '100% plant based', { max: 32 }),
					text('about.value3.text', 'Value 3 text', 'Whole fruit, greens and roots. That is the whole ingredient list.')
				]
			}
		]
	},
	{
		id: 'order',
		label: 'Order',
		path: '/order',
		sections: [
			{
				title: 'Top of the page',
				fields: [
					text('order.hero.kicker', 'Small heading', 'Order'),
					text('order.hero.line1', 'Headline, first line', 'Pressed fresh', { max: 24 }),
					text('order.hero.line2', 'Headline, second line (green)', 'for you', { max: 24 }),
					long('order.hero.lede', 'Intro', 'Pick your bottles, choose pickup in {pickupCity} or {deliveryDay} delivery, and pay securely in a minute.'),
					text('order.step.1', 'Step 1', 'Pick your bottles', { max: 32 }),
					text('order.step.2', 'Step 2', 'Choose a day', { max: 32 }),
					text('order.step.3', 'Step 3', "Pay and you're set", { max: 32 })
				]
			}
		]
	},
	{
		id: 'contact',
		label: 'Contact',
		path: '/contact',
		sections: [
			{
				title: 'Top of the page',
				fields: [
					text('contact.hero.kicker', 'Small heading', 'Contact'),
					text('contact.hero.line1', 'Headline, first line', "Let's talk", { max: 24 }),
					text('contact.hero.line2', 'Headline, second line', 'juice', { max: 24 }),
					long('contact.hero.lede', 'Intro', 'Questions about an order, a standing order for your studio or cafe, or an event? Send a note and Hunter will get back to you.')
				]
			},
			{
				title: 'Form',
				fields: [
					text('contact.wholesale', 'Wholesale note', 'Yoga studios, gyms and cafes in Philly: ask about weekly standing orders.'),
					text('contact.form.title', 'Form title', 'Send a message', { max: 40 }),
					text('contact.form.thanks', 'After sending', 'Thanks! Your message is on its way. Hunter will get back to you soon.')
				]
			}
		]
	},
	{
		id: 'everywhere',
		label: 'Footer & banner',
		path: '/',
		hint: 'These show on every page.',
		sections: [
			{
				title: 'Footer',
				fields: [
					text('footer.tag1', 'Big words, first', 'Embrace', { max: 20 }),
					text('footer.tag2', 'Big words, second', 'the sip', { max: 20 }),
					long('footer.note', 'Text', 'Cold-pressed in small batches by Hunter in Philadelphia. Real juice, nothing else in the bottle.'),
					text('footer.bottom', 'Bottom line', 'Cold pressed · No added sugar · Keep refrigerated'),
					photo('footer.photo', 'Photo', 'A wide photo works best. Leave empty for the bottles shot.')
				]
			},
			{
				title: 'Pickup & delivery cards',
				hint: 'On the Home and Juices pages. The address, days, minimums and fees fill in from Settings.',
				fields: [
					long('ways.pickup', 'Pickup text', "Order online, then grab your bottles fresh at {pickupAddress}. Hunter texts you when they're ready."),
					long('ways.delivery', 'Delivery text', 'Hunter drives a fresh batch to your door every {deliveryDay}, within {deliveryRadius} of {deliveryTowns}.'),
					long('ways.shipping', 'Shipping note', "Shipping is coming soon. Hunter is working out the best and cheapest way to get bottles to you.")
				]
			},
			{
				title: 'Pickup & delivery questions',
				hint: 'On the Order and Contact pages. Words in {curly brackets} fill in from Settings.',
				fields: [
					text('faq.title', 'Title', 'Pickup, delivery and shipping'),
					text('faq.1.q', 'Question 1', 'Where do I pick up?'),
					long('faq.1.a', 'Answer 1', 'At {pickupAddress}. Choose a pickup day when you order, and Hunter will text you when your bottles are ready to grab.'),
					text('faq.2.q', 'Question 2', 'When does delivery come?'),
					long('faq.2.a', 'Answer 2', 'Every {deliveryDay}, right to your door, anywhere within {deliveryRadius} of {deliveryTowns}. Get your order in by the end of {cutoffDay} for that {deliveryDay}.'),
					text('faq.3.q', 'Question 3', 'Is there a minimum?'),
					long('faq.3.a', 'Answer 3', 'Delivery needs at least {minBottles} bottles. Pickup has no minimum.'),
					text('faq.4.q', 'Question 4', 'Do you ship?'),
					long('faq.4.a', 'Answer 4', 'Not yet. Shipping is coming soon, and Hunter is working out the best and cheapest way to do it. Follow {instagram} to hear first.'),
					text('faq.5.q', 'Question 5', 'How do I pay?'),
					long('faq.5.a', 'Answer 5', 'Online when you order, through Stripe. Cards, Apple Pay and Google Pay all work.')
				]
			},
			{
				title: 'When ordering is paused',
				fields: [text('banner.paused', 'Banner', 'Online ordering is paused for now. Message us on Instagram to grab a bottle.')]
			}
		]
	}
];

export const COPY_FIELDS = PAGES.flatMap(page => page.sections.flatMap(section => section.fields));
export const DEFAULT_COPY = Object.fromEntries(COPY_FIELDS.map(field => [field.key, field.default]));
const FIELD_BY_KEY = new Map(COPY_FIELDS.map(field => [field.key, field]));
export const copyField = key => FIELD_BY_KEY.get(key);

/** Fills {tokens} from the live settings (plus any extra values, like {count}). Unknown tokens are left alone. */
export function fillTokens(value, settings, extra = {}) {
	return String(value ?? '').replace(/\{(\w+)\}/g, (match, name) => {
		if (name in extra) return String(extra[name]);
		if (TOKENS[name] && settings) {
			try {
				return TOKENS[name].value(settings);
			} catch {
				return match;
			}
		}
		return match;
	});
}

/** The text for a key, with tokens filled in. Falls back to the default when a saved value is empty. */
export function copyText(copy, key, settings, extra) {
	const value = copy?.[key];
	return fillTokens(typeof value === 'string' && value.trim() ? value : DEFAULT_COPY[key] ?? '', settings, extra);
}
