import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KiwiOps", template: "%s | KiwiOps" },
  description: "Operations management for New Zealand service businesses.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NZ">
      <body>{children}</body>
    </html>
  );
}
