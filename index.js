import express from 'express';
import { createAgent } from 'fast-agent-mcp';
// For logging
import pino from 'pino';

const app = express();
app.use(express.json());

// Logger setup
const logger = pino();

// Agent configuration via environment variables
const agent = createAgent({
  version: process.env.AGENT_VERSION || '0.2.28',
  name: process.env.AGENT_NAME || 'Artemis',
  temperature: parseFloat(process.env.AGENT_TEMPERATURE) || 0.2,
  tools: ['fetch-geotargeting-tool'],
  systemPrompt: process.env.SYSTEM_PROMPT || `
    You are Artemis, a geotargeting and geofencing AI specialist. Always consult the “June 5th Addressable Audience Curation Demographics” Google Sheet before answering any targeting-related quest[...]
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
    const result = await agent.run(input);
    res.json({ output: result });
  } catch (error) {
    logger.error('Error running agent:', error);
    res.status(500).json({ error: 'Failed to process the request' });
  }
});

// Static file serving (future scalability)
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`MCP Agent running on port ${PORT}`);
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
