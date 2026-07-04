import { motion } from "framer-motion";

type GlowOrbsProps = {
  className?: string;
};

export const GlowOrbs = ({ className = "" }: GlowOrbsProps) => (
  <motion.div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
    <motion.div
      animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-violet-500/30 blur-3xl"
    />
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      className="absolute top-1/3 -right-16 h-56 w-56 rounded-full bg-blue-500/25 blur-3xl"
    />
    <motion.div
      animate={{ scale: [1, 1.1, 1], opacity: [0.25, 0.45, 0.25] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      className="absolute -bottom-10 left-1/3 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl"
    />
  </motion.div>
);
