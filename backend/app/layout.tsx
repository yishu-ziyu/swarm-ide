import "./globals.css";
import { LanguageProvider } from "./_components/LanguageContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700&family=Press+Start+2P&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <style>{`
          body {
            font-family: 'Space Grotesk', 'Work Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          code, pre, .mono, .font-mono {
            font-family: 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', monospace;
          }
          /* Mobile responsive base */
          @media (max-width: 768px) {
            html { font-size: 14px; }
          }
        `}</style>
      </head>
      <body className="dark">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
