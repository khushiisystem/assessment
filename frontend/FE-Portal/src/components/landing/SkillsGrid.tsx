import { useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { skills } from "@/constants/landingData";
import { FadeInView } from "./shared/FadeInView";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "top" as const, label: "Top AI Skills" },
  { id: "cert" as const, label: "Certification Programs" },
];

export const SkillsGrid = () => {
  const [activeTab, setActiveTab] = useState<"top" | "cert">("top");
  const filtered = skills.filter((s) => s.category === activeTab);

  return (
    <section className="py-24 bg-[#060010] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(109,40,217,0.15)_0%,_transparent_55%)]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInView className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-10">
            Build skills that stand out
          </h2>
          <div className="flex flex-wrap gap-8 sm:gap-12 border-b border-white/10 pb-px max-w-7xl mx-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative pb-4 text-md font-semibold transition-colors",
                  activeTab === tab.id ? "text-orange-500" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.span
                    layoutId="skills-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
        </FadeInView>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          {filtered.map((skill, i) => (
            <motion.div
              key={skill.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              whileHover={{
                scale: 1.04,
                boxShadow: "0 0 28px rgba(139,92,246,0.35)",
              }}
              className="group flex items-center gap-3 px-4 py-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-violet-500/60 backdrop-blur-sm transition-colors cursor-default"
            >
              <Icon icon={skill.icon} className="h-7 w-7 shrink-0" />
              <span className="text-lg font-medium text-white truncate">{skill.name}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
