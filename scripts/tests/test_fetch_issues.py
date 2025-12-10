"""
Tests for fetch_issues.py - following TDD practices.
Tests written BEFORE implementation.
"""
import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, mock_open, patch


@pytest.fixture
def mock_jira_response():
    """Mock response from Jira API."""
    return {
        'issues': [
            {
                'key': 'RHOAIENG-123',
                'fields': {
                    'summary': 'Implement feature X',
                    'issuetype': {'name': 'Feature'},
                    'assignee': {'displayName': 'John Doe'},
                    'status': {'name': 'In Progress'},
                    'customfield_12313240': 'Fine Tuning',
                    'customfield_12320840': 'GA',
                    'customfield_12319940': ['rhoai-3.2'],
                    'customfield_12320841': 'Working on implementation. Made good progress on API endpoints.',
                }
            },
            {
                'key': 'RHAISTRAT-456',
                'fields': {
                    'summary': 'Design initiative Y',
                    'issuetype': {'name': 'Initiative'},
                    'assignee': None,  # Unassigned
                    'status': {'name': 'New'},
                    'customfield_12313240': None,
                    'customfield_12320840': None,
                    'customfield_12319940': ['rhoai-3.2'],
                    'customfield_12320841': None,
                }
            }
        ]
    }


class TestJQLQueryConstruction:
    """Test correct JQL query construction with filters."""

    def test_jql_includes_projects(self):
        """JQL should filter by RHAISTRAT and RHOAIENG projects."""
        from scripts.fetch_issues import build_jql_query
        jql = build_jql_query()
        assert 'project IN (RHAISTRAT, RHOAIENG)' in jql

    def test_jql_includes_components(self):
        """JQL should filter by specified components."""
        from scripts.fetch_issues import build_jql_query
        jql = build_jql_query()
        components = ['Fine Tuning', 'KubeRay', 'Feature Store',
                     'Training Ray', 'Training Kubeflow', 'AI Pipelines']
        for component in components:
            assert component in jql

    def test_jql_includes_issue_types(self):
        """JQL should filter by Feature and Initiative issue types."""
        from scripts.fetch_issues import build_jql_query
        jql = build_jql_query()
        assert 'issuetype IN (Feature, Initiative)' in jql

    def test_jql_includes_target_version(self):
        """JQL should filter by target version rhoai-3.2."""
        from scripts.fetch_issues import build_jql_query
        jql = build_jql_query()
        assert 'rhoai-3.2' in jql


class TestFieldMapping:
    """Test transformation of custom fields to human-readable names."""

    def test_transforms_team_field(self, mock_jira_response):
        """Should map customfield_12313240 to 'team'."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][0]
        result = transform_issue(issue)
        assert 'team' in result
        assert result['team'] == 'Fine Tuning'

    def test_transforms_release_type_field(self, mock_jira_response):
        """Should map customfield_12320840 to 'releaseType'."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][0]
        result = transform_issue(issue)
        assert 'releaseType' in result
        assert result['releaseType'] == 'GA'

    def test_transforms_target_release_field(self, mock_jira_response):
        """Should map customfield_12319940 to 'targetRelease'."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][0]
        result = transform_issue(issue)
        assert 'targetRelease' in result
        assert result['targetRelease'] == ['rhoai-3.2']

    def test_transforms_status_summary_field(self, mock_jira_response):
        """Should map customfield_12320841 to 'statusSummary'."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][0]
        result = transform_issue(issue)
        assert 'statusSummary' in result
        assert result['statusSummary'] == 'Working on implementation. Made good progress on API endpoints.'

    def test_transforms_target_release_field_with_multiple_values(self):
        """Should handle target release field with multiple values."""
        from scripts.fetch_issues import transform_issue
        issue = {
            'key': 'RHOAIENG-789',
            'fields': {
                'summary': 'Multi-release feature',
                'issuetype': {'name': 'Feature'},
                'assignee': {'displayName': 'Jane Smith'},
                'status': {'name': 'In Progress'},
                'customfield_12313240': 'KubeRay',
                'customfield_12320840': 'GA',
                'customfield_12319940': ['rhoai-3.2', 'rhoai-3.3', 'rhoai-4.0'],
            }
        }
        result = transform_issue(issue)
        assert 'targetRelease' in result
        assert result['targetRelease'] == ['rhoai-3.2', 'rhoai-3.3', 'rhoai-4.0']

    def test_transforms_target_release_field_with_jira_objects(self):
        """Should handle target release field as list of Jira objects with name attribute."""
        from scripts.fetch_issues import transform_issue

        # Mock Jira objects
        class MockJiraVersion:
            def __init__(self, name):
                self.name = name

        issue = {
            'key': 'RHOAIENG-999',
            'fields': {
                'summary': 'Feature with Jira version objects',
                'issuetype': {'name': 'Feature'},
                'assignee': {'displayName': 'Bob Jones'},
                'status': {'name': 'New'},
                'customfield_12313240': 'Training Ray',
                'customfield_12320840': 'Tech Preview',
                'customfield_12319940': [
                    MockJiraVersion('rhoai-3.2'),
                    MockJiraVersion('rhoai-3.3')
                ],
            }
        }
        result = transform_issue(issue)
        assert 'targetRelease' in result
        assert result['targetRelease'] == ['rhoai-3.2', 'rhoai-3.3']

    def test_handles_null_custom_fields(self, mock_jira_response):
        """Should handle null custom field values gracefully."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][1]  # Has null custom fields
        result = transform_issue(issue)
        assert result['team'] is None
        assert result['releaseType'] is None
        assert result['statusSummary'] is None

    def test_handles_unassigned_issues(self, mock_jira_response):
        """Should handle unassigned issues (null assignee)."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][1]
        result = transform_issue(issue)
        assert result['assignee'] is None


