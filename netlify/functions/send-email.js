const nodemailer = require('nodemailer');
require('dotenv').config();

// Email validation helper
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async event => {
	if (event.httpMethod !== 'POST') {
		return {
			statusCode: 405,
			body: 'Method Not Allowed'
		};
	}

	const { firstName, lastName, email, message } = JSON.parse(event.body || '{}');

	// Basic validation
	if (!firstName || !lastName || !email || !message) {
		return {
			statusCode: 400,
			body: 'All fields are required'
		};
	}

	if (!emailRegex.test(email)) {
		return {
			statusCode: 400,
			body: 'Invalid email address'
		};
	}

	// Determine port and secure flag dynamically to prevent mismatches that can cause SSL errors
	const port = Number(process.env.EMAIL_PORT) || 465;
	const transporter = nodemailer.createTransport({
		host: process.env.EMAIL_HOST,
		port,
		secure: port === 465, // true for port 465 (SSL), false for 587/25 (STARTTLS)
		auth: {
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASS
		}
	});

	try {
		await transporter.verify();

		await transporter.sendMail({
			from: `"${firstName} ${lastName}" <${process.env.EMAIL_USER}>`,
			to: process.env.CONTACT_EMAIL,
			replyTo: email,
			subject: 'New Contact Form Submission - Pressed by J & H',
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff9700;">New Message from Website Contact Form</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 10px;">
            <p><strong>Name:</strong> ${firstName} ${lastName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This message was sent from the Pressed by J & H website contact form.
          </p>
        </div>
      `
		});

		return { statusCode: 200, body: 'Email sent successfully' };
	} catch (err) {
		console.error('Email send error:', err);
		return { statusCode: 500, body: 'Failed to send email' };
	}
};
