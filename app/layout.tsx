import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-family-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'musilog.fm',
  description: 'Your Last.fm charts, neighbours, and listening history.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-us">
      <body className={`theme-github ${jetBrainsMono.variable}`} suppressHydrationWarning>{children}</body>
    </html>
  );
}
