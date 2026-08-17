import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { ComparisonData } from './rag';

/**
 * Generate Excel file from comparison data
 */
export async function generateComparisonExcel(
  data: ComparisonData[],
  positionNumber?: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Vertragsvergleich');

  // Set column widths
  worksheet.columns = [
    { header: 'Krankenkasse', key: 'company', width: 25 },
    { header: 'Vertrag', key: 'contract', width: 30 },
    { header: 'Preis', key: 'price', width: 15 },
    { header: 'Konditionen', key: 'conditions', width: 50 },
    { header: 'Seite', key: 'page', width: 10 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 12 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4CAF50' }, // Green
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;

  // Add title if position number is provided
  if (positionNumber) {
    worksheet.insertRow(1, [`Vertragsvergleich für Position ${positionNumber}`]);
    const titleRow = worksheet.getRow(1);
    titleRow.font = { bold: true, size: 14 };
    titleRow.alignment = { horizontal: 'center' };
    worksheet.mergeCells('A1:E1');
    titleRow.height = 30;
  }

  // Find best and worst prices
  const prices = data
    .filter(d => d.price)
    .map(d => ({
      company: d.insuranceCompany,
      priceNum: parseFloat(d.price!.replace(/[^\d,]/g, '').replace(',', '.')),
    }))
    .filter(p => !isNaN(p.priceNum));

  const bestPrice = prices.length > 0 ? Math.min(...prices.map(p => p.priceNum)) : null;
  const worstPrice = prices.length > 0 ? Math.max(...prices.map(p => p.priceNum)) : null;

  // Add data rows
  for (const item of data) {
    const priceNum = item.price
      ? parseFloat(item.price.replace(/[^\d,]/g, '').replace(',', '.'))
      : null;

    const isBestPrice = priceNum !== null && bestPrice !== null && priceNum === bestPrice;
    const isWorstPrice = priceNum !== null && worstPrice !== null && priceNum === worstPrice && bestPrice !== worstPrice;

    const row = worksheet.addRow({
      company: item.insuranceCompany,
      contract: item.contractName,
      price: item.price || 'Keine Information',
      conditions: item.conditions?.join('; ') || 'Keine Konditionen',
      page: item.pageNumber,
    });

    // Highlight best/worst prices
    if (isBestPrice) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC8E6C9' }, // Light green
      };
    } else if (isWorstPrice) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCDD2' }, // Light red
      };
    }

    row.alignment = { vertical: 'top', wrapText: true };
  }

  // Add price difference summary if applicable
  if (data.length > 1 && bestPrice && worstPrice && bestPrice !== worstPrice) {
    worksheet.addRow([]);
    const summaryRow = worksheet.addRow([
      'Preisdifferenz:',
      '',
      `${((worstPrice - bestPrice) / bestPrice * 100).toFixed(1)}% (${(worstPrice - bestPrice).toFixed(2)} €)`,
      '',
      '',
    ]);
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' }, // Light blue
    };
  }

  // Auto-fit rows
  worksheet.eachRow((row) => {
    row.height = Math.max(20, row.height || 20);
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate PDF file from comparison data
 */
export function generateComparisonPDF(
  data: ComparisonData[],
  positionNumber?: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text('Vertragsvergleich', { align: 'center' });
      
      if (positionNumber) {
        doc.moveDown(0.5);
        doc.fontSize(14).font('Helvetica').text(`Position: ${positionNumber}`, { align: 'center' });
      }

      doc.moveDown(1.5);

      // Find best and worst prices
      const prices = data
        .filter(d => d.price)
        .map(d => ({
          company: d.insuranceCompany,
          priceNum: parseFloat(d.price!.replace(/[^\d,]/g, '').replace(',', '.')),
        }))
        .filter(p => !isNaN(p.priceNum));

      const bestPrice = prices.length > 0 ? Math.min(...prices.map(p => p.priceNum)) : null;
      const worstPrice = prices.length > 0 ? Math.max(...prices.map(p => p.priceNum)) : null;

      // Add each comparison entry
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const priceNum = item.price
          ? parseFloat(item.price.replace(/[^\d,]/g, '').replace(',', '.'))
          : null;

        const isBestPrice = priceNum !== null && bestPrice !== null && priceNum === bestPrice;
        const isWorstPrice = priceNum !== null && worstPrice !== null && priceNum === worstPrice && bestPrice !== worstPrice;

        // Company name with badge
        doc.fontSize(14).font('Helvetica-Bold').text(item.insuranceCompany, { continued: true });
        
        if (isBestPrice) {
          doc.fillColor('green').text(' [Günstigster Preis]', { continued: false });
          doc.fillColor('black');
        } else if (isWorstPrice) {
          doc.fillColor('red').text(' [Teuerster Preis]', { continued: false });
          doc.fillColor('black');
        } else {
          doc.text('');
        }

        // Contract name
        doc.fontSize(10).font('Helvetica').fillColor('gray')
          .text(item.contractName)
          .fillColor('black');

        doc.moveDown(0.3);

        // Price
        if (item.price) {
          doc.fontSize(16).font('Helvetica-Bold').text(item.price);
        } else {
          doc.fontSize(10).font('Helvetica-Oblique').fillColor('gray')
            .text('Keine Preisinformation verfügbar')
            .fillColor('black');
        }

        doc.moveDown(0.3);

        // Conditions
        if (item.conditions && item.conditions.length > 0) {
          doc.fontSize(9).font('Helvetica').fillColor('gray').text('Konditionen:').fillColor('black');
          for (const condition of item.conditions) {
            doc.fontSize(9).text(`• ${condition}`, { indent: 10 });
          }
        }

        // Page reference
        doc.fontSize(8).fillColor('gray').text(`Quelle: Seite ${item.pageNumber}`, { align: 'right' }).fillColor('black');

        // Separator
        if (i < data.length - 1) {
          doc.moveDown(0.5);
          doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
          doc.moveDown(0.5);
        }

        // Check if we need a new page
        if (doc.y > doc.page.height - 150 && i < data.length - 1) {
          doc.addPage();
        }
      }

      // Add price difference summary
      if (data.length > 1 && bestPrice && worstPrice && bestPrice !== worstPrice) {
        doc.moveDown(1);
        doc.rect(50, doc.y, doc.page.width - 100, 40).fillAndStroke('#E3F2FD', '#2196F3');
        doc.fillColor('black').fontSize(11).font('Helvetica-Bold')
          .text(
            `Preisdifferenz: ${((worstPrice - bestPrice) / bestPrice * 100).toFixed(1)}% (${(worstPrice - bestPrice).toFixed(2)} €)`,
            50,
            doc.y - 30,
            { width: doc.page.width - 100, align: 'center' }
          );
      }

      // Footer
      doc.fontSize(8).fillColor('gray')
        .text(
          `Generiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')}`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
