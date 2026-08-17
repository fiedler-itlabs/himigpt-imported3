import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractContractFilters, KNOWN_INSURANCE_KEYWORDS, type ContractFilters } from './contractFilters';
import { invokeLLM } from './_core/llm';

// Mock invokeLLM
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn()
}));

describe('Contract Filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractContractFilters', () => {
    it('should extract insurance company with high confidence when explicitly mentioned', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              insuranceCompanyKeyword: 'AOK',
              confidence: 'high'
            })
          }
        }]
      };
      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await extractContractFilters('was zahlt die aok für 19.40.01.7?');
      
      expect(result).toEqual({
        insuranceCompanyKeyword: 'AOK',
        confidence: 'high'
      });
    });

    it('should return low confidence when insurance company not mentioned', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              confidence: 'low'
            })
          }
        }]
      };
      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await extractContractFilters('Preis für 19.40.01.7?');
      
      expect(result.confidence).toBe('low');
      expect(result.insuranceCompanyKeyword).toBeUndefined();
    });

    it('should extract TK with high confidence', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              insuranceCompanyKeyword: 'TK',
              confidence: 'high'
            })
          }
        }]
      };
      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await extractContractFilters('was kostet ein Rollstuhl bei der TK?');
      
      expect(result).toEqual({
        insuranceCompanyKeyword: 'TK',
        confidence: 'high'
      });
    });

    it('should extract IKK with high confidence', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              insuranceCompanyKeyword: 'IKK',
              confidence: 'high'
            })
          }
        }]
      };
      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await extractContractFilters('IKK Classic Preise');
      
      expect(result).toEqual({
        insuranceCompanyKeyword: 'IKK',
        confidence: 'high'
      });
    });

    it('should ignore filters when confidence is low', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              insuranceCompanyKeyword: 'AOK',
              confidence: 'low'
            })
          }
        }]
      };
      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await extractContractFilters('Rollstuhl Preis?');
      
      expect(result.confidence).toBe('low');
    });

    it('should handle LLM errors gracefully', async () => {
      vi.mocked(invokeLLM).mockRejectedValue(new Error('LLM error'));

      const result = await extractContractFilters('test question');
      
      expect(result).toEqual({ confidence: 'low' });
    });

    it('should handle empty LLM response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null
          }
        }]
      };
      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await extractContractFilters('test question');
      
      expect(result).toEqual({ confidence: 'low' });
    });

    it('should handle non-string LLM response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: [{ type: 'text', text: 'invalid' }]
          }
        }]
      };
      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await extractContractFilters('test question');
      
      expect(result).toEqual({ confidence: 'low' });
    });

    it('should handle comparison questions', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              insuranceCompanyKeyword: 'AOK',
              confidence: 'high'
            })
          }
        }]
      };
      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await extractContractFilters('AOK vs IKK Vergleich');
      
      // Should extract first mentioned company
      expect(result.insuranceCompanyKeyword).toBe('AOK');
      expect(result.confidence).toBe('high');
    });
  });

  describe('KNOWN_INSURANCE_KEYWORDS', () => {
    it('should contain common insurance company keywords', () => {
      expect(KNOWN_INSURANCE_KEYWORDS).toContain('AOK');
      expect(KNOWN_INSURANCE_KEYWORDS).toContain('IKK');
      expect(KNOWN_INSURANCE_KEYWORDS).toContain('TK');
      expect(KNOWN_INSURANCE_KEYWORDS).toContain('Barmer');
      expect(KNOWN_INSURANCE_KEYWORDS).toContain('DAK');
      expect(KNOWN_INSURANCE_KEYWORDS).toContain('KKH');
    });

    it('should have at least 5 keywords', () => {
      expect(KNOWN_INSURANCE_KEYWORDS.length).toBeGreaterThanOrEqual(5);
    });
  });
});
