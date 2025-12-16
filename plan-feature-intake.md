# Feature Intake Implementation Plan

This document provides a complete implementation plan for adding a "Feature Intake" view to the RHOAI T&E Features-at-a-Glance application. This feature helps identify approved RFEs that are ready for planning.

## Background & Context

### Current State
- The app has a "Release Tracking" view showing features assigned to specific releases on a kanban board
- Data is fetched from Jira (projects RHAISTRAT, RHOAIENG) via AWS Lambda and stored in S3
- The app uses Vue 3, Vite, Tailwind CSS, and Firebase authentication

### New Feature Overview
Add a second top-level navigation tab called "Feature Intake" that shows:
- Features in "New" status
- That are linked (via "clones" link type) to approved RFEs
- That do NOT yet have a target release set
- Grouped by team, with RICE score prioritization

### RFE Flow
1. PM creates RFE in RHAIRFE project (issue type: "Feature Request")
2. Engineering reviews and approves RFE (status changes to "Approved")
3. RFE is cloned to create a Feature in RHAISTRAT/RHOAIENG
4. Feature gets RICE scored (collaborative PM + engineering)
5. Feature gets planned and assigned to a release (appears on Release Tracking)

---

## Phase 1: Navigation & Routing Infrastructure

### Task 1.1: Create TopNav Component

**File:** `src/components/TopNav.vue`

**Purpose:** Two-tab navigation between "Release Tracking" and "Feature Intake"

**Implementation:**
```vue
<template>
  <nav class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-6">
      <div class="flex space-x-8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="$emit('view-change', tab.id)"
          class="py-4 px-1 border-b-2 font-medium text-sm transition-colors"
          :class="currentView === tab.id
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup>
defineProps({
  currentView: {
    type: String,
    required: true
  }
})

defineEmits(['view-change'])

const tabs = [
  { id: 'release-tracking', label: 'Release Tracking' },
  { id: 'feature-intake', label: 'Feature Intake' }
]
</script>
```

**Tests:** `src/__tests__/TopNav.spec.js`
- Renders both tabs
- Highlights active tab based on `currentView` prop
- Emits `view-change` event with correct tab id when clicked

### Task 1.2: Update App.vue for View Switching

**File:** `src/App.vue`

**Changes:**
1. Add `currentView` to data (default: `'release-tracking'`)
2. Import and add `TopNav` component after header
3. Add method `handleViewChange(view)` to update `currentView`
4. Conditionally render existing content (ReleaseTabBar, main content) only when `currentView === 'release-tracking'`
5. Add placeholder for `IntakeView` when `currentView === 'feature-intake'`

**Location in template:** Insert TopNav between `</header>` and `<ReleaseTabBar>`

```vue
<TopNav
  :currentView="currentView"
  @view-change="handleViewChange"
/>

<!-- Show Release Tracking content -->
<template v-if="currentView === 'release-tracking'">
  <ReleaseTabBar ... />
  <main class="flex">
    ...existing content...
  </main>
</template>

<!-- Show Feature Intake content -->
<template v-else-if="currentView === 'feature-intake'">
  <IntakeView
    :isRefreshing="isRefreshing"
    @refresh="refreshData"
  />
</template>
```

---

## Phase 2: Data Layer Updates

### Task 2.1: Add Custom Field Mappings

**File:** `amplify/backend/function/jiraFetcher/src/app.js`

**Add to CUSTOM_FIELDS object:**
```javascript
const CUSTOM_FIELDS = {
  // existing fields...
  team: 'customfield_12313240',
  releaseType: 'customfield_12320840',
  targetRelease: 'customfield_12319940',
  statusSummary: 'customfield_12320841',
  colorStatus: 'customfield_12320845',
  // NEW: RICE scoring fields
  reach: 'customfield_12320846',
  impact: 'customfield_12320740',
  confidence: 'customfield_12320847',
  effort: 'customfield_12320848',
  riceScore: 'customfield_12326242'
};
```

### Task 2.2: Create RFE Fetcher Function

**File:** `amplify/backend/function/jiraFetcher/src/app.js`

**Add new function to fetch approved RFEs:**

