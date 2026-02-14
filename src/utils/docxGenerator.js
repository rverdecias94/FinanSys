
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
  BorderStyle,
  Header 
} from 'docx';
import { saveAs } from 'file-saver';

/**
 * Generates and saves a structured DOCX document.
 * @param {Object} reportData - structured report object
 * @param {string} filename - output filename
 */
export const generateDOCX = async (reportData, filename) => {
  const children = [];

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
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generado automáticamente el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`,
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
