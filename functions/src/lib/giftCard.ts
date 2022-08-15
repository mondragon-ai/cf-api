import fetch from "node-fetch";
import { HEADERS_ADMIN } from "./shopify";
import * as functions from "firebase-functions";

export const giveGiftCard = async (customerID: string) => {

    functions.logger.log("============================================================================================");
    functions.logger.log("                                  6.a SHOPIFY CUSTOMER                                      ");
    functions.logger.log("============================================================================================");
    functions.logger.log("DATA --> ", customerID);
  
    try {
      const resp = await fetch("https://shophodgetwins.myshopify.com/admin/api/2022-07/graphql.json", {
        method: "POST",
        body: JSON.stringify({
          query: "mutation giftCardCreate($input: GiftCardCreateInput!) { giftCardCreate(input: $input) { userErrors { message field } giftCard { id expiresOn note initialValue { amount } customer { id } } giftCardCode } }",
           variables: {
              input: {
                initialValue: "40.00",
                note: "VIP_MEMBER_SUBSCRIPTION",
                customerId: `gid://shopify/Customer/${customerID}`
              }
            }
          }),
        headers: HEADERS_ADMIN
      });
  
      const result =  new Object(resp.json());
  
      functions.logger.log("============================================================================================");
      functions.logger.log("                                  6.a SHOPIFY CUSTOMER                                      ");
      functions.logger.log("============================================================================================");
      functions.logger.log("\n\n\nSHOPIFY CUSTOMER: ", result);
  
      return result;
    } catch {
      return undefined;
    }
  }
  
  