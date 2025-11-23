export const metadata = { title: 'LLM Council', description: 'Collective AI deliberation' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin:0, fontFamily:'system-ui, sans-serif' }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
