require('dotenv').config();

exports.handler = async event => {
	// Only allow GET requests
	if (event.httpMethod !== 'GET') {
		return {
			statusCode: 405,
			body: 'Method Not Allowed'
		};
	}

	// Get the Google Maps API key from environment variable
	const apiKey = process.env.GOOGLE_MAPS_API_KEY;

	if (!apiKey) {
		return {
			statusCode: 500,
			body: JSON.stringify({ error: 'Google Maps API key not configured' })
		};
	}

	return {
		statusCode: 200,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
		},
		body: JSON.stringify({ apiKey })
	};
};
