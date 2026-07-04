import {
  Layout,
  Server,
  Layers,
  Database,
  Boxes,
  Workflow,
  Sigma,
  BrainCircuit,
  MessagesSquare,
  Infinity as InfinityIcon,
  Cloud,
  Network,
  ShieldCheck,
  Smartphone,
  Globe,
  Webhook,
  Code,
  FlaskConical,
  GitBranch,
  GitMerge,
  Palette,
  Brush,
  KanbanSquare,
  Repeat,
  Link as LinkIcon,
  Cpu,
  Glasses,
  Bot,
  GraduationCap,
} from "lucide-react";

/**
 * Skiltechy brand tokens — derived from the logo:
 * deep purple core, lavender wordmark, vivid orange accent block.
 */
export const BRAND = {
  purple: "#3d075f",
  violet: "#7c3aed",
  lavender: "#e6c9f7",
  orange: "#ff5a1f",
  orangeSoft: "#ff7a45",
} as const;

export interface CourseTheme {
  label: string;
  /** tailwind gradient stops, e.g. "from-violet-500 to-fuchsia-600" */
  gradient: string;
  soft: string; // chip / tile background
  text: string; // chip / accent text
  ring: string; // chip / tile ring
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Per-category theme. Hues stay within the brand family (purple/violet/
 * fuchsia) with selective accents (orange = DevOps/API energy, cool tones
 * for data/cloud) so every card feels distinct yet on-brand.
 */
const THEME: Record<string, CourseTheme> = {
  frontend: { label: "Frontend", gradient: "from-violet-500 to-fuchsia-600", soft: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200", icon: Layout },
  backend: { label: "Backend", gradient: "from-indigo-500 to-purple-600", soft: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200", icon: Server },
  fullstack: { label: "Full Stack", gradient: "from-fuchsia-500 to-pink-600", soft: "bg-fuchsia-50", text: "text-fuchsia-700", ring: "ring-fuchsia-200", icon: Layers },
  database: { label: "Database", gradient: "from-blue-500 to-indigo-600", soft: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200", icon: Database },
  big_data: { label: "Big Data", gradient: "from-cyan-500 to-blue-600", soft: "bg-cyan-50", text: "text-cyan-700", ring: "ring-cyan-200", icon: Boxes },
  data_engineering: { label: "Data Engineering", gradient: "from-teal-500 to-cyan-600", soft: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-200", icon: Workflow },
  data_science: { label: "Data Science", gradient: "from-emerald-500 to-teal-600", soft: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", icon: Sigma },
  ai_ml: { label: "AI / ML", gradient: "from-fuchsia-500 to-purple-600", soft: "bg-fuchsia-50", text: "text-fuchsia-700", ring: "ring-fuchsia-200", icon: BrainCircuit },
  deep_learning: { label: "Deep Learning", gradient: "from-purple-500 to-violet-600", soft: "bg-purple-50", text: "text-purple-700", ring: "ring-purple-200", icon: BrainCircuit },
  nlp: { label: "NLP", gradient: "from-pink-500 to-rose-600", soft: "bg-pink-50", text: "text-pink-700", ring: "ring-pink-200", icon: MessagesSquare },
  devops: { label: "DevOps", gradient: "from-orange-500 to-amber-500", soft: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200", icon: InfinityIcon },
  cloud: { label: "Cloud", gradient: "from-sky-500 to-blue-600", soft: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-200", icon: Cloud },
  infrastructure: { label: "Infrastructure", gradient: "from-slate-500 to-violet-600", soft: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200", icon: Network },
  security: { label: "Security", gradient: "from-rose-500 to-red-600", soft: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200", icon: ShieldCheck },
  mobile_android: { label: "Mobile (Android)", gradient: "from-rose-500 to-pink-600", soft: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200", icon: Smartphone },
  mobile_ios: { label: "Mobile (iOS)", gradient: "from-slate-500 to-purple-600", soft: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200", icon: Smartphone },
  mobile_cross_platform: { label: "Mobile", gradient: "from-fuchsia-500 to-rose-600", soft: "bg-fuchsia-50", text: "text-fuchsia-700", ring: "ring-fuchsia-200", icon: Smartphone },
  web: { label: "Web", gradient: "from-cyan-500 to-sky-600", soft: "bg-cyan-50", text: "text-cyan-700", ring: "ring-cyan-200", icon: Globe },
  api: { label: "API", gradient: "from-amber-500 to-orange-600", soft: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", icon: Webhook },
  programming: { label: "Programming", gradient: "from-violet-500 to-purple-600", soft: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200", icon: Code },
  scripting: { label: "Scripting", gradient: "from-purple-500 to-fuchsia-600", soft: "bg-purple-50", text: "text-purple-700", ring: "ring-purple-200", icon: Code },
  testing: { label: "Testing / QA", gradient: "from-lime-500 to-green-600", soft: "bg-lime-50", text: "text-lime-700", ring: "ring-lime-200", icon: FlaskConical },
  automation: { label: "Automation", gradient: "from-green-500 to-emerald-600", soft: "bg-green-50", text: "text-green-700", ring: "ring-green-200", icon: Repeat },
  framework: { label: "Framework", gradient: "from-violet-500 to-indigo-600", soft: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200", icon: Boxes },
  version_control: { label: "Version Control", gradient: "from-orange-500 to-rose-600", soft: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200", icon: GitBranch },
  ci_cd: { label: "CI / CD", gradient: "from-amber-500 to-orange-600", soft: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", icon: GitMerge },
  design: { label: "UI / UX Design", gradient: "from-pink-500 to-fuchsia-600", soft: "bg-pink-50", text: "text-pink-700", ring: "ring-pink-200", icon: Palette },
  graphics: { label: "Graphics", gradient: "from-rose-500 to-pink-600", soft: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200", icon: Brush },
  project_management: { label: "Project Mgmt", gradient: "from-indigo-500 to-violet-600", soft: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200", icon: KanbanSquare },
  agile: { label: "Agile", gradient: "from-teal-500 to-emerald-600", soft: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-200", icon: Repeat },
  blockchain: { label: "Blockchain", gradient: "from-amber-500 to-yellow-600", soft: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", icon: LinkIcon },
  iot: { label: "IoT", gradient: "from-cyan-500 to-teal-600", soft: "bg-cyan-50", text: "text-cyan-700", ring: "ring-cyan-200", icon: Cpu },
  ar_vr: { label: "AR / VR", gradient: "from-fuchsia-500 to-violet-600", soft: "bg-fuchsia-50", text: "text-fuchsia-700", ring: "ring-fuchsia-200", icon: Glasses },
  robotics: { label: "Robotics", gradient: "from-slate-500 to-indigo-600", soft: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200", icon: Bot },
  default: { label: "Course", gradient: "from-brand-purple to-brand-violet", soft: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200", icon: GraduationCap },
};

/** Normalize a raw category value to a theme key. */
const normalizeKey = (category?: string) =>
  (category || "").toLowerCase().trim().replace(/[\s\-/.]+/g, "_");

export const themeForCategory = (category?: string): CourseTheme => {
  const key = normalizeKey(category);
  if (THEME[key]) return THEME[key];
  // tolerate compact spellings (e.g. "aiml", "bigdata")
  const compact = key.replace(/_/g, "");
  const match = Object.keys(THEME).find((k) => k.replace(/_/g, "") === compact);
  return (match && THEME[match]) || THEME.default;
};

/** Human label for a category, falling back to Title Case of the raw value. */
export const labelForCategory = (category?: string): string => {
  if (!category) return "Course";
  const theme = themeForCategory(category);
  if (theme !== THEME.default) return theme.label;
  return category
    .replace(/[_\-/.]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};
