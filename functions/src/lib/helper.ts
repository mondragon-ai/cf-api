import fetch from "node-fetch"
import { HEADERS_ADMIN } from "../routes";
import * as functions from "firebase-functions";
import { createStripeCustomer, createSubscription, handleStripeCharge, updateStripeCustomer } from "./stripe";
import { createShopifyCustomer, shopifyRequest } from "./shopify";
import { addAddressAndLineItem, addSubscriptionForStripe, createCustomerDoc, getCustomerDoc } from "./firestore";
import { giveGiftCard } from "./giftCard";

/**
 *  Create an intial charge to the user from the landing page
 * @param FB_UUID 
 * @param product 
 * @param bump 
 */
export const initialCharge = (FB_UUID: string, product: any, bump: number) =>  {
  functions.logger.log("\n\n\n\n\n#3.a Send Order - Helper\n\n\n\n\n");
  setTimeout(() => {
    console.log("HELPER FUNCITONS - inside: ", FB_UUID);
    // Fetch INternally
    fetch("https://us-central1-shopify-recharge-352914.cloudfunctions.net/funnelAPI/customers/charge", {
      method: "POST",
      body: JSON.stringify({
        FB_UUID: FB_UUID,
        product: product,
        b: bump
      }),
      headers: {
        "Content-Type": "application/json",
      }
    })
    .then(resp => resp.json())
    .then(json => json);

  }, 2000);
};

/**
 *  Create Draft Order in 1000*60*5 minutes
 *  @param FB_UUID
 */
export const sendOrder =  (FB_UUID: string) => {
  functions.logger.log("\n\n\n\n\n#4.a Send Order - Helper -- Outside Timer\n\n\n\n\n");
  console.log('36 - Shopify DRAFT_ORDER starts in 1000*60*1 minutes: ', FB_UUID);
  setTimeout(()=> {
    functions.logger.log("\n\n\n\n\n#4.a Send Order - Helper -- Inside Timer\n\n\n\n\n");
    console.log('38 - Shopify DRAFT_ORDER called: ', FB_UUID);
    const f = FB_UUID;
    // initiate Order 
    fetch("https://us-central1-shopify-recharge-352914.cloudfunctions.net/funnelAPI/customers/createOrder", {
      method: 'post',
      body:    JSON.stringify({FB_UUID: f}),
      headers: {
        "Content-Type": "application/json",
      }
    })
    .then(r => r.json())
    .then(json => json);

    }, 1000*60*7);

};


/**
 *  Complete Draft Order --> Order
 *  @param draftID 
 */
 export const completeOrder = async (o: any) => {
  functions.logger.log('#7 Shopify DRAFT_ORDER Complete: ', o.draft_order);
  // Check the status of the Shopify Create Customer Call
  async function checkStatus(r: any) {

        // If 200 >= x < 300, & return customer ID
        if (r.ok) { 
            console.log('392 - Shopify SUCCESS: ', r);
            return  await r.json()
        } else { 
            console.log('398 - Shopify: ', r);            
            return await r.json();
        } 
    };

    // Complete Order
   const result = await fetch(URL + `draft_orders/${o.draft_order.id}/complete.json`, {
        method: 'put',
        headers: HEADERS_ADMIN
    })
    .then(r =>  checkStatus(r))
    .then(json => json);


  functions.logger.log('#7 Shopify DRAFT_ORDER Complete: ', result);

  return
};

/**
 *  Get FB Document and Return Cart
 *  @param FB_DOC 
 *  @returns cart[product] || []
 */
 export const cartToOrder = (FB_DOC: any) => {
  functions.logger.log("\n\n\n\n\n#5.a Order Created - Helper\n\n\n\n\n");
  console.log('61 - helpers: ', FB_DOC);
  // Create vars
  const { line_items } = FB_DOC
  const ln = line_items.length
  var cart: any = []

  if (ln == 0 ) { 
    // return empty []
    console.log('477 - Shopify: ', cart);
    return cart
  } else {
    // return cart[product]
    console.log('480 - Shopify: ', cart);
    for (var i = 0; i < ln; i++) {
      cart = [
        ...cart,
        {
          variant_id: line_items[i].variant_id,
          quantity: line_items[i].quantity
        }
      ];
    }
    return cart
  };
};

/**
 * 
 * @param FB_UUID 
 * @param SHOPIFY_UUID 
 * @param STRIPE_UUID 
 * @param STRIPE_PM 
 * @param line_items 
 * @returns 
 */
export const handleSubscription = async (
  FB_UUID: string ,
  SHOPIFY_UUID: string, 
  STRIPE_UUID: string, 
  STRIPE_PM: string, 
  line_items: any,
) => {
  //Create Sub with customer
  const subResponse = await createSubscription(STRIPE_UUID, STRIPE_PM);

  if (subResponse === undefined) {
    return {status: 400, text: ""}
  }
  
  // ADD Tags to Shopify
  const shopifyCustomer = await shopifyRequest("/graphql.json", "POST", {
    query: "mutation addTags($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { node { id } userErrors { message } } }",
    variables: {
      id: `gid://shopify/Customer/${SHOPIFY_UUID}`,
      tags: "VIP_MEMBER"
    }
  });

  // Check if Shopify Request == OK
  if (shopifyCustomer.status >= 300) {
    return {status: shopifyCustomer.status, text: "Error: Likely an issue with Shopify."}
  }

  // Create Sub JSON
  const subscription = JSON.parse(JSON.stringify(subResponse));

  // Update FB Doc 
  const customerDoc = await addSubscriptionForStripe(FB_UUID, line_items, subscription.id);

  // Check if Sub to Stripe was OK
  if (customerDoc === undefined) {
    return {status: 400, text: "ERROR: Likely an issue with Stripe."}
  }

  const giftCard = await giveGiftCard(SHOPIFY_UUID);

  // Send Gift Card w/ Shopify && Handle Error
  if (giftCard === undefined) {
    return {status: 400, text: "ERROR: Likely an issue with Shopify."}
  }

  return {status: 200, text: undefined}

}

