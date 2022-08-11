// IMPORTS
// ============================================================================================================
import * as functions from "firebase-functions";
import {rest} from "./rest";
import {db} from "./firebase";

//Init Express App
const express = rest(db);
const settings: functions.RuntimeOptions = {
    timeoutSeconds: 60,
    memory: '512MB',
}

// Export API Express app - path/api/{{query}}
export const funnelAPI = functions.runWith(settings).https.onRequest(express);