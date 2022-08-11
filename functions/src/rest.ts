import * as express from "express";
import {routes} from "./routes";

/**
 * Transform the API into something RESTFU. Handle oAuth here. 
 * @param db from Firestre
 */
export const rest = (db: FirebaseFirestore.Firestore): any => {
  const bodyParser = require("body-parser");
  const bearerToken = require("express-bearer-token");
  const app = express();
  const API_PREFIX = "funnelAPI"

//   // Strip API from req
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.url.indexOf(`/${API_PREFIX}/`) == 0) {
        req.url =req.url.substring(API_PREFIX.length + 1)
    }
    next();
  });

  // Parse Bearer Token
  app.use(bearerToken());

  //Parse Query String 
  app.use(bodyParser.urlencoded({ extended: false }));

  // Parse posted JSON body 
  app.use(express.json());

  routes(app,db)

  return app
}