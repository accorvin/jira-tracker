/**
 * Issues Reader Lambda
 * Reads issues JSON from S3
 * Requires Firebase authentication token with @redhat.com domain
 */

const express = require('express');
const bodyParser = require('body-parser');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
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

// S3 Client
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

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
      throw new Error(`Issues file not found: ${key}. Please refresh data first.`);
    }
    throw error;
  }
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

// Handle OPTIONS for CORS preflight
app.options('/issues', function(req, res) {
  res.status(200).end();
});

app.options('/issues/*', function(req, res) {
  res.status(200).end();
});

app.listen(3000, function() {
  console.log("App started");
});

module.exports = app;
