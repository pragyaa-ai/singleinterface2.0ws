import type { Metadata } from "next";
import "./globals.css";
import "./lib/envSetup";

export const metadata: Metadata = {
  title: "SingleInterface Voice Agent",
  description: "Advanced voice agents with multilingual support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
