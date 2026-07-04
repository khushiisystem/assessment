import { Award, BookOpen, TrendingUp, Users } from "lucide-react";

export const landingPageFeatures = [
  {
    icon: BookOpen,
    title: "Rich Learning Content",
    description: "Access articles, videos, PDFs, and interactive coding challenges",
  },
  {
    icon: Users,
    title: "Role-Based Paths",
    description: "Customized learning tracks for React, Full Stack, AWS, and more",
  },
  {
    icon: TrendingUp,
    title: "Track Progress",
    description: "Monitor completion rates, quiz scores, and learning milestones",
  },
  {
    icon: Award,
    title: "Earn Achievements",
    description: "Unlock badges and certificates as you complete learning paths",
  },
] as const;
