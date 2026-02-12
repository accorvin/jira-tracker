# RHOAI T&E Features-at-a-Glance

A secure, serverless Vue 3 web application that displays Jira issues as cards on a kanban board with Firebase authentication and AWS Amplify backend.

---

## Quick Start

Get the UI running locally in 4 steps:

```bash
# 1. Clone and install
git clone git@github.com:accorvin/jira-tracker.git
cd jira-tracker
npm install

# 2. Pull AWS backend config (requires AWS credentials - see Full Setup below)
rh-aws-saml-login iaps-rhods-odh-dev -- amplify pull --appId db8qbfhkw24dz --envName dev

# 3. Start the dev server
npm run dev

# 4. Open http://localhost:5173 and sign in with your @redhat.com Google account
```

> **First time?** You'll need AWS credentials configured first. See [Full Setup Guide](#new-developer-setup) below.

---

## Features

- **Secure Authentication**: Firebase Auth with Google OAuth, restricted to @redhat.com emails
- **Kanban Board View**: Issues organized in 4 columns (To Do, In Refinement, In Progress, Done)
- **Rich Issue Cards**: Display all key fields including assignee, team, release type, and target release
- **Filtering**: Filter by assignee, status, team, and issue type
- **Multi-Release Support**: Manage and view multiple releases (e.g., rhoai-3.2, rhoai-3.3)
- **On-Demand Refresh**: Click the Refresh button to fetch latest data from Jira
- **Serverless Backend**: AWS Lambda functions with S3 storage
- **Responsive Design**: Works on desktop and mobile devices

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Vue 3 SPA     │─────▶│  Firebase Auth   │      │                 │
│  (Local/Cloud)  │      │  (Google OAuth)  │      │                 │
└────────┬────────┘      └──────────────────┘      │                 │
         │                                          │   Jira API      │
         │ ID Token                                 │                 │
         ▼                                          │                 │
┌─────────────────┐      ┌──────────────────┐      │                 │
│ AWS API Gateway │─────▶│  Lambda          │──────┤                 │
│   (REST API)    │      │  (Jira Fetcher)  │      └─────────────────┘
└─────────────────┘      └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │       S3         │
                         │  (issues.json)   │
                         └──────────────────┘
```

## Tech Stack

- **Frontend**: Vue 3, Vite, Tailwind CSS
- **Authentication**: Firebase Auth (Google OAuth)
- **Backend**: AWS Lambda, API Gateway, S3
- **Infrastructure**: AWS Amplify CLI
- **Testing**: Vitest

---

## New Developer Setup

This section provides step-by-step instructions for setting up the project from scratch on macOS.

### Prerequisites

You'll need the following tools and access:

| Requirement | Description |
|-------------|-------------|
| **Homebrew** | macOS package manager |
| **Node.js 18+** | JavaScript runtime (developed with v23.9.0) |
| **AWS CLI** | Amazon Web Services command line |
| **Amplify CLI** | AWS Amplify deployment tool |
| **Git** | Version control |
| **@redhat.com email** | Required for Firebase authentication |
| **Red Hat Jira access** | Access to issues.redhat.com |

### Step 1: Install Required Tools

If you don't have these tools installed, run:

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js (v18 or higher required, v23+ recommended)
brew install node

# Verify Node version
node --version  # Should be v18.x or higher

# Install AWS CLI
brew install awscli

# Install Amplify CLI globally
npm install -g @aws-amplify/cli
```

### Step 2: Configure AWS Credentials

This project uses `rh-aws-saml-login` for AWS authentication. All AWS and Amplify CLI commands must be prefixed with `rh-aws-saml-login iaps-rhods-odh-dev --`.

Verify it works:

```bash
rh-aws-saml-login iaps-rhods-odh-dev -- aws sts get-caller-identity
```

> **IMPORTANT**: All AWS and Amplify commands in this project MUST be prefixed with `rh-aws-saml-login iaps-rhods-odh-dev --`

### Step 3: Clone and Install

```bash
# Clone the repository
git clone git@github.com:accorvin/jira-tracker.git
cd jira-tracker

# Install dependencies
npm install
```

### Step 4: Pull Amplify Backend Configuration

This downloads the AWS backend configuration to your local machine:

```bash
rh-aws-saml-login iaps-rhods-odh-dev -- amplify pull --appId db8qbfhkw24dz --envName dev
```

When prompted:
- Choose your default editor
- Accept defaults for build settings (or customize)
- Choose "Yes" to modify the backend

This creates `src/aws-exports.js` and `src/amplifyconfiguration.json` (both gitignored).

### Step 5: S3 Bucket (No Action Needed)

The Lambda functions store Jira data in a shared S3 bucket (`acorvin-jira-tracker-issues-dev`). This is configured in `amplify/backend/function/jiraFetcher/parameters.json`.

**Important**: All developers and the deployed application share this same bucket. When you click Refresh in the app, it updates data for everyone.

> **Note**: The bucket name is currently hardcoded. If you need to change it (e.g., for a separate environment), coordinate with the team first - running `amplify push` with a different bucket would affect all users of the deployed app.

### Step 6: Jira API Token

The Lambda function needs a Jira API token to fetch issues. Check if one already exists:

```bash
rh-aws-saml-login iaps-rhods-odh-dev -- aws ssm get-parameter \
  --name "/jira-tracker-app/dev/jira-token" \
  --with-decryption \
  --region us-east-1
```

If it doesn't exist (or you need your own), create one:

1. Go to https://issues.redhat.com/secure/ViewProfile.jspa
2. Click **Personal Access Tokens** in the left sidebar
3. Create a new token with appropriate permissions
4. Store it in AWS SSM:

