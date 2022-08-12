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
export const updateStripeCustomer = async (email: string, stripe_uuid: string, shipping: any) => {
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

}

