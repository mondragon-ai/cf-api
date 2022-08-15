import fetch from "node-fetch"
import * as functions from "firebase-functions";
import { createStripeCustomer, createSubscription, handleStripeCharge, updateStripeCustomer } from "./stripe";
import { createOrder, createShopifyCustomer, shopifyRequest } from "./shopify";
import { addAddressAndLineItem, addSubscriptionForStripe, createCustomerDoc, getCustomerDoc, updateCustomerDoc } from "./firestore";
import { giveGiftCard } from "./giftCard";

// Admin Headers 
export const HEADERS_ADMIN = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
};

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
 * @returns - { shopifyCustomerID, stripCustomerID }
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
  } else {

    try {
      // Customer Data
      const shopifyCustomer = await createShopifyCustomer(shipping, email);
  
      // Update Stripe Customer 
      const stripCustomer = await updateStripeCustomer(email, STRIPE_UUID, shipping);
  
      // Check response & send result
      if (shopifyCustomer === undefined) {
        functions.logger.error("ERROR: Customers Stripe ID not present.");
        return {
          status: 500,
          text: "ERROR: Likely a Firebase internal server issue.",
          data: undefined
        }
      } else if (stripCustomer === undefined) {
        functions.logger.error("ERROR: Likely a Firebase internal server issue.");
        return {
          status: 500,
          text: "ERROR: Likely a Firebase internal server issue.",
          data: undefined
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
            functions.logger.error("ERROR: Likely a Firebase internal server issue.");
            return {
              status: 500,
              text: "ERROR: Likely a Firebase internal server issue.",
              data: undefined
            }
          } else {
            functions.logger.log("SUCCESS: Customer Created in Shopify");
  
            // Call initial charge
            initialCharge(FB_UUID, product, b);
  
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
            text: "ERROR: Invalid email entered.",
            data: undefined
          } 
        }
      }
    } catch (error) {
      functions.logger.error("ERROR: Likely a stripe issue.");
      return {
        status: 400,
        text: "ERROR: Likely a stripe issue.",
        data: undefined
      };
    };
  }
};

/**
 * Helper Fn - STEP #4 
 * Create an intial charge to the user from the landing page
 * @param FB_UUID 
 * @param product 
 * @param bump 
 */
export const initialCharge =  async (FB_UUID: string, product: any, bump: number) =>  {
  // ? toggle logs
  functions.logger.log("\n\n\n\n\n#3.a Handle Charge - Helper.ts\n\n\n\n\n");

  setTimeout( async () => {
    // ? toggle logs
    functions.logger.log("\n\n\n\n\nHELPER FUNCITONS - inside: \n\n\n\n\n");

    const price = Number(product.price + bump);

    try {
      // Handle Stripe charge based on isOrderCreated
      const charge_result = await handleCharge(FB_UUID, price)

      // Retrun to client
      if (charge_result.status >= 300) {
        console.log("185: initalCharge() - \n",charge_result);
        functions.logger.log(charge_result);
        functions.logger.error(charge_result.text);
        return 
      } else { 
        functions.logger.log("SUCCESS: Shopify Customer created. Charge successful on Stripe. Primary D Updated graciously.", FB_UUID);
        return
      }

    } catch {
      functions.logger.error("ERROR: Likely due to Stripe. Check logs - routes.js.");
      return

    }

  }, 2000);

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
      // ? Toggle Logs
      functions.logger.log("\n\n\n\n\n#4 Charge Customer - handleCharge() - helper.ts\n\n\n\n\n");
      const stripe_charge = await handleStripeCharge(data,price, FB_UUID);

      if (stripe_charge.status >= 300) {
        console.log("226: HandleCharge() - \n",stripe_charge);
        functions.logger.error(stripe_charge.text);
        return {
          status: stripe_charge.status,
          text: stripe_charge.text,
          data: undefined
        };

      } else {
        functions.logger.log("\n\n\n\n\nSUCCESS: Customer charged - handleCharge() - helper.ts\n\n\n\n\n");
        return {
          status: 200,
          text: "SUCCESS: Customer charged.",
          data: null
        };
      }

    } catch (error) {
      functions.logger.error("ERROR: Likely a problem charging the customer.");
      return {
        status: 400,
        text: "ERROR: Likely a problem charging the customer.",
        data: undefined
      };
    }

  } else {
    functions.logger.error( "ERROR: Likely due to firebase.");
    return {
      status: 400,
      text: "ERROR: Likely due to firebase.",
      data: undefined
    };
  };
};

/**
 * Helper Fn - STEP 4.a 
 * Add product to cart (primary DB) 
 * Handle charge from stripe
 * @param data 
 * @param FB_UUID 
 * @param product 
 * @returns 
 */
