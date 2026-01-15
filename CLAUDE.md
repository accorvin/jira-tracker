# RHOAI T&E Features-at-a-Glance

Jira issue tracker web app displaying issues as cards on a kanban board.

## Tech Stack
- **Frontend:** Vue 3, Vite, Tailwind CSS
- **Data fetching:** Node.js (integrated via Vite plugin)
- **Testing:** Vitest

## Development Workflow

### Test-Driven Development (TDD)
This project follows strict TDD practices:
1. Write tests BEFORE implementing functionality
2. Run tests to confirm they fail
3. Implement the minimum code to make tests pass
4. Refactor if needed, ensuring tests still pass

### Running Tests

```bash
npm run test        # Run once
npm run test:watch  # Watch mode during development
```

### Running the App

```bash
npm run dev
```

Click the **Refresh** button in the header to fetch fresh data from Jira.

### AWS CLI Commands

**IMPORTANT:** Always prepend AWS and Amplify CLI commands with `AWS_PROFILE=ais`

Examples:
```bash
AWS_PROFILE=ais aws ssm get-parameter --name /jira-tracker-app/dev/jira-token
AWS_PROFILE=ais aws cloudformation describe-stacks
AWS_PROFILE=ais amplify publish
```

## Project Structure
```
├── public/
│   └── redhat-logo.svg
├── src/
│   ├── components/         # Vue components
│   ├── composables/        # Vue composables (useAuth.js)
│   ├── config/             # Configuration (firebase.js)
│   ├── services/           # API client (api.js)
│   ├── utils/              # Utility functions
│   ├── __tests__/          # Component tests
│   ├── App.vue
│   └── main.js
├── amplify/
│   └── backend/
│       ├── function/
│       │   ├── jiraFetcher/    # Lambda: Fetch from Jira -> S3
│       │   └── issuesReader/   # Lambda: Read from S3
│       └── api/
│           └── jiraApi/        # API Gateway configuration
```

## Key Patterns

### Status Mapping (Kanban Columns)
- **To Do:** New, Backlog
- **In Refinement:** Refinement
- **In Progress:** In Progress, Review, Testing
- **Done:** Resolved, Closed

### Custom Field Mapping
Always use human-readable names in the UI and JSON:
- `customfield_12313240` → "Team"
- `customfield_12320840` → "Release Type"
- `customfield_12319940` → "Target Release"

### Jira Configuration
- Host: `https://issues.redhat.com`
- Token: Stored in AWS SSM Parameter Store at `/jira-tracker-app/dev/jira-token`
- Issue URL pattern: `https://issues.redhat.com/browse/{KEY}`

### Jira Query Filters
- Projects: RHAISTRAT, RHOAIENG
- Issue types: Feature, Initiative
- Target version: Selected release (e.g., rhoai-3.2)

Note: All features/initiatives for the project are fetched. Component and team filtering is done on the frontend.

### Frontend Filtering
Users can filter issues by:
- **Team** (multi-select): Filter by the Jira Team field
- **Component** (multi-select): Filter by Jira components (issues can have multiple)
- **Assignee** (single-select): Filter by assigned user
- **Status** (single-select): Filter by issue status
- **Type** (single-select): Filter by issue type (Feature/Initiative)

Filters are:
- Persisted to localStorage (restored on page reload)
- Reflected in URL parameters for shareable links
- URL format: `?teams=Team1,Team2&components=Comp1,Comp2&assignee=Name`

## Testing Conventions

- Test files: `src/__tests__/<ComponentName>.spec.js`
- Use `@vue/test-utils` for component mounting
- Test component rendering, props, events, and user interactions

## Commit Messages
Use Conventional Commits format:
```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`
Scopes: `card`, `board`, `filter`, `fetcher`, `config`

## Styling
- Blue primary color theme
- Tailwind CSS utility classes
- Large, readable cards with all fields visible
- Red Hat logo in header
