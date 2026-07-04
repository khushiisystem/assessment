import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { pricingPlans } from "@/constants/landingData";
import { FadeInView } from "./shared/FadeInView";
import { cn } from "@/lib/utils";

export const PricingSection = () => {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="py-24 bg-[#f4ebff]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInView className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl lg:leading-[1.3] xl:text-6xl xl:leading-[1.3] font-bold text-[#3D065F] tracking-tight mb-4">
            Effortless learning,<br /> exceptional value
          </h2>
          <p className="text-[#3D065F] text-sm lg:text-2xl font-semibold tracking-wide">
            Flexible free trial • No lock-ins • No hidden costs
          </p>
        </FadeInView>

        <FadeInView className="flex justify-center mb-14">
          <div className="inline-flex p-1.5 rounded-full bg-violet-200/70 border border-violet-200/80 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                "px-7 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
                !yearly ? "bg-white text-zinc-900 shadow-md" : "text-zinc-600 hover:text-zinc-800"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                "px-7 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
                yearly ? "bg-white text-zinc-900 shadow-md" : "text-zinc-600 hover:text-zinc-800"
              )}
            >
              Yearly
            </button>
          </div>
        </FadeInView>

        <div className="grid md:grid-cols-3 gap-8 items-stretch pt-4">
          {pricingPlans.map((plan, i) => {
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
            const isFeatured = plan.featured;

            return (
              <FadeInView key={plan.id} delay={i * 0.08} className="h-full flex">
                <motion.article
                  whileHover={{ y: -10 }}
                  className={cn(
                    "rounded-3xl overflow-hidden bg-white h-full flex flex-col w-full transition-shadow",
                    isFeatured
                      ? "md:scale-[1.06] shadow-[0_0_60px_-8px_rgba(249,115,22,0.45)] border-2 border-orange-500 relative z-10"
                      : "shadow-[0_12px_40px_-8px_rgba(109,40,217,0.12)] border border-violet-100"
                  )}
                >
                  {isFeatured && (
                    <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                      <Sparkles className="h-3 w-3" />
                      Featured
                    </div>
                  )}
                  <div className="p-7 sm:p-8 flex-1">
                    <p className="text-[11px] font-bold text-zinc-400 tracking-[0.15em] mb-3">
                      {plan.title}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
                      {price}{" "}
                      <span className="text-sm font-medium text-zinc-500">per interview</span>
                    </p>
                    <p className="text-sm text-zinc-600 mt-4 leading-relaxed">{plan.description}</p>
                  </div>
                  <div
                    className={cn(
                      "p-7 sm:p-8 flex-1 flex flex-col",
                      isFeatured ? "bg-orange-500" : "bg-violet-100/90"
                    )}
                  >
                    <ul className="space-y-3.5 mb-8 flex-1">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className={cn(
                            "flex items-start gap-2.5 text-sm leading-snug",
                            isFeatured ? "text-white" : "text-zinc-700"
                          )}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0 mt-0.5",
                              isFeatured ? "text-white" : "text-violet-600"
                            )}
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className={cn(
                        "w-full py-3.5 rounded-2xl text-sm font-bold transition-all",
                        isFeatured
                          ? "bg-white text-zinc-900 hover:shadow-lg"
                          : "bg-zinc-900 text-white hover:bg-zinc-800"
                      )}
                    >
                      Book a Demo
                    </button>
                  </div>
                </motion.article>
              </FadeInView>
            );
          })}
        </div>
      </div>
    </section>
  );
};
