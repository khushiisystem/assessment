import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { featureCards, promoSlides } from "@/constants/landingData";
import { FadeInView } from "./shared/FadeInView";
import "swiper/css";
import "swiper/css/pagination";

const cardBgImages = [
  "/banner.png",
  "/banner-1.png",
  "/banner-2.png",
];


const WaveGlow = () => (
  <motion.div
    animate={{ x: ["-10%", "10%", "-10%"] }}
    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
    className="absolute -bottom-1/2 -right-1/4 w-[120%] h-full opacity-60"
    style={{
      background:
        "radial-gradient(ellipse at center, rgba(56,189,248,0.45) 0%, rgba(99,102,241,0.2) 40%, transparent 70%)",
    }}
  />
);

export const FeatureCards = () => {
  const [promoIndex, setPromoIndex] = useState(0);

  return (
    <>
    <section className="py-24 pb-[240px] bg-[#F6E5FF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInView className="text-center max-w-xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#3D065F] tracking-tight mb-5">
            Skill development that drives results
          </h2>
          <p className="text-zinc-600 text-base sm:text-lg leading-relaxed text-[#3D065F]">
            Master today&apos;s most in-demand skills in AI, Data, Programming and beyond through
            Skiltechy&apos;s hands-on projects, expert mentorship, and flexible programs built with
            the world&apos;s leading tech companies.
          </p>
        </FadeInView>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {featureCards.map((card, i) => (
            <FadeInView key={card.title} delay={i * 0.08}>
              <motion.article
                whileHover={{ y: -10, boxShadow: "0 24px 48px -12px rgba(109,40,217,0.2)" }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="bg-white rounded-3xl border-y-[10px] border-x-[4px] border-white overflow-hidden shadow-[0_8px_30px_rgba(109,40,217,0.08)] h-full"
              >
                <div
                  className="h-32 px-6 py-7 flex items-end relative overflow-hidden rounded-2xl"
                  style={{
                   background: `
                        linear-gradient(145deg, #5b21b6 0%, #7c3aed 45%, #a78bfa 100%),
                        url('/bg-line.png')
                      `,
                      backgroundPosition: "center, right center",
                      backgroundRepeat: "no-repeat, no-repeat",
                      backgroundSize: "cover, contain",
                        minHeight: "200px",


                  }}
                >
                  <div
                    className="absolute inset-0 opacity-25"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(-45deg, transparent, transparent 12px, rgba(255,255,255,0.08) 12px, rgba(255,255,255,0.08) 13px)",
                    }}
                  />
                  <h3 className="text-2xl lg:text-3xl xxl:text-5xl font-bold text-white relative z-10 tracking-tight">
                    {card.title}
                  </h3>
                </div>
                <div className="p-6 sm:p-7">
                  <span className="inline-block xl:text-md xxl:text-lg  font-semibold text-violet-800 bg-[#EAC2FF]/90 px-3.5 py-1.5 rounded-full mb-4 border border-violet-200/50">
                    {card.pill}
                  </span>
                  <p className="xl:text-md xxl:text-lg  text-zinc-600 leading-relaxed">{card.description}</p>
                </div>
              </motion.article>
            </FadeInView>
          ))}
        </div>

        
      </div>
    </section>
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-[-150px]">
      <FadeInView delay={0.15}>
          <motion.div className="relative rounded-3xl overflow-hidden min-h-[240px] sm:min-h-[280px] xl:min-h-[360px] shadow-[0_24px_60px_-12px_rgba(30,27,75,0.45)]">
            <AnimatePresence mode="wait">
              <motion.div
                key={promoIndex}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45 }}
                className="absolute inset-0 p-8 sm:p-12 lg:p-14 flex flex-col justify-center"
                style={{
                    backgroundImage: "url('./../../ai_bg.png')",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    backgroundSize: "cover",

                }}
              >
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <WaveGlow />
                  <div className="absolute top-8 right-16 w-40 h-40 rounded-full bg-violet-500/25 blur-3xl" />
                  {[...Array(18)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.3, 1] }}
                      transition={{
                        duration: 2 + (i % 3),
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                      className="absolute w-1 h-1 rounded-full bg-cyan-300/80"
                      style={{
                        top: `${8 + (i * 5) % 85}%`,
                        left: `${3 + (i * 7) % 92}%`,
                        boxShadow: "0 0 12px rgba(147,197,253,0.9)",
                      }}
                    />
                  ))}
                </div>
                <div className="relative z-10 max-w-xl">
                  <div className="flex items-center gap-2 text-cyan-200/90 text-xs font-bold tracking-[0.2em] mb-4">
                    <Sparkles className="h-4 w-4" />
                    {promoSlides[promoIndex].badge}
                  </div>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight mb-4">
                    {promoSlides[promoIndex].heading}
                  </h3>
                  <p className="text-white/75 text-sm sm:text-base mb-8 max-w-md">
                    {promoSlides[promoIndex].description}
                  </p>
                  <button
                    type="button"
                    className="bg-white text-zinc-900 px-8 py-3 rounded-full text-sm font-bold hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all"
                  >
                    {promoSlides[promoIndex].cta}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            <Swiper
              modules={[Autoplay, Pagination]}
              autoplay={{ delay: 5500, disableOnInteraction: false }}
              onSlideChange={(s) => setPromoIndex(s.realIndex)}
              className="absolute inset-0 opacity-0 pointer-events-none"
              slidesPerView={1}
            >
              {promoSlides.map((slide) => (
                <SwiperSlide key={slide.heading}>
                  <span className="sr-only">{slide.heading}</span>
                </SwiperSlide>
              ))}
            </Swiper>
          </motion.div>

          <div className="flex justify-center gap-2.5 mt-8">
            {promoSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPromoIndex(i)}
                className={`rounded-full transition-all duration-300 ${
                  promoIndex === i
                    ? "w-8 h-2.5 bg-violet-700"
                    : "w-2 h-2 bg-violet-300 hover:bg-violet-400"
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </FadeInView>
    </section>
    </>
  );
};