export const addProduct = async (data: any, FB_UUID: string, product: any) => {

  // If no line items already exist add
  if (!data?.line_items) {
    await updateCustomerDoc(FB_UUID, {
      line_items: [
        {
          title: product.title, 
          price: product.price,
          variant_id: product.variant_id,
          quantity: product.quantity
        }
      ]
    });
  } else {
    // Update line_items: [{}]  
    await updateCustomerDoc(FB_UUID, {
      line_items: [
        ...data?.line_items, 
        {
          title: product.title,
          price: product.price,
          variant_id: product.variant_id,
          quantity: product.quantity
        }
      ]
    });
  };

  // Handle Stripe charge based on isOrderCreated
  const result = await handleCharge(FB_UUID, product.price);

  if (result.data == undefined) {
    return {
      status: result.status,
      text: result.text,
      data: undefined
    }
  } else {
    return {
      status: 200,
      text: "SUCCESS: Product added to cart & Charge was completed.",
      data: null
    }
  }

};

/**
 * Helper Fn - STEP 4.b
 * Create the subscription obeject and assign the customer based n the received payment method 
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

  console.log(subResponse);

  if (subResponse === undefined) {
    return {
      status: 400,
      text: "ERROR: Coudln't create subscription",
      data: null
    }
  }
  
  // ADD Tags to Shopify
  const shopifyCustomer = await shopifyRequest("/graphql.json", "POST", {
    query: "mutation addTags($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { node { id } userErrors { message } } }",
    variables: {
      id: `gid://shopify/Customer/${SHOPIFY_UUID}`,
      tags: "VIP_MEMBER"
    }
  });

  console.log(shopifyCustomer);

  // Check if Shopify Request == OK
  if (shopifyCustomer.status >= 300) {
    return {
      status: shopifyCustomer.status,
      text: "ERROR: Likely an issue with Shopify.",
      data: undefined
    }
  } else {
    // Create Sub JSON
    const subscription = JSON.parse(JSON.stringify(subResponse));
  
    // Update FB Doc 
    const customerDoc = await addSubscriptionForStripe(FB_UUID, line_items, subscription.id);
  
    // Check if Sub to Stripe was OK
    if (customerDoc === undefined) {
      return {
        status: 400, 
        text: "ERROR: Likely an issue with Stripe.",
        data: undefined
      }
    }
  
    const giftCard = await giveGiftCard(SHOPIFY_UUID);
  
    // Send Gift Card w/ Shopify && Handle Error
    if (giftCard === undefined) {
      return {
        status: 400, 
        text: "ERROR: Likely an issue with Shopify.",
        data: undefined
      }
    }
  
    return {
      status: 200,
      text: "SUCCESS: Subscription createCustomerDoc.",
      data: null
    }
  }


}


/**
 *  STEP #6 
 *  Create Draft Order in 1000*60*5 minutes
 *  @param FB_UUID
 */
 export const sendOrder = async (FB_UUID: string, ) => {
  // ? Toggle log 
  functions.logger.log("\n\n\n\n\n#4.a Send Order - Helper -- Outside Timer\n\n\n\n\n");
  
  // Wait for x-minutes to 
  setTimeout( async ()=> {
    // ? Toggle log 
    functions.logger.log("\n\n\n\n\n#4.a Send Order - Helper -- Inside Timer\n\n\n\n\n");

    try {
      // Create Order
      const result = await createOrder(FB_UUID);

      // Create Order & Return result
      if ( result.status < 300) {
        return // SUCCESS
      } else {
        functions.logger.error("ERROR: Likely due to shopify.");
        return 
        // res.status(400).json({
        //   m: "ERROR: Likely due to shopify.",
        // })
      }
      
    } catch (error) {
      functions.logger.error("ERROR: Likely due to shopify.");
      return
    }

    }, 1000*60*7);

};


/**
 *  STEP #7 COMPLETE FUNNEL ORDER
 *  Draft -> Order status fulfilled
 *  Complete Draft Order --> Order
 *  @param o 
 */
 export const completeOrder = async (o: any) => {
  // ? Toggle logs
  functions.logger.log('#7 Shopify DRAFT_ORDER Complete: ', o.draft_order);

  // Check the status of the Shopify Create Customer Call
  async function checkStatus(r: any) {

    // If 200 >= x < 300, & return customer ID
    if (r.ok) { 
      // ? Toggle logs
      functions.logger.log('SUCCESS: #7 Shopify DRAFT_ORDER Complete: ', o.draft_order);
      return  await r.json()
    } else { 
      // ? Toggle logs
      functions.logger.error('ERROR: #7 Shopify DRAFT_ORDER. ');    
      return await r.json();
    } 
  };

  // Complete Order
  const result = await fetch(`https://shophodgetwins.myshopify.com/admin/api/2022-07/draft_orders/${o.draft_order.id}/complete.json`, {
      method: 'put',
      headers: HEADERS_ADMIN
  })
  .then(r =>  checkStatus(r))
  .then(json => json);


  functions.logger.log('#7 Shopify DRAFT_ORDER Complete: ', result);

  return
};

/**
 *  Helper Fn - completeOrder()
 *  Get primary DB customer document && create a new cart obj to return to complete order
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
    // TODO: Return format
    functions.logger.log('160 - Helper Fn: ', cart);
    return cart
  } else {
    // TODO: Return format
    for (var i = 0; i < ln; i++) {
      cart = [
        ...cart,
        {
          variant_id: line_items[i].variant_id,
          quantity: line_items[i].quantity
        }
      ];
    }
    functions.logger.log('167 - Helper Fn: ', cart);
    return cart
  };
};