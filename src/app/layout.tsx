import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Redacta — Forensic Redactor',
  description: 'Secure document redaction with forensic-grade PII detection',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
