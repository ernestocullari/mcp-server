import { google } from 'googleapis';

export const fetchGeotargetingTool = {
  name: 'fetch-geotargeting-tool',
  description: 'Find exact ad targeting pathways by searching Description, Demographic, Grouping, then Category columns in priority order',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'User\'s plain language description of their target audience'
      }
    },
    required: ['query']
  },
  
  async execute({ query }) {
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

      // Fetch sheet data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'A:Z',
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return {
          success: false,
          message: 'No data found in the targeting database'
        };
      }

      // Find column indices
      const headers = rows[0];
      const categoryIndex = headers.findIndex(h => h.toLowerCase().includes('category'));
      const groupingIndex = headers.findIndex(h => h.toLowerCase().includes('grouping'));
      const demographicIndex = headers.findIndex(h => h.toLowerCase().includes('demographic'));
      const descriptionIndex = headers.findIndex(h => h.toLowerCase().includes('description'));

      if (categoryIndex === -1 || groupingIndex === -1 || demographicIndex === -1 || descriptionIndex === -1) {
        return {
          success: false,
          message: 'Required columns (Category, Grouping, Demographic, Description) not found in sheet'
        };
      }

      const data = rows.slice(1); // Skip header row
      const userQuery = query.toLowerCase().trim();

      // Helper function to calculate match score
      function calculateMatchScore(text, query) {
        const textLower = text.toLowerCase();
        let score = 0;
        
        // Exact phrase match (highest score)
        if (textLower.includes(query)) {
          score = 100;
        } else {
          // Word-by-word matching
          const queryWords = query.split(' ').filter(word => word.length > 2);
          const matchedWords = queryWords.filter(word => textLower.includes(word));
          
          if (matchedWords.length > 0) {
            score = (matchedWords.length / queryWords.length) * 80;
          }
        }
        
        return score;
      }

      // Helper function to search a specific column
      function searchColumn(columnIndex, columnName, minScore = 30) {
        const matches = [];
        
        data.forEach((row, index) => {
          const cellValue = (row[columnIndex] || '').toString();
          const category = row[categoryIndex] || '';
          const grouping = row[groupingIndex] || '';
          const demographic = row[demographicIndex] || '';
          const description = row[descriptionIndex] || '';
          
          if (!cellValue.trim()) return; // Skip empty cells
          
          const score = calculateMatchScore(cellValue, userQuery);
          
          if (score >= minScore) {
            matches.push({
              category,
              grouping,
              demographic,
              description,
              matchedText: cellValue,
              matchedColumn: columnName,
              score,
              rowIndex: index + 2
            });
          }
        });
        
        return matches.sort((a, b) => b.score - a.score);
      }

      // STEP 1: Search Description column first
      let matches = searchColumn(descriptionIndex, 'Description', 30);
      let searchSource = 'Description';

      // STEP 2: If no Description matches, try Demographic column
      if (matches.length === 0) {
        matches = searchColumn(demographicIndex, 'Demographic', 30);
        searchSource = 'Demographic';
      }

      // STEP 3: If no Demographic matches, try Grouping column
      if (matches.length === 0) {
        matches = searchColumn(groupingIndex, 'Grouping', 30);
        searchSource = 'Grouping';
      }

      // STEP 4: If no Grouping matches, try Category column
      if (matches.length === 0) {
        matches = searchColumn(categoryIndex, 'Category', 30);
        searchSource = 'Category';
      }

      // STEP 5: If matches found, return top 3 pathways
      if (matches.length > 0) {
        const bestMatches = matches.slice(0, 3);
        
        const pathways = bestMatches.map((match, index) => 
          `**Option ${index + 1}**: ${match.category} → ${match.grouping} → ${match.demographic}`
        ).join('\n');

        // Determine confidence level
        let confidence = 'Low';
        if (bestMatches[0].score >= 80) confidence = 'High';
        else if (bestMatches[0].score >= 60) confidence = 'Medium';

        return {
          success: true,
          matchSource: searchSource.toLowerCase(),
          message: `Found ${bestMatches.length} targeting pathway(s) by matching "${query}" in the ${searchSource} column:`,
          pathways: pathways,
          confidence: confidence,
          topMatch: {
            category: bestMatches[0].category,
            grouping: bestMatches[0].grouping,
            demographic: bestMatches[0].demographic,
            matchedText: bestMatches[0].matchedText,
            searchedIn: searchSource
          },
          allMatches: bestMatches.map(match => ({
            category: match.category,
            grouping: match.grouping,
            demographic: match.demographic
          }))
        };
      }

      // STEP 6: No matches found anywhere
      return {
        success: true,
        matchSource: 'none',
        message: `No targeting pathways found for "${query}" in any column (Description, Demographic, Grouping, or Category).`,
        pathways: '',
        suggestions: [
          'Try using different keywords or simpler terms',
          'Experiment with the targeting tool to explore available options',
          'Schedule a consultation with ernesto@artemistargeting.com for personalized assistance'
        ],
        searchAttempted: 'Searched all columns: Description, Demographic, Grouping, Category'
      };

    } catch (error) {
      console.error('Error in fetch-geotargeting-tool:', error);
      return {
        success: false,
        message: `Database error: ${error.message}`,
        pathways: '',
        suggestions: ['Contact ernesto@artemistargeting.com for technical support']
      };
    }
  }
};
