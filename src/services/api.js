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
  const { getIdToken, loading, user } = useAuth();

  // Wait for auth initialization to complete
  if (loading.value) {
    await new Promise((resolve) => {
      const checkLoading = setInterval(() => {
        if (!loading.value) {
          clearInterval(checkLoading);
          resolve();
        }
      }, 50);

      // Timeout after 10 seconds to prevent infinite waiting
      setTimeout(() => {
        clearInterval(checkLoading);
        resolve();
      }, 10000);
    });
  }

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

/**
 * Get list of releases from S3
 * @returns {Promise<{releases: Array}>}
 */
export async function getReleases() {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_ENDPOINT}/releases`, {
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

      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get releases error:', error);
    throw error;
  }
}

/**
 * Save list of releases to S3
 * @param {Array<{name: string}>} releases - Array of release objects
 * @returns {Promise<{success: boolean, releases: Array}>}
 */
export async function saveReleases(releases) {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_ENDPOINT}/releases`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ releases })
    });

    if (!response.ok) {
      const errorData = await response.json();

      if (response.status === 401) {
        throw new Error('Authentication failed. Please sign in again.');
      }

      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Save releases error:', error);
    throw error;
  }
}

/**
 * Get all issues across all releases
 * Fetches issues for each release in parallel and deduplicates by issue key
 * @param {Array<{name: string}>} releases - Array of release objects
 * @returns {Promise<{issues: Array, releaseNames: Array<string>}>}
 */
export async function getAllIssues(releases) {
  if (!releases || releases.length === 0) {
    return { issues: [], releaseNames: [] }
  }

  try {
    // Fetch issues for all releases in parallel
    const results = await Promise.allSettled(
      releases.map(release => getIssues(release.name))
    )

    // Collect all issues and deduplicate by key
    const issueMap = new Map()
    const releaseNames = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.issues) {
        releaseNames.push(releases[index].name)
        result.value.issues.forEach(issue => {
          // Keep the first occurrence of each issue (or could merge if needed)
          if (!issueMap.has(issue.key)) {
            issueMap.set(issue.key, issue)
          }
        })
      }
    })

    return {
      issues: Array.from(issueMap.values()),
      releaseNames
    }
  } catch (error) {
    console.error('Get all issues error:', error)
    throw error
  }
}

/**
 * Get intake features from S3
 * @returns {Promise<{lastUpdated: string, features: Array}>}
 */
export async function getIntakeFeatures() {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_ENDPOINT}/intake`, {
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
        throw new Error('No intake data found. Please refresh to fetch data from Jira.');
      }

      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get intake features error:', error);
    throw error;
  }
}
