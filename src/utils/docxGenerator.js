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
  ImageRun,
  Footer,
  PageNumber,
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
  const reportTitle = reportData?.title || 'Informe GESTIA';
  const reportId = reportData?.id || reportData?.type || '';

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
      text: reportTitle,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  // 2. Metadata Block (sin separador "---")
  if (reportData.metadata) {
    reportData.metadata.forEach(meta => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${meta.label}: `, bold: true }),
            new TextRun({ text: String(meta.value ?? '') })
          ],
          spacing: { after: 100 }
        })
      );
    });
    children.push(new Paragraph({
      text: '',
      border: { bottom: { color: 'DDDDDD', size: 6, space: 1, style: 'single' } },
      spacing: { before: 100, after: 300 }
    }));
  }

  // 3. Sections
  (reportData.sections || []).forEach((section, sectionIndex) => {
    const pageBreakBefore = Boolean(section.pageBreakBefore) && sectionIndex > 0;

    if (section.title) {
      const isMajorHeader = section.type === 'header_section';
      children.push(
        new Paragraph({
          text: section.title,
          heading: isMajorHeader ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: { before: isMajorHeader ? 400 : 300, after: 200 },
          alignment: isMajorHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
          pageBreakBefore,
        })
      );
    } else if (pageBreakBefore) {
      children.push(
        new Paragraph({
          text: '',
          pageBreakBefore: true,
          spacing: { after: 0 },
        })
      );
    }

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
      const colCount = Math.max(
        section.headers?.length || 0,
        ...(section.rows || []).map((row) => row.length),
        1
      );
      const colWidthPct = 100 / colCount;
      const tableRows = [];

      if (section.headers) {
        tableRows.push(
          new TableRow({
            cantSplit: true,
            children: section.headers.map(header =>
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: String(header ?? ''), bold: true, size: 20 })],
                  alignment: AlignmentType.CENTER
                })],
                shading: { fill: 'F0F0F0' },
                width: { size: colWidthPct, type: WidthType.PERCENTAGE },
                verticalAlign: 'center',
              })
            ),
          })
        );
      }

      if (section.rows) {
        section.rows.forEach(row => {
          tableRows.push(
            new TableRow({
              cantSplit: true,
              children: row.map(cell => {
                const text = cell == null ? '' : String(cell);
                const looksNumeric = text !== '' && !Number.isNaN(Number(String(text).replace(/[^\d.-]/g, ''))) && /[\d]/.test(text);
                return new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ text, size: 20 })],
                    alignment: looksNumeric ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  })],
                  width: { size: colWidthPct, type: WidthType.PERCENTAGE },
                });
              }),
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
      children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    } else if (section.type === 'list') {
      if (section.items) {
        section.items.forEach(item => {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: String(item).replace(/\*\*/g, ''), size: 24 })],
              bullet: { level: 0 },
              spacing: { after: 100 }
            })
          );
        });
      }
    }

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

  const footerName = company ? (company.tradeName || company.legalName || '') : '';
  const footerLeft = [footerName, reportTitle, reportId].filter(Boolean).join(' · ');
  const emittedAt = `Emitido ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          pageNumbers: { start: 1 },
        },
      },
      headers: undefined,
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: footerLeft || 'GESTIA', size: 16, color: '666666' }),
                new TextRun({ text: '  |  ', size: 16, color: 'AAAAAA' }),
                new TextRun({ text: emittedAt, size: 16, color: '888888', italics: true }),
                new TextRun({ text: '  |  Pág. ', size: 16, color: '666666' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '666666' }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
};
