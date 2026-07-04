import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  heroTabs,
  dashboardNavItems,
  dashboardStats,
  dashboardCourses,
} from "@/constants/landingData";
import { FadeInView } from "./shared/FadeInView";
import { GlowOrbs } from "./shared/GlowOrbs";
import { ShineButton } from "./shared/ShineButton";
import { cn } from "@/lib/utils";

const DashboardPreview = () => (
  <div className="relative w-full max-w-xl mx-auto lg:mx-0">
    <div
      className=""
      aria-hidden
    />
    <div
      className="relative"
      aria-hidden
      aria-hidden
    />
    <motion.div
      className="relative rounded-3xl"
    >
      <div className="flex min-h-[300px] sm:min-h-[340px]">
       <img src="/dashboard.png" />
       
      </div>
    </motion.div>
  </div>
);

export const HeroTabs = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = heroTabs[activeIndex];

  const scrollTo = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="features" className="relative py-24 bg-white overflow-hidden">
      <div className="text-center px-4">
          <div className="max-w-3xl mx-auto mb-[50px]">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              Master SQL for Data Analytics &<br /> Business Intelligence
            </h2>

            <p className="mt-4 text-base md:text-lg text-gray-600 leading-relaxed">
              Learn SQL from fundamentals to advanced concepts including data retrieval, joins, subqueries, aggregations, window functions, CTEs, query optimization, database design, and advanced data analysis techniques for real-world business reporting and decision-making.
            </p>
          </div>
        </div>
      <GlowOrbs />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInView>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-14 sm:mb-20 p-1.5  w-fit mx-auto ">
            {heroTabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative px-4 sm:px-6 py-2.5 border border-zinc-300 rounded-full text-sm font-semibold transition-colors duration-300",
                  activeIndex === index ? "text-white" : "text-zinc-800 hover:text-violet-700"
                )}
              >
                {activeIndex === index && (
                  <motion.span
                    layoutId="hero-tab-pill"
                    className="absolute inset-0 bg-zinc-900 rounded-full shadow-lg"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        </FadeInView>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <FadeInView delay={0.1}>
            <DashboardPreview />
          </FadeInView>

          <FadeInView delay={0.15} className="text-center lg:text-left">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4 }}
              >
                <h1 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-zinc-900 tracking-tight leading-[1.25] lg:leading-[1.2] mb-6">
                  {active.heading}
                </h1>
                <p className="text-zinc-500 text-base sm:text-lg leading-relaxed mb-10 max-w-lg mx-auto lg:mx-0">
                  {active.description}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <ShineButton onClick={() => scrollTo("#contact")}>Book a demo</ShineButton>
                  
                </div>
              </motion.div>
            </AnimatePresence>
          </FadeInView>
        </div>
      </div>
    </section>
  );
};
