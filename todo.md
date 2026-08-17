# HimiGPT - Project TODO

## Core Features

- [x] PDF-Upload und -Verarbeitung: Nutzer können PDF-Verträge hochladen, die automatisch in Text/Markdown konvertiert werden
- [x] Vektordatenbank-Integration: Extrahierter Text wird in eine Vektordatenbank gespeichert mit Metadaten für Seitennummern und Quellenangaben
- [x] KI-gestützter Chat: Mitarbeiter können natürlichsprachige Fragen zu Verträgen stellen
- [x] Semantische Suche: RAG-System findet relevante Vertragspassagen basierend auf Hilfsmittelpositionsnummern und Krankenkassen
- [x] Klickbare Quellenangaben: Antworten enthalten Seitennummern im Footer, die das PDF auf der entsprechenden Seite öffnen
- [x] Chat-Historie: Nutzer können neue Chats starten und alte Konversationen einsehen
- [x] Admin-Bereich: Vertragsverwaltung mit Tabellendarstellung aller hochgeladenen Verträge
- [x] Vertragserkennung: Automatische Extraktion von Krankenkasse, Vertragsnummer und Produktbereich aus PDFs
- [x] PDF-Viewer mit Seitennavigation: Integrierter Viewer zum Anzeigen der Originalverträge an der richtigen Stelle
- [x] Benutzerrollen: Admin (Vertragsverwaltung + Chat) und Benutzer (nur Chat) mit entsprechenden Berechtigungen
- [x] LLM-Integration: Generierung von Embeddings für Vektordatenbank und präzise Antworten
- [x] S3-Storage: Hochgeladene PDF-Verträge sicher in S3 speichern

## Database Schema

- [x] Contracts table (id, name, insuranceCompany, contractNumber, productArea, pdfUrl, totalPages, status, uploadedBy, createdAt)
- [x] ContractChunks table (id, contractId, content, pageNumber, embedding, metadata)
- [x] Chats table (id, userId, title, createdAt, updatedAt)
- [x] ChatMessages table (id, chatId, role, content, sources, createdAt)

## Backend

- [x] Contract upload endpoint with S3 storage
- [x] PDF text extraction with page tracking
- [x] Embedding generation for contract chunks
- [x] RAG search endpoint
- [x] Chat completion endpoint with sources
- [x] Contract metadata extraction

## Frontend

- [x] Dashboard layout with sidebar navigation
- [x] Chat interface with message history
- [x] New chat creation
- [x] Chat list sidebar
- [x] Source citations with clickable page numbers
- [x] PDF viewer modal with page navigation
- [x] Admin contracts table
- [x] Contract upload form
- [x] Contract detail view

## Bugs

- [x] Fix: OAuth-Anmeldung funktioniert nicht - Cookie SameSite auf 'lax' geändert
- [ ] KRITISCH: OAuth funktioniert nicht - JWT Signatur-Verifikation schlägt fehl nach Server-Neustart
- [x] Temporäre Lösung: Dev-Mode implementiert - Auth wird in Development umgangen
- [x] Fix: Vertrag-Upload läuft auf Fehler - JSON Schema korrigiert
- [x] Fix: Embedding API gibt 404 Fehler - Fallback auf hash-basierte Embeddings implementiert
- [x] Fix: Invalid time value beim Speichern des Vertrags in die Datenbank - Datums-Validierung hinzugefügt
- [x] Fix: JSON-Parsing Fehler bei großen PDFs - Verwende pdftotext statt LLM für Text-Extraktion

## Verbesserungen für Suchqualität

- [x] Problem: Hilfsmittelpositionsnummern werden nicht gefunden (z.B. 19.40.01.7)
- [x] Implementiere OpenAI text-embedding-3-large für bessere Genauigkeit
- [x] Implementiere Hybrid-Suche (semantisch + Keyword-Suche für Positionsnummern)
- [ ] Optimiere RAG-Prompt für präzisere Antworten
- [ ] Teste mit allen Beispielverträgen

## Quellenangaben-Optimierung

- [x] Reduziere Chunk-Anzahl von 15 auf 10 für semantische Suche
- [x] Implementiere Similarity-Threshold (nur Chunks mit >0.65 Ähnlichkeit)
- [x] Dedupliziere Seiten und zeige nur 5 relevanteste Quellen

## Neue Features

- [x] Tabellenstruktur-Erkennung für besseres Chunking - Hybrid-Suche implementiert
- [x] Antwort-Qualität-Feedback (Thumbs-up/down Buttons) - Feedback-System mit Thumbs-up/down implementiert
- [x] Dynamische Spalten in Vertragstabelle - Vertragsbeginn, Ansprechpartner, E-Mail, Telefon hinzugefügt
- [x] Automatisches Auslesen zusätzlicher Metadaten aus Verträgen - LLM extrahiert Kontaktdaten automatisch

## Dynamische Spaltenverwaltung

- [x] Datenbank-Schema: customColumns Tabelle für benutzerdefinierte Spalten
- [x] Datenbank-Schema: contractCustomData Tabelle für extrahierte Werte
- [x] Backend: API zum Erstellen/Löschen von Custom Columns
- [x] Backend: LLM-Extraktion für benutzerdefinierte Felder
- [x] Frontend: "Spalte hinzufügen" Dialog in Vertragstabelle
- [x] Frontend: Dynamische Spalten-Anzeige in der Tabelle
- [x] Frontend: Re-Extraktion bei neuen Spalten für bestehende Verträge

