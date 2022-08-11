// IMPORTS
// ============================================================================================================
const Stripe = require("stripe");
export const stripe = Stripe(process.env.STRIPE_SECRET);

