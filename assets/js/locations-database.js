const locations = [
	{
		id: 1,
		name: 'Woodbury',
		slug: 'woodbury',
		county: 'Gloucester County',
		state: 'NJ',
		fullLocation: 'Gloucester County, NJ',
		address: '880 Mantua Pike, Woodbury Heights, NJ 08097',
		description: 'Located inside of Clean Meal Prep in Giant Fitness',
		color: '#ff9700', // Primary brand color
		active: true,
		deliveryAvailable: false,
		deliveryRadius: 0,
		pickupHours: {
			monday: '10:00 AM - 9:00 PM',
			tuesday: '10:00 AM - 9:00 PM',
			wednesday: '10:00 AM - 9:00 PM',
			thursday: '10:00 AM - 9:00 PM',
			friday: '10:00 AM - 9:00 PM',
			saturday: '10:00 AM - 5:00 PM',
			sunday: 'Closed'
		},
		contactPhone: '(856) 537-1906',
		googleMapsLink: 'https://maps.app.goo.gl/TYcVsdRCeTf4Kjfs8',
		specialInstructions: 'Fridge inventory available - no prep required'
	},
	{
		id: 2,
		name: 'Blackwood',
		slug: 'blackwood',
		county: 'Camden County',
		state: 'NJ',
		fullLocation: 'Camden County, NJ',
		address: '1281 Blackwood-Clementon Rd, Clementon, NJ 08021',
		description: 'Located inside of Clean Meal Prep',
		color: '#ff7700',
		active: true,
		deliveryAvailable: true,
		deliveryRadius: 30, // 30 mile radius
		deliveryFee: 7.0, // $7 delivery fee
		pickupHours: {
			monday: '10:00 AM - 9:00 PM',
			tuesday: '10:00 AM - 9:00 PM',
			wednesday: '10:00 AM - 9:00 PM',
			thursday: '10:00 AM - 9:00 PM',
			friday: '10:00 AM - 9:00 PM',
			saturday: '10:00 AM - 6:00 PM',
			sunday: 'Closed'
		},
		contactPhone: '(609) 828-6626',
		website: 'https://www.cleanplatemealprep.com/',
		googleMapsLink: 'https://maps.app.goo.gl/D1YhSAWWwFT8kcu48',
		specialInstructions: 'Orders by Friday, prep Saturday, ship Sunday, pickup Monday'
	}
];

// Helper functions for locations (similar to juices)
const getLocationById = id => {
	return locations.find(location => location.id === parseInt(id));
};

const getLocationBySlug = slug => {
	return locations.find(location => location.slug === slug);
};

const getActiveLocations = () => {
	return locations.filter(location => location.active);
};

// Get today's hours for a location
const getTodaysHours = locationSlug => {
	const location = getLocationBySlug(locationSlug);
	if (!location || !location.pickupHours) return 'Hours not available';

	const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
	const today = days[new Date().getDay()];

	return location.pickupHours[today] || 'Closed';
};

// Get formatted hours for display
const getFormattedHours = location => {
	if (!location || !location.pickupHours) return 'Hours not available';

	const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

	return days
		.map((day, index) => {
			const hours = location.pickupHours[dayKeys[index]];
			return `${day}: ${hours}`;
		})
		.join('\n');
};

// Check if location is open on a given date
const isLocationOpenOnDate = (locationSlug, date) => {
	const location = getLocationBySlug(locationSlug);
	if (!location || !location.pickupHours) return false;

	const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
	const dayOfWeek = days[new Date(date).getDay()];
	const hours = location.pickupHours[dayOfWeek];

	return hours && hours.toLowerCase() !== 'closed';
};

// Check if delivery is available for a location
const isDeliveryAvailable = locationSlug => {
	const location = getLocationBySlug(locationSlug);
	return location && location.deliveryAvailable === true;
};

// Get delivery fee for a location
const getDeliveryFee = locationSlug => {
	const location = getLocationBySlug(locationSlug);
	return location && location.deliveryAvailable ? location.deliveryFee : 0;
};

// Get delivery radius for a location
const getDeliveryRadius = locationSlug => {
	const location = getLocationBySlug(locationSlug);
	return location && location.deliveryAvailable ? location.deliveryRadius : 0;
};

// Get locations that offer delivery
const getDeliveryLocations = () => {
	return locations.filter(location => location.active && location.deliveryAvailable);
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		locations,
		getLocationById,
		getLocationBySlug,
		getActiveLocations,
		getTodaysHours,
		getFormattedHours,
		isLocationOpenOnDate,
		isDeliveryAvailable,
		getDeliveryFee,
		getDeliveryRadius,
		getDeliveryLocations
	};
}
