import { drizzle } from "drizzle-orm/mysql2";
import { summaryTemplates } from "../drizzle/schema.ts";

const PREDEFINED_TEMPLATES = [
  {
    type: "backOffice",
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
    createdBy: null,
  },
  {
    type: "sales",
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
    createdBy: null,
  },
  {
    type: "management",
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
    createdBy: null,
  },
  {
    type: "all",
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
    createdBy: null,
  },
];

async function seedTemplates() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const db = drizzle(process.env.DATABASE_URL);

  console.log("Seeding predefined summary templates...");

  for (const template of PREDEFINED_TEMPLATES) {
    try {
      await db.insert(summaryTemplates).values(template);
      console.log(`✓ Created template: ${template.title}`);
    } catch (error) {
      console.log(`- Template already exists: ${template.title}`);
    }
  }

  console.log("Done!");
  process.exit(0);
}

seedTemplates();
