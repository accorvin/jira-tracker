/**
 * Admin Authorization Helper
 * Checks if a verified user is in the admin list.
 * In dev environment, all authenticated users are automatically admin.
 */

/**
 * Check if user is an admin
 * @param {Object} verification - Verified token result with { email }
 * @param {Function} readFromS3 - Function to read JSON from S3
 * @returns {Promise<{isAdmin: boolean, admins?: string[]}>}
 */
async function checkAdmin(verification, readFromS3) {
  // Dev environment: all authenticated users are admin
  if (process.env.ENV === 'dev') {
    return { isAdmin: true };
  }

  try {
    const data = await readFromS3('admins.json');

    if (!data || !Array.isArray(data.admins)) {
      return { isAdmin: false };
    }

    const isAdmin = data.admins.includes(verification.email);
    return { isAdmin, admins: isAdmin ? data.admins : undefined };
  } catch (error) {
    console.error('Error checking admin status:', error);
    return { isAdmin: false };
  }
}

module.exports = { checkAdmin };
