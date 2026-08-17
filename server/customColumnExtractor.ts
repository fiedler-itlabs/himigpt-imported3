import { invokeLLM } from "./_core/llm";
import type { CustomColumn } from "../drizzle/schema";

/**
 * Extracts custom column values from contract text using LLM
 */
export async function extractCustomColumnValue(
  contractText: string,
  column: CustomColumn
): Promise<string | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Du bist ein Experte für die Extraktion von Informationen aus Krankenkassenverträgen. 
Extrahiere die angeforderte Information aus dem Vertragstext. 
Wenn die Information nicht gefunden werden kann, antworte mit "nicht gefunden".
Sei präzise und gib nur die relevante Information zurück, ohne zusätzliche Erklärungen.`,
        },
        {
          role: "user",
          content: `Extrahiere folgende Information aus diesem Vertrag:

**Zu extrahierende Information:** ${column.name}
**Beschreibung:** ${column.description}
**Datentyp:** ${column.dataType}

**Vertragstext (Auszug):**
${contractText.slice(0, 8000)}

Gib nur den extrahierten Wert zurück, ohne zusätzliche Erklärungen.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    const extractedValue = typeof content === 'string' ? content.trim() : null;
    
    if (!extractedValue || extractedValue.toLowerCase().includes("nicht gefunden")) {
      return null;
    }

    // Validate based on data type
    if (column.dataType === "number") {
      const num = parseFloat(extractedValue.replace(/[^\d.,]/g, "").replace(",", "."));
      return isNaN(num) ? null : num.toString();
    }

    if (column.dataType === "date") {
      // Try to parse date
      const dateMatch = extractedValue.match(/\d{1,2}\.\d{1,2}\.\d{2,4}/);
      return dateMatch ? dateMatch[0] : null;
    }

    return extractedValue;
  } catch (error) {
    console.error("[CustomColumnExtractor] Error extracting value:", error);
    return null;
  }
}

/**
 * Extracts all custom column values for a contract
 */
export async function extractAllCustomColumns(
  contractText: string,
  columns: CustomColumn[]
): Promise<Record<number, string | null>> {
  const result: Record<number, string | null> = {};

  for (const column of columns) {
    const value = await extractCustomColumnValue(contractText, column);
    result[column.id] = value;
  }

  return result;
}
