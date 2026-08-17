/**
 * LLM-based service to suggest parent contracts for uploaded PDFs
 * Analyzes PDF filename and existing main contracts to find best match
 */

import { invokeLLM } from './_core/llm';
import { getMainContracts } from './db';
import type { Contract } from '../drizzle/schema';

export type ParentSuggestion = {
  suggestedParentId: number | null;
  suggestedParentName: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  suggestedContractType: 'extension' | 'pricelist' | 'productgroup' | 'regional' | null;
  suggestedProductGroups: string | null; // e.g., "4" or "7,8"
};

/**
 * Suggest parent contract for a new upload based on filename
 */
export async function suggestParentContract(
  pdfFileName: string,
  insuranceCompany: string | null
): Promise<ParentSuggestion> {
  console.log(`[suggestParentContract] Analyzing: ${pdfFileName}, Company: ${insuranceCompany}`);
  
  // Get all main contracts
  const mainContracts = await getMainContracts();
  
  // If no main contracts exist, can't suggest anything
  if (mainContracts.length === 0) {
    return {
      suggestedParentId: null,
      suggestedParentName: null,
      confidence: 'low',
      reasoning: 'Keine Hauptverträge vorhanden',
      suggestedContractType: null,
      suggestedProductGroups: null,
    };
  }
  
  // Filter by insurance company if provided
  let candidateContracts = mainContracts;
  if (insuranceCompany) {
    candidateContracts = mainContracts.filter(c => 
      c.insuranceCompany?.toLowerCase().includes(insuranceCompany.toLowerCase())
    );
    
    // If no matches, use all contracts
    if (candidateContracts.length === 0) {
      candidateContracts = mainContracts;
    }
  }
  
  // Prepare contract list for LLM
  const contractList = candidateContracts.map(c => ({
    id: c.id,
    name: c.name,
    insuranceCompany: c.insuranceCompany || 'Unbekannt',
    productArea: c.productArea || 'Unbekannt',
  }));
  
  // Ask LLM to analyze and suggest
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Du bist ein Experte für Krankenkassenverträge in der Orthopädie-Branche.
          
Deine Aufgabe: Analysiere einen PDF-Dateinamen und schlage vor, ob dieser als Sub-Vertrag zu einem bestehenden Hauptvertrag zugeordnet werden sollte.

**Vertragstypen:**
- **extension** (Erweiterung/Nachtrag): Enthält "Nachtrag", "Ergänzung", "Erweiterung", "Anhang", "Addendum"
- **pricelist** (Preisliste): Enthält "Preisliste", "Preis", "Tarif", "Vergütung"
- **productgroup** (Produktgruppe): Enthält "Produktgruppe", "PG", "Gruppe", oder Zahlen wie "04", "07", "23"
- **regional** (Regionale Variante): Enthält Bundesland-Namen wie "Bayern", "NRW", "Hessen"

**Produktgruppen:**
- Extrahiere Zahlen aus Dateinamen wie "PG 4", "Gruppe 07", "PG 7+8", "Produktgruppe 23"
- Format: "4" oder "7,8" (Komma-getrennt bei mehreren)

**Confidence-Levels:**
- **high**: Klare Übereinstimmung (z.B. "AOK Bayern PG 4" → "AOK Bayern Orthopädie")
- **medium**: Wahrscheinliche Übereinstimmung (z.B. "Preisliste 2024" → "AOK Bayern Vertrag")
- **low**: Unsicher oder kein Match`
        },
        {
          role: 'user',
          content: `PDF-Dateiname: "${pdfFileName}"
Krankenkasse (aus Metadaten): "${insuranceCompany || 'Unbekannt'}"

Verfügbare Hauptverträge:
${contractList.map(c => `- ID ${c.id}: ${c.name} (${c.insuranceCompany}, ${c.productArea})`).join('\n')}

Analysiere den Dateinamen und schlage vor:
1. Soll dieser als Sub-Vertrag zugeordnet werden?
2. Wenn ja, zu welchem Hauptvertrag (ID)?
3. Welcher Vertragstyp (extension/pricelist/productgroup/regional)?
4. Welche Produktgruppen (falls productgroup)?
5. Wie sicher bist du (high/medium/low)?`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'parent_suggestion',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              shouldAssignParent: {
                type: 'boolean',
                description: 'true wenn dieser als Sub-Vertrag zugeordnet werden sollte'
              },
              suggestedParentId: {
                type: ['number', 'null'],
                description: 'ID des vorgeschlagenen Hauptvertrags, oder null'
              },
              confidence: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description: 'Confidence-Level der Zuordnung'
              },
              reasoning: {
                type: 'string',
                description: 'Kurze Begründung für die Entscheidung'
              },
              suggestedContractType: {
                type: ['string', 'null'],
                enum: ['extension', 'pricelist', 'productgroup', 'regional', null],
                description: 'Vorgeschlagener Vertragstyp'
              },
              suggestedProductGroups: {
                type: ['string', 'null'],
                description: 'Produktgruppen als String (z.B. "4" oder "7,8"), oder null'
              }
            },
            required: [
              'shouldAssignParent',
              'suggestedParentId',
              'confidence',
              'reasoning',
              'suggestedContractType',
              'suggestedProductGroups'
            ],
            additionalProperties: false
          }
        }
      }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid LLM response format');
    }
    const result = JSON.parse(content);
    console.log('[suggestParentContract] LLM result:', result);
    
    // Find suggested parent name
    let suggestedParentName: string | null = null;
    if (result.suggestedParentId) {
      const parent = candidateContracts.find(c => c.id === result.suggestedParentId);
      suggestedParentName = parent?.name || null;
    }
    
    return {
      suggestedParentId: result.shouldAssignParent ? result.suggestedParentId : null,
      suggestedParentName,
      confidence: result.confidence || 'low',
      reasoning: result.reasoning || 'Keine Begründung verfügbar',
      suggestedContractType: result.shouldAssignParent ? result.suggestedContractType : null,
      suggestedProductGroups: result.suggestedProductGroups || null,
    };
    
  } catch (error) {
    console.error('[suggestParentContract] LLM error:', error);
    
    // Fallback: Return low confidence
    return {
      suggestedParentId: null,
      suggestedParentName: null,
      confidence: 'low',
      reasoning: 'Fehler bei der Analyse',
      suggestedContractType: null,
      suggestedProductGroups: null,
    };
  }
}
