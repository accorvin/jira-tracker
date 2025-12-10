#!/usr/bin/env python3
"""
Fetch issues from Jira and save to JSON file.
Implements the data fetching logic for the RHOAI T&E tracker.
"""
import json
import os
from datetime import datetime, UTC
from pathlib import Path
from jira import JIRA


def read_jira_token(token_path='~/.jira-token'):
    """
    Read Jira authentication token from file.

    Args:
        token_path: Path to token file (default: ~/.jira-token)

    Returns:
        str: The authentication token

    Raises:
        FileNotFoundError: If token file doesn't exist
    """
    expanded_path = Path(token_path).expanduser()
    if not expanded_path.exists():
        raise FileNotFoundError(f"Token file not found: {expanded_path}")

    with open(expanded_path, 'r') as f:
        return f.read().strip()


def build_jql_query():
    """
    Build JQL query with filters for RHOAI T&E tracking.

    Returns:
        str: Complete JQL query string
    """
    # Projects to filter
    projects = "project IN (RHAISTRAT, RHOAIENG)"

    # Components to include
    components = [
        "Fine Tuning",
        "KubeRay",
        "Feature Store",
        "Training Ray",
        "Training Kubeflow",
        "AI Pipelines"
    ]
    # Use single quotes for component names in JQL
    quoted_components = ', '.join([f"'{c}'" for c in components])
    component_filter = f"component IN ({quoted_components})"

    # Issue types
    issue_types = "issuetype IN (Feature, Initiative)"

    # Target version
    target_version = '"Target Version" = rhoai-3.2'

    # Combine all filters
    jql = f"{projects} AND {component_filter} AND {issue_types} AND {target_version}"

    return jql


def get_status_summary_updated_date(issue):
    """
    Extract the most recent update date for the status summary field from changelog.

    Args:
        issue: Jira issue object with changelog

    Returns:
        str: ISO 8601 formatted timestamp (e.g., '2025-12-10T16:45:00Z'), or None if not found
    """
    if not hasattr(issue, 'changelog') or issue.changelog is None:
        return None

    if not hasattr(issue.changelog, 'histories') or not issue.changelog.histories:
        return None

    # Find most recent change to Status Summary field
    # The changelog uses the human-readable name "Status Summary", not the custom field ID
    most_recent_date = None

    for history in issue.changelog.histories:
        for item in history.items:
            if item.field == 'Status Summary' or item.field == 'customfield_12320841':
                # history.created is in format: '2025-12-10T16:45:30.123+0000'
                # Convert to ISO 8601 with Z timezone
                timestamp = history.created
                # Remove milliseconds and timezone offset, replace with Z
                if '+' in timestamp:
                    timestamp = timestamp.split('.')[0] + 'Z'
                elif 'T' in timestamp and len(timestamp) > 19:
                    # Handle case without milliseconds
                    timestamp = timestamp[:19] + 'Z'

                most_recent_date = timestamp
                # Histories are in chronological order, but we want the last one
                # So we keep updating and the last one wins

    return most_recent_date