```javascript
/**
 * Build JQL query for approved RFEs
 */
function buildRfeJqlQuery() {
  const projectFilter = 'project = RHAIRFE';
  const issueTypeFilter = 'issuetype = "Feature Request"';
  const statusFilter = 'status = Approved';
  const componentFilter = `component IN (${COMPONENTS.map(c => `'${c}'`).join(', ')})`;

  return `${projectFilter} AND ${issueTypeFilter} AND ${statusFilter} AND ${componentFilter}`;
}

/**
 * Fetch approved RFEs from Jira
 * Returns map of RFE key -> RFE data for quick lookup
 */
async function fetchApprovedRfes() {
  const jiraToken = await getJiraToken();
  const jql = buildRfeJqlQuery();

  const fields = ['key', 'summary', 'status', 'components'].join(',');
  const rfes = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const url = new URL(`${JIRA_HOST}/rest/api/2/search`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('startAt', startAt.toString());
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('fields', fields);
    url.searchParams.set('expand', 'changelog');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${jiraToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API error fetching RFEs (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.issues || data.issues.length === 0) break;
    rfes.push(...data.issues);
    if (data.issues.length < maxResults) break;
    startAt += maxResults;
  }

  // Transform to map for quick lookup
  const rfeMap = {};
  for (const rfe of rfes) {
    rfeMap[rfe.key] = {
      key: rfe.key,
      title: rfe.fields.summary,
      approvalDate: getApprovalDateFromChangelog(rfe),
      status: rfe.fields.status?.name
    };
  }

  return rfeMap;
}

/**
 * Get the date when RFE status changed to "Approved"
 */
function getApprovalDateFromChangelog(issue) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null;
  }

  // Iterate in reverse to find most recent transition TO "Approved"
  const histories = [...issue.changelog.histories].reverse();
  for (const history of histories) {
    for (const item of history.items) {
      if (item.field === 'status' && item.toString === 'Approved') {
        let timestamp = history.created;
        if (timestamp.includes('+')) {
          timestamp = timestamp.split('.')[0] + 'Z';
        } else if (timestamp.includes('T') && timestamp.length > 19) {
          timestamp = timestamp.substring(0, 19) + 'Z';
        }
        return timestamp;
      }
    }
  }

  return null;
}
```

### Task 2.3: Create Intake Features Fetcher

**File:** `amplify/backend/function/jiraFetcher/src/app.js`

**Add function to fetch Features in "New" status with no target release:**

