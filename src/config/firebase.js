import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'ai-engineering-jira-tracking.firebaseapp.com',
  projectId: 'ai-engineering-jira-tracking',
  storageBucket: 'ai-engineering-jira-tracking.firebasestorage.app',
  messagingSenderId: '925128969424',
  appId: '1:925128969424:web:6c4b031262bffe2f0da2d5'
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Force account selection on sign-in
googleProvider.setCustomParameters({
  prompt: 'select_account'
})
