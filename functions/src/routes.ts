// IMPORTS
// ============================================================================================================
import * as express from "express";
import { getCustomerDoc, updateCustomerDoc } from "./lib/firestore";
import {
  addProduct,
  handleCharge,
  handleNewSession,
  handleSubscription,
  updateAndCharge 
} from "./lib/helper";
import * as functions from "firebase-functions";
import { createOrder } from "./lib/shopify";

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
      // Update primary DB && check 
      if (await updateCustomerDoc(FB_UUID, {
        email: email,
        name: name
      }) === undefined) {
        functions.logger.error("ERROR: Firebase -- Check logs.");
        res.status(500).json({
          text:"ERROR: Firebase -- Check logs.",
        });
      } else {
        res.status(200).json({
          text :"SUCCESS: Updated Firebase document.",
        });
      };

    } catch (error) {
      functions.logger.error(
        "ERROR: Firebase -- Likly missing valid FB_UUID.");
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
    // functions.logger.log("\n\n\n\n#3 Update Customer - Start\n\n\n");

    // Get Doc from Primary DB
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
          // ? toggle logs
          // functions.logger.log("SUCCESS: Updated and Charge initiated.");
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
  app.post("/payments/charge", async (req: express.Request, res: express.Response) => {
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
        functions.logger.error(charge_result.text);
        res.status(charge_result.status).json(charge_result.text);
      } else { 
        res.status(200).json({
          text: "SUCCESS: Shopify Customer created. Charge successful on Stripe. Primary D Updated graciously.",
          data: {FB_UUID: FB_UUID}
        });
      }
    } catch {
      functions.logger.error("ERROR: Likely due to Stripe. Check logs - routes.js.");
      res.status(400).json("ERROR: Likely due to Stripe. Check logs - routes.js.")
    }
  });
  
  /**
   *  STEP #5 - Create Shopify Draft orer 
   *  Create draft order once timer is complete
   *  @param FB_UUID
   */
  app.post("/customers/create-order", async (req: express.Request, res: express.Response) => {
    // ? Toggle Class
    functions.logger.log("\n\n\n\n\n#5 Order Created\n\n\n\n\n");
    // Set Var from req
    const {FB_UUID} = req.body;
    
    try {
      const result = await createOrder(FB_UUID);
      // Create Order & Return result
      if ( result.status < 300) {
        res.status(200).json({
          m: "SUCCESS. Draft order created. Order will complete in x-minutes.",
        })
      } else {
        functions.logger.error("ERROR: Likely due to shopify.");
        res.status(400).json({
          m: "ERROR: Likely due to shopify.",
        })
      }
      
    } catch (error) {
      functions.logger.error("ERROR: Likely due to shopify.");
      res.status(400).json({
        m: "ERROR: Likely due to shopify.",
        e: error,
      })
    }
  });
  
  /**
   *  STEP #4.a - Add Product to Primary DB
   *  Create draft order once timer is complete
   *  @param FB_UUID
   */
  app.post("products/add-product", async (req: express.Request, res: express.Response) => {
    functions.logger.log("\n\n\n\n\n#6.a Add Product - Optional\n\n\n\n\n");
    const {FB_UUID, product} = req.body;
    const data = await getCustomerDoc(FB_UUID);
    try {

      // Add product to P-DB && Charge w/ Stripe
      const result = await addProduct(data,FB_UUID,product);

      // Handle result
      if (result.data == undefined) {
        res.status(result.status).json({
          m: result.text
        });

      } else {
        res.status(200).json({
          m: "SUCCESS: Product added to DB. Charge success.",
        })
      }
   
    } catch (error) {
      res.status(400).json({
        m: "ERROR: Likely due to primary DB.",
        e: error,
      });
    };

  });

  
  /**
   *  STEP #4.b - Create Stripe subscription Object
   *  Create draft order once timer is complete
   *  @param FB_UUID
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
          data?.SHOPIFY_UUID,
          data?.STRIPE_UUID, 
          data?.STRIPE_PM,
          data?.line_items,
        );
        if (subResponse.status >= 300) {
          functions.logger.error(subResponse.text);
          // Send back 300+ && data
          res.status(subResponse.status).json(subResponse.text);
        } else {
          // Send back 200 - 300 && data
          res.status(subResponse.status).json(subResponse.text);
        }
    
      } catch (error) {
        functions.logger.error("ERROR: Likely an issue with stripe.");
        res.status(400).json({
          m: "ERROR: Likely an issue with stripe.",
          e: error,
        });
      }
    } else {
      functions.logger.error("ERROR: Likely an issue with stripe. 324");
      res.status(404).json({
        m: "Error: Likely an issue with firebase.",
      });
    }
  });
  
}