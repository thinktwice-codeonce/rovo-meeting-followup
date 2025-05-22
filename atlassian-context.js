import api, { route } from '@forge/api';

/**
 * Fetches context from Jira based on the current context
 * @param {Object} context - The context object from Rovo request
 * @returns {Promise<string>} - Relevant Jira context as a string
 */
export async function getJiraContext(context) {
  try {
    // If we have an issue key in context, fetch issue details
    if (context.extension && context.extension.issue && context.extension.issue.key) {
      const issueKey = context.extension.issue.key;
      const issueResponse = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}`);
      
      if (issueResponse.status === 200) {
        const issueData = await issueResponse.json();
        
        // Format issue data as a string
        return `
          Current Jira Issue:
          Key: ${issueData.key}
          Summary: ${issueData.fields.summary}
          Description: ${issueData.fields.description ? issueData.fields.description.content.map(item => 
            item.content.map(contentItem => contentItem.text).join('')
          ).join('\n') : 'No description'}
          Status: ${issueData.fields.status.name}
          Issue Type: ${issueData.fields.issuetype.name}
        `;
      }
    }
    
    return 'No specific Jira context available.';
  } catch (error) {
    console.error('Error fetching Jira context:', error);
    return 'Error fetching Jira context.';
  }
}

/**
 * Fetches context from Confluence based on the current context
 * @param {Object} context - The context object from Rovo request
 * @returns {Promise<string>} - Relevant Confluence context as a string
 */
export async function getConfluenceContext(context) {
  try {
    // If we have a page ID in context, fetch page details
    if (context.extension && context.extension.content && context.extension.content.id) {
      const pageId = context.extension.content.id;
      const pageResponse = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${pageId}`);
      
      if (pageResponse.status === 200) {
        const pageData = await pageResponse.json();
        
        // Get page content
        const contentResponse = await api.asApp().requestConfluence(
          route`/wiki/api/v2/pages/${pageId}/body?representation=storage`
        );
        
        let contentText = 'Content not available';
        if (contentResponse.status === 200) {
          const contentData = await contentResponse.json();
          // Extract text from HTML (simplified version)
          contentText = contentData.value
            .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
            .replace(/\s+/g, ' ')      // Normalize whitespace
            .trim();
          
          // Limit to a reasonable length
          if (contentText.length > 1000) {
            contentText = contentText.substring(0, 1000) + '... (content truncated)';
          }
        }
        
        return `
          Current Confluence Page:
          Title: ${pageData.title}
          Space: ${pageData.spaceKey}
          Content: ${contentText}
        `;
      }
    }
    
    return 'No specific Confluence context available.';
  } catch (error) {
    console.error('Error fetching Confluence context:', error);
    return 'Error fetching Confluence context.';
  }
}

/**
 * Gets the user information for the current request
 * @param {Object} context - The context object from Rovo request
 * @returns {Promise<string>} - User information as a string
 */
export async function getUserInfo(context) {
  try {
    if (context.accountId) {
      const userResponse = await api.asApp().requestJira(
        route`/rest/api/3/user?accountId=${context.accountId}`
      );
      
      if (userResponse.status === 200) {
        const userData = await userResponse.json();
        return `
          Current User:
          Display Name: ${userData.displayName}
          Email: ${userData.emailAddress || 'Not available'}
        `;
      }
    }
    
    return 'User information not available.';
  } catch (error) {
    console.error('Error fetching user info:', error);
    return 'Error fetching user information.';
  }
}

/**
 * Combines all context information
 * @param {Object} context - The context object from Rovo request
 * @returns {Promise<string>} - Combined context as a string
 */
export async function getAllContext(context) {
  try {
    const [userInfo, jiraContext, confluenceContext] = await Promise.all([
      getUserInfo(context),
      getJiraContext(context),
      getConfluenceContext(context),
    ]);
    
    return `
      ${userInfo}
      
      ${jiraContext}
      
      ${confluenceContext}
    `;
  } catch (error) {
    console.error('Error getting all context:', error);
    return 'Error fetching contextual information.';
  }
}
