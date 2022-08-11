import * as admin from "firebase-admin"

// Init the app in FB
admin.initializeApp();

// Create DB Instance
const firestoreDB: FirebaseFirestore.Firestore = admin.firestore();
firestoreDB.settings({
    timestampInSnapshot: true
})

// Export DB
export const db = firestoreDB;