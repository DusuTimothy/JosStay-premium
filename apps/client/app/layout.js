import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/Header";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

export const metadata = {
  title: "JosStay — Stays in Jos, Plateau State",
  description:
    "Find and book verified hotels, apartments, shortlets, guest houses and Airbnb-style stays in Jos, Plateau State.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <Header />
          <main className="min-h-[60vh] pb-24 xl:pb-0">{children}</main>
          <Footer />
          <MobileTabBar />
        </Providers>
      </body>
    </html>
  );
}
