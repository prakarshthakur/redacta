'use client';

import { useState, useCallback, useMemo } from 'react';
import { UploadCloud, FileText, Download, Shield, Loader, AlertCircle, Eye, Terminal, Crosshair, Database, Lock } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import dynamic from 'next/dynamic';

const PdfWrapper = dynamic(() => import('@/app/PdfWrapper'), { ssr: false });

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [redactedFileUrl, setRedactedFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const [clickedTexts, setClickedTexts] = useState<Set<string>>(new Set());

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    setError(null);
    setRedactedFileUrl(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf' || droppedFile.type === 'text/plain') {
        setFile(droppedFile);
        if (droppedFile.type === 'application/pdf') {
          setFileUrl(URL.createObjectURL(droppedFile));
        }
      } else {
        setError('Only PDF and Text files are currently supported.');
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setRedactedFileUrl(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf' || selectedFile.type === 'text/plain') {
        setFile(selectedFile);
        if (selectedFile.type === 'application/pdf') {
          setFileUrl(URL.createObjectURL(selectedFile));
        }
      } else {
        setError('Only PDF and Text files are currently supported.');
      }
    }
  };

  const handleTextLayerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'span' && target.parentElement?.classList.contains('react-pdf__Page__textContent')) {
      const text = target.textContent?.trim();
      if (text) {
        target.classList.toggle('marked-redact');
        setClickedTexts(prev => {
          const next = new Set(prev);
          if (next.has(text)) next.delete(text);
          else next.add(text);
          return next;
        });
      }
    }
  };

  const handleRedactClick = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      if (file.type === 'application/pdf') {
        // Secure Formatting-Preserving Forensic Redaction strategy:
        // We capture the exact rendered canvas layers directly from react-pdf.
        // We manually burn the black rectangles into the pixel context.
        // We then export the images and construct a flat, completely unselectable and strictly secure PDF.
        const pdfDoc = await PDFDocument.create();
        
        const pageContainers = document.querySelectorAll('.react-pdf__Page');
        if (pageContainers.length === 0) throw new Error("No PDF pages rendered.");

        for (const container of Array.from(pageContainers)) {
          const canvas = container.querySelector('canvas.react-pdf__Page__canvas') as HTMLCanvasElement;
          if (!canvas) continue;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          
          const canvasRect = canvas.getBoundingClientRect();
          const redactedSpans = container.querySelectorAll('.marked-redact');
          
          redactedSpans.forEach(span => {
            const spanRect = span.getBoundingClientRect();
            // Map Screen CSS constraints onto the internal High-Res Canvas matrix
            const scaleX = canvas.width / canvasRect.width;
            const scaleY = canvas.height / canvasRect.height;
            
            const x = (spanRect.left - canvasRect.left) * scaleX;
            const y = (spanRect.top - canvasRect.top) * scaleY;
            const width = spanRect.width * scaleX;
            const height = spanRect.height * scaleY;
            
            ctx.fillStyle = '#000000';
            ctx.fillRect(x, y, width, height); // Burn standard black redaction literal
          });
          
          // Flatten cleanly into heavy-compression standard image
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdfImage = await pdfDoc.embedJpg(imgData);
          
          const page = pdfDoc.addPage([canvas.width, canvas.height]);
          page.drawImage(pdfImage, {
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
          });
        }
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setRedactedFileUrl(url);

      } else if (file.type === 'text/plain') {
        const formData = new FormData();
        formData.append('file', file);
        
        const allKeywords = Array.from(clickedTexts).join(',');
        
        formData.append('keywords', allKeywords);

        const response = await fetch('/api/redact', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          let serverErrorMsg = 'Failed to process file. It may be an unsupported format or corrupted.';
          try {
             const errData = await response.json();
             if (errData.error) serverErrorMsg = errData.error;
          } catch(e) {}
          throw new Error(serverErrorMsg);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setRedactedFileUrl(url);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during redaction.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="app-container">
      <div className="glass-panel text-center">
        <h1 className="title">Redacta — Forensic Redactor</h1>
        <p className="subtitle">&gt; Secure document redaction // PII detection active</p>

        {!file && (
          <div 
            className={`dropzone ${isHovering ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fileUpload')?.click()}
          >
            <Terminal className="dropzone-icon" />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 }}>Drag & drop your file or click to browse</h3>
            <p style={{ color: 'var(--text-muted)' }}>&gt; Awaiting file input...</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Supported formats: .PDF, .TXT</p>
            <input 
              id="fileUpload" 
              type="file" 
              className="hidden" 
              accept=".pdf,.txt"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {error && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 0, 60, 0.1)', color: 'var(--danger)', borderRadius: '0', border: '1px solid var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} />
            Error: {error}
          </div>
        )}

        {file && !redactedFileUrl && (
          <div style={{ marginTop: '2rem' }}>
            <div className="file-info">
              <Database size={24} color="var(--primary)" />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>File: {file.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SIZE: {(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button 
                onClick={() => {
                  setFile(null);
                  setFileUrl(null);
                  setClickedTexts(new Set());
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '1.2rem', fontFamily: 'monospace' }}
              >
                [X]
              </button>
            </div>

            {fileUrl && (
              <div style={{ marginTop: '2.5rem', marginBottom: '2.5rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', textAlign: 'left', display: 'flex', alignItems: 'center', textShadow: '0 0 5px var(--danger)' }}>
                  <Crosshair size={20} style={{ marginRight: '0.5rem', color: 'var(--danger)' }}/>
                  &gt; Click on text to mark for redaction
                </h3>
                <div 
                  className="pdf-viewer-container" 
                  onClick={handleTextLayerClick}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '65vh',
                    minHeight: '400px',
                    overflowY: 'auto',
                    overflowX: 'auto',
                    background: '#111',
                    border: '1px solid var(--border-color)',
                    padding: '2rem 0',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,1)'
                  }}
                >
                  <PdfWrapper fileUrl={fileUrl} numPages={numPages} setNumPages={setNumPages} />
                </div>
              </div>
            )}

            <button 
              className="btn" 
              onClick={handleRedactClick} 
              disabled={isProcessing}
              style={{ width: '100%', padding: '1rem', fontSize: '1.2rem', marginTop: '1rem' }}
            >
              {isProcessing ? (
                <>
                  <Loader className="loading-spinner" size={20} />
                  &gt; Processing redaction...
                </>
              ) : (
                <>
                  <Lock size={20} />
                  [ Apply Redaction ]
                </>
              )}
            </button>
            
            {isProcessing && (
              <p className="status-text">&gt; Securing document...</p>
            )}
          </div>
        )}

        {redactedFileUrl && (
          <div style={{ marginTop: '2rem', padding: '2rem', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '0' }}>
            <Lock size={48} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Redaction Complete</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>&gt; Secure output ready for: {file?.name}</p>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn" 
                onClick={() => {
                  setFile(null);
                  setFileUrl(null);
                  setClickedTexts(new Set());
                  setRedactedFileUrl(null);
                }}
              >
                New File
              </button>
              <a 
                href={redactedFileUrl} 
                download={`redacted_${file?.name}`}
                className="btn"
                style={{ background: 'var(--primary)', color: 'var(--bg-color)', textDecoration: 'none', fontWeight: 'bold' }}
              >
                <Download size={20} />
                Download Secure PDF
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
