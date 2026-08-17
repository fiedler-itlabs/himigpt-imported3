import { invokeLLM } from "./_core/llm";

/**
 * Extract version information from filename
 * Returns { year, versionLabel, baseName }
 */
export function extractVersionFromFilename(filename: string): {
  year: string | null;
  versionLabel: string | null;
  baseName: string;
} {
  // Remove .pdf extension
  const name = filename.replace(/\.pdf$/i, "");

  // Try to extract year (2020-2099)
  const yearMatch = name.match(/20\d{2}/);
  const year = yearMatch ? yearMatch[0] : null;

  // Try to extract version label (v1, v2, Q1, Q2, etc.)
  const versionMatch = name.match(/v\d+|Q[1-4]|Version\s*\d+/i);
  const versionLabel = versionMatch ? versionMatch[0] : year;

  // Extract base name (without year/version)
  const baseName = name
    .replace(/20\d{2}/g, "")
    .replace(/v\d+/gi, "")
    .replace(/Q[1-4]/gi, "")
    .replace(/Version\s*\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return { year, versionLabel, baseName };
}

/**
 * Use LLM to suggest if this upload should replace an existing contract
 */
export async function suggestVersionReplacement(
  newContractName: string,
  newInsuranceCompany: string | null,
  existingContracts: Array<{ id: number; name: string; insuranceCompany: string | null; versionLabel: string | null }>
): Promise<{
  shouldReplace: boolean;
  replacementContractId: number | null;
  confidence: "high" | "medium" | "low";
  reason: string;
}> {
  if (existingContracts.length === 0) {
    return {
      shouldReplace: false,
      replacementContractId: null,
      confidence: "high",
      reason: "No similar contracts found",
    };
  }

  const prompt = `You are analyzing whether a new contract upload should replace an existing contract.

New Contract:
- Name: ${newContractName}
- Insurance Company: ${newInsuranceCompany || "Unknown"}

Existing Contracts:
${existingContracts.map((c, i) => `${i + 1}. ID ${c.id}: "${c.name}" (${c.insuranceCompany || "Unknown"}) [Version: ${c.versionLabel || "None"}]`).join("\n")}

Determine if the new contract is a newer version of one of the existing contracts.
Common patterns:
- "Preisliste 2024" replacing "Preisliste 2023"
- "Vertrag v2" replacing "Vertrag v1"
- "AOK Q2 2024" replacing "AOK Q1 2024"

Respond with JSON:
{
  "shouldReplace": boolean,
  "replacementContractId": number | null,
  "confidence": "high" | "medium" | "low",
  "reason": "Brief explanation"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a contract versioning expert. Always respond with valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "version_replacement_suggestion",
          strict: true,
          schema: {
            type: "object",
            properties: {
              shouldReplace: { type: "boolean" },
              replacementContractId: { type: ["number", "null"] },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              reason: { type: "string" },
            },
            required: ["shouldReplace", "replacementContractId", "confidence", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty LLM response");
    if (typeof content !== "string") throw new Error("Invalid LLM response format");

    const result = JSON.parse(content);
    return result;
  } catch (error) {
    console.error("[versionDetection] LLM error:", error);
    return {
      shouldReplace: false,
      replacementContractId: null,
      confidence: "low",
      reason: "LLM error - defaulting to no replacement",
    };
  }
}
