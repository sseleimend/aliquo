import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { SocialProof } from "@/components/SocialProof";
import { ProblemTransformation } from "@/components/ProblemTransformation";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { TestimonialsMetrics } from "@/components/TestimonialsMetrics";
import { Objections } from "@/components/Objections";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";

export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <SocialProof />
        <ProblemTransformation />
        <Features />
        <HowItWorks />
        <TestimonialsMetrics />
        <Objections />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
