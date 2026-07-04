import { TopHeroBanner } from "@/components/landing/TopHeroBanner";
import { HeroTabs } from "@/components/landing/HeroTabs";
import { FeatureCards } from "@/components/landing/FeatureCards";
import { CourseCarousel } from "@/components/landing/CourseCarousel";
import { Testimonials } from "@/components/landing/Testimonials";
import { StatsSection } from "@/components/landing/StatsSection";
import { SkillsGrid } from "@/components/landing/SkillsGrid";
import { PricingSection } from "@/components/landing/PricingSection";
import { FooterCTA } from "@/components/landing/FooterCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

const LandingPage = () => (
  <div className="min-h-screen bg-white scroll-smooth antialiased landing-page">
    <main>
      <TopHeroBanner />
      <HeroTabs />
      <FeatureCards />
      <CourseCarousel />
      <Testimonials />
      <StatsSection />
      <SkillsGrid />
      <PricingSection />
      <FooterCTA />
    </main>
    <LandingFooter />
  </div>
);

export default LandingPage;
