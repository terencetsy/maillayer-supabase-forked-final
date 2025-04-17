// src/lib/firebase-admin.js
import * as firebaseAdmin from 'firebase-admin';

// Check if firebase-admin is already initialized to avoid multiple initializations
const admin = firebaseAdmin.apps.length ? firebaseAdmin : firebaseAdmin;

export { admin };
