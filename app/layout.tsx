import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedViva AI — Your Ruthless 24/7 AI Medical Examiner",
  description: "A hyper-realistic, AI-driven viva simulator for high-stakes medical exams. Practice NEET-PG, USMLE, and clinical viva questions with your personal AI examiner powered by Azure AI.",
  keywords: "medical viva, NEET-PG, AI examiner, medical education, viva simulator",
  openGraph: {
    title: "MedViva AI",
    description: "Your personal, ruthless, 24/7 AI examiner for medical exam preparation.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