```javascript
/**
 * Build JQL query for intake features (New status, no target release)
 */
function buildIntakeFeaturesJqlQuery() {
  const projectFilter = `project IN (${PROJECTS.join(', ')})`;
  const componentFilter = `component IN (${COMPONENTS.map(c => `'${c}'`).join(', ')})`;
  const issueTypeFilter = `issuetype IN (${ISSUE_TYPES.join(', ')})`;
  const statusFilter = 'status = New';
  const noTargetRelease = '"Target Version" IS EMPTY';

  return `${projectFilter} AND ${componentFilter} AND ${issueTypeFilter} AND ${statusFilter} AND ${noTargetRelease}`;
}

/**
 * Fetch intake features from Jira with issue links
 */
async function fetchIntakeFeatures() {
  const jiraToken = await getJiraToken();
  const jql = buildIntakeFeaturesJqlQuery();

  const fields = [
    'key', 'summary', 'issuetype', 'assignee', 'status', 'created', 'issuelinks',
    CUSTOM_FIELDS.team,
    CUSTOM_FIELDS.releaseType,
    CUSTOM_FIELDS.targetRelease,
    CUSTOM_FIELDS.reach,
    CUSTOM_FIELDS.impact,
    CUSTOM_FIELDS.confidence,
    CUSTOM_FIELDS.effort,
    CUSTOM_FIELDS.riceScore
  ].join(',');

  const issues = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const url = new URL(`${JIRA_HOST}/rest/api/2/search`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('startAt', startAt.toString());
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('fields', fields);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${jiraToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API error fetching intake features (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.issues || data.issues.length === 0) break;
    issues.push(...data.issues);
    if (data.issues.length < maxResults) break;
    startAt += maxResults;
  }

  return issues;
}

/**
 * Get "clones" links from a feature (links to RFEs)
 */
function getClonesLinks(issue) {
  if (!issue.fields.issuelinks) return [];

  return issue.fields.issuelinks
    .filter(link => {
      // "clones" link type - the Feature clones the RFE
      // So we look for outwardIssue with type name "Cloners" or similar
      // The link type name is typically "Cloners" and relation is "clones"
      return link.type &&
             link.type.outward === 'clones' &&
             link.outwardIssue;
    })
    .map(link => link.outwardIssue.key);
}

/**
 * Compute RICE status for a feature
 * @returns 'complete' | 'partial' | 'none'
 */
function computeRiceStatus(fields) {
  const reach = fields[CUSTOM_FIELDS.reach];
  const impact = fields[CUSTOM_FIELDS.impact];
  const confidence = fields[CUSTOM_FIELDS.confidence];
  const effort = fields[CUSTOM_FIELDS.effort];

  const filledCount = [reach, impact, confidence, effort].filter(v => v != null).length;

  if (filledCount === 4) return 'complete';
  if (filledCount > 0) return 'partial';
  return 'none';
}

/**
 * Transform a feature for the intake view
 */
function transformIntakeFeature(issue, rfeMap) {
  const fields = issue.fields;
  const clonesLinks = getClonesLinks(issue);

  // Find linked RFE info
  let linkedRfe = null;
  for (const rfeKey of clonesLinks) {
    if (rfeMap[rfeKey]) {
      linkedRfe = rfeMap[rfeKey];
      break; // Use first matching approved RFE
    }
  }

  // Get component (first one)
  const component = fields.components && fields.components.length > 0
    ? fields.components[0].name
    : null;

  return {
    key: issue.key,
    title: fields.summary,
    issueType: fields.issuetype?.name || null,
    assignee: fields.assignee?.displayName || null,
    status: fields.status?.name || null,
    component: component,
    team: serializeField(fields[CUSTOM_FIELDS.team]),
    reach: fields[CUSTOM_FIELDS.reach],
    impact: fields[CUSTOM_FIELDS.impact],
    confidence: fields[CUSTOM_FIELDS.confidence],
    effort: fields[CUSTOM_FIELDS.effort],
    riceScore: fields[CUSTOM_FIELDS.riceScore],
    riceStatus: computeRiceStatus(fields),
    linkedRfe: linkedRfe,
    url: `https://issues.redhat.com/browse/${issue.key}`
  };
}
```

### Task 2.4: Create Intake Refresh Endpoint

**File:** `amplify/backend/function/jiraFetcher/src/app.js`

**Add function and integrate with existing refresh:**

```javascript
/**
 * Refresh intake features data
 */
async function refreshIntakeFeatures() {
  console.log('Fetching approved RFEs...');
  const rfeMap = await fetchApprovedRfes();
  console.log(`Found ${Object.keys(rfeMap).length} approved RFEs`);

  console.log('Fetching intake features...');
  const rawFeatures = await fetchIntakeFeatures();
  console.log(`Found ${rawFeatures.length} features in New status`);

  // Transform and filter to only features linked to approved RFEs
  const intakeFeatures = rawFeatures
    .map(issue => transformIntakeFeature(issue, rfeMap))
    .filter(feature => feature.linkedRfe !== null);

  console.log(`${intakeFeatures.length} features linked to approved RFEs`);

  const output = {
    lastUpdated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    features: intakeFeatures
  };

  await uploadToS3('intake-features.json', output);

  return { count: intakeFeatures.length };
}

/**
 * Update refreshAllReleases to also refresh intake
 */
async function refreshAllReleases(releases) {
  const results = [];

  // Existing release refresh logic...
  for (const release of releases) {
    // ... existing code ...
  }

  // Also refresh intake features
  try {
    const intakeResult = await refreshIntakeFeatures();
    results.push({
      release: 'intake',
      count: intakeResult.count
    });
  } catch (error) {
    console.error('Error refreshing intake features:', error);
    results.push({
      release: 'intake',
      count: 0,
      error: error.message
    });
  }

  const allSucceeded = results.every(r => !r.error);
  const totalCount = results.reduce((sum, r) => sum + r.count, 0);

  return { success: allSucceeded, results, totalCount };
}
```

### Task 2.5: Add Intake API Endpoint

**File:** `src/services/api.js`

**Add new function:**

```javascript
/**
 * Get intake features from S3
 * @returns {Promise<{lastUpdated: string, features: Array}>}
 */
