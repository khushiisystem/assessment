import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import { testimonials } from "@/constants/landingData";
import { FadeInView } from "./shared/FadeInView";
import "swiper/css";

export const Testimonials = () => (
  <section id="testimonials" className="py-24 bg-[#e8f0ff] overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <FadeInView className="text-center max-w-2xl mx-auto mb-14">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2d1b69] tracking-tight mb-5">
          Teams turning skills into impact
        </h2>
        <p className="text-zinc-600 text-base sm:text-lg">
          See how leading organizations transform their tech capabilities with Skiltechy.
        </p>
      </FadeInView>

      <Swiper
        modules={[Autoplay]}
        slidesPerView={1.15}
        spaceBetween={20}
        loop
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        breakpoints={{
          640: { slidesPerView: 2.1, spaceBetween: 24 },
          1024: { slidesPerView: 3.2, spaceBetween: 28 },
          1280: { slidesPerView: 4, spaceBetween: 28 },
        }}
        className="!overflow-visible testimonials-swiper"
      >
        {testimonials.map((item) => (
          <SwiperSlide key={item.id}>
            <motion.article
              whileHover={{ y: -8 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="rounded-3xl overflow-hidden shadow-xl h-[400px] sm:h-[440px] relative group border border-white/20"
            >
              <img
                src={item.image}
                alt={item.name}
                className="absolute inset-0 w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-700"
                loading="lazy"
              />
              <div className="absolute top-4 left-4 z-10">
                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-xl text-xs font-bold text-zinc-800 shadow-lg border border-white/50">
                  {item.company}
                </span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent/20" />
              <div className="absolute inset-x-0 bottom-0 p-6 z-10 backdrop-blur-[2px]">
                <p className="text-white/95 text-sm leading-relaxed mb-5 line-clamp-4 font-medium">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <p className="font-bold text-white text-base">{item.name}</p>
                <p className="text-sm text-zinc-400 mt-0.5">{item.role}</p>
              </div>
            </motion.article>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  </section>
);
