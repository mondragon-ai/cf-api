// import * as admin from "firebase-admin";
import {db} from "../firebase"

console.log(db)

/**
 *  Get Firebase customer doc
 *  @param FB_UUID 
 *  @returns customer || null
 */
export const getCustomerDoc = async (FB_UUID: string) => {
  let customer: any = undefined;

  if (FB_UUID !== "") {
    // Doc Ref
    var docRef = db.collection("customers").doc(FB_UUID);
    // Get Doc
    await docRef.get().then((doc) => {;
      if (doc.exists) {
        console.log("Document data:", doc.data());
        customer = doc.data();
      } else {
        // doc.data() will be undefined in this case
        console.log("No such document!");
        customer = undefined;
      }
    }).catch((error) => {
      console.log("Error getting document:", error);
      return undefined;
    });
    return customer;

  } else {
    console.log("FB_UUID EMPTY")
    return undefined;
  }

};

/**
 *  Create Doc with Data
 *  @param data 
 *  @returns FB_UUID
 */
export const createCustomerDoc = async (data: {}) => {
  try {
    var FB_UUID = ""
    
    // Create Doc with Data
    await db.collection("customers").add(data)
    .then((docRef) => {
      console.log("Document written with ID: ", docRef.id);
      FB_UUID = docRef.id;
    })
    .catch((error) => {
      console.error("Error adding document: ", error);
      return undefined
    });
    return FB_UUID;

  } catch {
    return undefined
  }
};

/**
 *  
 *  @param FB_UUID 
 *  @param data 
 *  @returns FB_UUID
 */
export const updateCustomerDoc = async (FB_UUID: string, data: {}) => {

  // Doc Ref
  var docRef =  db.collection("customers").doc(FB_UUID);

  try {
    // Doc Ref
    await docRef.set(data, { merge: true })
    return FB_UUID;
  } catch (err) {
    return undefined
  }

};

export const addAddressAndLineItem = async (
  FB_UUID: string, 
  b: number, 
  product: any, 
  shopifyID: string, 
  shipping: any
) => {
  const {address, name} = shipping;
  const {line1, city, state, zip} = address;
  const result = await updateCustomerDoc(FB_UUID, {
    BUMP_OFFER: b, 
    line_items:[
      {
        variant_id: product.variant_id,
        quantity: 1,
        price: product.price,
        title: product.title
      }
    ],
    SHOPIFY_UUID: shopifyID,
    shipping: {
      address: {
        line1: line1,
        city:  city,
        state:  state,
        country:  "US",
        zip:  zip,
      },
      name:  name
    },
    isReadyToCharge: true
  });
  if (result == undefined) {
    return undefined;
  } else {
    return result
  }
};

export const addSubscriptionForStripe = async (
  FB_UUID: string,
  line_items: any,
  subscriptionID: string
) => {
  const result = await updateCustomerDoc(FB_UUID, {
    STRIPE_SUB_ID: subscriptionID,
    line_items: [
      ...line_items,
      {
        title: "VIP Club",
        price: 4000,
        variant_id: 41175576608940,
        quantity: 1
      }
    ]
  });
  if (result == undefined) {
    return undefined;
  } else {
    return result
  }
};

