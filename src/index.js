import api, { route } from "@forge/api";
import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { getAllContext } from './atlassian-context';

export const summarizeMeetingNotes = async (payload) => {
  console.log(`Logging message: ${payload.meetingNotes}`);

  const query = payload.meetingNotes;
  console.log(`INVOKED the summarizeMeetingNotes funtion with the query: ${query} ; Full User input: ${payload}`);
  
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
  const atlassianContext = await getAllContext(userInput.context);

  try {
    // Configure Claude model with tools
    const model = new ChatAnthropic({
      anthropicApiKey: await getAnthropicApiKey(),
      modelName: 'claude-3-7-sonnet-20250219',
      temperature: 0.1,  // Set to 0.0-0.3 for most deterministic responses
      // Add MCP context through system parameters
      system: "You are an expert meeting summarization assistant that helps extract actionable insights, decisions, and follow-up tasks from meeting notes. Your output will be used by an automation system to create Jira tasks and meeting summaries.",
      additionalTools: [{
        type: "mcp",
        mcpContext: userInput.context
      }]
    });

    // Create a prompt template with explicit instructions to use MCP tools
    const promptTemplate = PromptTemplate.fromTemplate(`

          You are an expert meeting summarization assistant that helps extract actionable insights, decisions, and follow-up tasks from meeting notes. Your output will be used by an automation system to create Jira tasks and meeting summaries.

          ### Instructions:

          1. Analyze the provided meeting content thoroughly, focusing on extracting:
            - Action items and follow-up tasks
            - Key decisions made
            - Important discussion points
            - Unresolved questions or blockers

          2. For each action item identified, structure your response using the following format:
          {
            "action_items": [
              {
                "task": "Brief description of the task",
                "owner": "Person responsible (if mentioned)",
                "due_date": "Due date (if mentioned, in YYYY-MM-DD format)",
                "priority": "High/Medium/Low (inferred from context)",
                "context": "Brief context about why this task is needed",
                "related_topic": "The topic/project this relates to"
              }
            ],
            "decisions": [
              {
                "decision": "Brief description of the decision made",
                "context": "The context or reasoning behind this decision",
                "stakeholders": "People involved in this decision (if mentioned)"
              }
            ],
            "key_points": [
              "Important discussion point 1",
              "Important discussion point 2"
            ],
            "open_questions": [
              "Unresolved question or issue 1",
              "Unresolved question or issue 2"
            ],
            "summary": "A concise 2-3 sentence summary of the overall meeting"
          }

          3. Extraction Guidelines:
            - Be thorough in identifying all explicit and implicit action items
            - Use the exact names mentioned for task owners
            - Infer priority based on language urgency, deadlines, or explicit statements
            - Maintain the original intent without adding assumptions
            - If information is ambiguous, note this in your response
            - Only include fields where information is available (omit empty fields)

          4. Handling Special Cases:
            - For recurring action items, note the recurrence pattern if mentioned
            - For tasks without clear owners, list as "Unassigned"
            - For items mentioned as "FYI" or informational only, include in key_points rather than action_items
            - For multi-part tasks, break them into separate action items when appropriate

          5. Response Format:
            - Provide only the structured JSON output without additional commentary
            - Ensure the JSON is properly formatted and valid
            - Do not include explanations or notes outside the JSON structure

          The meeting content will be provided after this prompt. Analyze it carefully and extract all relevant information according to these guidelines.
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
    console.log(`FINAL RESPONSE => 2: ${response}`);

    // Process the response to extract just the color and row number
    const processedResponse = response.trim();

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