class TestIssueTransformation:
    """Test complete transformation of Jira issues to JSON schema."""

    def test_includes_all_required_fields(self, mock_jira_response):
        """Transformed issue should include all required fields."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][0]
        result = transform_issue(issue)

        required_fields = ['key', 'summary', 'issueType', 'assignee',
                          'status', 'team', 'releaseType', 'targetRelease', 'statusSummary', 'statusSummaryUpdated', 'url']
        for field in required_fields:
            assert field in result

    def test_generates_correct_url(self, mock_jira_response):
        """Should generate correct issue URL."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][0]
        result = transform_issue(issue)
        assert result['url'] == 'https://issues.redhat.com/browse/RHOAIENG-123'

    def test_extracts_key(self, mock_jira_response):
        """Should extract issue key."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][0]
        result = transform_issue(issue)
        assert result['key'] == 'RHOAIENG-123'

    def test_extracts_summary(self, mock_jira_response):
        """Should extract summary text."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][0]
        result = transform_issue(issue)
        assert result['summary'] == 'Implement feature X'

    def test_extracts_issue_type(self, mock_jira_response):
        """Should extract issue type name."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][0]
        result = transform_issue(issue)
        assert result['issueType'] == 'Feature'

    def test_extracts_status(self, mock_jira_response):
        """Should extract status name."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][0]
        result = transform_issue(issue)
        assert result['status'] == 'In Progress'

    def test_extracts_assignee(self, mock_jira_response):
        """Should extract assignee display name."""
        from scripts.fetch_issues import transform_issue
        issue = mock_jira_response['issues'][0]
        result = transform_issue(issue)
        assert result['assignee'] == 'John Doe'


class TestJSONOutput:
    """Test JSON file writing."""

    def test_creates_valid_json_structure(self, mock_jira_response, tmp_path):
        """Should create JSON file with correct structure."""
        from scripts.fetch_issues import write_issues_json

        output_file = tmp_path / 'issues.json'
        write_issues_json(mock_jira_response['issues'], str(output_file))

        assert output_file.exists()
        with open(output_file) as f:
            data = json.load(f)

        assert 'lastUpdated' in data
        assert 'issues' in data
        assert isinstance(data['issues'], list)
        assert len(data['issues']) == 2

    def test_includes_timestamp(self, mock_jira_response, tmp_path):
        """JSON should include lastUpdated timestamp."""
        from scripts.fetch_issues import write_issues_json

        output_file = tmp_path / 'issues.json'
        write_issues_json(mock_jira_response['issues'], str(output_file))

        with open(output_file) as f:
            data = json.load(f)

        assert 'lastUpdated' in data
        assert data['lastUpdated']  # Should not be empty


class TestErrorHandling:
    """Test error handling scenarios."""

    def test_handles_missing_token_file(self):
        """Should raise error when token file doesn't exist."""
        from scripts.fetch_issues import read_jira_token

        with pytest.raises(FileNotFoundError):
            read_jira_token('/nonexistent/path/.jira-token')

    def test_handles_jira_auth_failure(self):
        """Should handle Jira authentication failures."""
        from scripts.fetch_issues import fetch_issues_from_jira

        with pytest.raises(Exception) as exc_info:
            fetch_issues_from_jira('invalid-token')

        # Should raise some authentication-related error
        assert exc_info.value is not None


