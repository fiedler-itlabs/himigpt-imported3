import { invokeLLM } from "./_core/llm";
import { extractTextFromPdf } from "./pdfProcessor";

/**
 * Generate a contract summary based on a template prompt
 */
export async function generateContractSummary(
  pdfUrl: string,
  templatePrompt: string
): Promise<string> {
  // 1. Extract full text from PDF
  const { pages } = await extractTextFromPdf(pdfUrl);
  const fullText = pages.map(p => p.content).join('\n\n');

  // 2. Build system prompt with completeness instructions
  const systemPrompt = `Du bist ein Experte für Krankenkassenverträge. Deine Aufgabe ist es, einen Vertrag präzise und vollständig zusammenzufassen.

WICHTIG: Vollständigkeit
- Wenn nach Preisen gefragt wird, liste ALLE Preise auf, die im Vertrag vorkommen
- Wenn nach Positionsnummern gefragt wird, liste ALLE Positionsnummern auf
- Wenn nach Kontaktdaten gefragt wird, liste ALLE Kontaktdaten auf
- Lasse keine relevanten Informationen aus

Format-Richtlinien:
- Verwende professionelle Markdown-Formatierung
- Beginne mit einem Titel (# Zusammenfassung: [Vertragsname])
- Strukturiere mit klaren Überschriften (## für Hauptabschnitte, ### für Unterabschnitte)
- Verwende **Fettdruck** für wichtige Begriffe und Werte
- Verwende Markdown-Tabellen für Preisinformationen und strukturierte Daten
- Verwende nummerierte Listen (1., 2., 3.) für Schritt-für-Schritt-Informationen
- Verwende Aufzählungen (-, *, +) für einfache Listen
- Füge Leerzeilen zwischen Abschnitten ein für bessere Lesbarkeit
- Gib bei Preisen immer die Hilfsmittelpositionsnummer an

Beispiel für gute Formatierung:
## Vertragspartner
**Krankenkasse:** IKK classic  
**Ansprechpartner:** Max Mustermann  
**Telefon:** 0123-456789

## Preise
| Position | Bezeichnung | Preis | MwSt. |
|----------|-------------|-------|-------|
| 12.34.56 | Produkt A   | 50,00€| 19%   |

Wenn eine Information nicht im Vertrag enthalten ist, schreibe "Nicht angegeben" statt zu raten.`;

  // 3. Build user prompt with template requirements
  const userPrompt = `Erstelle eine Zusammenfassung des folgenden Vertrags basierend auf diesen Anforderungen:

${templatePrompt}

VERTRAG:
${fullText}`;

  // 4. Generate summary with LLM
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  
  if (!content || typeof content !== 'string') {
    throw new Error("Failed to generate summary: LLM returned empty or invalid response");
  }

  return content;
}

/**
 * Predefined template prompts
 */
export const PREDEFINED_TEMPLATES = {
  backOffice: {
    type: "backOffice" as const,
    title: "Zusammenfassung für Innendienst (Optadata)",
    prompt: `Extrahiere folgende Informationen aus dem Vertrag:

1. Kasse (Krankenkasse)
2. Vertragspartner (z.B. Innung oder Leistungsgemeinschaft)
3. LEGS (Leistungserbringergemeinschaft)
4. Produktgruppe (2-stellig)
5. Gültig ab
6. Gültigkeitsbezug (Verordnungs- oder Leistungserbringungsdatum)
7. Teilnehmende Kassen
8. MwSt. (netto- oder bruttobasiert)
9. Skonto
10. Genehmigungsfreigrenzen
11. Reparaturfreigrenzen
12. Aufzahlung / Mehrkosten
13. Rabatt / Zuschlag
14. Anfahrtspauschale
15. Arbeitswerte
16. Art des Versorgungszeitraums (z.B. Kalendermonat)
17. Depotversorgung
18. Frist VO-Lieferung
19. Zahlungsfrist Kostenträger
20. Widerspruchsfrist Leistungserbringer
21. Widerspruchsfrist Kostenträger
22. Abrechnungsfrist
23. Maßnahmen bei Vertragsverstößen
24. Gegenstand des Vertrages
25. Auslieferungsbestätigung
26. Rückkaufwerte
27. Unterlagen nach HKZ
28. Leistungsbeschreibung
29. Preisstaffeln
30. Abrechnungsmodalitäten (§300 oder §302)

PREISINFO (als Tabelle):
- Hilfsmittelnummer
- Leistung / Bezeichnung
- HKZ
- Produktbesonderheit
- Preis
- MwSt.
- Genehmigungsfrei / pflichtig pro Position
- Genehmigungsfreigrenzen pro Position
- Unterlagen nach HKZ`,
    displayOrder: 1,
  },
  sales: {
    type: "sales" as const,
    title: "Zusammenfassung für Außendienst",
    prompt: `Extrahiere folgende Informationen aus dem Vertrag:

1. Krankenkasse und Ansprechpartner
2. Produktgruppe und Produktbereich
3. Gültigkeitszeitraum
4. Wichtigste Preise und Konditionen (Tabelle)
5. Besondere Vereinbarungen (Rabatte, Zuschläge, Anfahrtspauschalen)
6. Genehmigungsfreigrenzen
7. Lieferfristen
8. Zahlungskonditionen
9. Kontaktdaten für Rückfragen

Fokus: Kundenrelevante Informationen für Verkaufsgespräche`,
    displayOrder: 2,
  },
  management: {
    type: "management" as const,
    title: "Zusammenfassung für Geschäftsführung",
    prompt: `Extrahiere folgende Informationen aus dem Vertrag:

1. Vertragspartner und Krankenkasse
2. Vertragslaufzeit und Kündigungsfristen
3. Produktgruppe und Umfang
4. Finanzielle Rahmenbedingungen:
   - Durchschnittliche Preise
   - Rabatte und Zuschläge
   - Zahlungskonditionen
5. Risiken und Haftung
6. Maßnahmen bei Vertragsverstößen
7. Besondere Vereinbarungen
8. Strategische Relevanz

Fokus: Geschäftskritische Informationen und finanzielle Kennzahlen`,
    displayOrder: 3,
  },
  all: {
    type: "all" as const,
    title: "Vollständige Zusammenfassung (Alle Zielgruppen)",
    prompt: `Erstelle eine umfassende Zusammenfassung des Vertrags mit allen relevanten Informationen:

1. Vertragsparteien und Kontaktdaten
2. Produktgruppe und Leistungsumfang
3. Gültigkeitszeitraum und Kündigungsfristen
4. Finanzielle Konditionen (alle Preise als Tabelle)
5. Genehmigungsverfahren und Freigrenzen
6. Lieferfristen und Versorgungszeiträume
7. Zahlungskonditionen
8. Abrechnungsmodalitäten
9. Besondere Vereinbarungen
10. Maßnahmen bei Vertragsverstößen
11. Weitere relevante Informationen

Fokus: Vollständige, strukturierte Übersicht für alle Mitarbeiter`,
    displayOrder: 4,
  },
};
