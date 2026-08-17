import { describe, it, expect } from 'vitest';
import { validateAnswerAgainstSources, removeHallucinatedCompanies } from './hallucinationValidator';
import type { Contract, ContractChunk } from '../drizzle/schema';

describe('Hallucination Validator', () => {
  // Mock contract and chunk data
  const mockAOKContract: Contract = {
    id: 1,
    userId: 'test-user',
    name: 'AOK Bayern Vertrag',
    insuranceCompany: 'AOK Bayern - Die Gesundheitskasse',
    productArea: 'Betten',
    validFrom: '2024-01-01',
    validUntil: null,
    contactPerson: null,
    contactEmail: null,
    contactPhone: null,
    status: 'ready',
    errorMessage: null,
    pdfUrl: 'https://example.com/aok.pdf',
    pdfKey: 'aok.pdf',
    pageCount: 94,
    createdAt: new Date(),
    updatedAt: new Date(),
    contractNumber: null,
    discountRate: null
  };

  const mockIKKContract: Contract = {
    ...mockAOKContract,
    id: 2,
    name: 'IKK Classic Vertrag',
    insuranceCompany: 'IKK classic'
  };

  const mockAOKChunk: ContractChunk & { contract: Contract } = {
    id: 1,
    contractId: 1,
    pageNumber: 41,
    content: 'Position 19.40.01.7: 250,00 € (netto)',
    embedding: [],
    createdAt: new Date(),
    contract: mockAOKContract
  };

  const mockIKKChunk: ContractChunk & { contract: Contract } = {
    id: 2,
    contractId: 2,
    pageNumber: 12,
    content: 'Position 19.40.01.7: 230,00 € (netto)',
    embedding: [],
    createdAt: new Date(),
    contract: mockIKKContract
  };

  describe('validateAnswerAgainstSources', () => {
    it('should detect hallucinated insurance companies', () => {
      const answer = `Ja, die Position 19.40.01.7 ist auch in anderen Verträgen enthalten:
      
      • IKK Classic: 250,00 € (netto) [IKK Classic - schwierig, Seite 41]
      • Barmer: 250,00 € (netto) [Barmer - schwierig, Seite 41]
      • DAK-Gesundheit: 250,00 € (netto) [DAK-Gesundheit - schwierig, Seite 41]`;

      const result = validateAnswerAgainstSources(answer, [mockAOKChunk]);

      expect(result.isValid).toBe(false);
      expect(result.hallucinatedCompanies).toContain('IKK Classic');
      expect(result.hallucinatedCompanies).toContain('Barmer');
      expect(result.hallucinatedCompanies).toContain('DAK-Gesundheit');
      expect(result.suggestion).toContain('nicht in den durchsuchten Verträgen vorkommen');
    });

    it('should validate correct answer with only source companies', () => {
      const answer = `Die AOK Bayern zahlt 250,00 € (netto) für Position 19.40.01.7. [AOK Bayern Vertrag, Seite 41]`;

      const result = validateAnswerAgainstSources(answer, [mockAOKChunk]);

      expect(result.isValid).toBe(true);
      expect(result.hallucinatedCompanies).toHaveLength(0);
      expect(result.validCompanies).toContain('AOK Bayern');
    });

    it('should handle multiple valid companies', () => {
      const answer = `Position 19.40.01.7 ist in folgenden Verträgen enthalten:
      
      • AOK Bayern: 250,00 € (netto)
      • IKK classic: 230,00 € (netto)`;

      const result = validateAnswerAgainstSources(answer, [mockAOKChunk, mockIKKChunk]);

      expect(result.isValid).toBe(true);
      expect(result.validCompanies).toContain('AOK Bayern');
      expect(result.validCompanies).toContain('IKK');
      expect(result.hallucinatedCompanies).toHaveLength(0);
    });

    it('should detect mix of valid and hallucinated companies', () => {
      const answer = `Position 19.40.01.7 ist in folgenden Verträgen enthalten:
      
      • AOK Bayern: 250,00 € (netto)
      • Barmer: 250,00 € (netto)
      • TK: 250,00 € (netto)`;

      const result = validateAnswerAgainstSources(answer, [mockAOKChunk]);

      expect(result.isValid).toBe(false);
      expect(result.validCompanies).toContain('AOK Bayern');
      expect(result.hallucinatedCompanies).toContain('Barmer');
      expect(result.hallucinatedCompanies).toContain('TK');
    });

    it('should handle answer with no company mentions', () => {
      const answer = `Diese Information ist in den vorliegenden Verträgen nicht enthalten.`;

      const result = validateAnswerAgainstSources(answer, [mockAOKChunk]);

      expect(result.isValid).toBe(true);
      expect(result.hallucinatedCompanies).toHaveLength(0);
      expect(result.validCompanies).toHaveLength(0);
    });

    it('should handle fuzzy matching (AOK vs AOK Bayern)', () => {
      const answer = `Die AOK zahlt 250,00 € für Position 19.40.01.7.`;

      const result = validateAnswerAgainstSources(answer, [mockAOKChunk]);

      expect(result.isValid).toBe(true);
      expect(result.validCompanies).toContain('AOK');
    });
  });

  describe('removeHallucinatedCompanies', () => {
    it('should remove bullet points with hallucinated companies', () => {
      const answer = `Ja, die Position ist in folgenden Verträgen enthalten:
      
      • AOK Bayern: 250,00 € (netto)
      • Barmer: 250,00 € (netto)
      • DAK-Gesundheit: 250,00 € (netto)`;

      const cleaned = removeHallucinatedCompanies(answer, ['Barmer', 'DAK-Gesundheit']);

      expect(cleaned).toContain('AOK Bayern');
      expect(cleaned).not.toContain('Barmer');
      expect(cleaned).not.toContain('DAK-Gesundheit');
    });

    it('should remove markdown bold mentions', () => {
      const answer = `**Barmer**: 250,00 € | **TK**: 240,00 €`;

      const cleaned = removeHallucinatedCompanies(answer, ['Barmer', 'TK']);

      expect(cleaned).not.toContain('Barmer');
      expect(cleaned).not.toContain('TK');
    });

    it('should clean up multiple consecutive newlines', () => {
      const answer = `Line 1\n\n\n\n\nLine 2`;

      const cleaned = removeHallucinatedCompanies(answer, []);

      expect(cleaned).toBe('Line 1\n\nLine 2');
    });

    it('should handle empty hallucinated companies list', () => {
      const answer = `Die AOK Bayern zahlt 250,00 € für Position 19.40.01.7.`;

      const cleaned = removeHallucinatedCompanies(answer, []);

      expect(cleaned).toBe(answer);
    });
  });
});
