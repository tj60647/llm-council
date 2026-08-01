export const metadata = {
  title: 'LLM Council — Reconvened',
  description: "Andrej Karpathy's llm-council, reconvened: multi-model deliberation with peer review and a chairman's synthesis — now with persistence, sign-in, and workshop seating."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin:0, fontFamily:'system-ui, sans-serif' }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
