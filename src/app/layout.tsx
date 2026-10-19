import type { Metadata } from 'next';
import '../styles/globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';

export const metadata: Metadata = {
  title: 'Sourcing Assistant — China Wholesale & Container Hub',
  description: 'Cross-platform app for sourcing from Chinese wholesale markets, tracking POs, prepping containers, and managing supplier ledgers.',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-screen md:pl-64 pb-16 md:pb-0">
          <Navbar />
          <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
