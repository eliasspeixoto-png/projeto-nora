// pdf-lib importada dinamicamente na função
import { ItensCalculados, ItemCalculado } from './calculadoraCerca';

export async function gerarPDF(
  companyName: string,
  clientName: string,
  calculo: ItensCalculados
): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 12;
  const margin = 50;
  let y = height - margin;

  // Cabeçalho
  page.drawText('ORÇAMENTO - XCOT', {
    x: margin,
    y,
    font: boldFont,
    size: 24,
    color: rgb(0, 0, 0),
  });
  y -= 40;

  // Informações
  page.drawText(`Empresa: ${companyName}`, { x: margin, y, font, size: fontSize });
  y -= 20;
  page.drawText(`Cliente: ${clientName}`, { x: margin, y, font, size: fontSize });
  y -= 30;

  // Itens
  page.drawText('Itens do Orçamento', { x: margin, y, font: boldFont, size: 16 });
  y -= 25;

  // Tabela de itens
  const tableTop = y;
  const tableLeft = margin;
  const colWidths = [200, 100, 100, 100];

  const drawCell = (text: string, x: number, y: number, width: number, isHeader = false) => {
    page.drawText(text, {
      x: x + 5,
      y: y - 15,
      font: isHeader ? boldFont : font,
      size: fontSize,
    });
  };

  const headers = ['Descrição', 'Qtd.', 'V. Unit.', 'Subtotal'];
  let currentX = tableLeft;
  for (let i = 0; i < headers.length; i++) {
    drawCell(headers[i], currentX, y, colWidths[i], true);
    currentX += colWidths[i];
  }
  y -= 25;
  page.drawLine({
    start: { x: margin, y: y + 10 },
    end: { x: width - margin, y: y + 10 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  calculo.items.forEach((item: ItemCalculado) => {
    currentX = tableLeft;
    drawCell(item.nome, currentX, y, colWidths[0]);
    currentX += colWidths[0];
    drawCell(item.quantidade.toString(), currentX, y, colWidths[1]);
    currentX += colWidths[1];
    drawCell(`R$ ${item.valor_unitario.toFixed(2)}`, currentX, y, colWidths[2]);
    currentX += colWidths[2];
    drawCell(`R$ ${item.subtotal.toFixed(2)}`, currentX, y, colWidths[3]);
    y -= 20;
  });

  page.drawLine({
    start: { x: margin, y: y + 10 },
    end: { x: width - margin, y: y + 10 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 30;

  // Total
  page.drawText(`Total: R$ ${calculo.total.toFixed(2)}`, {
    x: width - margin - 150,
    y,
    font: boldFont,
    size: 18,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
