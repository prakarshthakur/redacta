const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

(async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  page.drawText('John Doe has phone 555-555-5555 and SSN 123-45-6789.');
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('/tmp/test.pdf', pdfBytes);
})();
