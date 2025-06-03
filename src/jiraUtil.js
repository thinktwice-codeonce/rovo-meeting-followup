import api, { route } from '@forge/api';

// fetch priority id from Jira
export const fetchJiraPriorityId = async (priority) => {
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/priority`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch priorities: ${response.status} ${response.statusText}`);
    }

    const priorities = await response.json();
    const priorityObj = priorities.find(p => p.name.toLowerCase() === priority.toLowerCase());
    
    if (!priorityObj) {
      console.warn(`Priority "${priority}" not found in Jira. Using default priority.`);
      return null;
    }
    
    return priorityObj.id;
  } catch (error) {
    console.error('Error fetching Jira priority ID:', error);
    return null;
  }
}

/**
 * Function 1: Fetch available priority data and map to find the corresponding id
 * @returns {Object} A mapping object where keys are priority names and values are priority IDs
 */
export const fetchJiraPriorityMapping = async () => {
  try {
    const response = await api.asUser().requestJira('/rest/api/3/priority', {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log(`Priority fetch response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch priorities: ${response.status} ${response.statusText}`);
    }

    const priorities = await response.json();
    console.log('Fetched priorities:', priorities);

    // Create a mapping from priority name to priority ID
    const priorityMapping = {};
    priorities.forEach(priority => {
      priorityMapping[priority.name] = priority.id;
      // Also map common variations
      priorityMapping[priority.name.toLowerCase()] = priority.id;
      
      // Map common priority names to Jira priorities
      if (priority.name.toLowerCase().includes('high') || priority.name.toLowerCase().includes('major')) {
        priorityMapping['high'] = priority.id;
      }
      if (priority.name.toLowerCase().includes('medium') || priority.name.toLowerCase().includes('normal')) {
        priorityMapping['medium'] = priority.id;
      }
      if (priority.name.toLowerCase().includes('low') || priority.name.toLowerCase().includes('minor') || priority.name.toLowerCase().includes('trivial')) {
        priorityMapping['low'] = priority.id;
      }
    });

    console.log('Priority mapping created:', priorityMapping);
    return priorityMapping;
  } catch (error) {
    console.error('Error fetching Jira priorities:', error);
    throw error;
  }
};

/**
 * Function 2: Map action items to Jira issue format and bulk create Jira issues
 * @param {Array} actionItems - Array of action items from meeting notes
 * @param {string} projectId - Jira project ID where issues should be created (default: "10102" for ANDROID)
 * @param {string} issueTypeId - Jira issue type ID (default: "10002" for Task)
 * @returns {Object} Response from Jira bulk create API
 */
export const bulkCreateJiraIssues = async (actionItems, projectId = "10102", issueTypeId = "10002") => {
  try {
    // Get priority mapping for all action items
    const priorityMapping = await fetchJiraPriorityMapping();

    // Map action items to Jira issue format
    const issueUpdates = actionItems.map(item => {
      const issueData = {
        fields: {
          project: {
            id: projectId
          },
          issuetype: {
            id: issueTypeId
          },
          summary: item.task,
          // Map description to Jira's rich text format
          description: {
            content: [
              {
                content: [
                  {
                    text: item.context || item.task,
                    type: "text"
                  }
                ],
                type: "paragraph"
              }
            ],
            type: "doc",
            version: 1
          }
        }
      };

      // Add reporter if owner is specified and not "Unassigned"
      if (item.owner && item.owner !== "Unassigned") {
        issueData.fields.reporter = {
          id: item.owner
        };
        // Also set as assignee
        issueData.fields.assignee = {
          id: item.owner
        };
      }

      // Add due date if specified
      if (item.due_date && item.due_date.trim() !== "") {
        issueData.fields.duedate = item.due_date;
      }

      // Add priority if specified
      if (item.priority) {
        const priorityId = priorityMapping[item.priority.toLowerCase()];
        if (priorityId) {
          issueData.fields.priority = {
            id: priorityId
          };
        } else {
          console.warn(`Priority "${item.priority}" not found in mapping for task: ${item.task}`);
        }
      }

      // Add labels if related_topic is specified
      if (item.related_topic) {
        // Convert related_topic to a valid label (remove spaces, special chars)
        const label = item.related_topic
          .replace(/[^a-zA-Z0-9]/g, '_')
          .toLowerCase();
        issueData.fields.labels = [label];
      }

      return issueData;
    });

    // Create the bulk request body
    const bodyData = {
      issueUpdates: issueUpdates
    };

    console.log('Bulk create request body:', JSON.stringify(bodyData, null, 2));

    // Make the bulk create request
    const response = await api.asUser().requestJira('/rest/api/3/issue/bulk', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    });

    console.log(`Bulk create response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create Jira issues: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Bulk create result:', result);

    return result;
  } catch (error) {
    console.error('Error creating Jira issues:', error);
    throw error;
  }
};
