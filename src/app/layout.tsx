import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SYS.OP_FORENSIC_REDACTOR',
  description: 'Forensic PII Annihilation Protocol',
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
