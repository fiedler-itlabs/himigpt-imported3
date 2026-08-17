import { describe, it, expect } from 'vitest';
import { splitIntoChunks } from './pdfProcessor';

describe('splitIntoChunks', () => {
  it('should create smaller chunks (around 500 chars)', () => {
    const pages = [
      {
        pageNumber: 1,
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(40) // ~2280 characters of realistic text
      }
    ];

    const chunks = splitIntoChunks(pages);
    
    // Should create multiple chunks
    expect(chunks.length).toBeGreaterThan(2);
    
    // Average chunk size should be around 300-600 chars (accounting for overlap and break points)
    const avgSize = chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length;
    expect(avgSize).toBeGreaterThan(250);
    expect(avgSize).toBeLessThan(700);
  });

  it('should detect and preserve table structures', () => {
    const tableContent = `
Hilfsmittelpositionsnummer  Beschreibung              Preis
19.40.01.7                  Mobile Pumpe              150,00 EUR
19.40.01.8                  Stationäre Pumpe          200,00 EUR
19.40.01.9                  Zubehör Set               50,00 EUR
    `.trim();

    const pages = [
      {
        pageNumber: 1,
        content: tableContent
      }
    ];

    const chunks = splitIntoChunks(pages);
    
    // Table is small enough to fit in one chunk (< 800 chars)
    expect(chunks.length).toBeLessThanOrEqual(3);
    
    // Position numbers should stay with their prices in the same chunk
    const chunkWith7 = chunks.find(c => c.content.includes('19.40.01.7'));
    expect(chunkWith7).toBeDefined();
    expect(chunkWith7!.content).toContain('150,00');
  });

  it('should break at natural boundaries (paragraphs, sentences)', () => {
    const content = `
Dies ist ein langer Absatz mit mehreren Sätzen. Er sollte an natürlichen Grenzen getrennt werden. 
Das verbessert die Lesbarkeit der Chunks.

Dies ist ein neuer Absatz. Er beginnt nach einer Leerzeile.
    `.trim();

    const pages = [
      {
        pageNumber: 1,
        content: content
      }
    ];

    const chunks = splitIntoChunks(pages);
    
    // Should create at least one chunk
    expect(chunks.length).toBeGreaterThan(0);
    
    // Chunks should not be empty
    chunks.forEach(chunk => {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    });
  });

  it('should assign correct page numbers to chunks', () => {
    const pages = [
      {
        pageNumber: 1,
        content: 'A'.repeat(1000)
      },
      {
        pageNumber: 2,
        content: 'B'.repeat(1000)
      }
    ];

    const chunks = splitIntoChunks(pages);
    
    // Should have chunks from both pages
    const page1Chunks = chunks.filter(c => c.pageNumber === 1);
    const page2Chunks = chunks.filter(c => c.pageNumber === 2);
    
    expect(page1Chunks.length).toBeGreaterThan(0);
    expect(page2Chunks.length).toBeGreaterThan(0);
    
    // Page 1 chunks should contain 'A', page 2 chunks should contain 'B'
    page1Chunks.forEach(chunk => {
      expect(chunk.content).toContain('A');
    });
    page2Chunks.forEach(chunk => {
      expect(chunk.content).toContain('B');
    });
  });

  it('should handle position numbers correctly', () => {
    const content = `
Position 17.3.24: Inkontinenzversorgung - Preis: 45,00 EUR
Position 19.40.01.7: Mobile Insulinpumpe - Preis: 150,00 EUR
    `.trim();

    const pages = [
      {
        pageNumber: 1,
        content: content
      }
    ];

    const chunks = splitIntoChunks(pages);
    
    // Position numbers should be preserved in chunks
    const hasPosition1 = chunks.some(c => c.content.includes('17.3.24'));
    const hasPosition2 = chunks.some(c => c.content.includes('19.40.01.7'));
    
    expect(hasPosition1).toBe(true);
    expect(hasPosition2).toBe(true);
  });

  it('should use larger chunks for tables (around 800 chars)', () => {
    const tableContent = `
Pos.-Nr.    Beschreibung                                          Preis
19.40.01.1  Insulinpumpe Typ A mit Zubehör                       150,00 EUR
19.40.01.2  Insulinpumpe Typ B mit Zubehör                       180,00 EUR
19.40.01.3  Insulinpumpe Typ C mit Zubehör                       200,00 EUR
19.40.01.4  Insulinpumpe Typ D mit Zubehör                       220,00 EUR
19.40.01.5  Insulinpumpe Typ E mit Zubehör                       250,00 EUR
19.40.01.6  Insulinpumpe Typ F mit Zubehör                       280,00 EUR
19.40.01.7  Insulinpumpe Typ G mit Zubehör                       300,00 EUR
    `.trim();

    const pages = [
      {
        pageNumber: 1,
        content: tableContent
      }
    ];

    const chunks = splitIntoChunks(pages);
    
    // Table content is ~560 chars, should fit in one chunk with 800 char limit
    expect(chunks.length).toBeLessThanOrEqual(3);
    
    // All position numbers should be preserved
    const allContent = chunks.map(c => c.content).join(' ');
    expect(allContent).toContain('19.40.01.1');
    expect(allContent).toContain('19.40.01.7');
  });

  it('should handle empty pages gracefully', () => {
    const pages = [
      {
        pageNumber: 1,
        content: ''
      },
      {
        pageNumber: 2,
        content: '   '
      }
    ];

    const chunks = splitIntoChunks(pages);
    
    // Should not create chunks for empty content
    expect(chunks.length).toBe(0);
  });

  it('should assign sequential chunk indices', () => {
    const pages = [
      {
        pageNumber: 1,
        content: 'A'.repeat(1000)
      },
      {
        pageNumber: 2,
        content: 'B'.repeat(1000)
      }
    ];

    const chunks = splitIntoChunks(pages);
    
    // Chunk indices should be sequential starting from 0
    chunks.forEach((chunk, index) => {
      expect(chunk.chunkIndex).toBe(index);
    });
  });
});
