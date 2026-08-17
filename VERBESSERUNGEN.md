# HimiGPT - Verbesserungsideen und Roadmap

Dieses Dokument enthält alle identifizierten Verbesserungsmöglichkeiten für HimiGPT, sortiert nach Priorität und Implementierungsstatus.

---

## ✅ Umgesetzte Verbesserungen

### Antwortqualität

- **✅ Optimierter System-Prompt für knappe Antworten**
  - Maximal 2-3 Sätze pro Antwort
  - Keine überflüssigen Einleitungen
  - Direkte Beantwortung der Frage
  
- **✅ Few-Shot Examples im Prompt**
  - Konkrete Beispiele für gute vs. schlechte Antworten
  - Zeigt dem LLM den gewünschten Antwortstil
  
- **✅ Hybrid-Suche (Semantisch + Keyword)**
  - Erkennt Hilfsmittelpositionsnummern automatisch
  - Kombiniert exakte Keyword-Suche mit semantischer Suche
  - Höhere Trefferquote bei spezifischen Produktnummern

- **✅ Similarity-Threshold (0.65)**
  - Filtert irrelevante Chunks heraus
  - Nur hochrelevante Quellen werden verwendet

- **✅ Deduplizierung von Quellenangaben**
  - Zeigt nur 5 relevanteste Quellen
  - Vermeidet redundante Seitenangaben

### Embeddings & Vektordatenbank

- **✅ OpenAI text-embedding-3-large Integration**
  - 3072 Dimensionen für höchste Genauigkeit
  - Besseres Verständnis von Fachbegriffen
  - Ersetzt hash-basierte Placeholder-Embeddings

### Features

- **✅ Dynamische Spaltenverwaltung**
  - Nutzer können eigene Spalten definieren
  - Automatische LLM-Extraktion aus allen Verträgen
  - Flexible Datentypen (Text, Zahl, Datum)

- **✅ Feedback-System (Thumbs-up/down)**
  - Nutzer können Antwortqualität bewerten
  - Basis für kontinuierliche Verbesserung

- **✅ Erweiterte Metadaten-Extraktion**
  - Vertragsbeginn, Ansprechpartner, Kontaktdaten
  - Automatisch aus PDFs extrahiert

---

## 🔄 In Planung / Noch nicht umgesetzt

### Antwortqualität (Hohe Priorität)

#### 1. Kleinere Chunks mit reduziertem Overlap
**Status:** 🔴 Nicht umgesetzt  
**Priorität:** ⭐⭐⭐ Hoch  
**Aufwand:** 2-3 Stunden

**Problem:** Aktuelle 1.000-Zeichen-Chunks können Tabellenzeilen trennen, wodurch Kontext verloren geht.

**Lösung:**
- Chunk-Größe von 1.000 auf 500 Zeichen reduzieren
- Overlap von 200 auf 100 Zeichen reduzieren
- Präzisere Quellenangaben durch kleinere Einheiten

**Erwarteter Effekt:** +15% Antwortgenauigkeit bei Tabellenfragen

---

#### 2. Tabellenstruktur-Erkennung beim Chunking
**Status:** 🔴 Nicht umgesetzt  
**Priorität:** ⭐⭐⭐ Hoch  
**Aufwand:** 4-6 Stunden

**Problem:** Chunks brechen mitten in Tabellenzeilen, wodurch Positionsnummern von Preisen getrennt werden.

**Lösung:**
- Erkennung von Markdown-Tabellen im PDF-Text
- Erkennung von Spaltenstrukturen (mehrere Leerzeichen/Tabs)
- Chunks an Tabellenenden brechen, nicht mittendrin
- Tabellenzeilen zusammenhalten (Positionsnummer + Beschreibung + Preis)

**Implementierung:**
```typescript
function splitIntoChunksWithTableAwareness(text: string): Chunk[] {
  // 1. Erkennung von Tabellenstrukturen
  // 2. Markierung von Tabellengrenzen
  // 3. Chunking mit Respekt vor Tabellen
}
```

**Erwarteter Effekt:** +25% Antwortgenauigkeit bei Preisfragen

---

#### 3. Re-Ranking der Suchergebnisse mit LLM
**Status:** 🔴 Nicht umgesetzt  
**Priorität:** ⭐⭐ Mittel  
**Aufwand:** 3-4 Stunden

**Problem:** Cosine-Similarity allein reicht nicht - manchmal sind semantisch ähnliche Chunks nicht relevant für die konkrete Frage.

