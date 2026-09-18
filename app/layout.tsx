import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme";
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

/**
 * Sets the theme before first paint, so a dark-mode visitor never sees a
 * flash of light. It mirrors ThemeProvider (components/theme.tsx): the same
 * "cubixso.theme" key, the same "system" default, and data-theme plus
 * color-scheme written together. Keep the two in step.
 */
const themeBoot = `(function(){function sys(){try{return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){return "light"}}var t="system";try{var s=localStorage.getItem("cubixso.theme");if(s==="light"||s==="dark"||s==="system")t=s;}catch(e){}var r=t==="system"?sys():t;try{var d=document.documentElement;d.setAttribute("data-theme",r);d.style.colorScheme=r;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The boot script sets data-theme and color-scheme on <html> before React
    // hydrates, so the attributes legitimately differ from the static HTML.
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
