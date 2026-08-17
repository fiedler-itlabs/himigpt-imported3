import { marked } from "marked";
import { JSDOM } from "jsdom";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType } from "docx";
import { getContractSummaryById } from "./db";

/**
 * Export summary as Word document
 */
export async function exportSummaryAsWord(summaryId: number): Promise<Buffer> {
  const summary = await getContractSummaryById(summaryId);
  if (!summary) {
    throw new Error("Summary not found");
  }

  // Parse markdown to HTML
  const html = await marked(summary.content);
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Convert HTML to docx elements
  const children: (Paragraph | Table)[] = [];

  const processNode = (node: ChildNode) => {
    if (node.nodeType === 1) { // Element node
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      if (tagName === "h1") {
        children.push(
          new Paragraph({
            text: element.textContent || "",
            heading: HeadingLevel.HEADING_1,
          })
        );
      } else if (tagName === "h2") {
        children.push(
          new Paragraph({
            text: element.textContent || "",
            heading: HeadingLevel.HEADING_2,
          })
        );
      } else if (tagName === "h3") {
        children.push(
          new Paragraph({
            text: element.textContent || "",
            heading: HeadingLevel.HEADING_3,
          })
        );
      } else if (tagName === "p") {
        const runs: TextRun[] = [];
        const processInline = (inlineNode: ChildNode) => {
          if (inlineNode.nodeType === 3) { // Text node
            runs.push(new TextRun(inlineNode.textContent || ""));
          } else if (inlineNode.nodeType === 1) {
            const inlineElement = inlineNode as Element;
            const inlineTag = inlineElement.tagName.toLowerCase();
            if (inlineTag === "strong" || inlineTag === "b") {
              runs.push(new TextRun({ text: inlineElement.textContent || "", bold: true }));
            } else if (inlineTag === "em" || inlineTag === "i") {
              runs.push(new TextRun({ text: inlineElement.textContent || "", italics: true }));
            } else {
              runs.push(new TextRun(inlineElement.textContent || ""));
            }
          }
        };
        element.childNodes.forEach(processInline);
        children.push(new Paragraph({ children: runs }));
      } else if (tagName === "ul" || tagName === "ol") {
        element.querySelectorAll("li").forEach((li) => {
          children.push(
            new Paragraph({
              text: li.textContent || "",
              bullet: { level: 0 },
            })
          );
        });
      } else if (tagName === "table") {
        const rows: TableRow[] = [];
        element.querySelectorAll("tr").forEach((tr) => {
          const cells: TableCell[] = [];
          tr.querySelectorAll("th, td").forEach((cell) => {
            cells.push(
              new TableCell({
                children: [new Paragraph(cell.textContent || "")],
                width: { size: 100 / tr.children.length, type: WidthType.PERCENTAGE },
              })
            );
          });
          rows.push(new TableRow({ children: cells }));
        });
        children.push(
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }
    }
  };

  document.body.childNodes.forEach(processNode);

  // Create Word document
  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * Export summary as PDF (using markdown-pdf or similar)
 */
export async function exportSummaryAsPDF(summaryId: number): Promise<Buffer> {
  const summary = await getContractSummaryById(summaryId);
  if (!summary) {
    throw new Error("Summary not found");
  }

  // For now, we'll use a simple HTML to PDF conversion
  // In production, you might want to use a more sophisticated solution
  const html = await marked(summary.content);
  
  // Use weasyprint or similar for PDF generation
  // For now, return a placeholder
  throw new Error("PDF export not yet implemented - use Word export instead");
}