## Antwortqualitäts-Optimierungen

- [x] Optimierter System-Prompt für knappe, präzise Antworten
- [x] Few-Shot Examples im Prompt für bessere Antwortstruktur
- [x] Kleinere Chunks (500 Zeichen) mit reduziertem Overlap (100 Zeichen)
- [x] Tabellenstruktur-Erkennung beim Chunking
- [x] Re-Ranking der Suchergebnisse mit LLM-Bewertung

## Chunk-Optimierungen

- [x] Reduziere Chunk-Größe von 1000 auf 500 Zeichen
- [x] Reduziere Overlap von 200 auf 100 Zeichen
- [x] Implementiere Tabellenstruktur-Erkennung (erkennt Positionsnummern + Preise)
- [x] Chunks an natürlichen Grenzen brechen (Absätze, Sätze, Zeilen)
- [x] Größere Chunks für Tabellen (800 Zeichen) um Kontext zu bewahren
- [x] Unit-Tests für Chunking-Strategie
- [ ] Re-Indexierung aller bestehenden Verträge mit neuer Chunk-Strategie

## Re-Ranking Implementation

- [x] LLM-basiertes Re-Ranking der Suchergebnisse
- [x] Relevanz-Score für jeden Chunk basierend auf Frage (0-10 Skala)
- [x] Sortierung der Chunks nach Relevanz vor Antwortgenerierung
- [x] Unit-Tests für Re-Ranking Funktion
- [x] Fallback zu Original-Reihenfolge bei LLM-Fehlern
- [x] Effizienz-Optimierung: Nur erste 500 Zeichen pro Chunk

## Chat-Antwort-Optimierungen (Erweitert)

- [x] Kontext-Anreicherung: Metadaten (Vertragsdatum, Produktbereich, Krankenkasse) in Kontext einbinden
- [x] Intelligente Quellenangaben: Vertragsname in [Vertragsname, Seite X] Format integrieren
- [x] Antwort-Validierung: Prüft ob Antwort Preis enthält, Position erwähnt, Quellenangabe hat, ausreichend lang ist
- [x] Kontext-Deduplizierung: Jaccard-Similarity (80% Threshold) entfernt redundante Chunks
- [x] Dynamische Antwort-Länge: 1 Satz (einfach), 2-3 Sätze (mittel), 3-4 Sätze (komplex)
- [x] Unit-Tests für alle Optimierungen

## Vertragsvergleichs-Feature

- [x] Backend: Vergleichsfragen erkennen (Keywords: vergleich, unterschied, besser, günstiger, vs)
- [x] Backend: Strukturierte Vergleichsantwort mit ComparisonData[] generieren
- [x] Backend: Automatische Extraktion von Krankenkassen-Namen (AOK, IKK, TK, Barmer, DAK, KKH)
- [x] Backend: LLM-basierte Preis- und Konditionsextraktion pro Krankenkasse
- [x] Frontend: Vergleichstabelle-Komponente mit Cards und Badges
- [x] Frontend: Grünes Highlight für günstigsten Preis, rotes für teuersten
- [x] Frontend: Preisdifferenz-Berechnung (Prozent + absolut)
- [x] Frontend: Konditionen als Bullet-Liste
- [x] Unit-Tests für Vergleichslogik (19 Tests)

## Vergleichs-Export-Feature

- [x] Backend: Excel-Export mit exceljs (formatierte Tabelle, Styling, Highlights)
- [x] Backend: PDF-Export mit pdfkit (professionelles Layout, Badges, Separatoren)
- [x] Backend: S3-Upload für generierte Dateien
- [x] Backend: tRPC-Endpunkt export.comparisonTable (data, positionNumber, format)
- [x] Frontend: Export-Buttons in ComparisonTable (FileSpreadsheet + FileText Icons)
- [x] Frontend: Automatischer Download via <a> Element
- [x] Frontend: Loading-Spinner (Loader2) während Export
- [x] Frontend: Error-Handling mit Alert
- [x] Unit-Tests für Export-Funktionen (27 Tests)

## PDF-Viewer-Sidebar

- [x] Backend: PDF-URLs bereits verfügbar via trpc.pdf.getUrl
- [x] Frontend: ResizablePDFViewer-Komponente mit react-pdf
- [x] Frontend: Drag-Handle für Maus-Resize (min 300px, max window-200px)
- [x] Frontend: Integration in Vertragsmanager (FileText-Button bei ready-Verträgen)
- [x] Frontend: Integration in Chat-Quellenangaben (Klick auf Quelle)
- [x] Frontend: Seiten-Navigation (Pfeile, Seitenanzeige, Eingabefeld)
- [x] Frontend: Zoom-Funktionalität (0.5x - 3.0x, ZoomIn/ZoomOut Buttons)
- [x] Frontend: Schließen-Button (X) zum Ausblenden der Sidebar
- [x] Frontend: Persistierung der Sidebar-Breite in localStorage
- [x] Frontend: PDF.js Worker via CDN konfiguriert

## PDF.js Worker Fix

