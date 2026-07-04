import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { stats } from "@/constants/landingData";
import { FadeInView } from "./shared/FadeInView";

const AnimatedStat = ({
  value,
  suffix,
  decimals = 0,
  label,
}: {
  value: number;
  suffix: string;
  decimals?: number;
  label: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(value * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value]);

  const formatted =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();

  return (
    <div ref={ref} className="text-left">
      <p className="text-4xl sm:text-5xl xl:text-6xl font-bold text-zinc-900 tracking-tight">
        {formatted}
        {suffix}
      </p>
      <div className="w-14 h-1 bg-gradient-to-r from-violet-600 to-indigo-500 my-2 rounded-full" />
      <p className="text-sm font-medium text-zinc-500">{label}</p>
    </div>
  );
};

export const StatsSection = () => (
  <section className="py-24 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-1 gap-12 lg:gap-20 items-center">
        <FadeInView>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.25rem] font-extrabold text-zinc-900 leading-[1.1] tracking-tight">
            Incredible Stories,
            <br />
            Incredible journeys
          </h2>
        </FadeInView>

        <FadeInView delay={0.12}>
          <div className="grid sm:grid-cols-3 gap-10 lg:gap-8">
            {stats.map((stat) => (
              <AnimatedStat
                key={stat.label}
                value={stat.value}
                suffix={stat.suffix}
                decimals={stat.decimals}
                label={stat.label}
              />
            ))}
          </div>
        </FadeInView>
      </div>
    </div>
  </section>
);