def transform_issue(issue):
    """
    Transform a Jira issue to our JSON schema with human-readable field names.

    Args:
        issue: Jira issue object or dict

    Returns:
        dict: Transformed issue data
    """
    # Handle both dict and Jira object
    if hasattr(issue, 'key'):
        key = issue.key
        fields = issue.fields
    else:
        key = issue['key']
        fields = issue['fields']

    # Extract assignee
    assignee = None
    if hasattr(fields, 'assignee'):
        assignee = fields.assignee.displayName if fields.assignee else None
    elif 'assignee' in fields:
        assignee = fields['assignee']['displayName'] if fields['assignee'] else None

    # Extract issue type
    if hasattr(fields, 'issuetype'):
        issue_type = fields.issuetype.name
    else:
        issue_type = fields['issuetype']['name']

    # Extract status
    if hasattr(fields, 'status'):
        status = fields.status.name
    else:
        status = fields['status']['name']

    # Extract summary
    summary = fields.summary if hasattr(fields, 'summary') else fields['summary']

    # Extract custom fields with fallback for both object and dict access
    def get_custom_field(field_id):
        if hasattr(fields, field_id):
            return getattr(fields, field_id)
        elif isinstance(fields, dict):
            return fields.get(field_id)
        else:
            # For Jira objects, try getattr with default None
            return getattr(fields, field_id, None)

    # Helper function to convert Jira objects to strings
    def serialize_field(field_value):
        if field_value is None:
            return None
        if isinstance(field_value, str):
            return field_value
        if isinstance(field_value, list):
            if len(field_value) == 0:
                return None
            # Handle list - take first item
            first_item = field_value[0]
            if hasattr(first_item, 'name'):
                return first_item.name
            return str(first_item)
        if hasattr(field_value, 'name'):
            return field_value.name
        if hasattr(field_value, 'value'):
            return field_value.value
        return str(field_value)

    # Helper function to convert Jira objects to list of strings
    def serialize_list_field(field_value):
        if field_value is None:
            return None
        if isinstance(field_value, str):
            return [field_value]
        if isinstance(field_value, list):
            if len(field_value) == 0:
                return None
            # Handle list - extract all items
            result = []
            for item in field_value:
                if hasattr(item, 'name'):
                    result.append(item.name)
                else:
                    result.append(str(item))
            return result
        # Single value - convert to list
        if hasattr(field_value, 'name'):
            return [field_value.name]
        if hasattr(field_value, 'value'):
            return [field_value.value]
        return [str(field_value)]

    team = serialize_field(get_custom_field('customfield_12313240'))
    release_type = serialize_field(get_custom_field('customfield_12320840'))
    target_release = serialize_list_field(get_custom_field('customfield_12319940'))
    status_summary = serialize_field(get_custom_field('customfield_12320841'))

    # Extract status summary update date from changelog (if available)
    status_summary_updated = get_status_summary_updated_date(issue) if hasattr(issue, 'changelog') else None

    # Build transformed issue
    return {
        'key': key,
        'summary': summary,
        'issueType': issue_type,
        'assignee': assignee,
        'status': status,
        'team': team,
        'releaseType': release_type,
        'targetRelease': target_release,
        'statusSummary': status_summary,
        'statusSummaryUpdated': status_summary_updated,
        'url': f'https://issues.redhat.com/browse/{key}'
    }


def fetch_issues_from_jira(token):
    """
    Fetch issues from Jira using the API.

    Args:
        token: Jira authentication token

    Returns:
        list: List of raw Jira issues

    Raises:
        Exception: If authentication or API request fails
    """
    jira_host = 'https://issues.redhat.com'

    # Initialize Jira client
    try:
        jira = JIRA(server=jira_host, token_auth=token)
    except Exception as e:
        raise Exception(f"Failed to authenticate with Jira: {e}")

    # Build and execute query
    jql = build_jql_query()

    # Fetch all issues (handle pagination)
    issues = []
    start_at = 0
    max_results = 100

    while True:
        batch = jira.search_issues(
            jql,
            startAt=start_at,
            maxResults=max_results,
            fields='key,summary,issuetype,assignee,status,customfield_12313240,customfield_12320840,customfield_12319940,customfield_12320841',
            expand='changelog'
        )

        if not batch:
            break

        issues.extend(batch)

        if len(batch) < max_results:
            break

        start_at += max_results

    return issues


def write_issues_json(issues, output_path='public/issues.json'):
    """
    Write issues to JSON file.

    Args:
        issues: List of Jira issues (raw or transformed)
        output_path: Path to output JSON file
    """
    # Transform all issues
    transformed = [transform_issue(issue) for issue in issues]

    # Create output structure
    output = {
        'lastUpdated': datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'issues': transformed
    }

    # Ensure output directory exists
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Write to file
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {len(transformed)} issues to {output_path}")


def main():
    """Main execution function."""
    try:
        # Read token
        token = read_jira_token()

        # Fetch issues
        print("Fetching issues from Jira...")
        issues = fetch_issues_from_jira(token)

        # Write to JSON
        write_issues_json(issues)

        print("Done!")

    except FileNotFoundError as e:
        print(f"Error: {e}")
        print("Please create a ~/.jira-token file with your Jira API token")
        exit(1)
    except Exception as e:
        print(f"Error: {e}")
        exit(1)


if __name__ == '__main__':
    main()
