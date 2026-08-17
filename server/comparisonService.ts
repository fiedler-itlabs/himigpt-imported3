import { invokeLLM } from "./_core/llm";
import { extractTextFromPdf } from "./pdfProcessor";

/**
 * Compare multiple contracts based on a specific query
 */
export async function compareContracts(
  contracts: Array<{ id: number; name: string; pdfUrl: string }>,
  query: string
): Promise<{
  query: string;
  comparisons: Array<{
    contractId: number;
    contractName: string;
    findings: string;
  }>;
  summary: string;
}> {
  if (contracts.length < 2) {
    throw new Error("At least 2 contracts are required for comparison");
  }

  // 1. Extract text from all contracts (with smart chunking)
  const contractTexts = await Promise.all(
    contracts.map(async (contract) => {
      const { pages } = await extractTextFromPdf(contract.pdfUrl);
      
      // Smart chunking: Extract relevant sections based on query keywords
      const queryLower = query.toLowerCase();
      const keywords = [
        'preis', 'position', 'gültig', 'kasse', 'produkt', 'leistung',
        'rabatt', 'skonto', 'genehmigung', 'frist', 'zahlung'
      ];
      
      // If query contains specific keywords, try to find relevant pages
      const relevantPages = pages.filter(page => {
        const contentLower = page.content.toLowerCase();
        return keywords.some(kw => queryLower.includes(kw) && contentLower.includes(kw));
      });
      
      // Use relevant pages if found, otherwise use first 5 pages + last page
      let selectedPages = relevantPages.length > 0 ? relevantPages.slice(0, 8) : [
        ...pages.slice(0, Math.min(5, pages.length)),
        ...pages.slice(Math.max(0, pages.length - 1))
      ];
      
      // Limit to max 8 pages per contract to avoid token limits
      selectedPages = selectedPages.slice(0, 8);
      
      const text = selectedPages.map(p => p.content).join('\n\n');
      
      return {
        id: contract.id,
        name: contract.name,
        text: text.slice(0, 15000), // Max 15k chars per contract
        totalPages: pages.length,
        selectedPages: selectedPages.length,
      };
    })
  );

  // 2. Build system prompt for comparison
  const systemPrompt = `Du bist ein Experte für Krankenkassenverträge. Deine Aufgabe ist es, mehrere Verträge zu vergleichen und die Unterschiede strukturiert darzustellen.

WICHTIG:
- Sei präzise und vollständig
- Wenn nach Preisen gefragt wird, liste ALLE Preise auf
- Wenn nach Positionsnummern gefragt wird, liste ALLE Positionsnummern auf
- Markiere Unterschiede klar
- Verwende Tabellen für strukturierte Vergleiche

Format:
- Verwende Markdown-Formatierung
- Verwende **Fettdruck** für wichtige Unterschiede
- Verwende Tabellen für Preis- und Positionsvergleiche
- Strukturiere mit Überschriften (##, ###)

Wenn eine Information nicht im Vertrag enthalten ist, schreibe "Nicht angegeben".`;

  // 3. Build user prompt with all contracts
  const contractsInfo = contractTexts
    .map((ct, idx) => `### Vertrag ${idx + 1}: ${ct.name} (${ct.selectedPages}/${ct.totalPages} Seiten analysiert)\n\n${ct.text}`)
    .join('\n\n---\n\n');

  const userPrompt = `Vergleiche die folgenden ${contracts.length} Verträge basierend auf dieser Frage:

**Frage:** ${query}

Erstelle einen strukturierten Vergleich mit folgenden Abschnitten:
1. Für jeden Vertrag: Was sagt dieser Vertrag zu der Frage?
2. Zusammenfassung: Welche Unterschiede und Gemeinsamkeiten gibt es?

${contractsInfo}`;

  // 4. Generate comparison with LLM (with timeout)
  const response = await Promise.race([
    invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Comparison timeout after 120 seconds. Try a more specific question or compare fewer contracts.')), 120000)
    )
  ]);

  const content = response.choices[0]?.message?.content;
  
  if (!content || typeof content !== 'string') {
    throw new Error("Failed to generate comparison: LLM returned empty or invalid response");
  }

  // 5. Parse response into structured format
  // For now, we'll return the full content as summary
  // Individual findings can be extracted by parsing the markdown sections
  const findings = contractTexts.map((ct) => ({
    contractId: ct.id,
    contractName: ct.name,
    findings: `Siehe Gesamtvergleich`, // Placeholder - could be parsed from response
  }));

  return {
    query,
    comparisons: findings,
    summary: content,
  };
}
