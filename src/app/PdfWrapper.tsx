'use client';

import { Document, Page, pdfjs } from 'react-pdf';
import { Loader } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfWrapperProps {
  fileUrl: string;
  numPages: number;
  setNumPages: (pages: number) => void;
}

export default function PdfWrapper({ fileUrl, numPages, setNumPages }: PdfWrapperProps) {
  return (
    <div style={{ display: 'inline-block', width: '100%', textAlign: 'center' }}>
      <Document
        file={fileUrl}
        onLoadSuccess={({ numPages: totalPages }) => setNumPages(totalPages)}
        loading={<Loader className="loading-spinner" size={32} color="var(--primary)" />}
      >
        {Array.from(new Array(numPages), (el, index) => (
          <div key={`page_wrapper_${index}`} style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <Page
              pageNumber={index + 1}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              className="react-pdf__Page"
              width={typeof window !== 'undefined' ? Math.min(window.innerWidth - 60, 800) : 800}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
