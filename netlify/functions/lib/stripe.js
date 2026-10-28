import Stripe from 'stripe';

// Local `netlify dev` uses the test key when one is provided; deployed sites use the live key.
const secretKey = () => (process.env.CONTEXT === 'dev' && process.env.STRIPE_SECRET_KEY_TEST) || process.env.STRIPE_SECRET_KEY;

let client;
export const stripeConfigured = () => Boolean(secretKey());
export const stripe = () => (client ??= new Stripe(secretKey()));