export async function getIntakeFeatures() {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_ENDPOINT}/intake`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();

      if (response.status === 401) {
        throw new Error('Authentication failed. Please sign in again.');
      }

      if (response.status === 500 && errorData.error?.includes('not found')) {
        throw new Error('No intake data found. Please refresh to fetch data from Jira.');
      }

      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get intake features error:', error);
    throw error;
  }
}
```

### Task 2.6: Add Lambda Endpoint for Intake Data

**File:** `amplify/backend/function/issuesReader/src/app.js` (or wherever GET endpoints are)

**Add endpoint:**
```javascript
app.get('/intake', async function(req, res) {
  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);

    if (!verification.valid) {
      return res.status(401).json({ error: verification.error });
    }

    const data = await readFromS3('intake-features.json');
    res.json(data);
  } catch (error) {
    console.error('Error reading intake features:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## Phase 3: Feature Intake Components

### Task 3.1: Create IntakeView Component

**File:** `src/components/IntakeView.vue`

**Purpose:** Main container for the Feature Intake page

```vue
<template>
  <main class="container mx-auto px-6 py-8">
    <!-- Filters -->
    <div class="mb-6 flex gap-4">
      <select
        v-model="teamFilter"
        class="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm"
      >
        <option value="">All Teams</option>
        <option v-for="team in availableTeams" :key="team" :value="team">
          {{ team }}
        </option>
      </select>

      <select
        v-model="componentFilter"
        class="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm"
      >
        <option value="">All Components</option>
        <option v-for="comp in availableComponents" :key="comp" :value="comp">
          {{ comp }}
        </option>
      </select>
    </div>

    <!-- Last Updated -->
    <div v-if="lastUpdated" class="mb-4 text-sm text-gray-500">
      Last Updated: {{ formatDate(lastUpdated) }}
    </div>

    <!-- Team Sections (draggable) -->
    <draggable
      v-model="orderedTeams"
      item-key="name"
      handle=".drag-handle"
      @end="saveGroupOrder"
    >
      <template #item="{ element: team }">
        <TeamSection
          v-if="shouldShowTeam(team.name)"
          :teamName="team.name"
          :features="getFeaturesForTeam(team.name)"
          :isNextUpTeam="isNextUpTeam(team.name)"
          class="mb-6"
        />
      </template>
    </draggable>

    <!-- Empty state -->
    <div v-if="filteredFeatures.length === 0" class="text-center py-12 text-gray-500">
      <p class="text-lg">No features awaiting intake.</p>
      <p>All caught up!</p>
    </div>

    <LoadingOverlay v-if="isLoading" />
  </main>
</template>

<script>
import draggable from 'vuedraggable'
import TeamSection from './TeamSection.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import { getIntakeFeatures } from '../services/api'

const STORAGE_KEY = 'feature-intake-group-order'

