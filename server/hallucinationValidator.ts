import type { Contract, ContractChunk } from '../drizzle/schema';

/**
 * Validates LLM answer against source chunks to detect hallucinations
 * Specifically checks if mentioned insurance companies actually exist in sources
 */
export function validateAnswerAgainstSources(
  answer: string,
  sourceChunks: Array<ContractChunk & { contract: Contract }>
): {
  isValid: boolean;
  hallucinatedCompanies: string[];
  validCompanies: string[];
  suggestion?: string;
} {
  // Extract all insurance companies AND contract names from source chunks
  const sourceCompanies = new Set<string>();
  const sourceContractNames = new Set<string>();
  
  for (const chunk of sourceChunks) {
    if (chunk.contract.insuranceCompany) {
      sourceCompanies.add(chunk.contract.insuranceCompany.toLowerCase().trim());
    }
    if (chunk.contract.name) {
      sourceContractNames.add(chunk.contract.name.toLowerCase().trim());
    }
  }

  console.log('[validateAnswerAgainstSources] Source companies:', Array.from(sourceCompanies));
  console.log('[validateAnswerAgainstSources] Source contract names:', Array.from(sourceContractNames));

  // Extract mentioned insurance companies from answer
  // Look for common patterns like "IKK Classic:", "**Barmer**:", "bei der TK", etc.
  const mentionedCompanies = extractInsuranceCompaniesFromText(answer);
  console.log('[validateAnswerAgainstSources] Mentioned companies:', mentionedCompanies);

  // Check which mentioned companies are NOT in sources (hallucinations)
  const hallucinatedCompanies: string[] = [];
  const validCompanies: string[] = [];

  for (const mentioned of mentionedCompanies) {
    const mentionedLower = mentioned.toLowerCase().trim();
    
    // Check if mentioned company exists in sources (fuzzy match)
    const isValidInCompany = Array.from(sourceCompanies).some(source => 
      source.includes(mentionedLower) || mentionedLower.includes(source)
    );
    
    // Also check if mentioned company appears in contract names (e.g., "BKK" in "BKK 120")
    const isValidInContractName = Array.from(sourceContractNames).some(contractName => 
      contractName.includes(mentionedLower)
    );
    
    const isValid = isValidInCompany || isValidInContractName;

    if (isValid) {
      validCompanies.push(mentioned);
    } else {
      hallucinatedCompanies.push(mentioned);
    }
  }

  const isValid = hallucinatedCompanies.length === 0;

  let suggestion: string | undefined;
  if (!isValid) {
    suggestion = `Die Antwort enthält möglicherweise Informationen über Krankenkassen (${hallucinatedCompanies.join(', ')}), die nicht in den durchsuchten Verträgen vorkommen. Bitte prüfen Sie die Quellenangaben.`;
  }

  return {
    isValid,
    hallucinatedCompanies,
    validCompanies,
    suggestion
  };
}

/**
 * Extract insurance company names from text
 * Looks for common patterns and known insurance company keywords
 */
function extractInsuranceCompaniesFromText(text: string): string[] {
  const companies: string[] = [];
  
  // Known insurance company patterns (extend as needed)
  const knownCompanies = [
    'AOK Bayern',
    'AOK Baden-Württemberg',
    'AOK Nordwest',
    'AOK Plus',
    'AOK',
    'IKK Classic',
    'IKK',
    'Barmer',
    'DAK-Gesundheit',
    'DAK',
    'TK',
    'Techniker Krankenkasse',
    'hkk',
    'KKH',
    'KNAPPSCHAFT',
    'BKK',
    'Mobil Krankenkasse',
    'spectrumK'
  ];

  // Check for each known company in the text
  for (const company of knownCompanies) {
    // Case-insensitive search with word boundaries
    const regex = new RegExp(`\\b${company}\\b`, 'gi');
    if (regex.test(text)) {
      // Avoid duplicates
      if (!companies.some(c => c.toLowerCase() === company.toLowerCase())) {
        companies.push(company);
      }
    }
  }

  return companies;
}

/**
 * Clean answer by removing hallucinated information
 * This is a last-resort fallback - prefer regenerating the answer
 */
export function removeHallucinatedCompanies(
  answer: string,
  hallucinatedCompanies: string[]
): string {
  let cleanedAnswer = answer;

  // Remove bullet points or list items mentioning hallucinated companies
  for (const company of hallucinatedCompanies) {
    // Remove lines starting with bullet points that mention the company
    const bulletRegex = new RegExp(`^\\s*[•\\-\\*]\\s+.*${company}.*$`, 'gmi');
    cleanedAnswer = cleanedAnswer.replace(bulletRegex, '');
    
    // Remove markdown bold mentions
    const boldRegex = new RegExp(`\\*\\*${company}\\*\\*:?[^\\n]*`, 'gi');
    cleanedAnswer = cleanedAnswer.replace(boldRegex, '');
  }

  // Clean up multiple consecutive newlines
  cleanedAnswer = cleanedAnswer.replace(/\n{3,}/g, '\n\n');
  
  return cleanedAnswer.trim();
}
