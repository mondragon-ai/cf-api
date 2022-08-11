import fetch from "node-fetch"
import { HEADERS_ADMIN } from "../routes";
import * as functions from "firebase-functions";

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
 export const completeOrder = async (draftID: string) => {
  functions.logger.log('#7 Shopify DRAFT_ORDER Complete: ', draftID);
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
   const result = await fetch(URL + `draft_orders/${draftID}/complete.json`, {
        method: 'put',
        headers: HEADERS_ADMIN
    })
    .then(r =>  checkStatus(r))
    .then(json => json);


  functions.logger.log('#7 Shopify DRAFT_ORDER Complete: ', result);
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
