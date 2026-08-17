# Contract Filtering Strategy für große Vertragsmengen

## Problem

Bei hunderten Verträgen (z.B. 100 Verträge × 200 Chunks = 20.000 Chunks) lädt die aktuelle Suche **alle Chunks in den Speicher** und berechnet Cosine-Similarity für jeden einzelnen. Das führt zu:

- **Performance-Problemen**: Langsame Antwortzeiten (mehrere Sekunden)
- **Hoher Speicherverbrauch**: 20.000+ Chunks im RAM
- **Schlechte Skalierbarkeit**: Wächst linear mit Anzahl Verträge

## Lösung: 3-Stufige Filterung

### Stufe 1: Metadaten-Pre-Filtering (SQL WHERE)

**Ziel**: Reduziere Verträge von 100 auf ~5-10 relevante **vor** der Embedding-Suche

**Strategie**:
1. **LLM extrahiert aus Frage**:
   - Krankenkasse: "AOK Bayern", "IKK Classic", "TK", etc.
   - Produktbereich: "Betten", "Rollstühle", "Mobilitätshilfen", etc.
   - Zeitraum: "2024", "aktuell", etc.

2. **SQL-Filter auf Contract-Tabelle**:
   ```sql
   SELECT id FROM contracts 
   WHERE status = 'ready'
     AND (insuranceCompany = 'AOK Bayern' OR insuranceCompany IS NULL)
     AND (productArea = 'Betten' OR productArea IS NULL)
     AND (validFrom <= '2024-01-01' OR validFrom IS NULL)
   ```

3. **Fallback bei keinen Treffern**:
   - Wenn keine Verträge gefunden: Erweitere Suche (z.B. nur Krankenkasse, ohne Produktbereich)
   - Wenn immer noch keine: Suche in allen Verträgen (wie bisher)

**Effekt**: 100 Verträge → 5-10 Verträge = **90% Reduktion**

### Stufe 2: Embedding-Suche (nur in gefilterten Verträgen)

**Ziel**: Finde relevante Chunks nur in den vorselektierten Verträgen

**Strategie**:
1. Lade nur Chunks der gefilterten Verträge:
   ```sql
   SELECT * FROM contractChunks 
   WHERE contractId IN (5, 12, 23, 45, 67)
   ```

2. Berechne Cosine-Similarity nur für diese Chunks
   - 1.000 Chunks statt 20.000 = **95% schneller**

3. Top 20 Chunks für Re-Ranking

**Effekt**: 20.000 Chunks → 1.000 Chunks = **95% Reduktion**

### Stufe 3: LLM Re-Ranking (wie bisher)

**Ziel**: Bewerte Relevanz der Top 20 Chunks

**Strategie**: Unverändert - LLM bewertet Chunks auf Skala 0-10

**Effekt**: Beste 10 Chunks für Antwortgenerierung

## Implementation Plan

### 1. Neue Funktion: `extractContractFilters(question: string)`

