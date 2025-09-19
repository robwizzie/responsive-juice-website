const https = require('https');
const http = require('http');

import juices from '../assets/js/juices-database.js';

exports.handler = async (event, context) => {
	try {
		const { slug } = event.queryStringParameters || {};

		if (!slug) {
			return {
				statusCode: 400,
				body: JSON.stringify({ error: 'Slug parameter is required' })
			};
		}

		// Find the juice by slug
		const juice = juices.find(j => j.slug === slug);

		if (!juice) {
			return {
				statusCode: 404,
				body: JSON.stringify({ error: 'Juice not found' })
			};
		}

		// Generate SVG-based OG image
		const ogImageSvg = generateOGImageSVG(juice);

		return {
			statusCode: 200,
			headers: {
				'Content-Type': 'image/svg+xml',
				'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
			},
			body: ogImageSvg
		};
	} catch (error) {
		console.error('Error generating OG image:', error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: 'Internal server error' })
		};
	}
};

function generateOGImageSVG(juice) {
	const width = 1200;
	const height = 630;

	// Create a gradient based on the juice color
	const lightColor = lightenColor(juice.color, 0.3);
	const darkColor = darkenColor(juice.color, 0.2);

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${lightColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${darkColor};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.3)"/>
        </filter>
    </defs>
    
    <!-- Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>
    
    <!-- Decorative circles -->
    <circle cx="100" cy="100" r="60" fill="rgba(255,255,255,0.1)"/>
    <circle cx="${width - 100}" cy="${height - 100}" r="80" fill="rgba(255,255,255,0.1)"/>
    <circle cx="${width - 150}" cy="150" r="40" fill="rgba(255,255,255,0.15)"/>
    
    <!-- Main content container -->
    <rect x="80" y="120" width="${width - 160}" height="${height - 240}" rx="20" fill="rgba(255,255,255,0.95)" filter="url(#shadow)"/>
    
    <!-- Brand name -->
    <text x="120" y="180" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="${juice.color}">
        SIP ON PRESSED
    </text>
    
    <!-- Juice name -->
    <text x="120" y="240" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#333">
        ${juice.name}
    </text>
    
    <!-- Description/Ingredients -->
    <text x="120" y="290" font-family="Arial, sans-serif" font-size="24" fill="#666">
        ${juice.ingredients.slice(0, 4).join(' • ')}
    </text>
    
    ${
		juice.ingredients.length > 4
			? `
    <text x="120" y="320" font-family="Arial, sans-serif" font-size="24" fill="#666">
        ${juice.ingredients.slice(4).join(' • ')}
    </text>
    `
			: ''
	}
    
    <!-- Price and availability -->
    <text x="120" y="380" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="${juice.color}">
        $${juice.price.toFixed(2)} ${juice.inStock ? '• Available Now' : '• Coming Soon'}
    </text>
    
    <!-- Fresh & Organic badge -->
    <rect x="120" y="420" width="200" height="40" rx="20" fill="${juice.color}"/>
    <text x="220" y="445" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">
        FRESH & ORGANIC
    </text>
    
    <!-- Juice bottle silhouette (simplified) -->
    <g transform="translate(${width - 300}, 180)">
        <!-- Bottle shape -->
        <ellipse cx="60" cy="200" rx="45" ry="180" fill="rgba(255,255,255,0.3)"/>
        <ellipse cx="60" cy="50" rx="20" ry="30" fill="rgba(255,255,255,0.3)"/>
        <rect x="50" y="20" width="20" height="30" fill="rgba(255,255,255,0.3)"/>
        
        <!-- Liquid inside -->
        <ellipse cx="60" cy="200" rx="35" ry="160" fill="${juice.color}" opacity="0.8"/>
        
        <!-- Highlight -->
        <ellipse cx="45" cy="150" rx="8" ry="60" fill="rgba(255,255,255,0.4)"/>
    </g>
    
    <!-- Website URL -->
    <text x="${width / 2}" y="${height - 40}" font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.8)" text-anchor="middle">
        siponpressed.com
    </text>
</svg>`;
}

// Helper function to lighten a color
function lightenColor(color, percent) {
	const num = parseInt(color.replace('#', ''), 16);
	const amt = Math.round(2.55 * percent * 100);
	const R = (num >> 16) + amt;
	const G = ((num >> 8) & 0x00ff) + amt;
	const B = (num & 0x0000ff) + amt;
	return '#' + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 + (B < 255 ? (B < 1 ? 0 : B) : 255)).toString(16).slice(1);
}

// Helper function to darken a color
function darkenColor(color, percent) {
	const num = parseInt(color.replace('#', ''), 16);
	const amt = Math.round(2.55 * percent * 100);
	const R = (num >> 16) - amt;
	const G = ((num >> 8) & 0x00ff) - amt;
	const B = (num & 0x0000ff) - amt;
	return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 + (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 + (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
}
