import fetch, { Response } from "node-fetch";
import * as functions from "firebase-functions";
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
 * Creates a customer object in shopify and return the customer.id || 
 * @param shipping 
 * @param doc 
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
    functions.logger.log("\n\n\n\n#3 Update Customer - Shopify: ");

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

// Check Status of response && 
// return {customer: [{id: customer.id}]} || undefined
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