/**
 *  Helper Fn - STEP #1
 *  Create new stripe session && update primary DB
 *  @returns {FB_UUID, CLIENT} && 200 || 400
 */
export const handleNewSession = async () => {
  // Create Stripe Customer
  const result = await createStripeCustomer();

  // Create firebase doc
  const FB_UUID = await createCustomerDoc({
    STRIPE_UUID: result?.stripe_uuid,// result?.stripe_uuid,
    STRIPE_PI_UID: result?.stripe_pm, //result?.stripe_pm,
    STRIPE_CLIENT_ID: result?.stripe_client_secrete, //result?.stripe_client_secrete,
    ORDER_STARTED: false, 
    // TODO: Add more data as needed && ServerTimeStamp
  });

  if (FB_UUID === undefined || result === undefined) {
    return {
      status: 400,
      text: "ERROR: Could not create a user session. Likely a Stripe || Firebase error. See logs."
    }
  } else {
    return {
      status: 200,
      text: undefined,
      data: {
        FB_UUID: FB_UUID,
        STRIPE_UUID: result?.stripe_uuid,
        STRIPE_PI_UID: result?.stripe_pm,
        STRIPE_CLIENT_ID: result?.stripe_client_secrete,
      }
    }
  }
};

/**
 * Helper Fn - STEP #3 
 * Create || Search for shopify customer
 * Update Stripe data && push to primary DB
 * @param doc 
 * @param shipping 
 * @param FB_UUID 
 * @param b 
 * @param product 
 * @returns { shopifyCustomerID, stripCustomerID }
 */
export const updateAndCharge = async (
  doc: any, 
  shipping: any,
  FB_UUID: string, 
  b: any,
  product: string
) => {

  // Get DocumentData
  const {email, STRIPE_UUID} = await doc.data();

  // If stipe_uuid s not present reject request
  if (!STRIPE_UUID) {
    functions.logger.error("ERROR: Customers Stripe ID not present.");
    return {
        status: 422,
        text: "ERROR: Customers Stripe ID not present."
      }
    // TODO: Consider redirection back to rot "/" ?? 
  }

  try {
    // Customer Data
    const shopifyCustomer = await createShopifyCustomer(shipping, email);

    // Update Stripe Customer 
    const stripCustomer = await updateStripeCustomer(email, STRIPE_UUID, shipping);

    // Check response & send result
    if (shopifyCustomer === undefined) {
      return {
        status: 500,
        text: "ERROR: Likely a Firebase internal server issue."
      }
    } else if (stripCustomer === undefined) {
      return {
        status: 500,
        text: "ERROR: Likely a Firebase internal server issue."
      }
    } else {
      // Parse Stripe update request to JSON
      const result = JSON.parse(JSON.stringify(shopifyCustomer));

      // if the response is as expected, 
      if (result.customers[0]) {
        // Push new data to Firebase
        if (await addAddressAndLineItem(
          FB_UUID,
          b,
          product,
          result.customers[0].id,
          shipping
        ) === undefined) {
          return {
            status: 500,
            text: "ERROR: Likely a Firebase internal server issue."
          }
        } else {
          // TODO: Cron Job ???
          // Call initial charge
          // initialCharge(FB_UUID, product, b);

          // Send Response back
          return {
            status: 200,
            text: "SUCCESS: Customer Created in Shopify",
            data: { 
              d: result.customers[0].id,
              s: stripCustomer
            }
          }
        };
    
      } else {
        functions.logger.error("ERROR: Invalid email entered.");
        return {
          status: 422,
          text: "ERROR: Invalid email entered."
        } 
      }
    }
  } catch (error) {
    functions.logger.error("ERROR: Likely a stripe issue.");
    return {
      status: 400,
      text: "ERROR: Likely a stripe issue."
    };
  };
};

/**
 * Helper Fn - STEP #4
 * GET stripe_pm && create/charge stripe_pi
 * Update primary DB
 * @param FB_UUID 
 * @param price 
 * @returns 
 */
export const handleCharge = async (
  FB_UUID: string,
  price: number
) => {
  // Fetch doc from primary DB
  const data = await getCustomerDoc(FB_UUID);
  
  if (data) {

    try {
      const stripe_charge = await handleStripeCharge(data,price, FB_UUID);

      if (!stripe_charge.data) {
        return {
          status: stripe_charge.status,
          text: stripe_charge.text,
          data: null
        };

      } else {
        return {
          status: 200,
          text: "SUCCESS: Customer charged.",
          data: null
        };
      }

    } catch (error) {
      return {
        status: 400,
        text: "ERROR: Likely a problem charging the customer.",
      };
    }

  } else {
    return {
      status: 400,
      text: "ERROR: Likely due to firebase.",
    };
  };
};