**Lösung:** Zweistufiger Prozess
1. **Erste Suche:** Hole 20 Kandidaten-Chunks (statt 10)
2. **Re-Ranking:** LLM bewertet jeden Chunk
   - Prompt: "Bewerte auf einer Skala von 1-10, wie relevant dieser Text für die Frage ist"
   - Input: Frage + Chunk
   - Output: Relevanz-Score (1-10)
3. **Finale Auswahl:** Nur Top 5 Chunks gehen in die Antwort

**Implementierung:**
```typescript
async function rerankChunks(
  question: string,
  chunks: Chunk[]
): Promise<RankedChunk[]> {
  const rankings = await Promise.all(
    chunks.map(chunk => 
      llm.evaluate({
        question,
        chunk: chunk.content,
        instruction: "Rate relevance 1-10"
      })
    )
  );
  return chunks
    .map((chunk, i) => ({ ...chunk, score: rankings[i] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
```

**Erwarteter Effekt:** +10% Antwortgenauigkeit, weniger irrelevante Quellen

---

#### 4. Antwort-Validierung
**Status:** 🔴 Nicht umgesetzt  
**Priorität:** ⭐⭐ Mittel  
**Aufwand:** 2-3 Stunden

**Problem:** LLM gibt manchmal Antworten, die die Frage nicht wirklich beantworten.

**Lösung:** Validierung nach der Antwort-Generierung
1. **Prüfung:** Hat die Antwort die Frage beantwortet?
2. **Zweiter Versuch:** Falls nein, präziserer Prompt
3. **Fallback:** "Keine Information gefunden" statt Spekulation

**Implementierung:**
```typescript
async function validateAnswer(
  question: string,
  answer: string
): Promise<boolean> {
  const validation = await llm.ask({
    prompt: `Frage: "${question}"\nAntwort: "${answer}"\n\nWurde die Frage beantwortet? (Ja/Nein)`
  });
  return validation.toLowerCase().includes("ja");
}
```

**Erwarteter Effekt:** -30% falsche/ausweichende Antworten

---

### Features (Mittlere Priorität)

#### 5. Batch-Upload mit Drag & Drop
**Status:** 🔴 Nicht umgesetzt  
**Priorität:** ⭐⭐ Mittel  
**Aufwand:** 3-4 Stunden

**Beschreibung:**
- Mehrere PDFs gleichzeitig hochladen
- Drag & Drop Bereich statt File-Input
- Progress-Bar für jeden Vertrag
- Parallele Verarbeitung (bis zu 3 gleichzeitig)

**Use-Case:** Onboarding neuer Kunden mit 20+ Verträgen

---

#### 6. Chat-Export als PDF
**Status:** 🔴 Nicht umgesetzt  
**Priorität:** ⭐⭐ Mittel  
**Aufwand:** 4-5 Stunden

**Beschreibung:**
- Export-Button in jedem Chat
- PDF mit Fragen, Antworten und Quellenangaben
- Formatierung mit Markdown-Rendering
- Logo und Branding

**Use-Case:** Dokumentation für Audits, Weitergabe an Kollegen

---

#### 7. Vertragsversionierung
**Status:** 🔴 Nicht umgesetzt  
**Priorität:** ⭐ Niedrig  
**Aufwand:** 6-8 Stunden

**Beschreibung:**
- Mehrere Versionen desselben Vertrags speichern
- Automatische Auswahl der aktuell gültigen Version
- Basierend auf `validFrom` und `validUntil` Datum
- Historische Versionen durchsuchbar

**Use-Case:** Vertragsänderungen nachvollziehen

---

### Technische Verbesserungen

#### 8. OAuth-Problem für Produktion lösen
**Status:** 🔴 Kritisch - Dev-Mode Workaround aktiv  
**Priorität:** ⭐⭐⭐ Hoch  
**Aufwand:** 4-6 Stunden

**Problem:** JWT-Secret ändert sich bei Server-Neustarts, Session-Cookies werden ungültig.

**Lösung:**
- JWT_SECRET persistent machen (Environment Variable)
- Alternative: Session-Storage in Datenbank statt JWT
- Alternative: Redis für Session-Management

---

#### 9. Feedback-Loop Analytics
**Status:** 🔴 Nicht umgesetzt  
**Priorität:** ⭐⭐ Mittel  
**Aufwand:** 3-4 Stunden

**Beschreibung:**
- Dashboard für Feedback-Statistiken
- Welche Fragen führen zu Thumbs-down?
- Automatische Prompt-Optimierung basierend auf Feedback
- A/B-Testing verschiedener Prompt-Varianten

---

