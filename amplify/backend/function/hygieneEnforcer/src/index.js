const { runEnforcement, applyApprovedProposals } = require('./app');

/**
 * @type {import('@types/aws-lambda').Handler}
 */
exports.handler = async (event, context) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);

  try {
    if (event.source === 'apply-approved') {
      // Invoked by issuesReader to apply approved proposals
      const { proposalIds } = event;
      if (!proposalIds || !Array.isArray(proposalIds) || proposalIds.length === 0) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'proposalIds array is required' })
        };
      }

      const result = await applyApprovedProposals(proposalIds);
      return {
        statusCode: 200,
        body: JSON.stringify(result)
      };
    }

    // Default: scheduled enforcement run (EventBridge or manual)
    const result = await runEnforcement();
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Enforcement error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
