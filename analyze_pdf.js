const PDFParser = require("pdf2json");

let pdfParser = new PDFParser();
pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
pdfParser.on("pdfParser_dataReady", pdfData => {
    console.log("Keys:", Object.keys(pdfData));
    if (pdfData.formImage) {
        console.log("Pages:", pdfData.formImage.Pages.length);
        console.log(JSON.stringify(pdfData.formImage.Pages[0].Texts.slice(0, 3), null, 2));
        console.log("Page Width Object:", pdfData.formImage.Width);
    } else {
        console.log(JSON.stringify(pdfData).slice(0, 500));
    }
});
pdfParser.loadPDF("/tmp/test.pdf");
