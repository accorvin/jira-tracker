import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyBF0oo6lDOxMyc0luiLCSl7z2S8fPqDK8A',
  authDomain: 'ai-engineering-jira-tracking.firebaseapp.com',
  projectId: 'ai-engineering-jira-tracking'
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Force account selection on sign-in
googleProvider.setCustomParameters({
  prompt: 'select_account'
})
