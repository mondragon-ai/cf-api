import "https://js.stripe.com/v3/";

console.log("PUBLIC - LANDING.js");
console.log("PUBLIC - LANDING.js", localStorage);

const stripe = window.Stripe(
  "pk_test_51LCmGyE1N4ioGCdR6UcKcjiZDb8jfZaaDWcIGhdaUCyhcIDBxG9uYzLGFtziZjZ6R6VnSSVEMW8dUZ8IfnwvSSBa0044BHRyL5");

$("#event-two").hide();

let paymentFormElements;

createSession();
checkStatus();

document.querySelector("#order-form")?.addEventListener("submit", handleSubmit);
localStorage.clear();

/**
 * Fetches a payment intent, captures the client secret to create new customer session.
 */
async function createSession() {
  const response = await fetch(
    "https://us-central1-shopify-recharge-352914.cloudfunctions.net/funnelAPI/customers/create-session");
  const { clientSecret, FB_UUID } = await response.json();
  console.log(clientSecret);
  //window.firebase.analytics().logEvent('page_view', { page_location: window.location });

  localStorage.setItem("FB_UUID", "");
  localStorage.removeItem("FB_UUID");
  localStorage.setItem("FB_UUID", FB_UUID);
  localStorage.setItem("clientSecret", clientSecret);
  console.log("PUBLIC - LANDING.js", localStorage);

  const formThemeStyles = {
    theme: "stripe",
  };

  paymentFormElements = stripe.elements({ formThemeStyles, clientSecret});

  const paymentElement = paymentFormElements.create("payment");
  paymentElement.mount("#payment-element");
  console.log("PUBLIC - LANDING.js", localStorage);
}

/**
 * Checks the payment intent status after payment submission.
 * 
 * @returns the payment intent status.
 */
async function checkStatus() {
  const clientSecret = new URLSearchParams(window.location.search)
    .get("payment_intent_client_secret");

  if (!clientSecret) {
    return;
  } // else, client secret was captured, doNothing();

  const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);

  const type = {
    "success": function () {
      return "Payment Successful!";
    },
    "processing": function () {
      return "Your payment is processing...";
    },
    "error": function () {
      return "Your payment was not successful, please try again.";
    },
    "default": function () {
      return "Something went wrong, please try again."
    }
  };
  return (paymentIntent.status[type] || paymentIntent.status["default"])();
}

/**
 * Send customer data to Stripe, Firebase, Shopify after successful user opt-in.
 */
$("#event-one").submit(async function(event) {
  event.preventDefault();
  //window.firebase.analytics.logEvent('add_email');
  const name = $("input").val();
  const email = $("form input[type=email]").val();
  const firebaseId = localStorage.getItem("FB_UUID");
  const data = { 
        email: String(email),
        name: name,
        FB_UUID: String(firebaseId), 
  };

  console.log(email, name, firebaseId);

  if (name &&
      email &&
      firebaseId) {
    $("#entry-button-one").text("Loading...");
    await fetch("https://us-central1-shopify-recharge-352914.cloudfunctions.net/funnelAPI/customers/opt-in", {
          method: "POST",
          body: JSON.stringify(data),
          headers: {
            "Content-Type": "application/json",
          },
    });

    $("#event-two").show();
    $("#event-one").hide();
  } // else, event one (entry form) was not processed, doNothing();

});
//localStorage.clear();

let product = {
  variant_id: 0,
  title: "",
  quantity: 1,
  price: 0, 
};

let hasBumpOffer = true;

$("#product-one").change(function(event) {    
  event.preventDefault();

  $("input:radio[value='{\"name\": \"Bronze Pack - 14 entries\", \"price\": \"$7.00\"}']").prop('checked', true);
  $("input:radio[value='{\"name\": \"Silver Pack - 24 entries\", \"price\": \"$6.00\"}']").prop('checked', false);
  $("input:radio[value='{\"name\": \"Gold Pack - 30 entries\", \"price\": \"$5.00\"}']").prop('checked', false);
  $("input:radio[value='{\"name\": \"Platinum Pack - 40 entries\", \"price\": \"$4.00\"}']").prop('checked', false);

  let radioValue = $("input[name='variant']:checked").val();

  product = {
    variant_id: 41513662578860,
    title: 'Bronze Pack',
    quantity: 1,
    price: 700, 
  }
  console.log('VALUE SELECTED: ', radioValue, product);
});

$("#product-two").change(function(event) {    
  event.preventDefault();

  $("input:radio[value='{\"name\": \"Bronze Pack - 14 entries\", \"price\": \"$7.00\"}']").prop('checked', false);
  $("input:radio[value='{\"name\": \"Silver Pack - 24 entries\", \"price\": \"$6.00\"}']").prop('checked', true);
  $("input:radio[value='{\"name\": \"Gold Pack - 30 entries\", \"price\": \"$5.00\"}']").prop('checked', false);
  $("input:radio[value='{\"name\": \"Platinum Pack - 40 entries\", \"price\": \"$4.00\"}']").prop('checked', false);

  let radioValue = $("input:radio[value='{\"name\": variant']:checked").val();
  
  product = {
    variant_id: 41513667985580,
    title: 'Silver Pack',
    quantity: 1,
    price: 600, 
  }
  console.log('VALUE SELECTED: ', radioValue, product);
});

