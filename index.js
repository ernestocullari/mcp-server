import express from 'express';
import { createAgent } from 'fast-agent-mcp';
import pino from 'pino';
import { fetchGeotargetingTool } from './tools/fetch-geotargeting-tool.js';

const app = express();
app.use(express.json());

// Logger setup
const logger = pino();

// Agent configuration with the optimized tool
const agent = createAgent({
  version: process.env.AGENT_VERSION || '0.2.28',
  name: process.env.AGENT_NAME || 'Artemis',
  temperature: parseFloat(process.env.AGENT_TEMPERATURE) || 0.2,
  tools: [fetchGeotargetingTool],
  systemPrompt: process.env.SYSTEM_PROMPT || `
    You are Artemis, a geotargeting and geofencing AI specialist. You have access to the "June 5th Addressable Audience Curation Demographics" Google Sheet through your fetch-geotargeting-tool. 

    When users ask about targeting, demographics, or geolocation data:
    1. Always use the fetch-geotargeting-tool to search the sheet
    2. Provide specific, actionable insights based on the data
    3. Include relevant demographic and geographic details
    4. Suggest targeting strategies based on the findings
    5. If no exact matches are found, suggest alternative search terms or approaches

    Be conversational but data-driven in your responses.
  `
});

// Route with input validation and error handling
app.post('/agent', async (req, res) => {
  const input = req.body.input;
  
  // Input validation
  if (!input || typeof input !== 'string') {
    logger.warn('Invalid input format received:', req.body);
    return res.status(400).json({ error: 'Invalid input format' });
  }
  
  try {
    logger.info('Processing request:', input);
    const result = await agent.run(input);
    logger.info('Agent response generated successfully');
    res.json({ output: result });
  } catch (error) {
    logger.error('Error running agent:', error);
    res.status(500).json({ error: 'Failed to process the request' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Static file serving
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Artemis MCP Agent running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    logger.info('Process interrupted');
  });
});
