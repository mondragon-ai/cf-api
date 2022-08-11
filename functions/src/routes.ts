// IMPORTS
// ============================================================================================================
import * as express from "express";
import {stripe} from "./lib/stripe";
import {createCustomerDoc, getCustomerDoc, updateCustomerDoc} from "./lib/firestore";
import { cartToOrder, completeOrder, initialCharge, sendOrder } from "./lib/helper";
import * as functions from "firebase-functions";
import { giveGiftCard } from "./lib/giftCard";
import { shopifyRequest } from "./lib/shopify";
import fetch from "node-fetch";

// Admin Headers 
export const HEADERS_ADMIN = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
};

// Create URL
export const URL = "https://shophodgetwins.myshopify.com/admin/api/2022-07/"; 

export const routes = (app: express.Router, db: any) => {

    app.get("/test", async (req: express.Request, res: express.Response) => {

        const response = await shopifyRequest("graphql.json", "POST", {
            query: "mutation addTags($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { node { id } userErrors { message } } }",
            variables: {
              id: `gid://shopify/Customer/6128501227692`,
              tags: "VIP_MEMBER"
            }
        });
        const {data} = await response.json();
        console.log("\n\n\n"+data+"\n\n\n")
        res.status(200).send({m: "SUCCESS", d: data})
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
      const customerDoc = await updateCustomerDoc(FB_UUID, {
        email: email,
        name: name,
      });
      res.status(200).json({
        m:"Successfly updated firebase doc.",
        c: customerDoc,
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
    functions.logger.log("\n\n\n\n#3 Update Customer\n\n\n");
    // Define vars
    const {shipping, product, bump, FB_UUID} = req.body;
    var docRef =  db.collection("customers").doc(FB_UUID); //getCustomerDoc(FB_UUID);
    const {address, name} = shipping;
    // const {variant_id, quantity, price, title} = product;
    const {line1, city, state, zip} = address;
    let b = bump ? 399 : 0
  
    console.log(product, bump)
    // Get Doc
    await docRef.get().then( async (doc: any) => {
      if (doc.exists) {
        // Check the status of the Shopify Create Customer Call
        async function checkStatus(r: any) {
  
          // If 200 >= x < 300, & return customer ID
          if (r.ok) { 
  
            const data = await r.json();
            const d = {
                customers: [{
                    id: data.customer.id
                }] 
            };
            // Return customer if created
            return  d
  
          } else if ( r.status == 422 ) { 
            
            // If email is with an existing user search the email 
            const response = await fetch(URL + `customers/search.json?query=email:"${d.email}"&fields=id,email`, {
                method: 'get',
                headers: HEADERS_ADMIN
            })
            .then(res => res.json())
            .then(jsonData =>  jsonData);
  
            // Return the shopify UUID
            return response
  
          } else {
            // error
            res.status(400).json({m: "SHOPIFY: Unknonwn. See logs for more info."})
          }
        };
        console.log("Document data:", doc.data());
        const d: any = doc.data();
        try {
          // Customer Data
          const customer_data = {
            customer:{ 
              first_name: name,
              last_name:"",
              email: d.email,
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
      
          // Create New Customer OR search for existing on 422 status 
          const shopifyCustomer = await fetch(URL + `customers.json`, {
            method: 'POST',
            body: JSON.stringify(customer_data),
            headers: HEADERS_ADMIN
          })
          .then(resp => checkStatus(resp))
          .then(json => json);
          functions.logger.log("\n\n\n\n#3 Update Customer - Shopify: ", shopifyCustomer);
      
          // Update Stripe Customer 
          const stripeCustomer = await stripe.customers.update(
            d.STRIPE_UUID,
            {
              email: d.email,
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
          functions.logger.log("\n\n\n\n#3 Update Customer - Stripe: ", stripeCustomer);
      
          // Push new data to Firebase
          await updateCustomerDoc(FB_UUID, {
            BUMP_OFFER: b, 
            line_items:[
                {
                    variant_id: product.variant_id,
                    quantity: 1,
                    price: product.price,
                    title: product.title
                }
            ],
            SHOPIFY_UUID: shopifyCustomer.customers[0].id,
            shipping: {
                address: {
                    line1: line1,
                    city:  city,
                    state:  state,
                    country:  "US",
                    zip:  state,
                },
                name:  name
            },
            isReadyToCharge: true
          });
  
          functions.logger.log("============================================================================================================");
          functions.logger.log("                                          ", FB_UUID, product, b, "                                         ");
          functions.logger.log("============================================================================================================");
      
          // Call initial charge
          initialCharge(FB_UUID, product, b);
      
          res.status(200).json({
            m:"Successfly executed.",
            c: shopifyCustomer,
          });
          
        } catch (error) {
          res.status(400).json({
            m:"Error: Likely a stripe issue.",
            e: error,
          });
        };
      } else {
          // doc.data() will be undefined in this case
          console.log("No such document!");
      }
    }).catch((error: any) => {
        console.log("Error getting document:", error);
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
          currency: 'usd',
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