export default {
  name: 'IntakeView',
  components: {
    draggable,
    TeamSection,
    LoadingOverlay
  },
  props: {
    isRefreshing: Boolean
  },
  data() {
    return {
      features: [],
      lastUpdated: null,
      isLoading: false,
      teamFilter: '',
      componentFilter: '',
      orderedTeams: []
    }
  },
  computed: {
    filteredFeatures() {
      return this.features.filter(f => {
        if (this.teamFilter && f.team !== this.teamFilter) return false
        if (this.componentFilter && f.component !== this.componentFilter) return false
        return true
      })
    },
    availableTeams() {
      const teams = new Set(this.features.map(f => f.team).filter(Boolean))
      return [...teams].sort()
    },
    availableComponents() {
      const components = new Set(this.features.map(f => f.component).filter(Boolean))
      return [...components].sort()
    }
  },
  watch: {
    isRefreshing(newVal, oldVal) {
      // Reload data after refresh completes
      if (oldVal && !newVal) {
        this.loadFeatures()
      }
    }
  },
  mounted() {
    this.loadFeatures()
    this.loadGroupOrder()
  },
  methods: {
    async loadFeatures() {
      this.isLoading = true
      try {
        const data = await getIntakeFeatures()
        this.features = data.features
        this.lastUpdated = data.lastUpdated
        this.updateTeamsList()
      } catch (error) {
        console.error('Failed to load intake features:', error)
      } finally {
        this.isLoading = false
      }
    },
    updateTeamsList() {
      // Get all unique teams, putting "Unassigned" first
      const teams = new Set()
      teams.add(null) // Unassigned team
      this.features.forEach(f => teams.add(f.team))

      const savedOrder = this.getSavedOrder()
      const teamObjects = [...teams].map(t => ({
        name: t,
        displayName: t || 'Unassigned Team'
      }))

      // Sort by saved order, with new teams at end
      if (savedOrder.length > 0) {
        teamObjects.sort((a, b) => {
          const aIndex = savedOrder.indexOf(a.name)
          const bIndex = savedOrder.indexOf(b.name)
          if (aIndex === -1 && bIndex === -1) return 0
          if (aIndex === -1) return 1
          if (bIndex === -1) return 1
          return aIndex - bIndex
        })
      } else {
        // Default: Unassigned first, then alphabetical
        teamObjects.sort((a, b) => {
          if (a.name === null) return -1
          if (b.name === null) return 1
          return (a.name || '').localeCompare(b.name || '')
        })
      }

      this.orderedTeams = teamObjects
    },
    getFeaturesForTeam(teamName) {
      return this.filteredFeatures
        .filter(f => f.team === teamName)
        .sort((a, b) => {
          // Sort by RICE score descending, nulls last
          if (a.riceScore == null && b.riceScore == null) return 0
          if (a.riceScore == null) return 1
          if (b.riceScore == null) return -1
          return b.riceScore - a.riceScore
        })
    },
    shouldShowTeam(teamName) {
      return this.getFeaturesForTeam(teamName).length > 0
    },
    isNextUpTeam(teamName) {
      const features = this.getFeaturesForTeam(teamName)
      return features.length > 0 && features[0].riceStatus === 'complete'
    },
    formatDate(dateString) {
      return new Date(dateString).toLocaleString()
    },
    getSavedOrder() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    },
    saveGroupOrder() {
      const order = this.orderedTeams.map(t => t.name)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
    },
    loadGroupOrder() {
      // Order is applied in updateTeamsList
    }
  }
}
</script>
```

**Tests:** `src/__tests__/IntakeView.spec.js`
- Renders features grouped by team
- Filters work correctly
- Shows empty state when no features
- Persists group order to localStorage

### Task 3.2: Create TeamSection Component

**File:** `src/components/TeamSection.vue`

**Purpose:** Collapsible team section with health indicator

```vue
<template>
  <div class="team-section bg-white rounded-lg shadow">
    <!-- Header -->
    <div
      class="flex items-center justify-between p-4 cursor-pointer border-b"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-3">
        <!-- Drag handle -->
        <div class="drag-handle cursor-grab text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
          </svg>
        </div>

        <!-- Team name -->
        <h3 class="text-lg font-semibold text-gray-900">
          {{ displayName }}
        </h3>

        <!-- Count badge -->
        <span class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
          {{ features.length }}
        </span>
      </div>

      <div class="flex items-center gap-3">
        <!-- Health indicator -->
        <div
          class="w-3 h-3 rounded-full"
          :class="healthIndicatorClass"
          :title="healthTooltip"
        />

        <!-- Expand/collapse icon -->
        <svg
          class="w-5 h-5 text-gray-500 transition-transform"
          :class="{ 'rotate-180': isExpanded }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </div>
    </div>

    <!-- Feature cards -->
    <div v-show="isExpanded" class="p-4 space-y-4">
      <IntakeCard
        v-for="(feature, index) in features"
        :key="feature.key"
        :feature="feature"
        :isNextUp="index === 0 && feature.riceStatus === 'complete'"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import IntakeCard from './IntakeCard.vue'

const props = defineProps({
  teamName: {
    type: [String, null],
    required: true
  },
  features: {
    type: Array,
    required: true
  }
})

