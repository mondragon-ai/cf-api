// import * as admin from "firebase-admin";
import {db} from "../firebase"

console.log(db)

/**
 *  Get Firebase customer doc
 *  @param FB_UUID 
 *  @returns customer || null
 */
export const getCustomerDoc = async (FB_UUID: string) => {
  let customer: any = null;

  if (FB_UUID !== "") {
    // Doc Ref
    var docRef = db.collection("customers").doc(FB_UUID);
    // Get Doc
    await docRef.get().then((doc) => {
      if (doc.exists) {
          console.log("Document data:", doc.data());
          customer = doc.data();
      } else {
          // doc.data() will be undefined in this case
          console.log("No such document!");
          customer = null;
      }
    }).catch((error) => {
        console.log("Error getting document:", error);
    });
  
    return customer;
  } else {
    console.log("FB_UUID EMPTY")
    return customer;
  }

};

/**
 *  Create Doc with Data
 *  @param data 
 *  @returns FB_UUID
 */
export const createCustomerDoc = async (data: {}) => {
  var FB_UUID = ""
  // Create Doc with Data
  await db.collection("customers").add(data)
  .then((docRef) => {
    console.log("Document written with ID: ", docRef.id);
    FB_UUID = docRef.id;
  })
  .catch((error) => {
    console.error("Error adding document: ", error);
  });

  console.error("FB_UUID WRITTEN: ", FB_UUID);

  return FB_UUID;
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

  // Doc Ref
  await docRef.set(data, { merge: true })
  console.log("updated customer", docRef);

  return FB_UUID;
};

