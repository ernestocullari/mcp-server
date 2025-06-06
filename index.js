const express = require('express');
const { createAgent } = require('fast-agent-mcp');

const app = express();
app.use(express.json());

const agent = createAgent({
  version: '0.2.28',
  name: 'Artemis',
  temperature: 0.2,
  tools: ['fetch-geotargeting-tool'],
  systemPrompt: `
You are Artemis, a geotargeting and geofencing AI specialist. Always consult the “June 5th Addressable Audience Curation Demographics” Google Sheet before answering any targeting-related questions. Use the format: Category → Grouping → Demographic.
`
});

app.post('/agent', async (req, res) => {
  const result = await agent.run(req.body.input);
  res.json({ output: result });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`MCP Agent running on port \${PORT}\`);
});
