import fetch, { Response } from "node-fetch";
import * as functions from "firebase-functions";
import { getCustomerDoc } from "./firestore";
import { cartToOrder, completeOrder } from "./helper";
// import { firestore } from "firebase-admin";

// Admin Headers 
export const HEADERS_ADMIN = {
  "Content-Type": "application/json",
  "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
};

// Create URL
export const URL = "https://shophodgetwins.myshopify.com/admin/api/2022-07/"; 
  
/**
 * Initial request function for the 
 * @param resource 
 * @param method 
 * @param data 
 * @returns Response from fetch
 */
export const shopifyRequest = async (resource: string, method?: string, data?: any) => {

  // Make request to shopify 
  const response = await fetch(URL + resource, {
    method: method || "POST",
    body:  JSON.stringify(data) ,
    headers: HEADERS_ADMIN
  });
  return response;
};

/**
 * Helper Fn - STEP #3\
 * Creates a customer object in shopify and return the customer.id || undefined
 * @param shipping 
 * @param email 
 */
export const createShopifyCustomer = async (shipping: any, email:string) => {

  // Define vars
  const {address, name} = shipping;
  const {line1, city, state, zip} = address;

  // TODO: Validate address --> Helper fns???
  
  // Customer Data
  const customer_data = {
    customer:{ 
      first_name: name,
      last_name:"",
      email: email,
      phone:"",
      verified_email:true,
      addresses:[
        {
          address1:line1,
          city: city,
          province: state,
          phone: "",
          zip: zip,
          last_name:"",
          first_name: name,
          country:"US",
          country_name:"United States", 
          default: true
        }
      ]
    }
  };

  try {
    // Create New Customer 
    const response = await shopifyRequest( `customers.json`, "POST", customer_data);

    // ? Log to BE 
    functions.logger.log("\n\n\n\n#3 Update Customer - Shopify.ts ");

    // Check if exists && retrun {[customers: {id: customer.id}]}
    const status = await checkStatus(response, email); 

    // handle result
    if (status === undefined) {
      // ? Log to BE 
      functions.logger.error(`\n\n\n\n
        #3 SHOPIFY ERROR: Likely internal server`,
        status
      );
      return undefined;
    } else {
      return status;
    }
  } catch (err) {
    // ? Log to BE 
    functions.logger.error(`\n\n\n\n
      #3 SHOPIFY ERROR: Likely internal server`,
      err
    );
    return undefined
  }
};

/**
 * Helper Fn - createShopifyCustomer()
 * handle response and fetch existing user or return JSON repsonse of new 
 * @param r - Response
 * @param e - email
 * @returns - {customer: [{id: customer.id}]} || undefined
 */
async function checkStatus(r: any, e: string) {
  // If 200 >= x < 300 &&
  // Return {customer: [{id: customer.id}]}
  if (r.ok) { 
    // Await json response and return data
    const doc = await r.json();

    const d = new Object({
        customers: [{
            id: doc.customer.id
        }] 
    });
    return d;

  } else if ( r.status == 422 ) { 
    try {
      // If email is with an existing user, then search the email 
      const response:Response = await shopifyRequest(
        `customers/search.json?query=email:"${e}"&fields=id,email`, 
        "GET"
      );

      const customer = await response.json()
      return new Object(customer);
      
    } catch (error) { return undefined; }
  } else { return undefined; }
};

/**
 *  Helper Fn - STEP #5
 * Create Draft Order for Shopify && 
 * POST Complete in x-minutes
 * @param FB_UUID 
 * @returns underfined && 200 || 400 || other
 */
export const createOrder = async (FB_UUID: string) => {
  try {
    // Fetch data with UUID
    const data = await getCustomerDoc(FB_UUID);
  
    console.log("152: shopify.js - data: \n",data);

    // Order Data (SHOPIFY)
    const draft_order_data = {
      draft_order:{
        line_items: data ? await cartToOrder(data) : null,
        customer:{
            id: data?.SHOPIFY_UUID
        },
        use_customer_default_address:true,
        tags: "CUSTOM_CLICK_FUNNEL",
        shipping_line: {
          custom: "STANDARD_SHIPPING",
          price: 5.99,
          title: "Standard Shipping"
        }
      }
    };
    
    // setTimeout( async () => {
    // Create Order & Get Price

    const shopify_order = await shopifyRequest(`draft_orders.json`, "POST", draft_order_data) 

    console.log("195: shopify.js - shopify_order: \n", shopify_order);

    if (!shopify_order.ok) {
      functions.logger.error("176: shopify.ts \n", shopify_order.statusText)
      return {
        text: "ERROR: Likley Shopify - " + shopify_order.statusText,
        status: shopify_order.status,
        data: undefined
      }
    } else {
      functions.logger.log("183: shopify.ts. Complete Order. \n", )
      // Complete Draft Order --> Order
      // TODO: Turn into cron job with pubsub
      completeOrder(await shopify_order.json());
  
      return {
        text: "SUCCESS: Shopify craft order created && TTC 15 min. ",
        status: 200,
        data: undefined
      }
    }

  } catch {
    return {
      text: "ERROR: Likley issue with shopify. Check Logs - shopify.js",
      status: 400,
      data: undefined
    }
  }
};