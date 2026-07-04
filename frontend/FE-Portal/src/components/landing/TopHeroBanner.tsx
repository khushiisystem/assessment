import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import logo from "/logo-white.png";
import heroImage from '/top-baner.png';
import { cn } from "@/lib/utils";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import macImg from "@/assets/mac.png";

const navLinks = [
  { label: "Courses", href: "#courses" },
  { label: "Business", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#contact" },
];

// Single de-duplicated source of truth. The previous list manually
// repeated each brand twice to look denser on screen — that produced
// duplicate React keys ("HBO", "Lacoste", "Sony", "Target") which
// caused Swiper to mis-render loop clones and threw the React
// "encountered two children with the same key" warning. Swiper's
// `loop` prop already handles infinite scroll internally, so we don't
// need to duplicate the data here.
const partnerIcons = [
  { image: "/adidas.png", label: "HBO" },
  { image: "/lacoste.png", label: "Lacoste" },
  { image: "/sony.png", label: "Sony" },
  { image: "/target.png", label: "Target" },
  { image: "/mac.png", label: "McDonald's" },
];

const scrollTo = (href: string) => {
  document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
};

const FloatingNav = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <div className="fixed top-4 sm:top-6 left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none">
        <nav
          className={cn(
            "pointer-events-auto flex w-full max-w-7xl items-center justify-between gap-3 rounded-full bg-black px-4 py-2.5 sm:px-6 sm:py-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)] border border-white/10"
          )}
        >
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="" className="h-7 w-auto brightness-0 invert opacity-90" />
            {/* <span className="font-bold text-sm sm:text-base text-white tracking-tight">
              Skiltechy
            </span> */}
          </Link>

          <div className="hidden md:flex items-center justify-center gap-6 lg:gap-8 flex-1 px-4">
            {navLinks.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => scrollTo(link.href)}
                className="text-sm font-medium text-white/90 hover:text-white transition-colors whitespace-nowrap"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3 shrink-0">
          <Link
          to="/login"
          state={{ role: "candidate" }}
          className="flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white px-2 py-1.5 rounded-full transition-colors"
        >
          <User className="h-4 w-4" />
          Login
        </Link>
            <Link
              to="/signup"
              state={{ role: "candidate" }}
              className="text-sm font-semibold text-white border border-white/90 rounded-full px-4 py-2 hover:bg-white hover:text-black transition-colors"
            >
              Start Learning
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden p-2 rounded-full text-white hover:bg-white/10"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="fixed top-[4.5rem] left-4 right-4 z-[58] rounded-2xl bg-zinc-900 border border-white/10 p-4 shadow-2xl md:hidden"
            >
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => {
                      scrollTo(link.href);
                      setMobileOpen(false);
                    }}
                    className="text-left text-white/90 py-3 px-2 rounded-xl hover:bg-white/5 text-sm font-medium"
                  >
                    {link.label}
                  </button>
                ))}
                <hr className="border-white/10 my-2" />
                
             <Link
                  to="/login"
                  state={{ role: "candidate" }}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 text-white py-3 px-2 text-sm font-medium"
                >
                  <User className="h-4 w-4" />
                  Login
                </Link>
                <Link
                  to="/signup"
                  state={{ role: "candidate" }}
                  onClick={() => setMobileOpen(false)}
                  className="text-center mt-1 py-3 rounded-full border border-white text-white text-sm font-semibold"
                >
                  Start Learning
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export const TopHeroBanner = () => {
  
  return (
    <section id="top" className="relative bg-white pt-28 sm:pt-32 pb-16 sm:pb-20 overflow-hidden">
      <FloatingNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-20 lg:gap-25 items-top">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="text-center lg:col-span-4 lg:text-left order-2 lg:order-1"
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.25rem] font-bold text-zinc-900 tracking-tight leading-[1.1] mb-6">
              The future of learning is Human + AI
            </h1>
            <p className="text-base sm:text-lg text-zinc-500 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-10">
              We help you map the skill you need, track the skill you have, and close your gaps to
              thrive in a GenAI world.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                to="/signup"
                state={{ role: "candidate" }}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-black text-white font-semibold text-sm px-8 py-3.5 hover:bg-zinc-800 transition-colors shadow-lg"
              >
                Start Learning
              </Link>
              <button
                type="button"
                onClick={() => scrollTo("#contact")}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-white text-zinc-900 font-semibold text-sm px-8 py-3.5 border-2 border-zinc-900 hover:bg-zinc-50 transition-colors"
              >
                Book a demo
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative order-1 lg:col-span-8 lg:order-2 max-w-md mx-auto lg:max-w-none lg:mx-0"
          >
            <div className="relative h-auto w-full rounded-3xl bg-zinc-100 shadow-2xl">
              <img
                src={heroImage}
                alt="Professional learning with Skiltechy"
                className="absolute inset-0 w-full h-auto object-contain object-top"
                loading="eager"
              />
              

            
            </div>
          </motion.div>
        </div>

        {/* Logo strip */}
        {/* Partners Carousel */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-16 sm:mt-20 pt-[80px] overflow-hidden"
        >
          <Swiper
            modules={[Autoplay]}
            spaceBetween={40}
            slidesPerView={1}
            loop={true}
            speed={3000}
            autoplay={{
              delay: 0,
              disableOnInteraction: false,
            }}
            breakpoints={{
              640: {
                slidesPerView: 3,
              },
              768: {
                slidesPerView: 4,
              },
              1024: {
                slidesPerView: 7,
              },
            }}
            className="partner-swiper opacity-80 hover:opacity-90 transition-opacity"
          >
            {partnerIcons.map((p, i) => (
              // label-index key — defends against future drift if someone
              // ever adds a brand with a duplicate label again.
              <SwiperSlide key={`${p.label}-${i}`}>
                <div className="flex items-center justify-center">
                  <img
                    src={p.image}
                    alt={p.label}
                    className="h-7 sm:h-8 w-100 object-contain"
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </motion.div>
      </div>
    </section>
  );
};