- [x] Fix 404 error für PDF.js Worker
- [x] CDN-URL funktioniert nicht - verwende lokalen Worker aus pdfjs-dist
- [x] Worker-Datei nach client/public/pdf.worker.min.mjs kopiert (1.1MB)
- [x] Update ResizablePDFViewer mit lokalem Worker-Pfad (/pdf.worker.min.mjs)

## PDF.js Version Mismatch Fix

- [x] Versions-Inkompatibilität: react-pdf API 5.4.296 vs Worker 5.4.624
- [x] Downgrade pdfjs-dist auf 5.4.296 für Kompatibilität
- [x] Aktualisiere Worker-Datei mit korrekter Version (1022KB)

## PDF Failed to Fetch Fix

- [x] UnknownErrorException: Failed to fetch beim PDF-Laden
- [x] CORS-Problem mit direkten S3-URLs identifiziert
- [x] PDF-Proxy-Endpunkt implementiert (/api/pdf/proxy/:contractId)
- [x] Proxy holt PDF von S3 und streamt es mit CORS-Headern
- [x] Frontend verwendet Proxy-URL statt direkte S3-URL

## PDF-Viewer-Ersatz (Native Browser PDF)

- [ ] react-pdf rendert Seiten falsch und zeigt nur 2 von 95 Seiten
- [ ] Entferne react-pdf und pdfjs-dist Dependencies
- [ ] Ersetze durch nativen Browser-PDF-Viewer (iframe)
- [ ] Behalte Resize-Funktionalität und Sidebar-Layout
- [ ] Implementiere Seiten-Navigation via URL-Parameter (#page=X)

## PDF-Viewer-Ersatz (Native Browser PDF)

- [x] react-pdf rendert Seiten falsch und zeigt nur 2 von 95 Seiten
- [x] Entferne react-pdf und pdfjs-dist Dependencies (beide deinstalliert)
- [x] Ersetze durch nativen Browser-PDF-Viewer (iframe mit #page=X&zoom=Y)
- [x] Behalte Resize-Funktionalität und Sidebar-Layout (Drag-Handle)
- [x] Implementiere Seiten-Navigation via URL-Parameter
- [x] Zoom-Steuerung (50%-200%, Reset-Button)
- [x] Alle Browser-PDF-Features verfügbar (Drucken, Download, Suche)
- [x] Worker-Datei entfernt (1.1MB gespart)

## RAG-System Debugging (Falsche Suchergebnisse)

- [x] Problem: KI findet Position 19.40.01.7 nicht, zeigt stattdessen 22.29.01.7 (Seite 56)
- [x] Debug-Endpunkt erstellt: trpc.chats.debugSearch zeigt Chunks + Scores
- [x] Root-Cause identifiziert: **Tabellen-Chunking zerstört Preis-Positions-Bindung**
- [x] Chunk 60338 (Seite 56): Enthält 19.40.01.7 aber KEINEN Preis
- [x] Tabellen werden zu klein gechunkt (800 Zeichen) - Positionsnummer und Preis landen in verschiedenen Chunks
- [x] Fix: Größere Table-Chunks (2000 Zeichen statt 800)
- [x] Fix: Verbesserte Tabellenerkennung (Header + Positionsnummer)
- [x] Fix: Preis-Positionsnummer-Bindung durch größere Chunks
- [x] Re-Indexierung AOK Bayern Vertrag erfolgreich
- [x] ✅ KI findet jetzt Preis (250,00 €) korrekt!
- [x] ❌ Problem: Falsche Seitenzuordnung (zeigt Seite 53 statt 41)
- [x] Fix: pdftotext -layout mit Form-Feed (\f) für exakte Seitengrenzen
- [x] ✅ Seitennummern jetzt korrekt (41 statt 53)!
- [x] ❌ Neues Problem: -layout fügt viele Leerzeichen ein → Chunks zu groß → Preis fehlt
- [ ] Lösung: pdfplumber für strukturierte Tabellenextraktion
- [ ] Installiere pdfplumber (Python)
- [ ] Python-Script: Extrahiere Tabellen als JSON (Zeile für Zeile)
- [ ] Jede Tabellenzeile = 1 Chunk (Position + Preis garantiert zusammen)
- [ ] Integriere pdfplumber in pdfProcessor.ts
- [ ] Re-Indexierung mit strukturierten Tabellen-Chunks

## Chat-UX-Verbesserungen

- [x] Nachricht sofort anzeigen (bevor LLM antwortet) - Optimistic Update
- [x] Chat-Input fix am unteren Bildschirmrand (sticky bottom)
- [x] Chat-Bereich scrollbar mit overflow-y-auto
- [x] Auto-Scroll zu neuen Nachrichten (smooth behavior)

## PDF-Viewer-Vereinfachung

- [x] Entferne Zoom- und Navigations-Controls
- [x] Zeige nur reinen PDF-Inhalt mit Schließen-Button
- [x] Browser-native PDF-Controls verfügbar

## Position Number Recognition Fix

- [x] Fix regex pattern to support 4+ digit segments (e.g., 22.00.99.9915)
- [x] Update extractPositionNumbers function in rag.ts
- [x] Test with problematic position 22.00.99.9915
- [x] Create unit tests (12 tests, all passing)

## Contract Filtering für große Vertragsmengen (100+ Verträge)

### Problem
- Aktuelle Suche lädt ALLE Chunks aus ALLEN Verträgen (20.000+ Chunks bei 100 Verträgen)
- Performance-Bottleneck: Langsame Antwortzeiten, hoher Speicherverbrauch
- Schlechte Skalierbarkeit bei hunderten Verträgen

### Lösung: 3-Stufige Filterung

#### Stufe 1: Metadaten-Pre-Filtering
- [x] Implementiere `extractContractFilters(question)` - LLM extrahiert Krankenkasse (konservativ, nur bei hoher Confidence)
- [x] Implementiere `filterContractsByMetadata(filters)` - SQL-Filter mit Fuzzy-Matching (LIKE %keyword%)
- [x] Fallback-Logik: Suche in allen Verträgen wenn keine Treffer oder niedrige Confidence
- [x] Unit-Tests für Filter-Extraktion (11 Tests, alle passing)

#### Stufe 2: Embedding-Suche in gefilterten Verträgen
- [x] Erweitere `searchSimilarChunks()` um optionalen `contractIds` Parameter
- [x] Erweitere `searchByKeyword()` um optionalen `contractIds` Parameter
- [x] Lade nur Chunks der gefilterten Verträge (SQL WHERE contractId IN (...))

#### Stufe 3: Integration in queryContracts
- [x] Integriere Filter-Extraktion in `queryContracts()`
- [x] Übergebe gefilterte Contract-IDs an `searchSimilarChunks()` und `searchByKeyword()`
- [x] Logging für Debugging (gefilterte Verträge, Anzahl Chunks, Confidence)
- [ ] End-to-End Tests mit mehreren Verträgen

### Performance-Ziele
- Chunks durchsucht: 20.000 → 1.000 (95% Reduktion)
- Antwortzeit: 5-10s → 1-2s (80% schneller)
- Speicherverbrauch: 500 MB → 25 MB (95% weniger)

### Zusätzliche Optimierungen (Optional)
- [ ] Vektor-Datenbank (Pinecone, Weaviate, pgvector) für 1000+ Verträge
- [ ] Caching für häufige Fragen
- [ ] Parallel Search bei vielen gefilterten Verträgen (>20)

## CRITICAL BUG: LLM Hallucination - Invented Insurance Companies

### Problem
LLM erfindet Krankenkassen und behauptet, Position sei in Verträgen enthalten, die sie nicht haben:
- Frage: "haben wir den artikel auch in anderen verträgen?"
- LLM-Antwort: "Ja, Position 19.40.01.7 ist in IKK Classic, Barmer, DAK-Gesundheit, hkk, KNAPPSCHAFT, Techniker Krankenkasse enthalten"
- Realität: Alle Quellenangaben zeigen "Seite 41" = AOK Bayern Vertrag
- **Alle anderen Krankenkassen sind erfunden!**

### Root Cause
- System-Prompt sagt "Nutze NUR die bereitgestellten Vertragsauszüge"
- LLM ignoriert diese Anweisung und halluziniert Informationen
- Keine Validierung der generierten Antwort gegen Quell-Chunks

### Lösung: Post-Generation Validation
- [x] Implementiere `validateAnswerAgainstSources()` Funktion
- [x] Extrahiere alle Krankenkassen aus LLM-Antwort
- [x] Prüfe ob Krankenkassen in Quell-Chunks vorkommen (insuranceCompany + contractName)
- [x] Verschärfe System-Prompt mit expliziter Warnung
- [x] Unit-Tests für Hallucination-Detection (10 tests, all passing)

### Answer Regeneration on Hallucination Detection

- [x] Implement automatic answer regeneration when hallucination is detected
- [x] Add retry logic with stricter prompt (max 1 retry)
- [x] Stricter prompt lists valid company names explicitly
- [x] Test with problematic query and verify no hallucinations in regenerated answer

### Improve Hallucination Validator - Contract Name Matching

- [x] Extend validateAnswerAgainstSources to check contract names (not just insuranceCompany)
- [x] Recognize "BKK" as valid when contract name contains "BKK" (e.g., "BKK 120")
- [x] Recognize "IKK" as valid when contract name contains "IKK" (e.g., "IKK Classic")
- [x] Test with BKK contracts and verify no false positives (4 tests, all passing)
- [x] Live test confirms no hallucination warnings for valid BKK/IKK mentions

## Contract Scoping Feature

### Problem
- Users have hundreds of contracts uploaded
- Want to search only in specific contracts (e.g., "only AOK contracts")
- Need visual indication of which contracts are active in chat

### Solution: Pre-Chat Contract Selector

#### Backend Changes

##### Database Schema
- [x] Add `scopedContractIds` field to `chats` table (JSON array of contract IDs)
- [x] Migration: Add column with default NULL (= all contracts)

##### API Changes
- [x] Extend `chats.create` mutation: Accept optional `contractIds: number[]` parameter
- [x] Extend `chats.sendMessage` mutation: Pass `scopedContractIds` to RAG system
- [x] Extend `chats.list` query: Return `scopedContractIds` with chat details
- [x] Update `queryContracts()` in rag.ts: Filter by `scopedContractIds` if provided

#### Frontend Changes

##### Contract Selector Modal
- [x] Create `ContractSelectorModal` component with Dialog from shadcn/ui
- [x] Search bar: Filter contracts by name, insuranceCompany, productArea
- [x] Grouped list: Group contracts by insuranceCompany (Accordion from shadcn/ui)
- [x] Multi-select: Checkbox for each contract
- [x] Bulk actions: "Alle auswählen", "Alle abwählen"
- [x] Selected counter: "X Verträge ausgewählt"
- [x] Radio buttons: "Alle Verträge" vs "Bestimmte Verträge auswählen"

##### Chat UI Updates
- [x] Update "Neuen Chat starten" button: Open ContractSelectorModal instead of direct navigation
- [x] Chat header: Show scope indicator "📋 X Verträge: AOK Bayern, Mobil Krankenkasse" when scoped
- [x] Live test confirms scoping works correctly (only searches in selected contracts)
- [ ] Chat header: Add "Scope ändern" button (disabled after first message)
- [ ] Chat list sidebar: Show icon (📋 = scoped, 💬 = all contracts)
- [ ] First message: Show "🔍 Durchsuche X ausgewählte Verträge..." when scoped

##### State Management
- [ ] Add `scopedContractIds` to chat context
- [ ] Pass `scopedContractIds` to `trpc.chats.query.useMutation()`
- [ ] Store selected contracts in ContractSelectorModal state
- [ ] Persist scope in chat creation

#### Testing
- [ ] Unit tests: Chat creation with scoped contracts
- [ ] Unit tests: RAG filtering by scopedContractIds
- [ ] Integration test: Create scoped chat, verify only selected contracts searched
- [ ] UI test: Select 5 contracts, start chat, verify scope indicator shows correct contracts
- [ ] Edge case: Empty selection (should default to all contracts)
- [ ] Edge case: Non-existent contract IDs (should filter them out)

#### Performance Considerations
- [ ] Lazy-load contracts in selector (virtualized list for 100+ contracts)
- [ ] Cache contract list in frontend (avoid re-fetching on every modal open)
- [ ] Index `scopedContractIds` in database for faster queries (if needed)

## Scope Change Button in Chat Header

- [x] Backend: Add updateScope mutation to chats router (already done)
- [ ] Frontend: Add "Ändern" button next to scope indicator in chat header
- [ ] Frontend: Disable button after first message is sent (check messages.length > 0)
- [ ] Frontend: Open ContractSelectorModal with current scopedContractIds pre-selected
- [ ] Frontend: Call updateScope mutation on save
- [ ] Frontend: Invalidate chat query to refresh header after scope change
- [ ] Test: Change scope before first message, verify it works
- [ ] Test: Verify button is disabled after first message

## Chat List Icons for Scope Indication

- [x] Update Chat.tsx sidebar chat list rendering
- [x] Add conditional icon: 📋 if chat.scopedContractIds exists, 💬 if null
- [x] Position icon before chat title text
- [x] Add title attribute for tooltip (native browser tooltip)
- [x] Tooltip text: "Durchsucht X Verträge" (count from scopedContractIds.length) or "Durchsucht alle Verträge"
- [ ] Test: Create scoped and all-contracts chats, verify correct icons show

## Batch PDF Upload

- [x] Update Contracts.tsx file input: Add `multiple` attribute
- [x] Update handleFileUpload: Loop through files array instead of single file
- [x] Backend: contracts.upload mutation already handles single file - call it multiple times
- [x] Frontend: Track upload state per file with Promise.allSettled
- [x] Frontend: Show summary toast with success/failed count
- [x] Frontend: Use Promise.allSettled to upload files in parallel
- [x] Frontend: Invalidate contracts list after all uploads complete (via uploadMutation.onSuccess)
- [x] Filter non-PDF files and show warning
- [ ] Test: Upload 5 PDFs at once, verify all are processed
- [ ] Test: Upload mix of valid PDFs and invalid files, verify error handling

## CRITICAL BUG: Contract Selector Modal Not Opening

- [x] Debug why ContractSelectorModal doesn't open on "Neuen Chat starten" button click
- [x] Check Home.tsx integration - Fixed duplicate useState import
- [x] Verify modal state management
- [x] Test modal opening after fix - RESOLVED: Modal opens correctly after server restart

## CRITICAL BUG: Contract Selector Modal Not Opening for User

- [x] Debug why modal doesn't open when user clicks "Neuen Chat starten" - FOUND: User clicks sidebar "+ Neuer Chat" button, not Home button
- [x] Update Chat.tsx sidebar "+ Neuer Chat" button to open ContractSelectorModal
- [x] Add ContractSelectorModal to Chat.tsx with selectorOpen state
- [x] Test both buttons (Home + Sidebar) open modal - RESOLVED: Both buttons now open modal

## UI Fixes

- [x] Zentriere "PDF-Datei auswählen" Button im Upload-Dialog

## Homepage Verbesserungen

- [x] Statistik-Cards auf Homepage (Anzahl Verträge, Chats, Seiten, letzte Aktivität)
- [x] Backend API für Dashboard-Statistiken
- [x] Visuell ansprechendes Layout mit Icons und Zahlen

## Zielgruppenspezifische Zusammenfassungen

- [x] Datenbank-Schema: summaryTemplates Tabelle (id, type, title, prompt, order)
- [x] Datenbank-Schema: contractSummaries Tabelle (id, contractId, templateId, content, generatedAt)
- [x] Backend: Vordefinierte Templates (BackOffice, Außendienst, Geschäftsführung, Alle)
- [x] Backend: LLM-basierte Zusammenfassungs-Generierung mit Vollständigkeits-Check
- [x] Backend: API zum Erstellen/Löschen von Custom Templates
- [x] Backend: API zum Generieren/Abrufen von Zusammenfassungen
- [x] Backend: Word-Export (.docx) für Zusammenfassungen
- [x] Backend: PDF-Export für Zusammenfassungen
- [x] Frontend: Zusammenfassungs-Status in Vertragstabelle (Badges für existierende Zusammenfassungen)
- [x] Frontend: "Zusammenfassung generieren" Dialog mit Template-Auswahl
- [x] Frontend: Custom Template erstellen Dialog
- [x] Frontend: Zusammenfassungs-Viewer in rechter Sidebar
- [x] Frontend: Export-Buttons (Word/PDF) in Sidebar
- [x] Unit-Tests für Zusammenfassungs-Generierung

## Zusammenfassungs-Formatierung

- [x] Verbessere visuelle Darstellung der Zusammenfassungen in Sidebar
- [x] Besseres Markdown-Styling (Überschriften, Listen, Tabellen)
- [x] Professionelleres Layout mit Spacing und Typografie
- [x] Markdown-Tabellen korrekt rendern (remark-gfm Plugin)

## Vertragsvergleich

- [x] Backend: API zum Vergleichen mehrerer Verträge
- [x] Backend: LLM-basierte Vergleichslogik (strukturierte Ausgabe)
- [x] Frontend: Multi-Select für Verträge in Tabelle
- [x] Frontend: Vergleichs-Dialog mit Fragefeld
- [x] Frontend: Side-by-Side Vergleichsansicht
- [ ] Frontend: Export als Excel/PDF

## Vertragsvergleich Bugfixes

- [x] Vergleich läuft ewig ohne Ergebnis - Timeout/Error Handling prüfen (Gelöst: Chunking auf 8 Seiten/15k Zeichen reduziert, Timeout auf 120s erhöht)

## Vergleichs-Export & Historie
- [x] Datenbank-Schema: comparisonHistory Tabelle (id, userId, query, contractIds, result, createdAt)
- [x] Backend: Excel-Export für Vergleichsergebnisse (exceljs mit Formatierung)
- [x] Backend: PDF-Export für Vergleichsergebnisse (pdfkit mit professionellem Layout)
- [x] Backend: API zum Speichern von Vergleichen (comparison.save)
- [x] Backend: API zum Abrufen der Vergleichs-Historie (comparison.getHistory)
- [x] Backend: API zum Löschen von Vergleichen (comparison.delete)
- [x] Frontend: Export-Buttons (Excel/PDF) in ComparisonViewer
- [x] Frontend: "Vergleich speichern" Button mit Namen-Dialog
- [x] Frontend: Vergleichs-Historie-Liste in Sidebar oder separater Seitee
- [ ] Frontend: Klick auf Historie-Eintrag lädt Vergleich erneut
- [ ] Unit-Tests für Export-Funktionen

## Modern UI Redesign

- [x] Dark/Light Mode Theme System mit Toggle-Button
- [x] Glasmorphism-Effekte (frosted glass, backdrop-blur)
- [x] Moderne Farbpalette mit Gradients
- [x] Smooth Transitions & Animations
- [x] Mobile-First Responsive Design für alle Seiten
- [x] Homepage mobile-optimiert
- [x] Chat-Seite mobile-optimiert
- [x] Vertragsmanager mobile-optimiert
- [x] Dialogs & Sidebars mobile-optimiert
- [x] Touch-friendly Buttons & Controls

## Mobile Chat Fix

- [x] Sidebar standardmäßig geschlossen auf Mobile
- [x] Hamburger-Menu-Button zum Öffnen der Sidebar
- [x] Overlay-Modus mit Backdrop auf Mobile
- [x] Sidebar als Overlay über Content statt nebeneinander

## Mobile UI Polish

- [x] Logo-Margin in Sidebar reduzieren (zu viel Abstand links)
- [x] Input-Placeholder-Text kürzen (bricht um auf Mobile)

## Chat-Kontext-Memory Feature

- [x] Backend: Sende letzte 5-10 Nachrichten als Kontext an LLM (bereits implementiert in routers.ts Zeile 326-334)
- [x] Backend: Erweitere RAG-Prompt um Konversationshistorie (bereits implementiert in rag.ts Zeile 599-611)
- [x] Backend: Implementiere intelligente Kontext-Fenster-Verwaltung (Token-Limit beachten) (letzte 10 Nachrichten)
- [x] Test: "Was kostet X?" → "Und bei Y?" (KI versteht "X" aus Kontext) - Live-Test erfolgreich
- [x] Test: "Wie war das nochmal?" (KI referenziert vorherige Antwort) - Funktioniert
- [x] Test: "Vergleiche das mit Z" (KI weiß was "das" ist) - Live-Test: "Gibt es Unterschiede?" erfolgreich

## Hierarchische Vertragsstruktur (Parent-Child)

### Anforderungen
- [ ] 2 Ebenen: Hauptvertrag → Sub-Verträge (Erweiterungen, Preislisten, Produktgruppen)
- [ ] Automatische Zuordnung via LLM beim Upload (schlägt Hauptvertrag vor)
- [ ] Kaskadierendes Löschen (Hauptvertrag löschen → alle Sub-Verträge auch)

### Phase 1: Datenbank-Schema
- [ ] Erweitere contracts Tabelle um parentContractId (number | null)
- [ ] Erweitere contracts Tabelle um contractType (enum: main/extension/pricelist/productgroup/regional)
- [ ] Erweitere contracts Tabelle um displayOrder (number)
- [ ] Erweitere contracts Tabelle um productGroups (string | null) für "4" oder "7,8"
- [ ] Migration: Bestehende Verträge werden Hauptverträge (parentContractId = NULL, contractType = 'main')
- [ ] Index auf parentContractId für Performance
- [ ] Validierung: Verhindere 3+ Ebenen (Child kann nicht Parent werden)

### Phase 2: Backend-API
- [x] getContractHierarchy(contractId) - Gibt Parent + alle Children zurück
- [x] getMainContracts() - Nur Hauptverträge (parentContractId = NULL)
- [x] getChildContracts(parentId) - Alle Sub-Verträge eines Hauptvertrags
- [x] updateContractParent(contractId, newParentId) - Zuordnung ändern
- [x] deleteContractWithChildren(contractId) - Kaskadierendes Löschen
- [x] suggestParentContract(pdfName, insuranceCompany) - LLM schlägt Hauptvertrag vor
- [x] Upload-API erweitern: parentContractId und contractType Parameter

### Phase 3: UI-Komponenten
- [x] ContractHierarchyTree - Baum-Ansicht mit Collapse/Expand (Accordion)
- [x] Icons: 📁 für Hauptvertrag, 📄 für Sub-Verträge, Einrückung für Hierarchie
- [x] ContractUploadDialog erweitern: "Zu bestehendem Vertrag zuordnen" Option
- [x] Dropdown: Hauptvertrag auswählen (nur main contracts)
- [x] Radio-Buttons: Art der Zuordnung (Extension/Pricelist/Productgroup/Regional)
- [x] Input-Feld: Produktgruppen (optional, z.B. "4" oder "7,8")
- [x] ContractSelectorModal erweitern: Hierarchische Auswahl mit Checkboxen
- [x] Checkbox-Logik: Hauptvertrag auswählen → alle Children automatisch
- [x] Löschen-Dialog: Warnung bei Hauptvertrag ("Löscht auch X Sub-Verträge")

### Phase 4: RAG-Anpassungen
- [x] queryContracts() erweitern: Bei Scope-Auswahl Hauptvertrag → automatisch alle Children inkludieren
- [x] Quellenangaben mit Hierarchie-Pfad: [Hauptvertrag > Sub-Vertrag, Seite X]
- [x] Priorisierung bei mehreren Treffern: extension > pricelist > productgroup > main
- [x] Konfliktauflösung: Zeige beide Quellen wenn Position in mehreren Verträgen
- [x] contractFilters erweitern: Berücksichtige Hierarchie bei Krankenkassen-Filter

### Phase 5: LLM-Integration für Auto-Zuordnung
- [x] suggestParentContract() Funktion mit invokeLLM
- [x] Prompt: Analysiere PDF-Namen und vorhandene Hauptverträge
- [x] Beispiele: "AOK Bayern PG 4" → "AOK Bayern Orthopädie"
- [x] Beispiele: "IKK Preisliste 2024" → "IKK Classic Bundesvertrag"
- [x] Confidence-Score: high/medium/low für UI-Anzeige
- [x] Fallback: Wenn kein Match, zeige alle Hauptverträge der Krankenkasse

### Phase 6: Testing
- [x] Unit-Tests: getContractHierarchy, getChildContracts
- [x] Unit-Tests: Kaskadierendes Löschen
- [x] Unit-Tests: 3-Ebenen-Validierung (muss fehlschlagen)
- [x] Integration-Tests: RAG mit Hierarchie (Parent + Children durchsuchen)
- [x] Integration-Tests: Quellenangaben mit Hierarchie-Pfad
- [x] Integration-Tests: Priorisierung (Extension überschreibt Main)
- [x] UI-Tests: Baum-Ansicht Collapse/Expand
- [x] UI-Tests: Upload mit Auto-Zuordnung
- [x] End-to-End: Upload Sub-Vertrag → Chat-Abfrage → Korrekte Quelle

## Neue Bugs

- [x] Fix: Vertragsvergleich schlägt fehl - ModuleNotFoundError: No module named 'pdfplumber' (pdfplumber installiert)

## Hierarchische Verträge - UX-Verbesserungen

### Bulk-Upload für Sub-Verträge
- [ ] Backend: Upload-Endpunkt erweitern für Multi-File-Upload
- [ ] Frontend: ContractUploadDialog mit Multi-File-Selector
- [ ] Frontend: Alle ausgewählten Dateien dem gleichen Parent zuordnen
- [ ] Frontend: Progress-Anzeige für Bulk-Upload (X von Y hochgeladen)
- [ ] Frontend: Fehlerbehandlung (zeige welche Uploads fehlgeschlagen sind)

### Drag & Drop Zuordnung
- [ ] Frontend: react-dnd oder @dnd-kit installieren
- [ ] Frontend: Drag-Handle-Icon bei jedem Vertrag
- [ ] Frontend: Drop-Zone bei Hauptverträgen (visuelles Feedback)
- [ ] Frontend: onDrop → updateContractParent() API-Call
- [ ] Frontend: Optimistic Update (sofort UI ändern, bei Fehler rollback)
- [ ] Frontend: Verhindere ungültige Drops (Child → Child, Parent → Child)

### Hierarchie-Filter
- [ ] Frontend: Toggle-Buttons "Alle" / "Nur Hauptverträge" / "Nur Sub-Verträge"
- [ ] Frontend: Filter-State in URL-Query-Parameter (für Bookmark/Share)
- [ ] Frontend: Filtered Contracts Count anzeigen (z.B. "2 von 10 Verträgen")
- [ ] Frontend: Filter kombinierbar mit Suche/Sortierung

## Vertragsversionierung Feature

### Phase 1: Datenbank-Schema
- [ ] Erweitere contracts Tabelle: isArchived (boolean, default false)
- [ ] Erweitere contracts Tabelle: archivedAt (timestamp, nullable)
- [ ] Erweitere contracts Tabelle: replacedByContractId (nullable, FK zu contracts)
- [ ] Erweitere contracts Tabelle: versionNumber (integer, default 1)
- [ ] Erweitere contracts Tabelle: versionLabel (text, z.B. "2024", "2025", "Q1 2024")
- [ ] Migration erstellen und pushen (pnpm db:push)

### Phase 2: Backend-API
- [ ] archiveContract(id, replacedByContractId) - Archiviert alten Vertrag
- [ ] getContractVersions(contractId) - Gibt alle Versionen eines Vertrags zurück
- [ ] restoreArchivedContract(id) - Stellt archivierten Vertrag wieder her
- [ ] detectSimilarContracts(name, insuranceCompany) - Findet ähnliche Verträge für Auto-Archivierung
- [ ] tRPC-Router erweitern: contracts.getVersions, contracts.restore, contracts.archive

### Phase 3: Upload-Logik
- [ ] Beim Upload: Analysiere Dateinamen auf Jahr/Version (z.B. "2024", "2025", "v2")
- [ ] Suche nach ähnlichen aktiven Verträgen (gleiche Krankenkasse + ähnlicher Name)
- [ ] Zeige Vorschlag: "Ersetzt 'Preisliste 2024'? → Archivieren"
- [ ] User kann bestätigen oder ablehnen
- [ ] Bei Bestätigung: Setze isArchived=true, replacedByContractId=new_id beim alten Vertrag

### Phase 4: UI-Komponenten
- [ ] Version History Badge: Zeigt "v2" oder "2025" neben Vertragsnamen
- [ ] Version History Dialog: Liste aller Versionen mit Datum, Status (aktiv/archiviert)
- [ ] Restore Button: Stellt archivierte Version wieder her (macht aktuelle Version zu archiviert)
- [ ] Archive Filter: "Archivierte Verträge anzeigen" Toggle
- [ ] Upload-Dialog: "Ersetzt Version X?" Confirmation mit Preview

### Phase 5: RAG-Anpassungen
- [ ] Standardmäßig nur aktive Verträge (isArchived=false) durchsuchen
- [ ] Option: "Auch archivierte Versionen durchsuchen" für historische Abfragen
- [ ] Quellenangaben mit Version: [Vertrag v2 (2025), Seite X]

### Phase 6: Testing
- [ ] Unit-Tests: archiveContract, getContractVersions
- [ ] Integration-Tests: Upload → Auto-Detect → Archivierung
- [ ] UI-Tests: Version History anzeigen, Restore
- [ ] End-to-End: Upload "Preisliste 2025" → "Preisliste 2024" archivieren → Chat nutzt neue Version

## Versionsverwaltung UX-Verbesserungen

### Upload-Dialog mit Auto-Archivierungs-Vorschlag
- [ ] Backend: suggestReplacement API beim Datei-Upload aufrufen
- [ ] UI: Zeige Vorschlag-Card "Ersetzt 'Preisliste 2024'?" mit Confidence-Badge
- [ ] UI: Checkbox "Alte Version automatisch archivieren" (default: checked bei high confidence)
- [ ] UI: Ein-Klick-Archivierung direkt beim Upload
- [ ] Backend: Archiviere alte Version automatisch nach erfolgreichem Upload

### Version-Diff-Ansicht
- [ ] Backend: extractContractDiff(oldContractId, newContractId) - Extrahiert Unterschiede
- [ ] Backend: LLM-basierte Analyse: Geänderte Preise, neue/entfernte Positionen
- [ ] UI: VersionDiffViewer Komponente mit Tabelle
- [ ] UI: Zeige Änderungen: Grün = Neu, Rot = Entfernt, Gelb = Geändert
- [ ] UI: "Vergleichen"-Button in VersionHistoryDialog
- [ ] UI: Diff-Dialog mit Side-by-Side-Ansicht oder Unified-Diff
- [ ] Test: Vergleiche zwei Preislisten mit unterschiedlichen Preisen
