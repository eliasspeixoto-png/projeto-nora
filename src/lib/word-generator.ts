
import { Document, Packer, Paragraph, TextRun, Header, ImageRun, AlignmentType, Indent, UnderlineType, Table, TableCell, TableRow, WidthType, BorderStyle } from 'docx';
import { Quote } from './data';

const formatProductName = (name: string): string => {
    if (!name) return '';
    return name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const createStyledParagraphsAndTables = (text: string, quote?: Quote): (Paragraph | Table)[] => {
    const lines = text.split('\n');
    const elements: (Paragraph | Table)[] = [];
    let i = 0;

    while (i < lines.length) {
        const trimmedLine = lines[i].trim();

        if (trimmedLine.length === 0) {
            elements.push(new Paragraph({ text: "", spacing: { after: 120 } }));
            i++;
            continue;
        }

        const isMainTitle = i < 2;
        const isSectionTitle = /^[IVXLCDM]+\s*–/.test(trimmedLine);
        const isEquipmentTitle = trimmedLine.startsWith('EQUIPAMENTOS INCLUSOS NO COMODATO:');
        const isClauseTitle = trimmedLine.startsWith('CLÁUSULA');
        const isParagraphTitle = trimmedLine.startsWith('Parágrafo');

        if (isMainTitle) {
             elements.push(new Paragraph({
                children: [new TextRun({ text: trimmedLine, bold: true, size: 24 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 150 },
            }));
            i++;
            continue;
        }
        
        if (trimmedLine.startsWith('CONTRATANTE:') || trimmedLine.startsWith('CONTRATADA:') || trimmedLine.startsWith('TESTEMUNHAS:')) {
            elements.push(new Paragraph({
                children: [new TextRun({ text: trimmedLine, bold: true, size: 20 })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 100 },
            }));
            i++;
            continue;
        }
        
        if (trimmedLine.startsWith('Assinatura:') || trimmedLine.startsWith('Nome:') || trimmedLine.startsWith('Cargo:') || trimmedLine.startsWith('CNPJ:') || trimmedLine.startsWith('CPF:') || trimmedLine.startsWith('RG:')) {
             elements.push(new Paragraph({
                children: [new TextRun({ text: trimmedLine, size: 20 })],
                alignment: AlignmentType.CENTER,
            }));
            i++;
            continue;
        }
        
        if (trimmedLine.startsWith('________________________________________')) {
            elements.push(new Paragraph({
                children: [new TextRun({ text: trimmedLine, size: 20 })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 200 }
            }));
            i++;
            continue;
        }

        if (trimmedLine.includes(' , ') && (trimmedLine.includes('2025') || trimmedLine.includes('2026') || trimmedLine.includes('2024'))) {
             elements.push(new Paragraph({
                children: [new TextRun({ text: trimmedLine, size: 20 })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 200 },
            }));
            i++;
            continue;
        }

        if (isSectionTitle || isEquipmentTitle) {
            elements.push(new Paragraph({
               children: [new TextRun({ text: trimmedLine, bold: true, size: 22 })],
               alignment: AlignmentType.CENTER,
               spacing: { after: 200, before: 150 },
           }));
           i++;
           continue;
       }

        if (isClauseTitle || isParagraphTitle) {
            const separator = '–';
            const separatorIndex = trimmedLine.indexOf(separator);
            
            if (separatorIndex > -1) {
                const titlePart = trimmedLine.substring(0, separatorIndex + separator.length);
                const contentPart = trimmedLine.substring(separatorIndex + separator.length);

                elements.push(new Paragraph({
                    children: [
                        new TextRun({ text: titlePart, bold: true, size: 20 }),
                        new TextRun({ text: contentPart, size: 20 })
                    ],
                    style: "Default",
                    alignment: AlignmentType.JUSTIFIED,
                    indent: { firstLine: 720 },
                    spacing: { after: 100, before: 150 },
                }));
            } else {
                 elements.push(new Paragraph({
                    children: [new TextRun({ text: trimmedLine, bold: true, size: 20 })],
                    style: "Default",
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { after: 100, before: 150 },
                }));
            }

            i++;
            continue;
        }

        if (trimmedLine === '[EQUIPMENT_TABLE]') {
            if (quote && quote.items) {
                const headerRow = new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Item", bold: true, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Cód.", bold: true, size: 18 })] })], width: { size: 15, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Qtd.", bold: true, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Unid.", bold: true, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Produto", bold: true, size: 18 })] })], width: { size: 60, type: WidthType.PERCENTAGE } }),
                    ],
                    tableHeader: true,
                });

                const dataRows = quote.items.map((item, index) => new TableRow({
                    children: [
                        new TableCell({ verticalAlign: "center", children: [new Paragraph({ text: String(index + 1), alignment: AlignmentType.CENTER, children: [new TextRun({ size: 18 })] })] }),
                        new TableCell({ verticalAlign: "center", children: [new Paragraph({ text: item.product?.item || (item as any).productCode || "", children: [new TextRun({ size: 18 })] })] }),
                        new TableCell({ verticalAlign: "center", children: [new Paragraph({ text: String(item.quantity), alignment: AlignmentType.CENTER, children: [new TextRun({ size: 18 })] })] }),
                        new TableCell({ verticalAlign: "center", children: [new Paragraph({ text: item.product?.unit || "UNID", alignment: AlignmentType.CENTER, children: [new TextRun({ size: 18 })] })] }),
                        new TableCell({ verticalAlign: "center", children: [new Paragraph({ text: formatProductName(item.product?.description || (item as any).description || (item as any).productDescription || ""), children: [new TextRun({ size: 18 })] })] }),
                    ],
                }));

                elements.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
            }
            i++;
            continue;
        }

        // --- Standard Paragraphs ---
        elements.push(new Paragraph({
            children: [new TextRun({ text: trimmedLine, size: 20 })],
            style: "Default",
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: 720 },
            spacing: { after: 100 },
        }));
        
        i++;
    }

    return elements;
};

export const generateWordDocument = async (contractText: string, quote: Quote, logoBuffer?: ArrayBuffer): Promise<Document> => {
    
    const styledElements = createStyledParagraphsAndTables(contractText, quote);
    
    const doc = new Document({
        styles: {
            paragraphStyles: [
                {
                    id: "Default",
                    name: "Default",
                    run: { font: "Calibri", size: 20 }, // 10pt
                    paragraph: { spacing: { line: 240, after: 80 } },
                },
            ],
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: 567,    // 1cm
                        right: 567,  // 1cm
                        bottom: 567, // 1cm
                        left: 1134,  // 2cm
                        header: 567, // 1cm
                        footer: 567, // 1cm
                        gutter: 0,
                    },
                },
            },
            headers: {
                default: new Header({
                    children: logoBuffer
                        ? [
                            new Paragraph({
                                children: [
                                    new ImageRun({
                                        data: logoBuffer,
                                        transformation: {
                                            width: 120,
                                            height: 40,
                                        },
                                    }),
                                ],
                                alignment: AlignmentType.LEFT,
                            }),
                        ]
                        : [],
                }),
            },
            children: styledElements,
        }],
    });

    return doc;
};
