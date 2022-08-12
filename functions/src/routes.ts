// IMPORTS
// ============================================================================================================
import * as express from "express";
import {stripe, updateStripeCustomer} from "./lib/stripe";
import {addAddressAndLineItem, createCustomerDoc, getCustomerDoc, updateCustomerDoc} from "./lib/firestore";
import { cartToOrder, completeOrder, sendOrder } from "./lib/helper";
import * as functions from "firebase-functions";
import { giveGiftCard } from "./lib/giftCard";
import { createShopifyCustomer } from "./lib/shopify";
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
    const data = await getCustomerDoc("OYl6tO0GIRYXKYFpJe5w");
    if (data !== undefined) {

      console.log("34 - Firestore Data -- ", data);

      const response = await createShopifyCustomer(data.shipping, "angel@gobigly.com");

      if (response === undefined) {
        res.status(500).json({
          m: "ERROR: Likely Shopify Internal Server",
          d: response
        })
      } else {
        const result = JSON.parse(JSON.stringify(response))
        if (result.customers[0]) {
          res.status(200).json({
            m: "SUCCESS: Customer Created in Shopify", 
            d: result.customers[0].id});
        } else {
          res.status(422).json("ERROR: Not a valid email entered.");
        }
      }

    } else {
      res.status(404).json({m: "ERROR -- Firebase could not locate User"})
    }

  });


