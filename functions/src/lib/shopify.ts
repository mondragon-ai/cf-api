import fetch from "node-fetch";

// Admin Headers 
export const HEADERS_ADMIN = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
};

// Create URL
export const URL = "https://shophodgetwins.myshopify.com/admin/api/2022-07/"; 
  

export const shopifyRequest = async (resource: string, method?: string, data?: {}) => {

const response = await fetch(URL + resource, {
  method: method || "POST",
  body:  JSON.stringify(data) ,
  headers: HEADERS_ADMIN
});

  return response;

};
