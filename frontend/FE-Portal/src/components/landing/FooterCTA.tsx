import { motion } from "framer-motion";
import { footerCtaCards } from "@/constants/landingData";
import { FadeInView } from "./shared/FadeInView";
import { ShineButton } from "./shared/ShineButton";
import { cn } from "@/lib/utils";

export const FooterCTA = () => (
  <section id="contact" className="py-24 bg-[#050505] relative overflow-hidden">
    <motion.div
      className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(109,40,217,0.12)_0%,_transparent_60%)]"
      aria-hidden
    />
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <FadeInView className="text-center mb-14 sm:mb-16">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
          Get started with Skiltechy
        </h2>
      </FadeInView>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {footerCtaCards.map((card, i) => (
          <FadeInView key={card.title} delay={i * 0.1}>
            <motion.article
              whileHover={{
                y: -10,
                boxShadow: "0 0 40px rgba(139,92,246,0.15)",
              }}
              className="h-full flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-7 sm:p-8"
            >
              <span
                className={cn(
                  "inline-block text-xs font-bold px-3 py-1.5 rounded-full w-fit mb-6",
                  card.badgeClass
                )}
              >
                {card.badge}
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight mb-4">{card.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed flex-1 mb-8">{card.description}</p>
              <ShineButton variant="outline" size="sm" className="!rounded-2xl w-fit">
                {card.cta}
              </ShineButton>
            </motion.article>
          </FadeInView>
        ))}
      </div>
    </div>
  </section>
);
