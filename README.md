# RHOAI T&E Features-at-a-Glance

A secure, serverless Vue 3 web application that displays Jira issues as cards on a kanban board with Firebase authentication and AWS Amplify backend.

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

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- AWS Account with Amplify CLI configured
- Firebase project with Google Auth enabled
- Jira API token

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up Firebase:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Google authentication
   - Add your domain to Authorized domains
   - Copy your Firebase config values

3. Set up AWS Amplify:
```bash
amplify pull --appId YOUR_APP_ID --envName dev
```

4. Create SSM Parameter for Jira token:
```bash
aws ssm put-parameter \
  --name "/jira-tracker-app/dev/jira-token" \
  --description "Jira API token for jira-tracker-app dev environment" \
  --value "YOUR_JIRA_TOKEN" \
  --type "SecureString" \
  --region us-east-1
```

5. Configure non-sensitive parameters in `amplify/backend/function/jiraFetcher/parameters.json`:
   - `jiraHost`: `https://issues.redhat.com`
   - `s3Bucket`: `jira-tracker-issues-dev`
   - `firebaseProjectId`: Your Firebase project ID

6. Deploy the backend:
```bash
amplify push
```

### Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Open http://localhost:5173 in your browser

3. Sign in with your @redhat.com Google account

4. Click the **Refresh** button in the header to fetch data from Jira

### Building for Production

```bash
npm run build
npm run preview
```

### Deploying to AWS Amplify Hosting

```bash
amplify add hosting
amplify publish
```

## Testing

```bash
npm run test        # Run once
npm run test:watch  # Watch mode
```

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
│           ├── jiraFetcher/    # Lambda: Fetch from Jira → S3
│           └── issuesReader/   # Lambda: Read from S3
├── CLAUDE.md                   # Project documentation
└── plan-auth-firebase.md       # Implementation plan
```

## Development

This project follows Test-Driven Development (TDD) practices:
1. Write tests before implementing functionality
2. Run tests to confirm they fail
3. Implement the minimum code to make tests pass
4. Refactor if needed, ensuring tests still pass

## Configuration

### Jira Filters

Edit the Lambda function `amplify/backend/function/jiraFetcher/src/app.js` to customize:
- **Projects**: RHAISTRAT, RHOAIENG
- **Components**: Fine Tuning, KubeRay, Feature Store, Training Ray, Training Kubeflow, AI Pipelines
- **Issue Types**: Feature, Initiative

Target versions are managed per-release in the UI.

### Status Mapping

The kanban board maps Jira statuses to columns:
- **To Do**: New, Backlog
- **In Refinement**: Refinement
- **In Progress**: In Progress, Review, Testing
- **Done**: Resolved, Closed

## Security

- **Authentication**: Firebase Auth with @redhat.com domain restriction
- **Authorization**: Lambda functions verify Firebase ID tokens on every request
- **Secrets**: Jira token stored in AWS Systems Manager Parameter Store (SecureString) with KMS encryption
- **Network**: HTTPS enforced on all endpoints
- **Storage**: S3 bucket accessed only by authenticated Lambda functions
- **Least Privilege**: Lambda execution role has minimal IAM permissions (S3, SSM Parameter Store)

## API Endpoints

**Base URL**: `https://8jez4fgp80.execute-api.us-east-1.amazonaws.com/dev`

### POST /refresh
Fetch issues from Jira and upload to S3.

**Headers**:
- `Authorization: Bearer <firebase-id-token>`
- `Content-Type: application/json`

**Body**:
```json
{
  "releases": [
    { "name": "rhoai-3.2" },
    { "name": "rhoai-3.3" }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "results": [
    { "release": "rhoai-3.2", "count": 42 },
    { "release": "rhoai-3.3", "count": 38 }
  ],
  "totalCount": 80
}
```

### GET /issues/:release
Get issues for a specific release from S3.

**Headers**:
- `Authorization: Bearer <firebase-id-token>`

**Response**:
```json
{
  "lastUpdated": "2025-12-12T19:30:00Z",
  "issues": [...]
}
```

## Troubleshooting

### Authentication Issues
- Ensure you're using a @redhat.com email address
- Check Firebase Console → Authentication → Authorized domains includes your domain
- Clear browser cache and try signing in again

### Refresh Button Not Working
- Check AWS CloudWatch Logs for Lambda errors
- Verify SSM parameter `/jira-tracker-app/dev/jira-token` exists and contains valid token
- Ensure Lambda has SSM and S3 permissions
- Look for "Successfully fetched Jira token from SSM Parameter Store" in CloudWatch logs

### No Data Displaying
- Click the Refresh button first to populate S3
- Check browser console for API errors
- Verify S3 bucket name matches Lambda environment variable

## License

Internal Red Hat project
