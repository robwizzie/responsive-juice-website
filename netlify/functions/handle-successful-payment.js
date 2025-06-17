const nodemailer = require('nodemailer');
const stripeLib = require('stripe');
require('dotenv').config();

// Initialize Stripe
const stripeSecretKey = process.env.CONTEXT === 'dev' && process.env.STRIPE_SECRET_KEY_TEST ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY;
const stripe = stripeLib(stripeSecretKey);

// Email configuration
const transporter = nodemailer.createTransporter({
	host: process.env.EMAIL_HOST,
	port: process.env.EMAIL_PORT || 465,
	secure: process.env.EMAIL_PORT === '465',
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS
	}
});

exports.handler = async event => {
	if (event.httpMethod !== 'POST') {
		return {
			statusCode: 405,
			body: 'Method Not Allowed'
		};
	}

	try {
		const sig = event.headers['stripe-signature'];
		const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

		let stripeEvent;
		try {
			stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
		} catch (err) {
			console.log(`Webhook signature verification failed.`, err.message);
			return {
				statusCode: 400,
				body: `Webhook Error: ${err.message}`
			};
		}

		// Handle the checkout.session.completed event
		if (stripeEvent.type === 'checkout.session.completed') {
			const session = stripeEvent.data.object;

			// Get customer email from session
			const customerEmail = session.customer_details && session.customer_details.email;
			const pickupDate = session.metadata && session.metadata.pickup_date;
			const pickupLocation = session.metadata && session.metadata.pickup_location;
			const customerName = session.metadata && session.metadata.customer_name;
			const customerPhone = session.metadata && session.metadata.customer_phone;
			const subtotal = session.metadata && session.metadata.subtotal;
			const taxAmount = session.metadata && session.metadata.tax_amount;
			const total = ((session.amount_total || 0) / 100).toFixed(2);

			if (customerEmail && pickupDate && pickupLocation) {
				// Format the pickup date
				const formattedPickupDate = new Date(pickupDate).toLocaleDateString('en-US', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				});

				// Format location name
				const locationName = pickupLocation.charAt(0).toUpperCase() + pickupLocation.slice(1);
				const locationDetails = pickupLocation === 'woodbury' ? 'Gloucester County, NJ' : 'Camden County, NJ';

				// Send confirmation email to customer
				const customerEmailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #ff9700; margin-bottom: 10px;">Order Confirmed!</h1>
                        <p style="color: #666; font-size: 18px;">Thank you for your order with Pressed By J & H</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h2 style="color: #333; margin-top: 0;">📍 Pickup Details</h2>
                        <p><strong>Customer:</strong> ${customerName}</p>
                        <p><strong>Phone:</strong> ${customerPhone}</p>
                        <p><strong>Pickup Date:</strong> ${formattedPickupDate}</p>
                        <p><strong>Pickup Location:</strong> ${locationName}, ${locationDetails}</p>
                        <p><strong>Address:</strong> [EXACT ADDRESS WILL BE PROVIDED - Please reply to this email for specific location details]</p>
                        <p><strong>Pickup Time:</strong> We'll confirm the exact time via email before your pickup date</p>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9700; margin-bottom: 20px;">
                        <p style="margin: 0; color: #856d03;"><strong>Important:</strong> Please bring this confirmation email when picking up your order.</p>
                    </div>
                    
                    <div style="border: 1px solid #ddd; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h3 style="color: #333; margin-top: 0;">Order Summary</h3>
                        <div style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>Subtotal:</span>
                                <span>$${subtotal}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>NJ Sales Tax:</span>
                                <span>$${taxAmount}</span>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px;">
                            <span>Total Paid:</span>
                            <span style="color: #ff9700;">$${total}</span>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <p style="color: #666;">Questions about your order?</p>
                        <p style="color: #666;">Reply to this email or contact us directly</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="color: #999; font-size: 12px;">Pressed By J & H - Fresh Juice, Fresh Life</p>
                    </div>
                </div>
                `;

				// Send email to customer
				await transporter.sendMail({
					from: `"Pressed By J & H" <${process.env.EMAIL_USER}>`,
					to: customerEmail,
					subject: 'Order Confirmation - Pickup Details Inside',
					html: customerEmailHtml
				});

				// Send notification to business owner
				const businessNotificationHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ff9700;">New Pickup Order Received!</h2>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 10px;">
                        <h3 style="color: #333; margin-top: 0;">Customer Details</h3>
                        <p><strong>Name:</strong> ${customerName}</p>
                        <p><strong>Email:</strong> ${customerEmail}</p>
                        <p><strong>Phone:</strong> ${customerPhone}</p>
                        
                        <h3 style="color: #333; margin-top: 20px;">Pickup Information</h3>
                        <p><strong>Date:</strong> ${formattedPickupDate}</p>
                        <p><strong>Location:</strong> ${locationName}, ${locationDetails}</p>
                        
                        <h3 style="color: #333; margin-top: 20px;">Order Details</h3>
                        <p><strong>Order Total:</strong> $${total}</p>
                        <p><strong>Session ID:</strong> ${session.id}</p>
                    </div>
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9700; margin-top: 20px;">
                        <p style="margin: 0; color: #856d03;"><strong>Action Required:</strong> Reply to the customer with the exact pickup address and time confirmation.</p>
                    </div>
                </div>
                `;

				await transporter.sendMail({
					from: `"Order System" <${process.env.EMAIL_USER}>`,
					to: process.env.CONTACT_EMAIL,
					subject: `New Pickup Order - ${locationName} - ${formattedPickupDate}`,
					html: businessNotificationHtml
				});

				console.log(`Confirmation emails sent for order ${session.id}`);
			}
		}

		return {
			statusCode: 200,
			body: JSON.stringify({ received: true })
		};
	} catch (error) {
		console.error('Webhook error:', error);
		return {
			statusCode: 500,
			body: 'Webhook handler failed'
		};
	}
};
