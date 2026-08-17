import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { storagePut } from './storage';

interface ComparisonExportData {
  query: string;
  contracts: Array<{
    id: number;
    name: string;
  }>;
  result: string; // Markdown content
}

/**
 * Generate Excel export for comparison results
 */
export async function exportComparisonToExcel(data: ComparisonExportData): Promise<{ url: string; key: string }> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Vertragsvergleich');

  // Set column widths
  worksheet.columns = [
    { width: 40 },
    { width: 60 },
  ];

  // Title
  const titleRow = worksheet.addRow(['Vertragsvergleich']);
  titleRow.font = { size: 16, bold: true };
  titleRow.height = 30;
  worksheet.mergeCells('A1:B1');

  // Query
  worksheet.addRow([]);
  const queryLabelRow = worksheet.addRow(['Vergleichsfrage:']);
  queryLabelRow.font = { bold: true };
  const queryRow = worksheet.addRow([data.query]);
  queryRow.alignment = { wrapText: true };
  worksheet.mergeCells(`A${queryRow.number}:B${queryRow.number}`);

  // Contracts
  worksheet.addRow([]);
  const contractsLabelRow = worksheet.addRow(['Verglichene Verträge:']);
  contractsLabelRow.font = { bold: true };
  data.contracts.forEach((contract, index) => {
    const contractRow = worksheet.addRow([`${index + 1}. ${contract.name}`]);
    worksheet.mergeCells(`A${contractRow.number}:B${contractRow.number}`);
  });

  // Result
  worksheet.addRow([]);
  const resultLabelRow = worksheet.addRow(['Ergebnis:']);
  resultLabelRow.font = { bold: true, size: 12 };
  worksheet.mergeCells(`A${resultLabelRow.number}:B${resultLabelRow.number}`);

  // Parse markdown result into rows
  const lines = data.result.split('\n');
  for (const line of lines) {
    if (!line.trim()) {
      worksheet.addRow([]);
      continue;
    }

    // Headers (##, ###)
    if (line.startsWith('###')) {
      const row = worksheet.addRow([line.replace(/^###\s*/, '')]);
      row.font = { bold: true, size: 11 };
      worksheet.mergeCells(`A${row.number}:B${row.number}`);
    } else if (line.startsWith('##')) {
      const row = worksheet.addRow([line.replace(/^##\s*/, '')]);
      row.font = { bold: true, size: 12 };
      worksheet.mergeCells(`A${row.number}:B${row.number}`);
    } else if (line.startsWith('|')) {
      // Table row - skip for now (complex to parse)
      const row = worksheet.addRow([line]);
      worksheet.mergeCells(`A${row.number}:B${row.number}`);
    } else {
      // Regular text
      const row = worksheet.addRow([line.replace(/^\*\s*/, '• ')]);
      row.alignment = { wrapText: true };
      worksheet.mergeCells(`A${row.number}:B${row.number}`);
    }
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Upload to S3
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const key = `comparisons/comparison-${timestamp}-${randomSuffix}.xlsx`;
  const { url } = await storagePut(key, buffer as any, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  return { url, key };
}

/**
 * Generate PDF export for comparison results
 */
export async function exportComparisonToPDF(data: ComparisonExportData): Promise<{ url: string; key: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);

        // Upload to S3
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const key = `comparisons/comparison-${timestamp}-${randomSuffix}.pdf`;
        const { url } = await storagePut(key, buffer as any, 'application/pdf');

        resolve({ url, key });
      });

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text('Vertragsvergleich', { align: 'center' });
      doc.moveDown(1.5);

      // Query
      doc.fontSize(12).font('Helvetica-Bold').text('Vergleichsfrage:');
      doc.fontSize(11).font('Helvetica').text(data.query, { indent: 20 });
      doc.moveDown();

      // Contracts
      doc.fontSize(12).font('Helvetica-Bold').text('Verglichene Verträge:');
      data.contracts.forEach((contract, index) => {
        doc.fontSize(11).font('Helvetica').text(`${index + 1}. ${contract.name}`, { indent: 20 });
      });
      doc.moveDown();

      // Result
      doc.fontSize(14).font('Helvetica-Bold').text('Ergebnis:');
      doc.moveDown(0.5);

      // Parse markdown result
      const lines = data.result.split('\n');
      for (const line of lines) {
        if (!line.trim()) {
          doc.moveDown(0.3);
          continue;
        }

        // Headers
        if (line.startsWith('###')) {
          doc.fontSize(11).font('Helvetica-Bold').text(line.replace(/^###\s*/, ''), { indent: 20 });
          doc.moveDown(0.3);
        } else if (line.startsWith('##')) {
          doc.fontSize(12).font('Helvetica-Bold').text(line.replace(/^##\s*/, ''));
          doc.moveDown(0.5);
        } else if (line.startsWith('|')) {
          // Table row - render as plain text
          doc.fontSize(9).font('Helvetica').text(line, { indent: 10 });
        } else if (line.startsWith('*')) {
          // Bullet point
          doc.fontSize(10).font('Helvetica').text(line.replace(/^\*\s*/, '• '), { indent: 20 });
        } else {
          // Regular text
          doc.fontSize(10).font('Helvetica').text(line);
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
