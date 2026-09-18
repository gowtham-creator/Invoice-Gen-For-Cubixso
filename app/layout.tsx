import type { Metadata } from "next";
import "./globals.css";

/**
 * The interface is set in the system face (SF Pro on the Mac); see globals.css.
 * The invoice itself embeds Inter from public/fonts, because a PDF has to carry
 * its own fonts and the template it follows is set in Inter.
 */
export const metadata: Metadata = {
  title: "Invoices · Cubixso",
  description: "GST and non-GST invoices for CUBIXSO Solutions, in any currency.",
  icons: { icon: "/cubixso-logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
