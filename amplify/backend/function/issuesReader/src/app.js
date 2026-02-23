/**
 * Issues Reader Lambda
 * Reads issues JSON from S3
 * Requires Firebase authentication token with @redhat.com domain
 */

const express = require('express');
const bodyParser = require('body-parser');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { verifyFirebaseToken } = require('./verifyToken');
const { checkAdmin } = require('./requireAdmin');

const app = express();
app.use(bodyParser.json());
app.use(awsServerlessExpressMiddleware.eventContext());

// Enable CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// AWS Clients
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });

const S3_BUCKET = process.env.S3_BUCKET;

/**
 * Convert S3 stream to string
 */
async function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

/**
 * Read JSON from S3
 */
async function readFromS3(key) {
  if (!S3_BUCKET) {
    throw new Error('S3_BUCKET environment variable is not set');
  }

  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key
    });

    const response = await s3Client.send(command);
    const bodyContents = await streamToString(response.Body);
    return JSON.parse(bodyContents);
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return null; // File doesn't exist
    }
    throw error;
  }
}

/**
 * Write JSON to S3
 */
async function writeToS3(key, data) {
  if (!S3_BUCKET) {
    throw new Error('S3_BUCKET environment variable is not set');
  }

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json'
  });

  await s3Client.send(command);
}

/**
 * GET /issues/:release - Get issues for a specific release
 */
