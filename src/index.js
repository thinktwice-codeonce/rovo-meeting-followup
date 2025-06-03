import api, { route } from "@forge/api";
import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { getAllContext } from './atlassian-context';
import { fetchPageOrBlogInfo, resourceTypeToContentType, updatePageOrBlogContent } from './confluenceUtil';

export const summarizeMeetingNotes = async (payload) => {
  console.log(`Confluence Page ID: ${payload.pageId}`);
  const pageContent = await fetchPageContent(payload.pageId);

  const query = pageContent;

  console.log(`INVOKED the summarizeMeetingNotes funtion with the query: ${query} ; Full User input: ${JSON.stringify(payload)}`);
  
  if (!query) {
    return {
      response: {
        type: 'message',
        body: {
          type: 'text',
          text: 'Please provide a query to get a response.'
        }
      }
    };
  }
  
  // Get Atlassian context
  const atlassianContext = await getAllContext(payload.context);

  try {
    // Configure Claude model with tools
    const model = new ChatAnthropic({
      anthropicApiKey: await getAnthropicApiKey(),
      modelName: 'claude-3-7-sonnet-20250219',
      temperature: 0.3,  // Set to 0.0-0.3 for most deterministic responses
      // Add MCP context through system parameters
      system: `You are a highly reliable meeting summarization assistant, specialized in extracting explicit, follow-up tasks (Action items) from meeting notes. 
      Your output is consumed by an automation system to generate Jira tasks and concise meeting summaries.
      Accuracy is critical: Do not infer, assume, or fabricate information. Extract only what is clearly and explicitly stated in the meeting content.`,
      additionalTools: [{
        type: "mcp",
        mcpContext: payload.context
      }]
      // topP: 0.1
    });

    // Create a prompt template with explicit instructions to use MCP tools
    const promptTemplate = PromptTemplate.fromTemplate(`
      You are a fact-only extraction assistant. You help extract follow-up tasks (Action items) from meeting notes. Your output will be used by an automation system to create Jira tasks and meeting summaries.
      ⸻
      INSTRUCTIONS:

      Only extract follow-up tasks (Action items) from the meeting notes. For each action item identified, structure your response using the following format:

        {{
        "action_items": [
          {{
          "task": "<Brief description of the task>",
          "owner": "<data-account-id>",
          "due_date": "Due date (if mentioned, in YYYY-MM-DD format)",
          "priority": "High/Medium/Low (inferred from context)",
          "context": "Brief context about why this task is needed",
          "related_topic": "The topic/project this relates to"
          }}
        ],
        "summary": "A concise 2-3 sentence summary of the overall meeting"
        }}

      EXTRACTION GUIDELINES:
      - Do not infer, assume, or fabricate information.
      - If a task has no owner, use: "owner": "Unassigned".
      - If no due date is mentioned, keep it empty.
      - Do not extract tasks from meeting notes, summaries, or discussion text — only from the Action items section.

      HANDLING SPECIAL CASES:

      - For recurring action items, note the recurrence pattern only if explicitly stated.
      - Break multi-part tasks into separate action items only if clearly listed as separate tasks.
      - If no action items are found, return:
        {{
        "action_items": [],
        "summary": "No action items were recorded in this meeting."
        }}

      RESPONSE FORMAT:

      - Return only valid JSON output.
      - Do not include any commentary, notes, or explanation outside the JSON.
      - Ensure the JSON is properly structured and machine-readable.
      
      ## Atlassian Context
      {atlassianContext}
    
      ## User Query
      {query}
      
      `);

    // Create a Langchain pipeline
    const chain = RunnableSequence.from([
      promptTemplate,
      model,
      new StringOutputParser(),
    ]);

    // Execute the chain with context
    const response = await chain.invoke({
      query: query,
      atlassianContext: atlassianContext
    });
    console.log(`FINAL RESPONSE => 3: ${response}`);

    // Process the response to extract just the color and row number
    const processedResponse = response.trim();
    createJiraTasks(processedResponse);

    // Return the response to the Rovo agent
    return {
      response: {
        type: 'message',
        body: {
          type: 'text',
          text: processedResponse
        }
      }
    };
  } catch (error) {
    console.error('Error processing query:', error);
    
    return {
      response: {
        type: 'message',
        body: {
          type: 'text',
          text: `Sorry, I encountered an error while processing your request: ${error.message}`
        }
      }
    };
  }
}

// Function to get API key
async function getAnthropicApiKey() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('Anthropic API key not found. Please configure it in the app settings.');
  }
  
  return apiKey;
}

export const fetchPageContent = async (pageId) => {
  const pageInfo = await fetchPageOrBlogInfo(pageId, 'page', 'view');
  return pageInfo.content;
}

export const createJiraTasks = async (rawJsonContent) => {
  try {
  // Remove code fences like ```json, ```html, ```code, or ```
  const cleanJsonContent = rawJsonContent
  .replace(/```[\w-]*\n?/gi, '')  // Remove opening fence with optional label
  .replace(/```/g, '')            // Remove closing fence
  .trim();
  const meetingContent = JSON.parse(cleanJsonContent);
  console.log(meetingContent);
  // Access the action_items array
const actionItems = meetingContent.action_items;
console.log(actionItems);

//TODO: Generate Jira tasks from actionItems (api.asUser().requestJira)

// Access individual items
actionItems.forEach(item => {
  console.log(`${item.owner} needs to: ${item.task}`);
});
} catch (error) {
  console.error("Invalid JSON:", error.message);
}
}

