// IMPORTS

import { updateCustomerDoc } from "./firestore";
import { sendOrder } from "./helper";

// ============================================================================================================
const Stripe = require("stripe");
export const stripe = Stripe(process.env.STRIPE_SECRET);

/**
 *  Helper Fn - STEP #1 
 *  Create a stripe customer and a payment intent secrete key to receive card and store in the vault 
 *  @returns {stripe_data} 200 || 400
 */
export const createStripeCustomer = async () => {
    try {

      // Craete Stripe customer
      const stripeCustomer = await stripe.customers.create({
        description: "CUSTOM CLICK FUNNEL",
      });
  
      // Create a SetUp Intent to get client side secrete key
      const paymentIntent = await stripe.setupIntents.create({
        customer: stripeCustomer.id,
        payment_method_types: ['card']
      });

      // TODO: Follow same return formate and assign to data key
      return {
        stripe_uuid: stripeCustomer.id,
        stripe_pm: paymentIntent.id,
        stripe_client_secrete: paymentIntent.client_secret
    }
    } catch (e) {
        // TODO: Follow same return format
        return undefined
    }
};


/**
 * Helper Fn - STEP #3
 * Updates the strie customer wiht the billing&shipping wiht the same address
 * Primary DB created as well
 * @param email 
 * @param stripe_uuid 
 * @param shipping 
 * @returns 
 */
 export const updateStripeCustomer = async (
  email: string,
  stripe_uuid: string,
  shipping: any
) => {
  // Define vars
  const {address, name} = shipping;
  const {line1, city, state, zip} = address;

  try {
    
    // Update Stripe Customer 
    const stripeCustomer = await stripe.customers.update(
      stripe_uuid,
      {
        email: email,
        name: name,
        shipping: {
          name:  name,
          address: {
            line1: line1,
            city: city,
            state: state,
            postal_code: zip,
            country: "US"
          }
        },
        address: {
          city: city,
          country: "US",
          line1: line1,
          postal_code: zip,
          state: state
        }
      }
    );

    // handle Results
    if (stripeCustomer) {
      // TODO: Follow same return formate 
      return new Object(stripeCustomer); 
    } else { 
      // TODO: Follow same return formate 
      return undefined 
    }

  } catch {
    // TODO: Follow same return formate 
    return undefined
  }

};

/**
 * Helper Fn - STEP #4 
 * Get Stripe pm & create pi
 * Update Customer  
 * @param data 
 * @param price 
 * @param FB_UUID 
 * @returns 
 */
export const handleStripeCharge = async (
  data: any,
  price: any,
  FB_UUID: string,
) => {
  // Get Customers Payment Methods (from PI)
  const paymentMethods = await stripe.paymentMethods.list({
    customer: data.STRIPE_UUID,
    type: "card"
  });

  // Make the initial Stripe charge based on product price
  await stripe.paymentIntents.create({
    amount: price,
    currency: 'USD',
    customer: data.STRIPE_UUID,
    payment_method: paymentMethods.data[0].id ? paymentMethods.data[0].id : "",
    off_session: true,
    confirm: true,
    receipt_email: data.email, 
  });

  // Check if Draft Order was created w/ timer
  if (data.ORDER_STARTED) {
    return {
      status: 200,
      text: "SUCCESS: Customer charged again.",
      data: null,
    };
  } else {
    // Update FB document
    if (await updateCustomerDoc(FB_UUID, {
      STRIPE_PM: paymentMethods.data[0].id,
      ORDER_STARTED: true
    }) === undefined) {
      return {
        status: 400,
        text: "ERROR: Problem wiht firebase. Check Logs - Stripe.js",
        data: undefined,
      };
    } else {
      // Create Draft Order w/ Timer
      sendOrder(FB_UUID);
  
      return {
        status: 201,
        text: "SUCCESS: Customer charged && Draft Order timer started.",
        data: null,
      };

    };
  }
};

/**
 * Helper Fn - STEP 4.b
 * Create subscription based on the 
 * @param STRIPE_UUID 
 * @param STRIPE_PM 
 * @returns 
 */
export const createSubscription = async (STRIPE_UUID: string, STRIPE_PM: string) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: STRIPE_UUID,
      items: [
        {
          price_data: {
            currency: "usd",
            product: "prod_M5BDYb70j19Und",
            recurring: {
              interval: "month"
            },
            unit_amount: 4000
          }
        },
      ],
      default_payment_method: STRIPE_PM,
    });

    // Handle results
    if (subscription) {
      // TODO: Follow same return format 
      return new Object(subscription); 
    } else { 
      // TODO: Follow same return format 
      return undefined 
    }

  } catch (err) {
    // TODO: Follow same return format
    return undefined
  }
};
