const awsServerlessExpress = require('aws-serverless-express');
const app = require('./app');

/**
 * @type {import('http').Server}
 */
const server = awsServerlessExpress.createServer(app);

/**
 * Handle scheduled EventBridge refresh
 */
async function handleScheduledRefresh(event, context) {
  const { readFromS3, refreshAllReleases } = require('./app');

  try {
    console.log('Scheduled refresh triggered');

    // Read releases.json from S3
    let releases;
    try {
      releases = await readFromS3('releases.json');
    } catch (error) {
      console.log('No releases.json found in S3 or error reading it, skipping refresh');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No releases to refresh' })
      };
    }

    if (!releases || releases.length === 0) {
      console.log('No releases found in S3, skipping refresh');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No releases to refresh' })
      };
    }

    // Refresh all releases
    const result = await refreshAllReleases(releases);

    console.log(`Scheduled refresh completed: ${result.totalCount} issues across ${result.results.length} releases`);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Scheduled refresh error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event, context) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);

  // Check if invoked by EventBridge (scheduled trigger)
  if (event.source === 'aws.events') {
    return await handleScheduledRefresh(event, context);
  }

  // Otherwise, handle as API Gateway request (existing behavior)
  return awsServerlessExpress.proxy(server, event, context, 'PROMISE').promise;
};
