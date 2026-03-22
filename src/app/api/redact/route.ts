import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PDFParser from 'pdf2json';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const keywordsRaw = formData.get('keywords') as string;
    const aiPrompt = formData.get('aiPrompt') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const customKeywords = keywordsRaw ? keywordsRaw.split(',').map(k => k.trim()).filter(Boolean) : [];
    
    // In a full production app, you would pass `aiPrompt` and the extracted text directly to an LLM provider here.
    if (aiPrompt) {
      console.log('User requested AI Redaction with Prompt:', aiPrompt);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let originalText = '';

    if (file.type === 'application/pdf') {
      const pdfData = await new Promise<any>((resolve, reject) => {
        const pdfParser = new (PDFParser as any)();
        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", (data: any) => resolve(data));
        pdfParser.parseBuffer(buffer);
      });

      const pdfDoc = await PDFDocument.load(buffer);
      const pages = pdfDoc.getPages();

      // Simple heuristic for PII checking on individual tokenized text chunks
      const checkPII = (str: string) => {
        const rules = [
          /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i, // Email
          /\b\d{3}-\d{2}-\d{4}\b/, // SSN
          /(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})/i,
          /\b(John Doe|Jane Doe|Alice|Bob|Charlie)\b/ig
        ];
        
        const customRules = customKeywords.map(k => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
        return [...rules, ...customRules].some(r => r.test(str));
      };

      for (let pInit = 0; pInit < pdfData.Pages.length; pInit++) {
        if (!pages[pInit]) continue;
        const pageInfo = pdfData.Pages[pInit];
        const pdfPage = pages[pInit];
        const pageHeight = pdfPage.getHeight();

        for (const textItem of pageInfo.Texts || []) {
          if (!textItem.R || !textItem.R[0]) continue;
          
          let rawText = '';
          try {
            rawText = decodeURIComponent(textItem.R[0].T);
          } catch (e) {
            rawText = unescape(textItem.R[0].T); // Fallback for malformed string encoding
          }
          
          if (checkPII(rawText)) {
            const SCALE = 16.0;

            const fontSize = (textItem.R[0].TS && textItem.R[0].TS[1]) ? Math.max(textItem.R[0].TS[1] * 2, 8) : 12;
            const approxWidth = (textItem.w || (rawText.length * 0.5)) * 14; 
            
            const x = (textItem.x || 0) * SCALE;
            const y = pageHeight - ((textItem.y || 0) * SCALE);
            
            try {
              pdfPage.drawRectangle({
                x: x,
                y: y - fontSize * 0.8,
                width: approxWidth,
                height: fontSize * 1.2,
                color: rgb(0, 0, 0),
              });
            } catch (drawErr) {
              console.error('Failed to draw rectangle on page', pInit, drawErr);
            }
          }
        }
      }

      const modifiedPdfBytes = await pdfDoc.save();
      return new NextResponse(modifiedPdfBytes as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="redacted_${file.name}"`
        }
      });
    } else if (file.type === 'text/plain') {
      let redactedText = buffer.toString('utf-8');
      
      redactedText = redactedText.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[REDACTED EMAIL]');
      redactedText = redactedText.replace(/(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?/gi, '[REDACTED PHONE]');
      redactedText = redactedText.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED SSN]');
      
      const namesToRedact = ['John Doe', 'Jane Doe', 'Alice', 'Bob', 'Charlie', ...customKeywords];
      namesToRedact.forEach(name => {
        const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        redactedText = redactedText.replace(regex, '[REDACTED]');
      });

      return new NextResponse(redactedText, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="redacted_${file.name}"`
        }
      });
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF or TXT file.' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Redaction API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