```bash
rh-aws-saml-login iaps-rhods-odh-dev -- aws ssm put-parameter \
  --name "/jira-tracker-app/dev/jira-token" \
  --description "Jira API token for jira-tracker-app dev environment" \
  --value "YOUR_JIRA_TOKEN" \
  --type "SecureString" \
  --region us-east-1
```

### Step 7: Run the Application

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

1. Sign in with your @redhat.com Google account
2. Click the **Refresh** button in the header to fetch data from Jira

---

## Important Notes

### Dev vs Production Backend

When running locally (`npm run dev`), the frontend connects to the **production API Gateway endpoint** (`https://8jez4fgp80.execute-api.us-east-1.amazonaws.com/dev`). This means:

- Local development uses the same Lambda functions as the deployed app
- Data refreshed locally affects the production S3 bucket
- There is no separate "local-only" backend

This is intentional - the backend is serverless and doesn't need local hosting.

### AWS Authentication Requirement

**ALWAYS** prefix AWS and Amplify commands with `rh-aws-saml-login iaps-rhods-odh-dev --`:

```bash
# Correct
rh-aws-saml-login iaps-rhods-odh-dev -- amplify push
rh-aws-saml-login iaps-rhods-odh-dev -- aws s3 ls

# Incorrect - will use wrong AWS account
amplify push
aws s3 ls
```

---

## Development

### Running Tests

```bash
npm run test        # Run once
npm run test:watch  # Watch mode
```

### Test-Driven Development (TDD)

This project follows TDD practices:
1. Write tests before implementing functionality
2. Run tests to confirm they fail
3. Implement the minimum code to make tests pass
4. Refactor if needed, ensuring tests still pass

### Building for Production

```bash
npm run build
npm run preview
```

### Deploying to AWS Amplify Hosting

```bash
rh-aws-saml-login iaps-rhods-odh-dev -- amplify publish
```

---

## Project Structure

```
├── public/
│   └── redhat-logo.svg
├── src/
│   ├── components/         # Vue components
│   │   ├── AuthGuard.vue   # Authentication wrapper
│   │   ├── IssueCard.vue
│   │   ├── KanbanColumn.vue
│   │   ├── KanbanBoard.vue
│   │   ├── FilterBar.vue
│   │   └── ReleaseTabBar.vue
│   ├── composables/
│   │   └── useAuth.js      # Firebase auth composable
│   ├── config/
│   │   └── firebase.js     # Firebase configuration
│   ├── services/
│   │   └── api.js          # API client for Lambda
│   ├── __tests__/          # Component tests
│   ├── App.vue
│   └── main.js
├── amplify/
│   └── backend/
│       └── function/
│           ├── jiraFetcher/    # Lambda: Fetch from Jira -> S3
│           └── issuesReader/   # Lambda: Read from S3
├── CLAUDE.md                   # AI assistant instructions
└── .env.example                # Configuration documentation
```

---

## Configuration

### Jira Filters

Edit `amplify/backend/function/jiraFetcher/src/app.js` to customize:
- **Projects**: RHAISTRAT, RHOAIENG
- **Components**: Fine Tuning, KubeRay, Feature Store, Training Ray, Training Kubeflow, AI Pipelines
- **Issue Types**: Feature, Initiative

### Status Mapping

The kanban board maps Jira statuses to columns:
- **To Do**: New, Backlog
- **In Refinement**: Refinement
- **In Progress**: In Progress, Review, Testing
- **Done**: Resolved, Closed

---

## Security

- **Authentication**: Firebase Auth with @redhat.com domain restriction
- **Authorization**: Lambda functions verify Firebase ID tokens on every request
- **Secrets**: Jira token stored in AWS Systems Manager Parameter Store (SecureString) with KMS encryption
- **Network**: HTTPS enforced on all endpoints
- **Storage**: S3 bucket accessed only by authenticated Lambda functions
- **Least Privilege**: Lambda execution role has minimal IAM permissions

---

## API Endpoints

**Base URL**: `https://8jez4fgp80.execute-api.us-east-1.amazonaws.com/dev`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /refresh | Fetch issues from Jira and upload to S3 |
| GET | /issues/:release | Get issues for a specific release |
| GET | /releases | Get list of configured releases |
| POST | /releases | Save list of releases |
| GET | /intake | Get intake features |

All endpoints require `Authorization: Bearer <firebase-id-token>` header.

---

## Troubleshooting

### "Command not found: amplify"

```bash
npm install -g @aws-amplify/cli
```

### "amplify pull" fails with authentication error

Ensure your AWS credentials are valid:
```bash
rh-aws-saml-login iaps-rhods-odh-dev -- aws sts get-caller-identity
```

### Authentication Issues
- Ensure you're using a @redhat.com email address
- Check Firebase Console -> Authentication -> Authorized domains
- Clear browser cache and try signing in again

### Refresh Button Not Working
- Check AWS CloudWatch Logs for Lambda errors
- Verify SSM parameter `/jira-tracker-app/dev/jira-token` exists
- Ensure Lambda has SSM and S3 permissions

### No Data Displaying
- Click the Refresh button first to populate S3
- Check browser console for API errors
- Verify S3 bucket name matches Lambda configuration

### Node Version Issues

Ensure you have Node.js v18 or higher:
```bash
node --version  # Should be v18.x or higher
```

---

## Using Claude Code

This project is configured for AI-assisted development with Claude Code. See:

- **CLAUDE.md**: Project-specific instructions and patterns
- **AGENTS.md**: Guidelines for AI agent behavior

When using Claude Code, it will automatically follow the TDD practices and coding conventions defined in these files.

---

## License

Internal Red Hat project