class TestChangelogParsing:
    """Test changelog parsing to extract status summary update date."""

    def test_extracts_status_summary_update_date_from_changelog(self):
        """Should extract the most recent change date for status summary field."""
        from scripts.fetch_issues import get_status_summary_updated_date

        # Mock issue with changelog containing status summary updates
        class MockChangelogHistory:
            def __init__(self, created, items):
                self.created = created
                self.items = items

        class MockChangelogItem:
            def __init__(self, field):
                self.field = field

        issue = MagicMock()
        # Jira changelog uses "Status Summary" (human-readable name), not the custom field ID
        issue.changelog.histories = [
            MockChangelogHistory('2025-12-01T10:00:00.000+0000', [
                MockChangelogItem('Status Summary')
            ]),
            MockChangelogHistory('2025-12-05T14:30:00.000+0000', [
                MockChangelogItem('status')
            ]),
            MockChangelogHistory('2025-12-10T16:45:00.000+0000', [
                MockChangelogItem('Status Summary')
            ]),
        ]

        result = get_status_summary_updated_date(issue)
        assert result == '2025-12-10T16:45:00Z'

    def test_returns_none_when_no_status_summary_changes(self):
        """Should return None when status summary field was never changed."""
        from scripts.fetch_issues import get_status_summary_updated_date

        class MockChangelogHistory:
            def __init__(self, created, items):
                self.created = created
                self.items = items

        class MockChangelogItem:
            def __init__(self, field):
                self.field = field

        issue = MagicMock()
        issue.changelog.histories = [
            MockChangelogHistory('2025-12-05T14:30:00.000+0000', [
                MockChangelogItem('status')
            ]),
            MockChangelogHistory('2025-12-08T09:15:00.000+0000', [
                MockChangelogItem('assignee')
            ]),
        ]

        result = get_status_summary_updated_date(issue)
        assert result is None

    def test_returns_none_when_no_changelog(self):
        """Should return None when issue has no changelog."""
        from scripts.fetch_issues import get_status_summary_updated_date

        issue = MagicMock()
        issue.changelog.histories = []

        result = get_status_summary_updated_date(issue)
        assert result is None

    def test_returns_none_when_changelog_is_none(self):
        """Should return None when changelog attribute is None."""
        from scripts.fetch_issues import get_status_summary_updated_date

        issue = MagicMock()
        issue.changelog = None

        result = get_status_summary_updated_date(issue)
        assert result is None

    def test_converts_jira_timestamp_to_iso8601(self):
        """Should convert Jira timestamp format to ISO 8601."""
        from scripts.fetch_issues import get_status_summary_updated_date

        class MockChangelogHistory:
            def __init__(self, created, items):
                self.created = created
                self.items = items

        class MockChangelogItem:
            def __init__(self, field):
                self.field = field

        issue = MagicMock()
        issue.changelog.histories = [
            MockChangelogHistory('2025-12-10T16:45:30.123+0000', [
                MockChangelogItem('Status Summary')
            ]),
        ]

        result = get_status_summary_updated_date(issue)
        # Should convert to ISO 8601 with Z timezone
        assert result == '2025-12-10T16:45:30Z'

    def test_transformed_issue_includes_status_summary_updated(self):
        """Transformed issue should include statusSummaryUpdated field."""
        from scripts.fetch_issues import transform_issue

        # Mock issue with changelog
        class MockChangelogHistory:
            def __init__(self, created, items):
                self.created = created
                self.items = items

        class MockChangelogItem:
            def __init__(self, field):
                self.field = field

        issue = MagicMock()
        issue.key = 'RHOAIENG-123'
        issue.fields.summary = 'Test issue'
        issue.fields.issuetype.name = 'Feature'
        issue.fields.assignee.displayName = 'John Doe'
        issue.fields.status.name = 'In Progress'
        issue.fields.customfield_12313240 = 'Fine Tuning'
        issue.fields.customfield_12320840 = 'GA'
        issue.fields.customfield_12319940 = ['rhoai-3.2']
        issue.fields.customfield_12320841 = 'Status update text'
        # Jira changelog uses "Status Summary" (human-readable name)
        issue.changelog.histories = [
            MockChangelogHistory('2025-12-10T14:30:00.000+0000', [
                MockChangelogItem('Status Summary')
            ]),
        ]

        result = transform_issue(issue)
        assert 'statusSummaryUpdated' in result
        assert result['statusSummaryUpdated'] == '2025-12-10T14:30:00Z'

    def test_transformed_issue_has_null_status_summary_updated_when_no_changelog(self):
        """Transformed issue should have null statusSummaryUpdated when no changelog."""
        from scripts.fetch_issues import transform_issue

        issue = MagicMock()
        issue.key = 'RHOAIENG-456'
        issue.fields.summary = 'Test issue'
        issue.fields.issuetype.name = 'Feature'
        issue.fields.assignee = None
        issue.fields.status.name = 'New'
        issue.fields.customfield_12313240 = None
        issue.fields.customfield_12320840 = None
        issue.fields.customfield_12319940 = ['rhoai-3.2']
        issue.fields.customfield_12320841 = None
        issue.changelog.histories = []

        result = transform_issue(issue)
        assert 'statusSummaryUpdated' in result
        assert result['statusSummaryUpdated'] is None


class TestMainExecution:
    """Test main execution flow."""

    @patch('scripts.fetch_issues.read_jira_token')
    @patch('scripts.fetch_issues.fetch_issues_from_jira')
    @patch('scripts.fetch_issues.write_issues_json')
    def test_main_flow(self, mock_write, mock_fetch, mock_read_token, mock_jira_response):
        """Test complete execution flow."""
        from scripts.fetch_issues import main

        mock_read_token.return_value = 'fake-token'
        mock_fetch.return_value = mock_jira_response['issues']

        main()

        mock_read_token.assert_called_once()
        mock_fetch.assert_called_once_with('fake-token')
        mock_write.assert_called_once()