#### 10. Caching für häufige Fragen
**Status:** 🔴 Nicht umgesetzt  
**Priorität:** ⭐ Niedrig  
**Aufwand:** 2-3 Stunden

**Beschreibung:**
- Cache für identische/ähnliche Fragen
- Redis oder In-Memory Cache
- TTL: 24 Stunden
- Reduziert LLM-Kosten um 30-50%

---

## 📊 Priorisierungs-Matrix

| Feature | Priorität | Aufwand | Erwarteter Effekt | Empfehlung |
|---------|-----------|---------|-------------------|------------|
| Kleinere Chunks | ⭐⭐⭐ | 2-3h | +15% Genauigkeit | **Sofort umsetzen** |
| Tabellenstruktur-Erkennung | ⭐⭐⭐ | 4-6h | +25% Genauigkeit | **Sofort umsetzen** |
| OAuth-Fix | ⭐⭐⭐ | 4-6h | Produktionsreife | **Vor Launch** |
| Re-Ranking | ⭐⭐ | 3-4h | +10% Genauigkeit | Nach Chunks |
| Antwort-Validierung | ⭐⭐ | 2-3h | -30% Fehler | Nach Chunks |
| Batch-Upload | ⭐⭐ | 3-4h | UX-Verbesserung | Nice-to-have |
| Chat-Export | ⭐⭐ | 4-5h | UX-Verbesserung | Nice-to-have |
| Feedback Analytics | ⭐⭐ | 3-4h | Langfristig | Nach Launch |
| Vertragsversionierung | ⭐ | 6-8h | Edge-Case | Später |
| Caching | ⭐ | 2-3h | Kosten-Optimierung | Später |

---

## 🎯 Empfohlene Roadmap

### Phase 1: Antwortqualität maximieren (1-2 Wochen)
1. ✅ Optimierter Prompt + Few-Shot Examples (erledigt)
2. 🔄 Kleinere Chunks (500 Zeichen, 100 Overlap)
3. 🔄 Tabellenstruktur-Erkennung
4. 🔄 Re-Ranking mit LLM
5. 🔄 Antwort-Validierung

**Ziel:** +50% Antwortgenauigkeit, besonders bei Tabellenfragen

### Phase 2: Produktionsreife (1 Woche)
1. 🔄 OAuth-Problem lösen
2. 🔄 Umfangreiches Testing mit allen Beispielverträgen
3. 🔄 Performance-Optimierung (Caching)
4. 🔄 Error-Handling verbessern

**Ziel:** Stabile, produktionsreife Anwendung

### Phase 3: UX-Verbesserungen (1-2 Wochen)
1. 🔄 Batch-Upload mit Drag & Drop
2. 🔄 Chat-Export als PDF
3. 🔄 Feedback Analytics Dashboard
4. 🔄 Mobile-Optimierung

**Ziel:** Professionelle, nutzerfreundliche Anwendung

### Phase 4: Advanced Features (optional)
1. 🔄 Vertragsversionierung
2. 🔄 Multi-Tenancy (mehrere Organisationen)
3. 🔄 API für externe Integrationen
4. 🔄 Automatische Vertragsanalyse (Anomalien, Vergleiche)

---

## 💡 Weitere Ideen (Brainstorming)

### Antwortqualität
- **Kontextuelle Nachfragen:** "Meinten Sie Vertrag X oder Y?"
- **Unsicherheits-Indikator:** "Ich bin mir zu 85% sicher, dass..."
- **Vergleichsfunktion:** "Vergleiche AOK Bayern mit Techniker Krankenkasse"

### Features
- **Favoriten/Bookmarks:** Wichtige Verträge markieren
- **Tags:** Verträge kategorisieren (z.B. "Rollstühle", "Inkontinenz")
- **Benachrichtigungen:** "Vertrag läuft in 30 Tagen aus"
- **Kollaboration:** Kommentare zu Verträgen, Team-Chats

### Integration
- **E-Mail-Integration:** Verträge per E-Mail hochladen
- **Slack/Teams Bot:** HimiGPT im Team-Chat
- **API:** Externe Systeme anbinden (ERP, CRM)
- **Zapier/Make Integration:** Automatisierung

---

## 📝 Notizen

- Alle Verbesserungen sollten mit A/B-Testing validiert werden
- Feedback-Daten sind Gold wert - unbedingt sammeln und analysieren
- Performance-Monitoring einrichten (Antwortzeit, Token-Verbrauch)
- Regelmäßige Reviews mit echten Nutzern durchführen

---

**Letzte Aktualisierung:** 04.02.2026  
**Version:** 1.0
