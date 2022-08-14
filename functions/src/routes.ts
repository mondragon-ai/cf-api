// IMPORTS
// ============================================================================================================
import * as express from "express";
import { getCustomerDoc, updateCustomerDoc } from "./lib/firestore";
import {
  cartToOrder, 
  completeOrder,
  handleCharge,
  handleNewSession,
  handleSubscription,
  updateAndCharge 
} from "./lib/helper";
import * as functions from "firebase-functions";
import fetch from "node-fetch";

// Admin Headers 
export const HEADERS_ADMIN = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
};

// Create URL
export const URL = "https://shophodgetwins.myshopify.com/admin/api/2022-07/"; 

/**
 * The routes for the custom click funel MVP route 
 * @param app Express app sent from rest file 
 * @param db DB created in firebase file
 */
export const routes = (app: express.Router, db: any) => {

  app.get("/test", async (req: express.Request, res: express.Response) => {
    // Set Vars 
    // const {shipping} = req.body;
  });
  
  /**
   *  STEP #1 - Creating new session for customer
   *  Create stripe customer, and create new FB document
   *  @return {FB_UUID, STRIPE_CLIENT_ID} 400 || 200 || 500 
   */
  app.get("/customers/create-session", async (req: express.Request, res: express.Response) => {
    // ? Toggle Logs
    functions.logger.log("\n\n\n\n#1 Create User Session\n\n\n");

    try {
      // Create New Session - Helpers
      const sessionResult = await handleNewSession();

      // Send back response to client
      if (!sessionResult.data) {
        res.status(sessionResult.status).json({
          text: sessionResult.text,
        });
      } else {
        res.status(200).json({
          text:"SUCCESS: Customer session created && FB added.",
          FB_UUID: sessionResult.data?.FB_UUID, 
          clientSecret: sessionResult.data?.STRIPE_CLIENT_ID
        });
      }
    } catch (error) {
      res.status(500).json({
        m:"ERROR: Could not create a user session. Likely a stripe error. See logs.",
        e: error,
      });
    }
  });
  
  /**
   *  STEP #2 - Opt In with user email || phone
   *  Push data to primary database. 
   *  @param {FB_UUID, email, name} req.body
   *  @return 400 || 200 || 500
   */
  app.post("/customers/opt-in", async (req: express.Request, res: express.Response) => {
    // Set Vars
    const {FB_UUID, email, name} = req.body;

    // ? Toggle Log
    functions.logger.log("\n\n\n\n#2 Add EMAIL\n\n\n");

    try {
      if (await updateCustomerDoc(FB_UUID, {
        email: email,
        name: name
      }) === undefined) {
        res.status(500).json({
          text:"ERROR: Firebase -- Check logs.",
        });
      } else {
        res.status(200).json({
          text :"SUCCESS: Updated Firebase document.",
        });
      };
    } catch (error) {
      res.status(400).json({
        text:"ERROR: Firebase -- Likly missing valid FB_UUID.",
        data: error,
      });
    }
  });
  
  /**
   *  STEP #3 - Update Customer Data && Initiate Charge 
   *  Update stripe customer &&  FB document 
   *  Call initialCharge 
   *  @param  
   *  @return 400 || 200 || 201
   */
  app.post("/customers/update", async (req: express.Request, res: express.Response) => {
    // Define vars
    const {shipping, product, bump, FB_UUID} = req.body;
    var docRef =  db.collection("customers").doc(FB_UUID); 
    let b = bump ? 399 : 0
  
    // ? toggle logs
    functions.logger.log("\n\n\n\n#3 Update Customer - Start\n\n\n");

    // Get Doc
    await docRef.get().then( async (doc: any) => {
      // Check if DOCUMENT_UUID exists
      if (doc.exists) {
        // Create Shopify & Update DB & Inital Charge
        const result = await updateAndCharge(doc, shipping, FB_UUID, b, product);

        // Send results to client
        if (!result.data)  {
          functions.logger.error(result.text);
          res.status(result.status).json(result.text);
        } else {
          // functions.logger.log("ERROR: Likely a Firebase Document not found.");
          res.status(200).json("SUCCESS: Updated and Charge initiated.");
        }
      } else {
        functions.logger.error("ERROR: Likely a Firebase Document not found.");
        res.status(404).json("ERROR: Likely a Firebase Document not found.");
      }
    }).catch((error: any) => {
      functions.logger.error("ERROR: Likely a Firebase issue. Check logs.\n", error);
      res.status(400).json({
        m: "ERROR: Likely a Firebase issue. Check logs.",
        e: error
      });
    });
  });
  
  /** 
   *  STEP #4 - Charge Customer
   *  Charge Customer for prodct 
   *  @param FB_UUID
   *  @param product
   *  @param bump
   */
  app.post("/customers/charge", async (req: express.Request, res: express.Response) => {
    // Set Vars
    const { FB_UUID, product, b } = req.body;
    const price = product.price + b;

    // ? Toggle Logs
    functions.logger.log("\n\n\n\n\n#4 Charge Customer\n\n\n\n\n");

    try {
      // Handle Stripe charge based on isOrderCreated
      const charge_result = await handleCharge(FB_UUID, price)

      // Retrun to client
      if (!charge_result.data) {
        res.status(charge_result.status).json(charge_result.text);
      } else { 
        res.status(200).json({
          text: "SUCCESS: Shopify Customer created. Charge successful on Stripe. Primary D Updated graciously.",
          data: {FB_UUID: FB_UUID}
        });
      }
    } catch {
      res.status(400).json("ERROR: Likely due to Stripe. Check logs - routes.js.")
    }

    
  });
  
  /**
   *  Create draft order once timer is complete
   *  @param FB_UUID
   */
  app.post("/customers/createOrder", async (req: express.Request, res: express.Response) => {
    functions.logger.log("\n\n\n\n\n#5 Order Created\n\n\n\n\n");
    const {FB_UUID} = req.body;
    const data = await getCustomerDoc(FB_UUID);
  
    // Order Data (SHOPIFY)
    const draft_order_data = {
      draft_order:{
        line_items: data ? await cartToOrder(data) : null,
        customer:{
            id: data.SHOPIFY_UUID
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
  
    try {
      // setTimeout( async () => {
      // Create Order & Get Price
      const shopify_order = await fetch(URL + `draft_orders.json`, {
        method: 'post',
        body: JSON.stringify(draft_order_data),
        headers: HEADERS_ADMIN
      })
      .then(r =>  r.json()) 
      .then(json => json);
  
      // Complete Draft Order --> Order
      // TODO: Turn into cron job with pubsub
      completeOrder(shopify_order.draft_order.id);
  
      res.status(200).json({
        m: "Sucesffully created and sent order to shopify.",
        d: shopify_order,
      })
      
    } catch (error) {
      res.status(400).json({
        m: "Error: Likely due to shopify.",
        e: error,
      })
      
    }
  });
  
  app.post("/addProduct", async (req: express.Request, res: express.Response) => {
    functions.logger.log("\n\n\n\n\n#6.a Add Product - Optional\n\n\n\n\n");
    const {FB_UUID, product} = req.body;
    const data = await getCustomerDoc(FB_UUID);
    try {
      // If no line items already exist add
      if (!data.line_items) {
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
            ...data.line_items, 
            {
              title: product.title,
              price: product.price,
              variant_id: product.variant_id,
              quantity: product.quantity
            }
          ]
        });
      };
  
      // Once added make the charge
      await fetch("https://us-central1-shopify-recharge-352914.cloudfunctions.net/funnelAPI/customers/charge", {
        method: 'post',
        body:    JSON.stringify({
            FB_UUID: FB_UUID, 
            product: product,
            b: 0
        }),
        headers: HEADERS_ADMIN
      })
      .then(r => r.json())
      .then(json => json);
  
      res.status(200).json({
        m: "Sucesffully cadded product to DB. Initiating Charge.",
        d: product,
      })
   
    } catch (error) {
      res.status(400).json({
        m: "Error: Likely due to shopify.",
        e: error,
      });
    };
  });

  /** 
   * Test API Route
   */
  app.post('/customers/create-subscription', async (req: express.Request, res: express.Response) => {
    //Get doc id
    const {FB_UUID} = req.body;
    const data = await getCustomerDoc(FB_UUID);
    functions.logger.log("\n\n\n\n\n#6.b Create Subscription - Optional\n\n\n\n\n");

    if (data !== null) {
      try {
        //Create Sub with customer
        const subResponse = await handleSubscription(
          FB_UUID,
          data.SHOPIFY_UUID,
          data.STRIPE_UUID, 
          data.STRIPE_PM,
          data.line_items,
        );
        if (subResponse.status >= 300) {
          // Send back 300+ && data
          res.status(subResponse.status).json(subResponse.text);
        } else {
          // Send back 200 - 300 && data
          res.status(subResponse.status).json(subResponse.text);
        }
    
      } catch (error) {
        res.status(400).json({
          m: "Error: Likely an issue with stripe.",
          e: error,
        });
      }
    } else {
      res.status(404).json({
        m: "Error: Likely an issue with firebase.",
      });
    }
  });
  
}