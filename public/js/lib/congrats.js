import { getCart } from "./firebase";

const FB_UUID = localStorage("FB_UUID");
import("firebase.js").then(module => {
  module.getCart(FB_UUID);
});