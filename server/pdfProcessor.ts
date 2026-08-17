// PDF processing utilities
import { invokeLLM } from './_core/llm';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

/**
 * Extract text and tables from PDF using pdfplumber (Python)
 */
export async function extractTextFromPdf(pdfUrl: string): Promise<{
  pages: { pageNumber: number; content: string; tables?: any[] }[];
  totalPages: number;
}> {
  let tempPdfPath: string | null = null;
  
  try {
    console.log('[extractTextFromPdf] Downloading PDF from:', pdfUrl);
    // Download PDF
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    console.log('[extractTextFromPdf] PDF downloaded, size:', buffer.length, 'bytes');
    
    // Save to temp file
    tempPdfPath = join(tmpdir(), `contract-${Date.now()}.pdf`);
    await writeFile(tempPdfPath, buffer);
    
    // Extract text and tables using pdfplumber (Python)
    const scriptPath = join(__dirname, 'extract_pdf_tables.py');
    console.log('[extractTextFromPdf] Using pdfplumber script:', scriptPath);
    const { stdout } = await execAsync(`/usr/bin/python3.11 "${scriptPath}" "${tempPdfPath}"`, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large PDFs
      env: {
        ...process.env,
        PYTHONPATH: '', // Clear PYTHONPATH to avoid uv environment
        PYTHONHOME: '' // Clear PYTHONHOME to use system Python
      }
    });
    
    const result = JSON.parse(stdout);
    
    if (result.error) {
      throw new Error(`pdfplumber extraction failed: ${result.error}`);
    }
    
    console.log('[extractTextFromPdf] Extracted', result.total_pages, 'pages with pdfplumber');
    console.log('[extractTextFromPdf] Pages with tables:', result.pages.filter((p: any) => p.tables && p.tables.length > 0).length);
    
    return {
      pages: result.pages.map((p: any) => ({
        pageNumber: p.page_number,
        content: p.text || '',
        tables: p.tables || []
      })),
      totalPages: result.total_pages
    };
  } catch (error) {
    console.error('[extractTextFromPdf] Error:', error);
    throw new Error(`Failed to extract text from PDF: ${error}`);
  } finally {
    // Cleanup temp files
    if (tempPdfPath) {
      try {
        await unlink(tempPdfPath);
      } catch (e) {
        console.warn('[extractTextFromPdf] Failed to delete temp PDF:', e);
      }
    }
  }
}

/**
 * Extract contract metadata from the first few pages
 */
