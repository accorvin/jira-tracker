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

app.listen(3000, function() {
  console.log("App started");
});

module.exports = app;