/** 
 * Test API Route
 */
 app.post('/customers/create-subscription', async (req: express.Request, res: express.Response) => {
    functions.logger.log("\n\n\n\n\n#6.b Create Subscription - Optional\n\n\n\n\n");
    //Get doc id
    const {FB_UUID} = req.body;
    const data = await getCustomerDoc(FB_UUID);
      if (data !== null) {
        try {
          //Create Sub with customer
          const subscription = await stripe.subscriptions.create({
            customer: data.STRIPE_UUID,
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
            default_payment_method: data.STRIPE_PM,
          });
  
          // ADD Tags to Shopify
          await fetch(URL + "/graphql.json", {
            method: "POST",
            body: JSON.stringify({
              query: "mutation addTags($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { node { id } userErrors { message } } }",
              variables: {
                id: `gid://shopify/Customer/${data.SHOPIFY_UUID}`,
                tags: "VIP_MEMBER"
              }
            }),
            headers: HEADERS_ADMIN
          })
          .then(resp => resp.json())
          .then(json => json);
  
          // Update FB Doc 
          const customerDoc = await updateCustomerDoc(FB_UUID, {
            STRIPE_SUB_ID: subscription.id,
            line_items: [
                ...data.line_items,
                {
                    title: "VIP Club",
                    price: 4000,
                    variant_id: 41175576608940,
                    quantity: 1
                }
            ]
          });
  
          await giveGiftCard(data.SHOPIFY_UUID)
  
          // Send back 200 + data
          res.status(200).json({
            m: "Succesffully created subscription.",
            d: subscription,
            c: customerDoc,
          });
     
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
  
  /**
   *  Creating Scene for session 
   *  @param req
   *  @return 400 || 200
   */
  app.get("/customers/createSession", async (req: express.Request, res: express.Response) => {
    functions.logger.log("\n\n\n\n#1 Create User Session\n\n\n");
    // Try to call stripe
    try {
      // Create Stripe Customer
      const stripeCustomer = await stripe.customers.create({
        description: "CUSTOM CLICK FUNNEL",
      });
  
      // Create a SetUp Intent to get client side secrete key
      const paymentIntent = await stripe.setupIntents.create({
        customer: stripeCustomer.id,
        payment_method_types: ['card']
      });
  
      // Create firebase doc
      const FB_UUID = await createCustomerDoc({
        STRIPE_UUID: stripeCustomer.id,
        STRIPE_PI_UID: paymentIntent.id,
        STRIPE_CLIENT_ID: paymentIntent.client_secret,
        ORDER_STARTED: false, // TODO: Add more data as needed
      })
  
      res.status(200).json({
        m:"Successfly created customer session.",
        FB_UUID: FB_UUID, 
        clientSecret: paymentIntent.client_secret
      });
  
    } catch (error) {
      res.status(400).json({
        m:"Error: Could not create a user session. Likely a stripe error. See logs.",
        e: error,
      });
    }
  });
  
  app.post("/customers/opt-in", async (req: express.Request, res: express.Response) => {
    const {FB_UUID, email, name} = req.body;
    functions.logger.log("\n\n\n\n#2 Add EMAIL\n\n\n");
    try {
      await updateCustomerDoc(FB_UUID, {
        email: email,
        name: name,
      });
      res.status(200).json({
        m:"Successfly updated firebase doc.",
      });
    } catch (error) {
      res.status(400).json({
        m:"Error: Firebase -- likly missing valid FB_UUID.",
        e: error,
      });
    }
  });
  
  /**
   *  Update customer on event two & call self to create initialCharge 
   *  @param  
   *  @return 400 || 200 || 201
   */
  app.post("/customers/update", async (req: express.Request, res: express.Response) => {
    // Define vars
    const {shipping, product, bump, FB_UUID} = req.body;
    var docRef =  db.collection("customers").doc(FB_UUID); 
    let b = bump ? 399 : 0
  
    // Console Logs
    functions.logger.log("\n\n\n\n#3 Update Customer - Start\n\n\n");

    // Get Doc
    await docRef.get().then( async (doc: any) => {
      // Check if DOCUMENT_UUID exists
      if (doc.exists) {
        // Get DocumentData
        const d: any = doc.data();

        try {
          // Customer Data
          const shopifyCustomer = await createShopifyCustomer(shipping, d.email);
      
          // Update Stripe Customer 
          if (!d.STRIPE_UUID) {
            functions.logger.error("ERROR: Customers Stripe ID not present.");
            res.status(422).json("ERROR: Customers Stripe ID not present.");
          }
          const stripCustomer = await updateStripeCustomer(d.email, d.STRIPE_UUID, shipping);

          // Check response & send result
          if (shopifyCustomer === undefined) {
            res.status(500).json("ERROR: Likely Shopify Internal Server");
          } else if (stripCustomer === undefined) {
            res.status(500).json("ERROR: Likely Stripe Internal Server");
          } else {
            const result = JSON.parse(JSON.stringify(shopifyCustomer));

            // if the response is as expected, 
            if (result.customers[0]) {
              // Push new data to Firebase
              await addAddressAndLineItem(
                FB_UUID,
                b,
                product,
                result.customers[0].id,
                shipping
              );

              functions.logger.log("============================================================================================================");
              functions.logger.log("                                               ", FB_UUID,  "                                               ");
              functions.logger.log("============================================================================================================");
          
              // TODO: Cron Job ???
              // Call initial charge
              // initialCharge(FB_UUID, product, b);

              // Send Response back
              res.status(200).json({
                m: "SUCCESS: Customer Created in Shopify", 
                d: result.customers[0].id,
                s: stripCustomer
              });
            } else {
              functions.logger.error("ERROR: Invalid email entered.");
              res.status(422).json("ERROR: Invalid email entered.");
            }
          }
          
        } catch (error) {
          functions.logger.error("ERROR: Likely a stripe issue.");
          res.status(400).json({
            m:"ERROR: Likely a stripe issue.",
            e: error,
          });
        };
      } else {
        functions.logger.error("ERROR: Likely a Firebase Document not found.");
        res.status(404).json("ERROR: Likely a Firebase Document not found.");
      }
    }).catch((error: any) => {
      functions.logger.error("ERROR: Likely a Firebase issue. Check logs.\n",error);
      res.status(404).json({
        m: "ERROR: Likely a Firebase issue. Check logs.",
        e: error
      });
    });
  });
  
  /** 
   *  Charge Customer for prodct 
   *  @param FB_UUID
   *  @param product
   *  @param bump
   */
  app.post("/customers/charge", async (req: express.Request, res: express.Response) => {
    functions.logger.log("\n\n\n\n\n#4 Charge Customer\n\n\n\n\n");
    // get Product and FB_UUID
    const { FB_UUID, product, b } = req.body;
    console.log("\n\n\n\n ============== SPACE ==============\n\n\n\n ");
    const data = await getCustomerDoc(FB_UUID);
    const price = product.price + b;
  
    if (data) {
      // Get Customers Payment Methods (from PI)
      const paymentMethods = await stripe.paymentMethods.list({
        customer: data.STRIPE_UUID,
        type: "card"
      });
      console.log("\n\n\n\n DATA: ", product);
  
      try {
        // Make the initial Stripe charge based on product price
        const paymentIntent = await stripe.paymentIntents.create({
          amount: price,
          currency: 'USD',
          customer: data.STRIPE_UUID,
          payment_method: paymentMethods.data[0].id ? paymentMethods.data[0].id : "",
          off_session: true,
          confirm: true,
          receipt_email: data.email, 
        });
  
        // Update FB document
        await updateCustomerDoc(FB_UUID, {
          STRIPE_PM: paymentMethods.data[0].id
        });
    
        console.log("\n\n SUCCESSFULLY CHARGED: " + paymentIntent + " \n\n\ ")
        
  
        if (data.ORDER_STARTED) {
          res.status(200).json({
            m: "Successfully charged again.",
            d: paymentIntent,
          });
        } else {
          // Update FB document
          await updateCustomerDoc(FB_UUID, {
            ORDER_STARTED: true
          });
          functions.logger.log("\n\n\n\n\n#4.a Start Order - Helper\n\n\n\n\n");
          sendOrder(FB_UUID);
          res.status(201).json({
            m: "Successfully charged. Draft Order timer started.",
            d: paymentIntent,
          });
        }
  
      } catch (error) {
        console.log(error);
        res.status(401).json({
          m: "Unsuccessfully charged. Likely a stripe porblem.",
          e: error,
        });
      }
  
    } else {
      res.status(400).json({
        m: "ERROR: Likely due to firebase.",
      });
    };
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
  
}