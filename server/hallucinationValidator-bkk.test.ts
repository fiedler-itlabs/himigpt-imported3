import { describe, it, expect } from 'vitest';
import { validateAnswerAgainstSources } from './hallucinationValidator';
import type { Contract, ContractChunk } from '../drizzle/schema';

describe('Hallucination Validator - BKK Contract Name Matching', () => {
  const mockBKKContract: Contract = {
    id: 1,
    userId: 'test-user',
    name: 'BKK 120',
    insuranceCompany: 'Mobil Krankenkasse',
    productArea: 'Hilfsmittel',
    validFrom: '2024-01-01',
    validUntil: null,
    contactPerson: null,
    contactEmail: null,
    contactPhone: null,
    status: 'ready',
    errorMessage: null,
    pdfUrl: 'https://example.com/bkk.pdf',
    pdfKey: 'bkk.pdf',
    pageCount: 120,
    createdAt: new Date(),
    updatedAt: new Date(),
    contractNumber: null,
    discountRate: null
  };

  const mockBKKChunk: ContractChunk & { contract: Contract } = {
    id: 1,
    contractId: 1,
    pageNumber: 93,
    content: 'Position 19.40.01.7: 250,00 € (netto)',
    embedding: [],
    createdAt: new Date(),
    contract: mockBKKContract
  };

  it('should recognize "BKK" as valid when contract name contains "BKK"', () => {
    const answer = `Ja, die Position 19.40.01.7 ist in folgenden Verträgen enthalten:
    
    • Mobil Krankenkasse [BKK 120, Seite 93]`;

    const result = validateAnswerAgainstSources(answer, [mockBKKChunk]);

    expect(result.isValid).toBe(true);
    expect(result.validCompanies).toContain('BKK');
    expect(result.validCompanies).toContain('Mobil Krankenkasse');
    expect(result.hallucinatedCompanies).toHaveLength(0);
  });

  it('should recognize "BKK" even when only mentioned in answer text', () => {
    const answer = `Die BKK zahlt 250,00 € für Position 19.40.01.7. [BKK 120, Seite 93]`;

    const result = validateAnswerAgainstSources(answer, [mockBKKChunk]);

    expect(result.isValid).toBe(true);
    expect(result.validCompanies).toContain('BKK');
    expect(result.hallucinatedCompanies).toHaveLength(0);
  });

  it('should still detect hallucinated companies not in contract names', () => {
    const answer = `Position 19.40.01.7 ist in folgenden Verträgen enthalten:
    
    • BKK: 250,00 € (netto)
    • Barmer: 250,00 € (netto)
    • TK: 250,00 € (netto)`;

    const result = validateAnswerAgainstSources(answer, [mockBKKChunk]);

    expect(result.isValid).toBe(false);
    expect(result.validCompanies).toContain('BKK');
    expect(result.hallucinatedCompanies).toContain('Barmer');
    expect(result.hallucinatedCompanies).toContain('TK');
  });

  it('should handle multiple BKK contracts', () => {
    const mockBKK101: ContractChunk & { contract: Contract } = {
      ...mockBKKChunk,
      id: 2,
      contract: {
        ...mockBKKContract,
        id: 2,
        name: 'BKK 101'
      }
    };

    const answer = `Die Position ist in BKK 120 und BKK 101 enthalten.`;

    const result = validateAnswerAgainstSources(answer, [mockBKKChunk, mockBKK101]);

    expect(result.isValid).toBe(true);
    expect(result.validCompanies).toContain('BKK');
    expect(result.hallucinatedCompanies).toHaveLength(0);
  });
});
