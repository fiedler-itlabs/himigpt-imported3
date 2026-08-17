import { invokeLLM } from './_core/llm';

export type ContractFilters = {
  insuranceCompanyKeyword?: string; // Fuzzy match keyword (e.g., "AOK", "IKK")
  confidence: 'high' | 'low'; // High = explicitly mentioned, Low = inferred
};

/**
 * Extract contract filters from question using conservative approach
 * Only extracts insurance company if explicitly mentioned
 * Uses fuzzy matching to handle variations (AOK Bayern, AOK, aok, etc.)
 */
export async function extractContractFilters(question: string): Promise<ContractFilters> {
  console.log('[extractContractFilters] Analyzing question:', question);
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Du bist ein Experte für Krankenkassenverträge. Extrahiere Filterkriterien aus der Frage.

WICHTIG - Konservative Filterung:
- Extrahiere NUR explizit genannte Krankenkassen
- Verwende kurze Keywords für Fuzzy-Matching (z.B. "AOK" statt "AOK Bayern")
- Bei Unsicherheit: confidence = "low"
- Produktbereich NICHT extrahieren (zu unsicher)

Beispiele:
- "was zahlt die aok für 19.40.01.7?" → insuranceCompanyKeyword: "AOK", confidence: "high"
- "Preis für 19.40.01.7?" → keine Filter (confidence: "low")
- "AOK vs IKK Vergleich" → insuranceCompanyKeyword: "AOK" (nur erste), confidence: "high"
- "was kostet ein Rollstuhl bei der TK?" → insuranceCompanyKeyword: "TK", confidence: "high"`
        },
        {
          role: "user",
          content: question
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "contract_filters",
          strict: true,
          schema: {
            type: "object",
            properties: {
              insuranceCompanyKeyword: {
                type: "string",
                description: "Short keyword for fuzzy matching (e.g., 'AOK', 'IKK', 'TK'). Null if not explicitly mentioned."
              },
              confidence: {
                type: "string",
                enum: ["high", "low"],
                description: "High if explicitly mentioned, low if inferred or uncertain"
              }
            },
            required: ["confidence"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    if (!content || typeof content !== 'string') {
      console.log('[extractContractFilters] No content in LLM response');
      return { confidence: 'low' };
    }

    const filters = JSON.parse(content) as ContractFilters;
    console.log('[extractContractFilters] Extracted filters:', filters);
    
    // Only use filter if confidence is high
    if (filters.confidence === 'low') {
      console.log('[extractContractFilters] Low confidence, ignoring filters');
      return { confidence: 'low' };
    }
    
    return filters;
  } catch (error) {
    console.error('[extractContractFilters] Error:', error);
    return { confidence: 'low' };
  }
}

/**
 * Known insurance company keywords for fuzzy matching
 * Used to validate extracted keywords
 */
export const KNOWN_INSURANCE_KEYWORDS = [
  'AOK',
  'IKK',
  'TK',
  'Barmer',
  'DAK',
  'KKH',
  'BKK',
  'Techniker',
  'Krankenkasse'
];