const isExpanded = ref(true)

const displayName = computed(() => props.teamName || 'Unassigned Team')

const healthIndicatorClass = computed(() => {
  if (props.features.length === 0) return 'bg-gray-300'

  const topFeature = props.features[0]

  // Unassigned team is always red
  if (props.teamName === null) return 'bg-red-500'

  // Check RICE status of top feature
  if (topFeature.riceStatus === 'complete') return 'bg-green-500'
  if (topFeature.riceStatus === 'partial') return 'bg-yellow-500'
  return 'bg-red-500'
})

const healthTooltip = computed(() => {
  if (props.features.length === 0) return 'No features'

  const topFeature = props.features[0]

  if (props.teamName === null) return 'Team not assigned'
  if (topFeature.riceStatus === 'complete') return 'Ready to plan: next item has RICE score'
  if (topFeature.riceStatus === 'partial') return 'Needs attention: RICE score incomplete'
  return 'Needs attention: no RICE score on top item'
})
</script>
```

**Tests:** `src/__tests__/TeamSection.spec.js`
- Renders team name correctly
- Shows correct health indicator color
- Expands/collapses on click
- Shows "Next Up" badge on first feature with complete RICE

### Task 3.3: Create IntakeCard Component

**File:** `src/components/IntakeCard.vue`

**Purpose:** Card displaying a feature awaiting intake

```vue
<template>
  <div
    class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow relative"
    :class="{ 'ring-2 ring-primary-500': isNextUp }"
  >
    <!-- Next Up badge -->
    <div
      v-if="isNextUp"
      class="absolute -top-2 -right-2 px-2 py-1 bg-primary-500 text-white text-xs font-bold rounded-full"
    >
      NEXT UP
    </div>

    <!-- Header: Key + Title -->
    <div class="mb-3">
      <a
        :href="feature.url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-600 hover:text-primary-800 font-semibold"
        @click.stop
      >
        {{ feature.key }}
      </a>
      <h4 class="text-lg font-medium text-gray-900 mt-1">
        {{ feature.title }}
      </h4>
    </div>

    <!-- Feature details -->
    <div class="grid grid-cols-2 gap-2 text-sm mb-4">
      <div>
        <span class="text-gray-500">Component:</span>
        <span class="ml-1 text-gray-900">{{ feature.component || 'Not set' }}</span>
      </div>
      <div>
        <span class="text-gray-500">Assignee:</span>
        <span class="ml-1 text-gray-900">{{ feature.assignee || 'Unassigned' }}</span>
      </div>
    </div>

    <!-- RICE Score Section -->
    <div class="mb-4 p-3 rounded-lg" :class="riceBackgroundClass">
      <div class="flex items-center justify-between">
        <span class="font-medium text-gray-700">RICE Score</span>
        <span v-if="feature.riceScore != null" class="text-2xl font-bold text-gray-900">
          {{ feature.riceScore }}
        </span>
        <span v-else class="text-sm font-medium" :class="riceWarningClass">
          {{ riceWarningText }}
        </span>
      </div>

      <!-- RICE breakdown (if any values set) -->
      <div v-if="hasAnyRiceValues" class="mt-2 grid grid-cols-4 gap-2 text-xs">
        <div class="text-center">
          <div class="text-gray-500">Reach</div>
          <div :class="feature.reach != null ? 'text-gray-900' : 'text-red-500'">
            {{ feature.reach ?? '-' }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-gray-500">Impact</div>
          <div :class="feature.impact != null ? 'text-gray-900' : 'text-red-500'">
            {{ feature.impact ?? '-' }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-gray-500">Confidence</div>
          <div :class="feature.confidence != null ? 'text-gray-900' : 'text-red-500'">
            {{ feature.confidence != null ? feature.confidence + '%' : '-' }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-gray-500">Effort</div>
          <div :class="feature.effort != null ? 'text-gray-900' : 'text-red-500'">
            {{ feature.effort ?? '-' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Linked RFE Section -->
    <div v-if="feature.linkedRfe" class="p-3 bg-gray-50 rounded-lg">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-medium text-gray-500 uppercase">Linked RFE</span>
      </div>
      <a
        :href="rfeUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-600 hover:text-primary-800 text-sm font-medium"
        @click.stop
      >
        {{ feature.linkedRfe.key }}
      </a>
      <p class="text-sm text-gray-700 mt-1">{{ feature.linkedRfe.title }}</p>
      <div v-if="feature.linkedRfe.approvalDate" class="text-xs text-gray-500 mt-1">
        Approved: {{ formatDate(feature.linkedRfe.approvalDate) }}
      </div>
    </div>

    <!-- External links -->
    <div class="mt-4 flex gap-4 text-sm">
      <a
        :href="feature.url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-600 hover:text-primary-800 flex items-center gap-1"
      >
        View Feature
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
        </svg>
      </a>
      <a
        v-if="feature.linkedRfe"
        :href="rfeUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-600 hover:text-primary-800 flex items-center gap-1"
      >
        View RFE
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
        </svg>
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  feature: {
    type: Object,
    required: true
  },
  isNextUp: {
    type: Boolean,
    default: false
  }
})

const rfeUrl = computed(() => {
  if (!props.feature.linkedRfe) return ''
  return `https://issues.redhat.com/browse/${props.feature.linkedRfe.key}`
})

const hasAnyRiceValues = computed(() => {
  const { reach, impact, confidence, effort } = props.feature
  return reach != null || impact != null || confidence != null || effort != null
})

const riceBackgroundClass = computed(() => {
  switch (props.feature.riceStatus) {
    case 'complete': return 'bg-green-50'
    case 'partial': return 'bg-yellow-50'
    default: return 'bg-red-50'
  }
})

const riceWarningClass = computed(() => {
  return props.feature.riceStatus === 'partial'
    ? 'text-yellow-700'
    : 'text-red-700'
})

const riceWarningText = computed(() => {
  return props.feature.riceStatus === 'partial'
    ? 'Incomplete RICE'
    : 'No RICE'
})

function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>
```

**Tests:** `src/__tests__/IntakeCard.spec.js`
- Renders feature title and key
- Shows RICE score when complete
- Shows warning for incomplete/missing RICE
- Displays linked RFE information
- External links work correctly
- "Next Up" badge appears when prop is true

---

## Phase 4: Hygiene Rules for Release Tracking

### Task 4.1: Add New Hygiene Rules

**File:** `src/utils/hygieneRules.js`

**Add two new rules:**

```javascript
{
  id: 'missing-rfe-link',
  name: 'Missing RFE Link',
  check: (issue) => {
    // Only check for Features (not Initiatives)
    if (issue.issueType !== 'Feature') return false
    // Only check for active statuses
    if (!isInRefinement(issue) && !isInProgress(issue)) return false
    // Check if linkedRfeStatus exists and is 'Approved'
    return !issue.linkedRfeApproved
  },
  message: (issue) => {
    if (!issue.linkedRfeKey) {
      return 'This feature is not linked to an RFE. Features should be cloned from an approved RFE.'
    }
    return `This feature is linked to RFE ${issue.linkedRfeKey} which is not in Approved status.`
  }
},
{
  id: 'premature-release-target',
  name: 'Premature Release Target',
  check: (issue) => {
    // Feature in "New" status but has a target release
    return issue.status === 'New' &&
           issue.targetRelease &&
           issue.targetRelease.length > 0
  },
  message: (issue) => {
    return `This feature is in New status but already has a target release set. Target release should only be set after refinement is complete.`
  }
}
```

### Task 4.2: Update Data to Include RFE Link Info

**File:** `amplify/backend/function/jiraFetcher/src/app.js`

**Update `transformIssue` function to include RFE link data:**

```javascript
function transformIssue(issue, rfeMap = {}) {
  // ... existing code ...

  // Get clones links for RFE checking
  const clonesLinks = getClonesLinks(issue);
  let linkedRfeKey = null;
  let linkedRfeApproved = false;

  for (const rfeKey of clonesLinks) {
    linkedRfeKey = rfeKey;
    if (rfeMap[rfeKey] && rfeMap[rfeKey].status === 'Approved') {
      linkedRfeApproved = true;
      break;
    }
  }

  return {
    // ... existing fields ...
    linkedRfeKey: linkedRfeKey,
    linkedRfeApproved: linkedRfeApproved
  };
}
```

**Note:** This requires fetching RFE data during release refresh too, or at minimum checking the link exists.

---

## Phase 5: Filtering & Polish

### Task 5.1: Persist Filters to localStorage

**File:** `src/components/IntakeView.vue`

**Add filter persistence:**

```javascript
const FILTER_STORAGE_KEY = 'feature-intake-filters'

// In mounted()
mounted() {
  this.loadFeatures()
  this.loadGroupOrder()
  this.loadFilters()
}

// Add methods
loadFilters() {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY)
    if (saved) {
      const filters = JSON.parse(saved)
      this.teamFilter = filters.team || ''
      this.componentFilter = filters.component || ''
    }
  } catch {
    // Ignore errors
  }
}

saveFilters() {
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
    team: this.teamFilter,
    component: this.componentFilter
  }))
}

