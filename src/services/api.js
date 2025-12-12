/**
 * API Service
 * Handles communication with the Amplify backend
 * Automatically includes Firebase ID token in requests
 */

import { useAuth } from '../composables/useAuth';

const API_ENDPOINT = 'https://8jez4fgp80.execute-api.us-east-1.amazonaws.com/dev';

/**
 * Get Firebase ID token for authentication
 */
async function getAuthToken() {
  const { getIdToken } = useAuth();
  try {
    return await getIdToken();
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw new Error('Authentication required. Please sign in again.');
  }
}

/**
 * Refresh issues from Jira and upload to S3
 * @param {Array<{name: string}>} releases - Array of release objects
 * @returns {Promise<{success: boolean, results: Array, totalCount: number}>}
 */
export async function refreshIssues(releases) {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_ENDPOINT}/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ releases })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Refresh issues error:', error);

    if (error.message.includes('401')) {
      throw new Error('Authentication failed. Please sign in again.');
    }

    throw new Error(error.message || 'Failed to refresh issues');
  }
}

/**
 * Get issues for a specific release from S3
 * @param {string} releaseName - Release name (e.g., 'rhoai-3.2')
 * @returns {Promise<{lastUpdated: string, issues: Array}>}
 */
export async function getIssues(releaseName) {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_ENDPOINT}/issues/${releaseName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();

      if (response.status === 401) {
        throw new Error('Authentication failed. Please sign in again.');
      }

      if (response.status === 500 && errorData.error?.includes('not found')) {
        throw new Error(`No data found for ${releaseName}. Please refresh to fetch data from Jira.`);
      }

      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Get issues error for ${releaseName}:`, error);
    throw error;
  }
}