app.get('/issues/:release', async function(req, res) {
  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);

    if (!verification.valid) {
      return res.status(401).json({
        error: verification.error
      });
    }

    const { release } = req.params;

    if (!release) {
      return res.status(400).json({
        error: 'Release parameter is required'
      });
    }

    console.log(`Reading issues for ${release} (user: ${verification.email})`);

    // Read from S3
    const s3Key = `issues-${release}.json`;
    const data = await readFromS3(s3Key);

    res.json(data);

  } catch (error) {
    console.error('Read error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /issues - Get issues (expects release query param)
 */
app.get('/issues', async function(req, res) {
  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);

    if (!verification.valid) {
      return res.status(401).json({
        error: verification.error
      });
    }

    const release = req.query.release;

    if (!release) {
      return res.status(400).json({
        error: 'Release query parameter is required'
      });
    }

    console.log(`Reading issues for ${release} (user: ${verification.email})`);

    // Read from S3
    const s3Key = `issues-${release}.json`;
    const data = await readFromS3(s3Key);

    res.json(data);

  } catch (error) {
    console.error('Read error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /releases - Get list of releases
 */
app.get('/releases', async function(req, res) {
  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);

    if (!verification.valid) {
      return res.status(401).json({
        error: verification.error
      });
    }

    console.log(`Reading releases (user: ${verification.email})`);

    // Read from S3
    const data = await readFromS3('releases.json');

    // If file doesn't exist, return empty array
    if (!data) {
      return res.json({ releases: [] });
    }

    res.json(data);

  } catch (error) {
    console.error('Read releases error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /releases - Save list of releases
 */
app.post('/releases', async function(req, res) {
  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);

    if (!verification.valid) {
      return res.status(401).json({
        error: verification.error
      });
    }

    // Admin check
    const adminResult = await checkAdmin(verification, readFromS3);
    if (!adminResult.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { releases } = req.body;

    if (!releases || !Array.isArray(releases)) {
      return res.status(400).json({
        error: 'Request must include "releases" array'
      });
    }

    console.log(`Saving ${releases.length} releases (user: ${verification.email})`);

    // Write to S3
    await writeToS3('releases.json', { releases });

    res.json({ success: true, releases });

  } catch (error) {
    console.error('Save releases error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /intake - Get intake features
 */
app.get('/intake', async function(req, res) {
  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);

    if (!verification.valid) {
      return res.status(401).json({
        error: verification.error
      });
    }

    console.log(`Reading intake features (user: ${verification.email})`);

    // Read from S3
    const data = await readFromS3('intake-features.json');

    // If file doesn't exist, return empty array
    if (!data) {
      return res.status(500).json({
        error: 'Intake features data not found. Please refresh to fetch data from Jira.'
      });
    }

    res.json(data);

  } catch (error) {
    console.error('Read intake features error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /plan-rankings - Get plan rankings
 */
app.get('/plan-rankings', async function(req, res) {
  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);

    if (!verification.valid) {
      return res.status(401).json({
        error: verification.error
      });
    }

    console.log(`Reading plan rankings (user: ${verification.email})`);

    // Read from S3
    const data = await readFromS3('plan-rankings.json');

    // If file doesn't exist, return empty
    if (!data) {
      return res.status(500).json({
        error: 'Plan rankings data not found. Please refresh to fetch data from Jira.'
      });
    }

    res.json(data);

  } catch (error) {
    console.error('Read plan rankings error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /refresh - Trigger async refresh of Jira data
 */
app.post('/refresh', async function(req, res) {
  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);

    if (!verification.valid) {
      return res.status(401).json({
        error: verification.error
      });
    }

    const { releases } = req.body;

    if (!releases || !Array.isArray(releases) || releases.length === 0) {
      return res.status(400).json({
        error: 'Request must include "releases" array with at least one release'
      });
    }

    console.log(`Refresh request from ${verification.email} for ${releases.length} releases`);

    // Invoke jiraFetcher Lambda asynchronously
    const functionName = `jiraFetcher-${process.env.ENV}`;
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
      Payload: JSON.stringify({ source: 'manual-refresh', releases })
    });

    await lambdaClient.send(command);

    res.status(202).json({ success: true, message: 'Refresh started' });

  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// Hygiene Enforcement endpoints
// ---------------------------------------------------------------------------

/**
 * GET /hygiene/config - Get enforcement rule toggles
 */
app.get('/hygiene/config', async function(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.error });
    }

    console.log(`Reading hygiene config (user: ${verification.email})`);

    const data = await readFromS3('hygiene/config.json');
    if (!data) {
      return res.json({ rules: {} });
    }

    res.json(data);
  } catch (error) {
    console.error('Read hygiene config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /hygiene/config - Save enforcement rule toggles
 */
app.post('/hygiene/config', async function(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.error });
    }

    // Admin check
    const adminResult2 = await checkAdmin(verification, readFromS3);
    if (!adminResult2.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { rules } = req.body;
    if (!rules || typeof rules !== 'object') {
      return res.status(400).json({ error: 'Request must include "rules" object' });
    }

    console.log(`Saving hygiene config (user: ${verification.email})`);

    const config = {
      rules,
      updatedAt: new Date().toISOString(),
      updatedBy: verification.email
    };

    await writeToS3('hygiene/config.json', config);

    res.json({ success: true, ...config });
  } catch (error) {
    console.error('Save hygiene config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /hygiene/pending - Get pending proposals
 */
app.get('/hygiene/pending', async function(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.error });
    }

    console.log(`Reading pending proposals (user: ${verification.email})`);

    const data = await readFromS3('hygiene/pending.json');
    if (!data) {
      return res.json({ proposals: [], lastRunAt: null });
    }

    res.json(data);
  } catch (error) {
    console.error('Read pending proposals error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /hygiene/history - Get enforcement run history
 */
app.get('/hygiene/history', async function(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.error });
    }

    console.log(`Reading hygiene history (user: ${verification.email})`);

    // List history files from S3
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const listCommand = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'hygiene/history/',
      MaxKeys: 50
    });

    const listResponse = await s3Client.send(listCommand);
    const runs = [];

    if (listResponse.Contents) {
      // Sort by key descending (most recent first)
      const sorted = listResponse.Contents
        .filter(obj => obj.Key.endsWith('.json'))
        .sort((a, b) => b.Key.localeCompare(a.Key))
        .slice(0, 20);

      for (const obj of sorted) {
        const data = await readFromS3(obj.Key);
        if (data) runs.push(data);
      }
    }

    res.json({ runs });
  } catch (error) {
    console.error('Read hygiene history error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /hygiene/run - Manually trigger an enforcement evaluation run
 */
app.post('/hygiene/run', async function(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.error });
    }

    // Admin check
    const adminResult3 = await checkAdmin(verification, readFromS3);
    if (!adminResult3.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log(`Manual enforcement run requested (user: ${verification.email})`);

    // Invoke hygieneEnforcer Lambda synchronously
    const functionName = `hygieneEnforcer-${process.env.ENV}`;
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ source: 'manual-run' })
    });

    const lambdaResponse = await lambdaClient.send(command);
    const payload = JSON.parse(Buffer.from(lambdaResponse.Payload).toString());

    if (lambdaResponse.StatusCode !== 200 || payload.statusCode !== 200) {
      const errorBody = typeof payload.body === 'string' ? JSON.parse(payload.body) : payload.body;
      throw new Error(errorBody?.error || 'Failed to run enforcement');
    }

    const result = typeof payload.body === 'string' ? JSON.parse(payload.body) : payload.body;
    res.json(result);
  } catch (error) {
    console.error('Manual enforcement run error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /hygiene/approve - Approve and apply pending proposals
 */
app.post('/hygiene/approve', async function(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.error });
    }

    // Admin check
    const adminResult4 = await checkAdmin(verification, readFromS3);
    if (!adminResult4.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { proposalIds } = req.body;
    if (!proposalIds || !Array.isArray(proposalIds) || proposalIds.length === 0) {
      return res.status(400).json({ error: 'Request must include "proposalIds" array' });
    }

    console.log(`Approving ${proposalIds.length} proposals (user: ${verification.email})`);

    // Invoke hygieneEnforcer Lambda to apply
    const functionName = `hygieneEnforcer-${process.env.ENV}`;
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ source: 'apply-approved', proposalIds })
    });

    const lambdaResponse = await lambdaClient.send(command);
    const payload = JSON.parse(Buffer.from(lambdaResponse.Payload).toString());

    if (lambdaResponse.StatusCode !== 200 || payload.statusCode !== 200) {
      const errorBody = typeof payload.body === 'string' ? JSON.parse(payload.body) : payload.body;
      throw new Error(errorBody?.error || 'Failed to apply proposals');
    }

    const result = typeof payload.body === 'string' ? JSON.parse(payload.body) : payload.body;
    res.json(result);
  } catch (error) {
    console.error('Approve proposals error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /hygiene/dismiss - Dismiss pending proposals
 */
app.post('/hygiene/dismiss', async function(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.error });
    }

    // Admin check
    const adminResult5 = await checkAdmin(verification, readFromS3);
    if (!adminResult5.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { proposalIds } = req.body;
    if (!proposalIds || !Array.isArray(proposalIds) || proposalIds.length === 0) {
      return res.status(400).json({ error: 'Request must include "proposalIds" array' });
    }

    console.log(`Dismissing ${proposalIds.length} proposals (user: ${verification.email})`);

    // Read pending, update status, write back
    const pendingData = await readFromS3('hygiene/pending.json');
    if (!pendingData || !pendingData.proposals) {
      return res.status(404).json({ error: 'No pending proposals found' });
    }

    const dismissed = [];
    for (const proposal of pendingData.proposals) {
      if (proposalIds.includes(proposal.id) && proposal.status === 'pending') {
        proposal.status = 'dismissed';
        proposal.dismissedAt = new Date().toISOString();
        proposal.dismissedBy = verification.email;
        dismissed.push(proposal.id);
      }
    }

    await writeToS3('hygiene/pending.json', pendingData);

    res.json({ success: true, dismissed });
  } catch (error) {
    console.error('Dismiss proposals error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Admin management endpoints
// ---------------------------------------------------------------------------

/**
 * GET /admins - Check admin status and optionally return admin list
 */
app.get('/admins', async function(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.error });
    }

    const adminResult = await checkAdmin(verification, readFromS3);

    // If not admin, just return status (no list)
    if (!adminResult.isAdmin) {
      return res.json({ isAdmin: false });
    }

    // Admin: also return the admin list
    // In dev mode, there may be no admins.json — return empty list
    let admins = adminResult.admins || [];
    if (admins.length === 0 && process.env.ENV !== 'dev') {
      // Auto-seed with default admin
      const seedData = {
        admins: ['acorvin@redhat.com'],
        updatedAt: new Date().toISOString(),
        updatedBy: 'system'
      };
      await writeToS3('admins.json', seedData);
      admins = seedData.admins;
    }

    res.json({ isAdmin: true, admins });
  } catch (error) {
    console.error('Get admin status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /admins - Save admin list (admin-only)
 */
app.post('/admins', async function(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.error });
    }

    const adminResult = await checkAdmin(verification, readFromS3);
    if (!adminResult.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { admins } = req.body;
    if (!admins || !Array.isArray(admins)) {
      return res.status(400).json({ error: 'Request must include "admins" array' });
    }

    // Validate all emails are @redhat.com
    const invalidEmails = admins.filter(email => !email.endsWith('@redhat.com'));
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        error: `Invalid email domain. Only @redhat.com addresses allowed: ${invalidEmails.join(', ')}`
      });
    }

    // Prevent self-removal
    if (!admins.includes(verification.email)) {
      return res.status(400).json({ error: 'You cannot remove yourself from the admin list' });
    }

    console.log(`Saving admin list (${admins.length} admins) by ${verification.email}`);

    const data = {
      admins,
      updatedAt: new Date().toISOString(),
      updatedBy: verification.email
    };

    await writeToS3('admins.json', data);

    res.json({ success: true, ...data });
  } catch (error) {
    console.error('Save admin list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle OPTIONS for CORS preflight
app.options('/refresh', function(req, res) {
  res.status(200).end();
});

app.options('/issues', function(req, res) {
  res.status(200).end();
});

app.options('/issues/*', function(req, res) {
  res.status(200).end();
});

app.options('/releases', function(req, res) {
  res.status(200).end();
});

app.options('/intake', function(req, res) {
  res.status(200).end();
});

app.options('/plan-rankings', function(req, res) {
  res.status(200).end();
});

app.options('/hygiene/*', function(req, res) {
  res.status(200).end();
});

app.options('/admins', function(req, res) {
  res.status(200).end();
});

app.listen(3000, function() {
  console.log("App started");
});

module.exports = app;
