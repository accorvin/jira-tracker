# AI Agent Guidelines

This file provides guidelines for AI agents (Claude Code, Copilot, etc.) working on this codebase.

## Project Overview

This is a Vue 3 + Vite application with an AWS Amplify backend. It displays Jira issues on a kanban board for the RHOAI T&E team.

## Code Style and Patterns

### Vue Components

- Use Vue 3 Composition API with `<script setup>` syntax
- Place components in `src/components/`
- Keep components focused and single-responsibility
- Use props for data flow down, events for communication up

### Testing

**IMPORTANT: This project follows strict Test-Driven Development (TDD)**

1. **Write tests FIRST** - Before implementing any functionality
2. Tests go in `src/__tests__/<ComponentName>.spec.js`
3. Use `@vue/test-utils` for component testing
4. Use `vitest` as the test runner

Example test structure:
```javascript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MyComponent from '../components/MyComponent.vue'

describe('MyComponent', () => {
  it('renders correctly', () => {
    const wrapper = mount(MyComponent, {
      props: { /* ... */ }
    })
    expect(wrapper.text()).toContain('expected text')
  })
})
```

Run tests with:
```bash
npm run test        # Single run
npm run test:watch  # Watch mode
```

### Styling

- Use Tailwind CSS utility classes
- Primary color palette is blue (defined in `tailwind.config.js`)
- Keep styles inline with Tailwind - avoid custom CSS unless necessary

### Lambda Functions

- Lambda code is in `amplify/backend/function/*/src/`
- Each function has its own `package.json` and dependencies
- Test Lambda changes locally before deploying

## AWS Commands

**CRITICAL: Always prefix AWS/Amplify commands with `rh-aws-saml-login iaps-rhods-odh-dev --`**

```bash
# Correct
rh-aws-saml-login iaps-rhods-odh-dev -- amplify push
rh-aws-saml-login iaps-rhods-odh-dev -- aws s3 ls

# Incorrect - will fail or use wrong account
amplify push
aws s3 ls
```

## Git Conventions

### Commit Messages

Use Conventional Commits format:
```
<type>(<scope>): <description>
```

**Types:** `feat`, `fix`, `test`, `refactor`, `docs`, `chore`

**Scopes:** `card`, `board`, `filter`, `fetcher`, `config`, `auth`, `api`

**Examples:**
- `feat(card): add priority badge to issue cards`
- `fix(auth): handle expired Firebase tokens`
- `test(board): add tests for column sorting`
- `refactor(filter): simplify filter state management`

### Branching

- Prefer rebasing over merge commits
- Amend commits when fixing issues rather than adding "fix" commits

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/App.vue` | Main application component |
| `src/components/KanbanBoard.vue` | Primary board view |
| `src/components/IssueCard.vue` | Individual issue card |
| `src/services/api.js` | Backend API client |
| `src/composables/useAuth.js` | Firebase authentication |
| `src/config/firebase.js` | Firebase configuration |
| `amplify/backend/function/jiraFetcher/src/app.js` | Lambda: Jira fetcher |
| `amplify/backend/function/issuesReader/src/app.js` | Lambda: S3 reader |

## Common Tasks

### Adding a New Component

1. Write tests in `src/__tests__/NewComponent.spec.js`
2. Run tests to confirm they fail
3. Create component in `src/components/NewComponent.vue`
4. Implement until tests pass
5. Import and use in parent component

### Modifying Lambda Functions

1. Edit code in `amplify/backend/function/<name>/src/`
2. Test locally if possible
3. Deploy with `rh-aws-saml-login iaps-rhods-odh-dev -- amplify push`
4. Check CloudWatch logs for errors

### Adding New API Endpoints

1. Update Lambda function to handle new route
2. Update `src/services/api.js` with new function
3. Add tests for new functionality
4. Deploy with `rh-aws-saml-login iaps-rhods-odh-dev -- amplify push`

## Things to Avoid

- **Don't** commit sensitive data (tokens, keys, credentials)
- **Don't** modify `amplify/team-provider-info.json` unless intentional
- **Don't** skip tests - TDD is mandatory
- **Don't** forget the `rh-aws-saml-login iaps-rhods-odh-dev --` prefix for AWS commands
- **Don't** add unnecessary dependencies without justification

## Jira Field Mappings

When working with Jira data, use these human-readable names:

| Custom Field ID | Human-Readable Name |
|-----------------|---------------------|
| `customfield_12313240` | Team |
| `customfield_12320840` | Release Type |
| `customfield_12319940` | Target Release |

## Status Mapping (Kanban Columns)

| Column | Jira Statuses |
|--------|---------------|
| To Do | New, Backlog |
| In Refinement | Refinement |
| In Progress | In Progress, Review, Testing |
| Done | Resolved, Closed |
