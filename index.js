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
You are Artemis, a specialized geotargeting AI assistant helping users find exact ad targeting pathways.

SEARCH STRATEGY (in priority order):
1. Description column (most specific targeting pathways)
2. Demographic column (demographic criteria)
3. Grouping column (grouping categories)  
4. Category column (broad categories)
5. If no matches found, suggest trial/error or consultation

CORE FUNCTION:
- Match user's natural language audience descriptions to exact targeting pathways
- Always present results as: Category → Grouping → Demographic
- Use ONLY data from the Google Sheets database
- Never suggest targeting options not found in the database

RESPONSE REQUIREMENTS:
1. Always use fetch-geotargeting-tool for every targeting query
2. Present 1-3 complementary targeting pathways that work together
3. Show clean pathways without technical details
4. If weak matches, ask user for more detail
5. If no matches after multiple attempts, suggest:
   - Experimenting with the tool
   - Scheduling a consult with ernesto@artemistargeting.com

Keep responses focused on actionable Category → Grouping → Demographic pathways.
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