$("#product-three").change(function(event) {    
  event.preventDefault();

  $("input:radio[value='{\"name\": \"Bronze Pack - 14 entries\", \"price\": \"$7.00\"}']").prop('checked', false);
  $("input:radio[value='{\"name\": \"Silver Pack - 24 entries\", \"price\": \"$6.00\"}']").prop('checked', false);
  $("input:radio[value='{\"name\": \"Gold Pack - 30 entries\", \"price\": \"$5.00\"}']").prop('checked', true);
  $("input:radio[value='{\"name\": \"Platinum Pack - 40 entries\", \"price\": \"$4.00\"}']").prop('checked', false);

  let radioValue = $("input[name='variant']:checked").val();

  product = {
    variant_id: 41513672474796,
    title: 'Gold Pack',
    quantity: 1,
    price: 500, 
  };

  console.log('VALUE SELECTED: ', radioValue, product);
});

$("#product-four").change(function(event) {    
  event.preventDefault();

  $("input:radio[value='{\"name\": \"Bronze Pack - 14 entries\", \"price\": \"$7.00\"}']").prop('checked', false);
  $("input:radio[value='{\"name\": \"Silver Pack - 24 entries\", \"price\": \"$6.00\"}']").prop('checked', false);
  $("input:radio[value='{\"name\": \"Gold Pack - 30 entries\", \"price\": \"$5.00\"}']").prop('checked', false);
  $("input:radio[value='{\"name\": \"Platinum Pack - 40 entries\", \"price\": \"$4.00\"}']").prop('checked', true);

  let radioValue = $("input[name='variant']:checked").val();

  product = {
    variant_id: 41513860300972,
    title: 'Platinum Pack',
    quantity: 1,
    price: 400, 
  };

  console.log('VALUE SELECTED: ', radioValue, product);
});

/**
 * Gets the user selected variant from the form to display the corresponding line item.
 */
$("input[type='radio']").change(async function(event) {
  event.preventDefault();

  // const variant_id = product.variant_id + 1;
    
  const variant = $("input[name='variant']:checked").val();
  const data = await JSON.parse(variant);
  $(".selected-variant-title").text(data.title);
  
  // const quantity = product.quantity;

  $(".selected-variant-price").text(data.price);

  // product = { 
  //   variant_id: variant_id,
  //   title: data.title,
  //   quantity: quantity,
  //   price: data.price, 
  // };
});

/**
 * Toggles the option to apply rush order shipping. Rush order shipping is turned on by default.
 */
$("#rush-order").change(function(event) {
  event.preventDefault();

  let checkedValue = $("input[name='shipping']").is(":checked");
  hasBumpOffer = checkedValue;

  if (!hasBumpOffer) {
    $(".shipping").hide();
  } else {
    $(".shipping").show();
  }
});

/**
 * Create payment intent object to collect credit card information for Stripe, including the address
 * to submit to Stripe, Firebase.
 * 
 * Note: Shopify is NOT modified until '/checkout'.
 * 
 * @param {*} event ignore the default page refresh default.
 */
async function handleSubmit(event) {
  event.preventDefault();
  //window.firebase.analytics().logEvent('add_payment_info');

  let address = {};
  let name = "";

  $("form#order-form input[type=text]").each(function() {
    let input = $(this);
    if ([input.attr('name')] == 'firstName') {
      console.log(input);
      console.log("success!");
      name = input.val();
    } else {
      address = {
        ...address,
        [input.attr('name')]: input.val()
      };
    }
  });

  const shippingAddress = {
    address: address,
    name: name,
  };

  const customerData = { 
    shipping: shippingAddress,
    FB_UUID: localStorage.getItem("FB_UUID"),
    product: product,
    bump: hasBumpOffer, 
  };

  console.log(customerData);

  if (customerData.FB_UUID != "" &&
      customerData.shipping.address != {} &&
      customerData.shipping.name != "") {
      $("#entry-button-two").text("Loading...");
      const response = await fetch("https://us-central1-shopify-recharge-352914.cloudfunctions.net/funnelAPI/customers/update", {
        method: "POST",
        body: JSON.stringify(customerData),
        headers: {
          "Content-Type": "application/json",
        },
      });
      console.log(response);
      // window.firebase.analytics.logEvent('add_payment_info', {
      //   currency: "USD",
      //   value: product.price,
      // });
  } else {
    console.log("NO EMAIL");
  }

  const {error} = await stripe.comfirmSetup({
    paymentFormElements,
    confirmParams: {
      return_url: "http://127.0.0.1:5500/webflow/upsell.html",
    }
  });

  if (error) {
    const messageContainer = document.querySelector("#error-message");
    
    if (messageContainer != undefined) {
      messageContainer.textContent = error.message;
    } // else, messageContainer is undefined, doNothing();

  } // else, activate return URL && doNothing();
};
console.log("started");