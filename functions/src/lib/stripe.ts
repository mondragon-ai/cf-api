// IMPORTS
// ============================================================================================================
const Stripe = require("stripe");
export const stripe = Stripe(process.env.STRIPE_SECRET);

/**
 * 
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

  try {// Update Stripe Customer 
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
    
    if (stripeCustomer) {
      return new Object(stripeCustomer); 
    } else { return undefined }
  } catch {
    return undefined
  }
};

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

    if (subscription) {
      return new Object(subscription); 
    } else { return undefined }

  } catch (err) {
    return undefined
  }
};

export const createStripeCustomer = async () => {
    try {
      const stripeCustomer = await stripe.customers.create({
        description: "CUSTOM CLICK FUNNEL",
      });
  
      // Create a SetUp Intent to get client side secrete key
      const paymentIntent = await stripe.setupIntents.create({
        customer: stripeCustomer.id,
        payment_method_types: ['card']
      });

      return {
        stripe_uuid: stripeCustomer.id,
        stripe_pm: paymentIntent.id,
        stripe_client_secrete: paymentIntent.client_secret
    }
    } catch (e) {
        return undefined
    }
};

