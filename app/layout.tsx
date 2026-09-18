import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * The same four TTFs the PDF embeds.
 *
 * Loading the identical files on both sides is what keeps the preview honest:
 * if the editor were set in a system font and the PDF in Inter, every line
 * would wrap at a different place and the preview would stop predicting the
 * document. `public/fonts` is shared rather than duplicated for that reason.
 */
const inter = localFont({
  src: [
    { path: "../public/fonts/Inter-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/Inter-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/Inter-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/Inter-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cubixso Invoicer",
  description: "GST and non-GST invoices, in any currency.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
