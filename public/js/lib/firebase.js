console.log("PUBLIC - FIREBASE.js");
import "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";

// Config obj for FB
const firebaseConfig = {
  apiKey: "AIzaSyBVbUajosWuWo6RDhcwarsoFb5vQULdm50",
  authDomain: "shopify-recharge-352914.firebaseapp.com",
  projectId: "shopify-recharge-352914",
  storageBucket: "shopify-recharge-352914.appspot.com",
  messagingSenderId: "282916076195",
  appId: "1:282916076195:web:5f4863d335fd2394ff5d16",
  measurementId: "G-3LFMNFVE5Y"
};
// Initialize Firebase
const app = window.firebase.initializeApp(firebaseConfig);
console.log(window);
console.log(app);

// var formatter = new Intl.NumberFormat('en-US', {
//   style: 'currency',
//   currency: 'USD',

//   // These options are needed to round to whole numbers if that's what you want.
//   //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
//   //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
// });


// export const analytics = window.firebase?.analytics();

// // Create DB
// export const db = window.firebase?.firestore();
// console.log("FB & SHOPIFY INITALIZED", db);

// export async function getCart(FB_UUID)  {
//   console.log("Get Cart", db);

//   let docRef = await db.collection('customers').doc(FB_UUID);

//   if (docRef !== null) {

//     docRef.get().then(doc => {
//       console.log("Doc Ref", doc);
//       if (doc.exists) {
//         const data = doc.data();
//         let html = ``;
//         let totalPrice = 0;
  
//         if (!data.line_items) {
//           console.log("NO CART");
  
//         } else {
//           const ln = data.line_items.length
//           for (let i = 0 ; i < ln ; i++) {
  
//             console.log("Cart Item: ", data.line_items[i].price);
  
//             let price = String(data.line_items[i].price).slice(0, -2);
//             totalPrice = totalPrice +   Number(price);
  
//             price = formatter.format(Number(price));
  
//             console.log("Price: ", price);
//             html = html + `<div class="line_item"><h2 id="title">${data.line_items[i].title}</h2><h2 id="price">${price}</h2></div>`; 
  
//           }
//         }
  
//         html = html + `<div class="total"><h2 id="">Total</h2><h2 id="total_price">${formatter.format(totalPrice)}</h2></div>`
  
//         $(".cart-table").html(html);
  
//         console.log(doc.data())
//         console.log(html)
  
//       } else {
//         $(".cart-table").html(`<div class="total"><h2 id="">Total</h2><h2 id="total_price">$0.000</h2></div>`);

//       }
//     }).catch((error) => {
//       console.log("Error getting document:", error);
//     })

//   } else {
//     console.log("ELSE");
//   }

// };

// if (localStorage.getItem("FB_UUID")) {
//   getCart(localStorage.getItem("FB_UUID"));
// }