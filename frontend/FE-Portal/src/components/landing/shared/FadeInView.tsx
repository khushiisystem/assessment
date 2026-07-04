import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type FadeInViewProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  delay?: number;
};

export const FadeInView = ({
  children,
  delay = 0,
  className,
  ...props
}: FadeInViewProps) => (
  <motion.div
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
);