// Add watchers
watch: {
  teamFilter() {
    this.saveFilters()
  },
  componentFilter() {
    this.saveFilters()
  }
}
```

### Task 5.2: Add Empty and Loading States

Already included in IntakeView.vue above.

### Task 5.3: Install vuedraggable Dependency

**Command:**
```bash
npm install vuedraggable@next
```

Note: Use `vuedraggable@next` for Vue 3 compatibility.

---

## Phase 6: Testing

### Task 6.1: Unit Tests

Create test files:
- `src/__tests__/TopNav.spec.js`
- `src/__tests__/IntakeView.spec.js`
- `src/__tests__/TeamSection.spec.js`
- `src/__tests__/IntakeCard.spec.js`

Each test file should follow the existing patterns in the codebase using `@vue/test-utils`.

### Task 6.2: Update Existing Tests

Update any tests that might be affected by App.vue changes.

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `src/components/TopNav.vue` | Two-tab navigation component |
| `src/components/IntakeView.vue` | Main Feature Intake page |
| `src/components/TeamSection.vue` | Collapsible team group |
| `src/components/IntakeCard.vue` | Feature card for intake view |
| `src/__tests__/TopNav.spec.js` | TopNav tests |
| `src/__tests__/IntakeView.spec.js` | IntakeView tests |
| `src/__tests__/TeamSection.spec.js` | TeamSection tests |
| `src/__tests__/IntakeCard.spec.js` | IntakeCard tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/App.vue` | Add TopNav, view switching, IntakeView |
| `src/services/api.js` | Add `getIntakeFeatures()` function |
| `src/utils/hygieneRules.js` | Add two new hygiene rules |
| `amplify/backend/function/jiraFetcher/src/app.js` | Add RICE fields, RFE fetching, intake endpoint |
| `package.json` | Add `vuedraggable` dependency |

