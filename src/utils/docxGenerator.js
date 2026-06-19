
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun
} from 'docx';
import { saveAs } from 'file-saver';
import { loadLogoAsPng, buildCompanyLines } from './reportBranding';

/**
 * Generates and saves a structured DOCX document.
 * @param {Object} reportData - structured report object
 * @param {string} filename - output filename
 * @param {Object} [options]
 * @param {Object} [options.company] - Perfil del negocio para el membrete (premium / custom_branding)
 */
export const generateDOCX = async (reportData, filename, options = {}) => {
  const { company = null } = options;
  const children = [];

  // 0. Membrete del negocio (premium / custom_branding): logo + identificación
  if (company) {
    const { name, lines } = buildCompanyLines(company);
    const logo = company.logoUrl ? await loadLogoAsPng(company.logoUrl) : null;
    if (logo) {
      const h = 56;
      const w = Math.round((logo.width / logo.height) * h);
      children.push(new Paragraph({
        children: [new ImageRun({ data: logo.uint8, type: 'png', transformation: { width: w, height: h } })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 }
      }));
    }
    if (name) {
      children.push(new Paragraph({
        children: [new TextRun({ text: name, bold: true, size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 }
      }));
    }
    if (lines.length) {
      children.push(new Paragraph({
        children: [new TextRun({ text: lines.join('   ·   '), size: 18, color: '666666' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }));
    }
    children.push(new Paragraph({
      text: '',
      border: { bottom: { color: 'CCCCCC', size: 6, space: 1, style: 'single' } },
      spacing: { after: 240 }
    }));
  }

  // 1. Title
  children.push(
    new Paragraph({
      text: reportData.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  // 2. Metadata Block
  if (reportData.metadata) {
    reportData.metadata.forEach(meta => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${meta.label}: `, bold: true }),
            new TextRun({ text: meta.value })
          ],
          spacing: { after: 100 }
        })
      );
    });
    children.push(new Paragraph({ text: "", spacing: { after: 300 } })); // Spacer
    children.push(new Paragraph({ 
      text: "---", 
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 }
    }));
  }

  // 3. Sections
  reportData.sections.forEach(section => {
    // Section Title
    if (section.title) {
      const isMajorHeader = section.type === 'header_section';
      children.push(
        new Paragraph({
          text: section.title,
          heading: isMajorHeader ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: { before: isMajorHeader ? 400 : 300, after: 200 },
          alignment: isMajorHeader ? AlignmentType.CENTER : AlignmentType.LEFT
        })
      );
    }

    // Section Content by Type
    if (section.type === 'paragraph' || !section.type) {
      if (section.content) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: section.content, size: 24 })],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 }
          })
        );
      }
    } else if (section.type === 'table') {
      const tableRows = [];

      // Header Row
      if (section.headers) {
        tableRows.push(
          new TableRow({
            children: section.headers.map(header => 
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ text: header, bold: true, size: 22 })],
                  alignment: AlignmentType.CENTER 
                })],
                shading: { fill: "F0F0F0" },
                width: { size: 100 / section.headers.length, type: WidthType.PERCENTAGE },
                verticalAlign: "center",
              })
            ),
          })
        );
      }

      // Data Rows
      if (section.rows) {
        section.rows.forEach(row => {
          tableRows.push(
            new TableRow({
              children: row.map(cell => 
                new TableCell({
                  children: [new Paragraph({ 
                    text: cell, 
                    size: 22,
                    alignment: isNaN(cell) ? AlignmentType.LEFT : AlignmentType.RIGHT // Auto align numbers
                  })],
                  width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
                })
              ),
            })
          );
        });
      }

      children.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
      children.push(new Paragraph({ text: "", spacing: { after: 200 } })); // Spacer after table
    } else if (section.type === 'list') {
      if (section.items) {
        section.items.forEach(item => {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: item.replace(/\*\*/g, ''), size: 24 })], // Remove markdown bold markers for now
              bullet: { level: 0 },
              spacing: { after: 100 }
            })
          );
        });
      }
    }

    // Notes
    if (section.notes) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: section.notes, italics: true, size: 20 })
          ],
          spacing: { before: 100, after: 300 }
        })
      );
    }
  });

  // Footer
  const footerName = company ? (company.tradeName || company.legalName || '') : '';
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${footerName ? `${footerName} — ` : ''}Generado automáticamente el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`,
          italics: true,
          size: 16, // 8pt
          color: "888888"
        }),
      ],
      spacing: { before: 600 },
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
};