export async function extractContractMetadata(pdfUrl: string): Promise<{
  insuranceCompany: string | null;
  contractNumber: string | null;
  productArea: string | null;
  validFrom: string | null;
  validUntil: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Du bist ein Experte für deutsche Krankenkassenverträge.
Extrahiere die folgenden Metadaten aus dem Vertrag:
- Krankenkasse (z.B. "AOK Bayern", "IKK Classic", "Techniker Krankenkasse")
- Vertragsnummer
- Produktbereich (z.B. "Produktgruppe 17", "Hilfsmittel", "Inkontinenzversorgung")
- Gültig ab (Datum im Format YYYY-MM-DD)
- Gültig bis (Datum im Format YYYY-MM-DD, oder "unbefristet" wenn nicht angegeben)
- Ansprechpartner (Name der Kontaktperson bei der Krankenkasse)
- E-Mail (E-Mail-Adresse des Ansprechpartners)
- Telefon (Telefonnummer des Ansprechpartners)

Wenn ein Wert nicht gefunden wird, gib "unbekannt" zurück.`
      },
      {
        role: "user",
        content: [
          {
            type: "file_url",
            file_url: {
              url: pdfUrl,
              mime_type: "application/pdf"
            }
          },
          {
            type: "text",
            text: "Extrahiere die Vertragsmetadaten aus diesem PDF."
          }
        ]
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "contract_metadata",
        strict: true,
        schema: {
          type: "object",
          properties: {
            insuranceCompany: { type: "string" },
            contractNumber: { type: "string" },
            productArea: { type: "string" },
            validFrom: { type: "string" },
            validUntil: { type: "string" },
            contactPerson: { type: "string" },
            contactEmail: { type: "string" },
            contactPhone: { type: "string" }
          },
          required: ["insuranceCompany", "contractNumber", "productArea", "validFrom", "validUntil", "contactPerson", "contactEmail", "contactPhone"],
          additionalProperties: false
        }
      }
    }
  });

  console.log('[extractContractMetadata] LLM Response:', JSON.stringify(response, null, 2));
  
  if (!response.choices || response.choices.length === 0) {
    console.error('[extractContractMetadata] No choices in response');
    throw new Error("LLM returned no choices");
  }
  
  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    console.error('[extractContractMetadata] Invalid content:', content);
    throw new Error("Failed to extract contract metadata - invalid content");
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('[extractContractMetadata] Failed to parse JSON:', content);
    throw new Error(`Failed to parse metadata JSON: ${error}`);
  }
}

/**
 * Detect if text contains table structure
 * Tables are identified by:
 * - Multiple consecutive lines with consistent spacing/alignment
 * - Position numbers (e.g., 19.40.01.7)
 * - Numeric patterns (prices, quantities)
 */
function detectTableStructure(text: string): boolean {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // Check for position numbers (common in insurance contracts)
  const positionNumberPattern = /\b\d{1,2}\.\d{1,2}\.\d{1,2}\.\d{1,2}\b/;
  const hasPositionNumbers = lines.some(line => positionNumberPattern.test(line));
  
  // Check for price patterns (EUR, €, or decimal numbers)
  const pricePattern = /\b\d+[,.]\d{2}\s*(?:EUR|€)?\b/;
  const hasPrices = lines.some(line => pricePattern.test(line));
  
  // Check for table headers (common keywords)
  const headerPattern = /Produktgruppe|Produktuntergruppe|Produktbezeichnung|Betrag|Preis|Vergütung|Leistungsbeschreibung/i;
  const hasTableHeader = lines.some(line => headerPattern.test(line));
  
  // Check for consistent column-like structure (multiple spaces/tabs)
  const columnPattern = /\s{3,}|\t/;
  const columnLines = lines.filter(line => columnPattern.test(line));
  const hasColumns = columnLines.length >= 2;
  
  // STRONG table indicator: position number + price in same text block
  if (hasPositionNumbers && hasPrices) {
    return true;
  }
  
  // STRONG table indicator: table header + position numbers
  if (hasTableHeader && hasPositionNumbers) {
    return true;
  }
  
  // WEAK table indicator: consistent columns
  return hasColumns && columnLines.length >= 3;
}

/**
 * Find natural break points in text (sentence/paragraph boundaries)
 */
function findBreakPoint(text: string, idealPosition: number, minPosition: number): number {
  // Don't break too early - ensure minimum chunk size
  const searchStart = Math.max(minPosition, idealPosition - 150);
  
  // Try to break at paragraph boundary first (within last 150 chars)
  const paragraphBreak = text.lastIndexOf('\n\n', idealPosition);
  if (paragraphBreak >= searchStart) {
    return paragraphBreak + 2;
  }
  
  // Try to break at sentence boundary (within last 150 chars)
  const sentenceBreak = text.lastIndexOf('. ', idealPosition);
  if (sentenceBreak >= searchStart) {
    return sentenceBreak + 2;
  }
  
  // Try to break at line boundary (within last 100 chars)
  const lineBreak = text.lastIndexOf('\n', idealPosition);
  if (lineBreak >= Math.max(minPosition, idealPosition - 100)) {
    return lineBreak + 1;
  }
  
  // Fallback to ideal position
  return idealPosition;
}

/**
 * Split text into chunks for embedding with table-aware chunking
 * - Smaller chunks (500 chars) for more precise source citations
 * - Reduced overlap (100 chars) to minimize redundancy
 * - Table rows as individual chunks to guarantee position+price together
 */
export function splitIntoChunks(
  pages: { pageNumber: number; content: string; tables?: any[] }[]
): { content: string; pageNumber: number; chunkIndex: number }[] {
  const chunks: { content: string; pageNumber: number; chunkIndex: number }[] = [];
  const chunkSize = 500; // Reduced from 1000 for better precision
  const overlap = 100; // Reduced from 200 to minimize redundancy
  const tableChunkSize = 2000; // Large chunks for tables to keep position numbers with prices
  
  let globalChunkIndex = 0;
  
  for (const page of pages) {
    // First, process structured tables (if available)
    if (page.tables && page.tables.length > 0) {
      for (const table of page.tables) {
        const headers = table.headers || [];
        const rows = table.rows || [];
        
        // Create one chunk per table row (with headers as context)
        for (let i = 1; i < rows.length; i++) { // Skip header row (i=0)
          const row = rows[i];
          if (!row || !row.some((cell: any) => cell && String(cell).trim())) {
            continue; // Skip empty rows
          }
          
          // Build chunk: headers + current row
          const headerLine = headers.map((h: any) => String(h || '').trim()).join(' | ');
          const rowLine = row.map((cell: any) => String(cell || '').trim()).join(' | ');
          const chunkContent = `${headerLine}\n${rowLine}`;
          
          if (chunkContent.trim().length > 0) {
            chunks.push({
              content: chunkContent.trim(),
              pageNumber: page.pageNumber,
              chunkIndex: globalChunkIndex++
            });
          }
        }
      }
    }
    
    // Then, process regular text content
    const text = page.content;
    let start = 0;
    
    while (start < text.length) {
      // Look ahead to check if we're in a table
      const lookAheadText = text.substring(start, Math.min(start + chunkSize * 2, text.length));
      const isTable = detectTableStructure(lookAheadText);
      
      // Use larger chunks for tables to preserve row context
      const currentChunkSize = isTable ? tableChunkSize : chunkSize;
      const idealEnd = Math.min(start + currentChunkSize, text.length);
      
      // Find natural break point to avoid splitting mid-sentence or mid-table-row
      // Ensure minimum chunk size of 300 chars (unless at end of text)
      const minChunkSize = 300;
      const minEnd = Math.min(start + minChunkSize, text.length);
      const end = idealEnd >= text.length ? text.length : findBreakPoint(text, idealEnd, minEnd);
      
      const chunk = text.substring(start, end);
      
      // Only add non-empty chunks (after trimming whitespace)
      const trimmedChunk = chunk.trim();
      if (trimmedChunk.length > 0) {
        chunks.push({
          content: trimmedChunk,
          pageNumber: page.pageNumber,
          chunkIndex: globalChunkIndex++
        });
      }
      
      // Move forward with overlap, but ensure we make progress
      // If we reached the end of text, we're done
      if (end >= text.length) {
        break;
      }
      
      // Use the untrimmed end position for overlap calculation
      const nextStart = end - overlap;
      if (nextStart <= start) {
        // Prevent infinite loop - move forward at least by minChunkSize
        start = start + Math.max(1, Math.floor(minChunkSize / 2));
      } else {
        start = nextStart;
      }
    }
  }
  
  console.log(`[splitIntoChunks] Created ${chunks.length} chunks (avg size: ${Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length)} chars)`);
  return chunks;
}
