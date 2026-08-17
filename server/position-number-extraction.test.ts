import { describe, it, expect } from 'vitest';

/**
 * Extract Hilfsmittelpositionsnummern from text
 * This is a copy of the function from rag.ts for testing purposes
 */
function extractPositionNumbers(text: string): string[] {
  const pattern = /\b\d{1,4}\.\d{1,4}\.\d{1,4}(?:\.\d{1,4})?\b/g;
  const matches = text.match(pattern);
  return matches ? Array.from(new Set(matches)) : [];
}

describe('Position Number Extraction', () => {
  it('should extract standard position numbers with 2 digits per segment', () => {
    const text = 'Was kostet Position 19.40.01.7?';
    const result = extractPositionNumbers(text);
    expect(result).toEqual(['19.40.01.7']);
  });

  it('should extract position numbers with 4 digits in last segment', () => {
    const text = 'Preis für 22.00.99.9915?';
    const result = extractPositionNumbers(text);
    expect(result).toEqual(['22.00.99.9915']);
  });

  it('should extract position numbers with varying digit counts', () => {
    const text = 'Positionen: 1.2.3.4, 12.34.56.789, 123.456.789.1234';
    const result = extractPositionNumbers(text);
    expect(result).toEqual(['1.2.3.4', '12.34.56.789', '123.456.789.1234']);
  });

  it('should extract position numbers without 4th segment', () => {
    const text = 'Position 22.00.99 ist wichtig';
    const result = extractPositionNumbers(text);
    expect(result).toEqual(['22.00.99']);
  });

  it('should handle multiple position numbers in one text', () => {
    const text = 'Vergleiche 19.40.01.7 mit 22.00.99.9915 und 12.34.56';
    const result = extractPositionNumbers(text);
    expect(result).toEqual(['19.40.01.7', '22.00.99.9915', '12.34.56']);
  });

  it('should deduplicate identical position numbers', () => {
    const text = 'Position 19.40.01.7 und nochmal 19.40.01.7';
    const result = extractPositionNumbers(text);
    expect(result).toEqual(['19.40.01.7']);
  });

  it('should return empty array when no position numbers found', () => {
    const text = 'Was kostet ein Rollstuhl?';
    const result = extractPositionNumbers(text);
    expect(result).toEqual([]);
  });

  it('should not match numbers without dots', () => {
    const text = 'Preis: 1234567890';
    const result = extractPositionNumbers(text);
    expect(result).toEqual([]);
  });

  it('should not match partial patterns', () => {
    const text = 'Nur zwei Segmente: 12.34';
    const result = extractPositionNumbers(text);
    expect(result).toEqual([]);
  });

  it('should handle position numbers at start and end of text', () => {
    const text = '19.40.01.7 ist der Preis für 22.00.99.9915';
    const result = extractPositionNumbers(text);
    expect(result).toEqual(['19.40.01.7', '22.00.99.9915']);
  });

  it('should extract from real user question', () => {
    const text = 'Preis für 22.00.99.9915?';
    const result = extractPositionNumbers(text);
    expect(result).toEqual(['22.00.99.9915']);
  });

  it('should handle position numbers with 1 digit segments', () => {
    const text = 'Position 1.2.3.4 und 9.8.7.6';
    const result = extractPositionNumbers(text);
    expect(result).toEqual(['1.2.3.4', '9.8.7.6']);
  });
});
