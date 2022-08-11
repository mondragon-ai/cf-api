// IMPORTS
// ============================================================================================================
import {app} from "./api";
import * as express from "express";
import { updateCustomerDoc } from "../lib/firestore";

// ROUTES
// ============================================================================================================
app.post("/firebase/addEmail", async (req: express.Request, res: express.Response) => {
  const {FB_UUID, email, name} = req.body;
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
})
