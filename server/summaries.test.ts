import { describe, it, expect, beforeAll } from "vitest";
import {
  createSummaryTemplate,
  getAllSummaryTemplates,
  getSummaryTemplateById,
  deleteSummaryTemplate,
  createContractSummary,
  getSummariesByContractId,
  getSummaryByContractAndTemplate,
  deleteContractSummary,
  getSummariesWithTemplatesByContractId,
} from "./db";

describe("Summary Templates", () => {
  let templateId: number;

  it("should create a summary template", async () => {
    const template = await createSummaryTemplate({
      type: "custom",
      title: "Test Template",
      prompt: "Extract test information",
      displayOrder: 999,
      createdBy: 1,
    });

    expect(template).toBeDefined();
    expect(template.title).toBe("Test Template");
    expect(template.type).toBe("custom");
    templateId = template.id;
  });

  it("should get template by id", async () => {
    const template = await getSummaryTemplateById(templateId);
    expect(template).toBeDefined();
    expect(template?.id).toBe(templateId);
  });

  it("should get all templates", async () => {
    const templates = await getAllSummaryTemplates();
    expect(templates.length).toBeGreaterThan(0);
    // Should include predefined templates (4) + test template
    expect(templates.length).toBeGreaterThanOrEqual(5);
  });

  it("should delete template", async () => {
    await deleteSummaryTemplate(templateId);
    const template = await getSummaryTemplateById(templateId);
    expect(template).toBeNull();
  });
});

describe("Contract Summaries", () => {
  let summaryId: number;
  const testContractId = 1; // Assuming contract with ID 1 exists
  const testTemplateId = 1; // Assuming template with ID 1 exists (backOffice)

  it("should create a contract summary", async () => {
    const summary = await createContractSummary({
      contractId: testContractId,
      templateId: testTemplateId,
      content: "# Test Summary\n\nThis is a test summary with **bold** text.",
      generatedBy: 1,
    });

    expect(summary).toBeDefined();
    expect(summary.contractId).toBe(testContractId);
    expect(summary.templateId).toBe(testTemplateId);
    expect(summary.content).toContain("Test Summary");
    summaryId = summary.id;
  });

  it("should get summaries by contract id", async () => {
    const summaries = await getSummariesByContractId(testContractId);
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries.some(s => s.id === summaryId)).toBe(true);
  });

  it("should get summary by contract and template", async () => {
    const summary = await getSummaryByContractAndTemplate(testContractId, testTemplateId);
    expect(summary).toBeDefined();
    expect(summary?.id).toBe(summaryId);
  });

  it("should get summaries with template info", async () => {
    const summaries = await getSummariesWithTemplatesByContractId(testContractId);
    expect(summaries.length).toBeGreaterThan(0);
    const testSummary = summaries.find(s => s.id === summaryId);
    expect(testSummary).toBeDefined();
    expect(testSummary?.template).toBeDefined();
    expect(testSummary?.template.type).toBe("backOffice");
  });

  it("should delete contract summary", async () => {
    await deleteContractSummary(summaryId);
    const summary = await getSummaryByContractAndTemplate(testContractId, testTemplateId);
    expect(summary).toBeNull();
  });
});

describe("Predefined Templates", () => {
  it("should have all predefined templates", async () => {
    const templates = await getAllSummaryTemplates();
    const types = templates.map(t => t.type);
    
    expect(types).toContain("backOffice");
    expect(types).toContain("sales");
    expect(types).toContain("management");
    expect(types).toContain("all");
  });

  it("should have correct template titles", async () => {
    const templates = await getAllSummaryTemplates();
    
    const backOffice = templates.find(t => t.type === "backOffice");
    expect(backOffice?.title).toContain("Innendienst");
    
    const sales = templates.find(t => t.type === "sales");
    expect(sales?.title).toContain("Außendienst");
    
    const management = templates.find(t => t.type === "management");
    expect(management?.title).toContain("Geschäftsführung");
    
    const all = templates.find(t => t.type === "all");
    expect(all?.title).toContain("Vollständige");
  });
});