---

## Dependencies

```json
{
  "vuedraggable": "^4.1.0"
}
```

---

## Implementation Order

1. **Install dependency:** `npm install vuedraggable@next`
2. **Phase 2 first:** Data layer (Lambda updates) - this enables testing the rest
3. **Phase 1:** Navigation infrastructure
4. **Phase 3:** Intake components
5. **Phase 4:** Hygiene rules
6. **Phase 5:** Polish
7. **Phase 6:** Testing throughout

---

## Jira Custom Fields Reference

| Field Name | Custom Field ID |
|------------|----------------|
| Team | customfield_12313240 |
| Release Type | customfield_12320840 |
| Target Release | customfield_12319940 |
| Status Summary | customfield_12320841 |
| Color Status | customfield_12320845 |
| Reach | customfield_12320846 |
| Impact | customfield_12320740 |
| Confidence | customfield_12320847 |
| Effort | customfield_12320848 |
| RICE Score | customfield_12326242 |

## Jira Configuration

| Setting | Value |
|---------|-------|
| Host | https://issues.redhat.com |
| RFE Project | RHAIRFE |
| RFE Issue Type | Feature Request |
| RFE Approved Status | Approved |
| Feature Projects | RHAISTRAT, RHOAIENG |
| Feature Issue Types | Feature, Initiative |
| Link Type | clones (Feature clones RFE) |