```typescript
type ContractFilters = {
  insuranceCompany?: string;
  productArea?: string;
  validFrom?: Date;
};

async function extractContractFilters(question: string): Promise<ContractFilters> {
  // LLM extrahiert strukturierte Filter aus Frage
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "Extrahiere Krankenkasse, Produktbereich und Zeitraum aus der Frage."
      },
      {
        role: "user",
        content: question
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "contract_filters",
        schema: {
          type: "object",
          properties: {
            insuranceCompany: { type: "string", nullable: true },
            productArea: { type: "string", nullable: true },
            validFrom: { type: "string", nullable: true }
          }
        }
      }
    }
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

### 2. Neue DB-Funktion: `filterContractsByMetadata(filters: ContractFilters)`

```typescript
export async function filterContractsByMetadata(
  filters: ContractFilters
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({ id: contracts.id })
    .from(contracts)
    .where(eq(contracts.status, "ready"));
  
  if (filters.insuranceCompany) {
    query = query.where(eq(contracts.insuranceCompany, filters.insuranceCompany));
  }
  
  if (filters.productArea) {
    query = query.where(eq(contracts.productArea, filters.productArea));
  }
  
  const results = await query;
  return results.map(r => r.id);
}
```

### 3. Update: `searchSimilarChunks(embedding, limit, contractIds?)`

```typescript
export async function searchSimilarChunks(
  queryEmbedding: number[],
  limit: number = 10,
  contractIds?: number[] // NEU: Optional contract filter
): Promise<(ContractChunk & { contract: Contract; similarity: number })[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({
      chunk: contractChunks,
      contract: contracts,
    })
    .from(contractChunks)
    .innerJoin(contracts, eq(contractChunks.contractId, contracts.id))
    .where(eq(contracts.status, "ready"));
  
  // NEU: Filter by contract IDs if provided
  if (contractIds && contractIds.length > 0) {
    query = query.where(inArray(contracts.id, contractIds));
  }
  
  const allChunks = await query;
  // ... rest bleibt gleich
}
```

### 4. Update: `queryContracts()` Integration

```typescript
export async function queryContracts(question: string): Promise<RAGResponse> {
  // 1. Extract filters from question
  const filters = await extractContractFilters(question);
  console.log('[queryContracts] Extracted filters:', filters);
  
  // 2. Filter contracts by metadata
  let contractIds = await filterContractsByMetadata(filters);
  console.log('[queryContracts] Filtered to contracts:', contractIds);
  
  // 3. Fallback if no contracts found
  if (contractIds.length === 0) {
    console.log('[queryContracts] No contracts match filters, searching all');
    contractIds = undefined; // Search all contracts
  }
  
  // 4. Generate embedding
  const queryEmbeddings = await generateEmbeddings([question]);
  
  // 5. Search only in filtered contracts
  const similarChunks = await searchSimilarChunks(
    queryEmbeddings[0],
    20,
    contractIds // Pass filtered contract IDs
  );
  
  // ... rest bleibt gleich (re-ranking, answer generation)
}
```

## Erwartete Verbesserungen

| Metrik | Vorher (100 Verträge) | Nachher (gefiltert) | Verbesserung |
|--------|----------------------|---------------------|--------------|
| Chunks durchsucht | 20.000 | 1.000 | **95% weniger** |
| Antwortzeit | 5-10s | 1-2s | **80% schneller** |
| Speicherverbrauch | 500 MB | 25 MB | **95% weniger** |
| Relevanz | Mittel | Hoch | **Bessere Ergebnisse** |

## Zusätzliche Optimierungen (Optional)

### A. Vektor-Datenbank (langfristig)

Für **1000+ Verträge** sollte eine dedizierte Vektor-DB verwendet werden:
- **Pinecone**: Managed, sehr schnell, teuer
- **Weaviate**: Self-hosted, Open Source
- **pgvector**: PostgreSQL Extension (einfachste Integration)

### B. Caching

Cache häufige Fragen:
```typescript
const cacheKey = `rag:${hash(question)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);
```

### C. Parallel Search

Bei vielen gefilterten Verträgen (>20): Suche parallel
```typescript
const chunkPromises = contractIds.map(id => 
  searchInContract(id, embedding)
);
const allChunks = (await Promise.all(chunkPromises)).flat();
```

## Testing Strategy

1. **Unit Tests**: `extractContractFilters()` mit verschiedenen Fragen
2. **Integration Tests**: Vollständiger Flow mit 100 Test-Verträgen
3. **Performance Tests**: Zeitmessung vorher/nachher
4. **Relevanz Tests**: Prüfe ob richtige Verträge gefunden werden

## Rollout Plan

1. ✅ Design-Dokument erstellen
2. [ ] `extractContractFilters()` implementieren + Tests
3. [ ] `filterContractsByMetadata()` implementieren + Tests
4. [ ] `searchSimilarChunks()` erweitern + Tests
5. [ ] `queryContracts()` integrieren
6. [ ] End-to-End Tests mit 100 Verträgen
7. [ ] Performance-Messung
8. [ ] Deployment
