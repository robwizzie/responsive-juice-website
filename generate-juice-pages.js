const { juices } = require('./assets/js/juices-database.js');
const fs = require('fs');
const path = require('path');

// Read the template
const templatePath = path.join(__dirname, 'juice-details.html');
const template = fs.readFileSync(templatePath, 'utf8');

// Generate individual pages for each juice
juices.forEach(juice => {
	let html = template;

	// Replace meta tags with juice-specific content
	const metaImage = `/assets/img/og-images/${juice.slug}-og.png`;

	// Replace title
	html = html.replace('<title>Product Details</title>', `<title>${juice.name} - Premium Cold-Pressed Juice | Sip On Pressed</title>`);

	// Replace meta description
	html = html.replace('<meta name="description" content="Discover our fresh, cold-pressed juices made with premium organic ingredients.">', `<meta name="description" content="${juice.metaDescription}">`);

	// Replace meta keywords
	html = html.replace('<meta name="keywords" content="cold-pressed juice, organic juice, fresh juice, healthy drinks">', `<meta name="keywords" content="${juice.metaKeywords}">`);

	// Replace OG title
	html = html.replace('<meta property="og:title" content="Product Details">', `<meta property="og:title" content="${juice.name} - Premium Cold-Pressed Juice">`);

	// Replace OG description (handle multiline case)
	html = html.replace(/<meta property="og:description"[^>]*content="[^"]*"[^>]*>/, `<meta property="og:description" content="${juice.metaDescription}">`);

	// Replace OG image
	html = html.replace('<meta property="og:image" content="/assets/img/branding/logo.png">', `<meta property="og:image" content="${metaImage}">`);

	// Replace OG URL
	html = html.replace('<meta property="og:url" content="">', `<meta property="og:url" content="https://siponpressed.com/juices/${juice.slug}">`);

	// Replace Twitter title
	html = html.replace('<meta name="twitter:title" content="Product Details">', `<meta name="twitter:title" content="${juice.name} - Premium Cold-Pressed Juice">`);

	// Replace Twitter description (handle multiline case)
	html = html.replace(/<meta name="twitter:description"[^>]*content="[^"]*"[^>]*>/, `<meta name="twitter:description" content="${juice.metaDescription}">`);

	// Replace Twitter image
	html = html.replace('<meta name="twitter:image" content="/assets/img/branding/logo.png">', `<meta name="twitter:image" content="${metaImage}">`);

	// Replace canonical URL
	html = html.replace('<link rel="canonical" href="">', `<link rel="canonical" href="https://siponpressed.com/juices/${juice.slug}">`);

	// Write the file
	const outputPath = path.join(__dirname, `${juice.slug}.html`);
	fs.writeFileSync(outputPath, html);

	console.log(`Generated: ${juice.slug}.html`);
});

console.log('All juice pages generated successfully!');
