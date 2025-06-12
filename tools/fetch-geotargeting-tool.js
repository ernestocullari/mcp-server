import { google } from 'googleapis';

export const fetchGeotargetingTool = {
  name: 'fetch-geotargeting-tool',
  description: 'Search and analyze the June 5th Addressable Audience Curation Demographics Google Sheet for geotargeting insights',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for demographic and geotargeting data'
      },
      location: {
        type: 'string',
        description: 'Specific location or geographic area to focus on (optional)'
      },
      demographic: {
        type: 'string',
        description: 'Specific demographic criteria to filter by (optional)'
      }
    },
    required: ['query']
  },
  
  async execute({ query, location, demographic }) {
    try {
      // Initialize Google Sheets API
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;

      if (!spreadsheetId) {
        throw new Error('GOOGLE_SHEET_ID environment variable not set');
      }

      // Fetch all data from the sheet
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'A:Z', // Adjust range as needed
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return {
          success: false,
          message: 'No data found in the Google Sheet'
        };
      }

      // Extract headers and data
      const headers = rows[0];
      const data = rows.slice(1);

      // Enhanced search and matching logic
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
      const locationTerms = location ? location.toLowerCase().split(' ') : [];
      const demographicTerms = demographic ? demographic.toLowerCase().split(' ') : [];

      const scoredResults = [];

      data.forEach((row, index) => {
        let score = 0;
        let matchDetails = [];
        const rowObject = {};

        // Create row object with headers
        headers.forEach((header, i) => {
          rowObject[header] = row[i] || '';
        });

        // Search through each cell in the row
        headers.forEach((header, colIndex) => {
          const cellValue = (row[colIndex] || '').toString().toLowerCase();
          
          // Query term matching
          searchTerms.forEach(term => {
            if (cellValue.includes(term)) {
              score += 5;
              matchDetails.push(`"${term}" found in ${header}`);
            }
          });

          // Location-specific matching (higher weight)
          locationTerms.forEach(locTerm => {
            if (cellValue.includes(locTerm)) {
              score += 8;
              matchDetails.push(`Location "${locTerm}" found in ${header}`);
            }
          });

          // Demographic-specific matching (higher weight)
          demographicTerms.forEach(demoTerm => {
            if (cellValue.includes(demoTerm)) {
              score += 8;
              matchDetails.push(`Demographic "${demoTerm}" found in ${header}`);
            }
          });

          // Exact phrase matching (highest score)
          if (cellValue.includes(query.toLowerCase())) {
            score += 12;
            matchDetails.push(`Exact query match in ${header}`);
          }
        });

        // Boost score for rows with geographic indicators
        const geoKeywords = ['city', 'state', 'zip', 'county', 'region', 'area', 'district'];
        const demoKeywords = ['age', 'income', 'household', 'population', 'gender', 'education'];
        
        headers.forEach((header, colIndex) => {
          const headerLower = header.toLowerCase();
          const cellValue = (row[colIndex] || '').toString().toLowerCase();
          
          if (geoKeywords.some(keyword => headerLower.includes(keyword)) && cellValue) {
            score += 3;
          }
          
          if (demoKeywords.some(keyword => headerLower.includes(keyword)) && cellValue) {
            score += 3;
          }
        });

        if (score > 0) {
          scoredResults.push({
            data: rowObject,
            score: score,
            matchDetails: matchDetails,
            rowIndex: index + 2 // +2 because array is 0-indexed and we skip header row
          });
        }
      });

      // Sort by score and get top results
      const topResults = scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (topResults.length === 0) {
        return {
          success: true,
          message: `No relevant data found for "${query}". Try different search terms or check the sheet contents.`,
          suggestions: [
            'Try broader search terms',
            'Check spelling of location names',
            'Use demographic categories like "age", "income", "household"'
          ]
        };
      }

      // Format results for Artemis
      const formattedResults = topResults.map((result, index) => {
        const relevantData = Object.entries(result.data)
          .filter(([key, value]) => value && value.toString().trim() !== '')
          .slice(0, 8) // Limit to most relevant fields
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        return `**Result ${index + 1} (Confidence Score: ${result.score})**\n${relevantData}\n`;
      });

      const summary = `Found ${topResults.length} relevant results for "${query}"${location ? ` in ${location}` : ''}${demographic ? ` for ${demographic} demographics` : ''}. Top match has confidence score of ${topResults[0].score}.`;

      return {
        success: true,
        summary: summary,
        results: formattedResults.join('\n'),
        totalMatches: scoredResults.length,
        query: query,
        rawData: topResults // For debugging if needed
      };

    } catch (error) {
      console.error('Error in fetch-geotargeting-tool:', error);
      return {
        success: false,
        message: `Error accessing Google Sheet: ${error.message}`,
        suggestions: [
          'Check Google Sheets API credentials',
          'Verify GOOGLE_SHEET_ID environment variable',
          'Ensure sheet permissions are set correctly'
        ]
      };
    }
  }
};