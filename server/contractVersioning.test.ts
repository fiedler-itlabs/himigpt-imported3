import { describe, it, expect, beforeEach } from "vitest";
import {
  archiveContract,
  getContractVersions,
  restoreArchivedContract,
  detectSimilarContracts,
  createContract,
  getContractById,
} from "./db";
import { extractVersionFromFilename } from "./versionDetection";

describe("Contract Versioning", () => {
  describe("extractVersionFromFilename", () => {
    it("should extract year from filename", () => {
      const result = extractVersionFromFilename("Preisliste 2024.pdf");
      expect(result.year).toBe("2024");
      expect(result.versionLabel).toBe("2024");
      expect(result.baseName).toBe("Preisliste");
    });

    it("should extract version label (v1, v2)", () => {
      const result = extractVersionFromFilename("AOK Vertrag v2.pdf");
      expect(result.versionLabel).toBe("v2");
      expect(result.baseName).toBe("AOK Vertrag");
    });

    it("should extract quarter (Q1, Q2)", () => {
      const result = extractVersionFromFilename("IKK Q2 2024.pdf");
      expect(result.year).toBe("2024");
      expect(result.versionLabel).toBe("Q2");
      expect(result.baseName).toBe("IKK");
    });

    it("should handle filename without version", () => {
      const result = extractVersionFromFilename("Bundesvertrag.pdf");
      expect(result.year).toBeNull();
      expect(result.versionLabel).toBeNull();
      expect(result.baseName).toBe("Bundesvertrag");
    });
  });

  describe("Database versioning operations", () => {
    let testContractId1: number;
    let testContractId2: number;

    beforeEach(async () => {
      // Create test contracts
      const contract1 = await createContract({
        name: "Preisliste 2023",
        pdfUrl: "https://example.com/preisliste-2023.pdf",
        pdfKey: "test-key-1",
        uploadedBy: 1,
        status: "ready",
        insuranceCompany: "AOK Bayern",
        versionLabel: "2023",
        versionNumber: 1,
      });
      testContractId1 = contract1.id;

      const contract2 = await createContract({
        name: "Preisliste 2024",
        pdfUrl: "https://example.com/preisliste-2024.pdf",
        pdfKey: "test-key-2",
        uploadedBy: 1,
        status: "ready",
        insuranceCompany: "AOK Bayern",
        versionLabel: "2024",
        versionNumber: 2,
      });
      testContractId2 = contract2.id;
    });

    it("should archive a contract", async () => {
      await archiveContract(testContractId1, testContractId2);
      
      const archived = await getContractById(testContractId1);
      expect(archived?.isArchived).toBe(true);
      expect(archived?.replacedByContractId).toBe(testContractId2);
      expect(archived?.archivedAt).toBeDefined();
    });

    it("should get all versions of a contract", async () => {
      const versions = await getContractVersions(testContractId1);
      
      expect(versions.length).toBeGreaterThanOrEqual(2);
      expect(versions.some(v => v.id === testContractId1)).toBe(true);
      expect(versions.some(v => v.id === testContractId2)).toBe(true);
    });

    it("should restore archived contract", async () => {
      // Archive first contract
      await archiveContract(testContractId1, testContractId2);
      
      // Restore it
      await restoreArchivedContract(testContractId1);
      
      const restored = await getContractById(testContractId1);
      expect(restored?.isArchived).toBe(false);
      expect(restored?.replacedByContractId).toBeNull();
      
      // Check that the replacement was archived
      const nowArchived = await getContractById(testContractId2);
      expect(nowArchived?.isArchived).toBe(true);
      expect(nowArchived?.replacedByContractId).toBe(testContractId1);
    });

    it("should detect similar contracts", async () => {
      const similar = await detectSimilarContracts("Preisliste 2025", "AOK Bayern");
      
      expect(similar.length).toBeGreaterThanOrEqual(2);
      expect(similar.every(c => c.insuranceCompany === "AOK Bayern")).toBe(true);
      expect(similar.every(c => c.name.includes("Preisliste"))).toBe(true);
      expect(similar.every(c => !c.isArchived)).toBe(true);
    });
  });
});
