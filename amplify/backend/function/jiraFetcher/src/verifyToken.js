/**
 * Firebase Token Verification Helper
 * Verifies Firebase ID tokens and ensures @redhat.com domain
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
let firebaseInitialized = false;

function initializeFirebase() {
  if (!firebaseInitialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'ai-engineering-jira-tracking';

    admin.initializeApp({
      projectId: projectId
    });

    firebaseInitialized = true;
    console.log('Firebase Admin initialized with project:', projectId);
  }
}

/**
 * Extract Bearer token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token string or null
 */
function extractToken(authHeader) {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify Firebase ID token and check @redhat.com domain
 * @param {string} authHeader - Authorization header value
 * @returns {Promise<{valid: boolean, email?: string, uid?: string, error?: string}>}
 */
async function verifyFirebaseToken(authHeader) {
  try {
    // Extract token
    const token = extractToken(authHeader);
    if (!token) {
      return {
        valid: false,
        error: 'Missing or invalid Authorization header. Expected: Bearer <token>'
      };
    }

    // Initialize Firebase if needed
    initializeFirebase();

    // Verify token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Check if email exists
    if (!decodedToken.email) {
      return {
        valid: false,
        error: 'Token does not contain email claim'
      };
    }

    // Check @redhat.com domain
    if (!decodedToken.email.endsWith('@redhat.com')) {
      return {
        valid: false,
        error: 'Access denied. Only @redhat.com email addresses are allowed.'
      };
    }

    // Token is valid and user is from correct domain
    return {
      valid: true,
      email: decodedToken.email,
      uid: decodedToken.uid
    };

  } catch (error) {
    console.error('Token verification error:', error);

    // Handle specific Firebase errors
    if (error.code === 'auth/id-token-expired') {
      return {
        valid: false,
        error: 'Token has expired. Please sign in again.'
      };
    }

    if (error.code === 'auth/argument-error') {
      return {
        valid: false,
        error: 'Invalid token format'
      };
    }

    return {
      valid: false,
      error: `Token verification failed: ${error.message}`
    };
  }
}

module.exports = {
  verifyFirebaseToken,
  extractToken
};
