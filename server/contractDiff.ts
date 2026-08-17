import { invokeLLM } from "./_core/llm";
import { getContractById, getChunksByContractId } from "./db";

export type ContractDiff = {
  changes: Array<{
    type: "added" | "removed" | "modified";
    category: "price" | "position" | "condition" | "other";
    description: string;
    oldValue?: string;
    newValue?: string;
    positionNumber?: string;
  }>;
  summary: string;
};

/**
 * Extract differences between two contract versions using LLM
 */
export async function extractContractDiff(
  oldContractId: number,
  newContractId: number
): Promise<ContractDiff> {
  // Get contract metadata
  const oldContract = await getContractById(oldContractId);
  const newContract = await getContractById(newContractId);

  if (!oldContract || !newContract) {
    throw new Error("Contract not found");
  }

  // Get contract chunks (text content)
  const oldChunks = await getChunksByContractId(oldContractId);
  const newChunks = await getChunksByContractId(newContractId);

  // Limit to first 50 chunks to avoid token limits (focus on tables/prices)
  const oldText = oldChunks
    .slice(0, 50)
    .map((c) => c.content)
    .join("\n\n");
  const newText = newChunks
    .slice(0, 50)
    .map((c) => c.content)
    .join("\n\n");

  // Use LLM to analyze differences
  const prompt = `Du bist ein Experte für Vertragsanalyse. Vergleiche zwei Versionen eines Vertrags und extrahiere die wichtigsten Änderungen.

**Alter Vertrag (${oldContract.name}):**
${oldText.slice(0, 10000)}

**Neuer Vertrag (${newContract.name}):**
${newText.slice(0, 10000)}

Analysiere die Unterschiede und gib eine strukturierte JSON-Antwort zurück:

{
  "changes": [
    {
      "type": "added" | "removed" | "modified",
      "category": "price" | "position" | "condition" | "other",
      "description": "Kurze Beschreibung der Änderung",
      "oldValue": "Alter Wert (optional)",
      "newValue": "Neuer Wert (optional)",
      "positionNumber": "Hilfsmittelpositionsnummer (optional)"
    }
  ],
  "summary": "Zusammenfassung der wichtigsten Änderungen (2-3 Sätze)"
}

**Fokus:**
- Preisänderungen (wichtigste Kategorie!)
- Neue/entfernte Hilfsmittelpositionen
- Geänderte Konditionen (Lieferzeit, Genehmigungspflicht, etc.)
- Maximal 20 Änderungen, sortiert nach Wichtigkeit

Antworte NUR mit dem JSON-Objekt, ohne zusätzlichen Text.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Du bist ein Experte für Vertragsanalyse. Antworte immer mit validen JSON-Objekten.",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "contract_diff",
        strict: true,
        schema: {
          type: "object",
          properties: {
            changes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["added", "removed", "modified"],
                  },
                  category: {
                    type: "string",
                    enum: ["price", "position", "condition", "other"],
                  },
                  description: { type: "string" },
                  oldValue: { type: "string" },
                  newValue: { type: "string" },
                  positionNumber: { type: "string" },
                },
                required: ["type", "category", "description"],
                additionalProperties: false,
              },
            },
            summary: { type: "string" },
          },
          required: ["changes", "summary"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Empty LLM response");
  }

  const contentStr = typeof content === "string" ? content : JSON.stringify(content);
  return JSON.parse(contentStr);
}
