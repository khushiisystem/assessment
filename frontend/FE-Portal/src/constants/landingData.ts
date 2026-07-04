import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Clock,
  Star,
  LayoutDashboard,
  Users,
  BookOpen,
  MessageSquare,
  ClipboardList,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
} from "lucide-react";

export type HeroTab = {
  id: string;
  label: string;
  heading: string;
  description: string;
};

export const heroTabs: HeroTab[] = [
  {
    id: "feature-1",
    label: "Feature 1",
    heading: "Python Programming & Automation",
    description:
      "Learn Python from beginner to advanced level including programming fundamentals, automation, APIs, object-oriented programming, and data analysis to build real-world analytics and AI-driven applications.",
  },
  {
    id: "feature-2",
    label: "Feature 2",
    heading: "Continue Building Your Future with AI & Data Skills",
    description:
      "Stay ahead in the modern tech industry with practical learning, hands-on projects, and industry-ready training programs.",
  },
  {
    id: "feature-3",
    label: "Feature 3",
    heading: "Start Learning Today",
    description:"Learn at your own pace, Real-world projects, Industry-focused curriculum, AI-powered learning assistance, Certification-ready programs",
    },
  {
    id: "feature-4",
    label: "Feature 4",
    heading: "Learning Analytics & Progress Tracking",
    description:
      "Monitor your learning journey with real-time insights into course completion, skill development, assessment performance, certifications achieved, and overall progress across your assigned learning paths.",
  },
  {
    id: "feature-5",
    label: "Feature 5",
    heading: "Track Your Progress",
    description:
      "Assigned Courses, Completed Learning Modules, Assessment & Quiz Performance, Skill Development Progress ,Certifications Earned ,Active Learning Streaks",
  },
];

export const featureCards = [
  {
    title: "Hands-on learning",
    pill: "Learn by building",
    description:
      "Gain job-ready skills through real projects, created with top tech companies to reflect what the industry actually needs.",
  },
  {
    title: "Personalized support",
    pill: "Support, any time you need it",
    description:
      "Get personalized support and feedback from industry professionals who've done the work and know what it takes.",
  },
  {
    title: "Measurable outcomes",
    pill: "Progress you can see",
    description:
      "Start applying your skills from day one, build your portfolio, and achieve your career goals.",
  },
];

export const promoSlides = [
  {
    badge: "WHAT'S NEW",
    heading: "Generative AI is Evolving. Are you?",
    description: "Build production-ready applications using the latest Gen-AI stack.",
    cta: "Enroll Now",
  },
  {
    badge: "TRENDING",
    heading: "Master Data & AI skills today",
    description: "From Python to LLMs — learn paths curated with industry leaders.",
    cta: "Explore Paths",
  },
  {
    badge: "FEATURED",
    heading: "Interview prep that works",
    description: "AI-powered mock interviews with instant feedback and scoring.",
    cta: "Try Free",
  },
];

export type Course = {
  id: string;
  image: string;
  tag: string;
  title: string;
  description: string;
  rating: string;
  students: string;
  hours: string;
  level: string;
};

export const courses: Course[] = [
  {
    id: "1",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=400&fit=crop",
    tag: "AI Programming with Python",
    title: "AI Programming with Python",
    description:
      "Develop a strong foundation in Python programming for AI, utilizing tools like NumPy, pandas, and Matplotlib for data analysis and visualization.",
    rating: "4.8",
    students: "500+",
    hours: "22 Hrs",
    level: "Beginner",
  },
  {
    id: "2",
    image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=400&fit=crop",
    tag: "Deep Learning",
    title: "Introduction to Deep Learning",
    description:
      "Build neural networks with TensorFlow and PyTorch. Learn CNNs, RNNs, and transformers for real-world AI applications.",
    rating: "4.9",
    students: "320+",
    hours: "28 Hrs",
    level: "Intermediate",
  },
  {
    id: "3",
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=400&fit=crop",
    tag: "Full Stack Development",
    title: "React & Node.js Mastery",
    description:
      "Create scalable web applications with React, Node.js, and modern DevOps practices used by top tech companies.",
    rating: "4.7",
    students: "410+",
    hours: "35 Hrs",
    level: "Intermediate",
  },
  {
    id: "4",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop",
    tag: "Data Analytics",
    title: "SQL for Data Science",
    description:
      "Master SQL queries, joins, and window functions to extract insights from complex datasets efficiently.",
    rating: "4.8",
    students: "280+",
    hours: "18 Hrs",
    level: "Beginner",
  },
  {
    id: "5",
    image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&h=400&fit=crop",
    tag: "Cloud Computing",
    title: "AWS Cloud Practitioner",
    description:
      "Learn core AWS services, architecture best practices, and prepare for cloud roles in enterprise environments.",
    rating: "4.6",
    students: "190+",
    hours: "24 Hrs",
    level: "Beginner",
  },
];

export const testimonials = [
  {
    id: "1",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop",
    company: "Agentic AI",
    quote:
      "I have been leading the Marketing team on a journey to incorporate AI into our workflows... I will be a better leader for having taken this course.",
    name: "Mohit Rana",
    role: "Software Engineer",
  },
  {
    id: "2",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop",
    company: "TechCorp",
    quote:
      "Skiltechy transformed how we upskill our engineering teams. The hands-on projects mirror real work — our developers love it.",
    name: "Sarah Chen",
    role: "Engineering Manager",
  },
  {
    id: "3",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop",
    company: "DataFlow",
    quote:
      "The mock interview feature helped me land my dream role. The feedback was specific, actionable, and incredibly valuable.",
    name: "James Wilson",
    role: "Data Scientist",
  },
  {
    id: "4",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=500&fit=crop",
    company: "CloudNine",
    quote:
      "We've seen a 40% improvement in assessment pass rates since adopting Skiltechy for our hiring pipeline.",
    name: "Emily Rodriguez",
    role: "HR Director",
  },
  {
    id: "5",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop",
    company: "FinTech Pro",
    quote:
      "Flexible learning paths and expert mentorship made all the difference for our distributed team's certification goals.",
    name: "David Kim",
    role: "Team Lead",
  },
  {
    id: "6",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop",
    company: "StartupLab",
    quote:
      "From GenAI courses to coding assessments — everything we need to stay competitive is in one platform.",
    name: "Priya Sharma",
    role: "Product Manager",
  },
];

export const stats = [
  { value: 80, suffix: "%", label: "Courses rate" },
  { value: 4.8, suffix: "/5", label: "Rate by learners", decimals: 1 },
  { value: 50, suffix: "% +", label: "Average salary hike" },
];

export type SkillItem = {
  name: string;
  icon: string;
  category: "top" | "cert";
};

export const skills: SkillItem[] = [
  { name: "Android", icon: "logos:android-icon", category: "top" },
  { name: "Redux", icon: "logos:redux", category: "top" },
  { name: "JavaScript", icon: "logos:javascript", category: "top" },
  { name: "Docker", icon: "logos:docker-icon", category: "top" },
  { name: "Python", icon: "logos:python", category: "top" },
  { name: "Java", icon: "logos:java", category: "top" },
  { name: "Next.js", icon: "logos:nextjs-icon", category: "top" },
  { name: "Electron", icon: "logos:electron", category: "top" },
  { name: "FaunaDB", icon: "simple-icons:fauna", category: "top" },
  { name: "AWS", icon: "logos:aws", category: "top" },
  { name: "GraphQL", icon: "logos:graphql", category: "top" },
  { name: "Laravel", icon: "logos:laravel", category: "top" },
  { name: "Jira", icon: "logos:jira", category: "top" },
  { name: "Swift", icon: "logos:swift", category: "top" },
  { name: "PostgreSQL", icon: "logos:postgresql", category: "top" },
  { name: "React JS", icon: "logos:react", category: "top" },
  { name: "AWS Solutions Architect", icon: "simple-icons:amazonaws", category: "cert" },
  { name: "Google Cloud Professional", icon: "logos:google-cloud", category: "cert" },
  { name: "Azure Administrator", icon: "logos:microsoft-azure", category: "cert" },
  { name: "PMP Certification", icon: "simple-icons:pmi", category: "cert" },
  { name: "CISSP", icon: "simple-icons:isc2", category: "cert" },
  { name: "Kubernetes CKA", icon: "logos:kubernetes", category: "cert" },
  { name: "Scrum Master", icon: "simple-icons:scrumalliance", category: "cert" },
  { name: "CompTIA Security+", icon: "simple-icons:comptia", category: "cert" },
];

export type PricingPlan = {
  id: string;
  title: string;
  monthlyPrice: string;
  yearlyPrice: string;
  description: string;
  features: string[];
  featured?: boolean;
};

export const pricingPlans: PricingPlan[] = [
  {
    id: "screening",
    title: "SCREENING INTERVIEWS",
    monthlyPrice: "$ 2.75",
    yearlyPrice: "$ 2.25",
    description: "Perfect for Basic Screening with Pre-Fixed questions",
    features: [
      "Upto 15 minutes of interview",
      "Fit for HR Screening & Communication Desk",
      "All Features Included Proctoring & Scheduling",
    ],
  },
  {
    id: "coding",
    title: "CODING INTERVIEWS",
    monthlyPrice: "$ 11",
    yearlyPrice: "$ 9",
    description: "Ideal for human-like cross-questioning on Code written Tech Roles",
    features: [
      "Upto 60 minutes of interview",
      "Fit for Coding Rounds at all levels",
      "All Features Included Proctoring & Scheduling",
    ],
    featured: true,
  },
  {
    id: "non-coding",
    title: "NON-CODING INTERVIEWS",
    monthlyPrice: "$ 7.5",
    yearlyPrice: "$ 6",
    description:
      "Perfect for all subject matter interviews which require detailed discussion",
    features: [
      "Upto 60 minutes of interview",
      "Fit for Interviews in Business Roles",
      "All Features Included Proctoring & Scheduling",
    ],
  },
];

export const footerCtaCards = [
  {
    badge: "Trial",
    badgeClass: "bg-purple-500/30 text-white",
    title: "Free to try. Fast to scale.",
    description:
      "Take better version software for a spin with a free trial of Skiltechy. No credit card required.",
    cta: "Book a Demo",
  },
  {
    badge: "Contact Sales",
    badgeClass: "bg-sky-500/30 text-white",
    title: "See rapid impact in action",
    description:
      "Let our product experts show you how Skiltechy can solve your specific challenges. Get a personalized walkthrough tailored to your needs.",
    cta: "Book a Demo",
  },
  {
    badge: "Resources",
    badgeClass: "bg-white text-zinc-900",
    title: "Learn, explore, get inspired",
    description:
      "Explore our library of case studies, product tours, webinars and insights.",
    cta: "Browse More",
  },
];

export const dashboardNavItems: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Candidate", icon: Users },
  { label: "Course", icon: BookOpen },
  { label: "Mock Interviews", icon: MessageSquare },
  { label: "Assessments", icon: ClipboardList },
];

export const dashboardStats = [
  { label: "Total Candidates", value: "409", color: "text-blue-600" },
  { label: "Total Questions", value: "457", color: "text-purple-600" },
  { label: "Total Courses", value: "24", color: "text-green-600" },
  { label: "Active Sessions", value: "18", color: "text-orange-600" },
  { label: "Completed", value: "312", color: "text-pink-600" },
  { label: "Avg. Score", value: "78%", color: "text-indigo-600" },
];

export const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Courses", href: "#courses" },
      { label: "Pricing", href: "#pricing" },
      { label: "Testimonials", href: "#testimonials" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#contact" },
      { label: "Blog", href: "#" },
    ],
  },
];

export const socialLinks: { icon: LucideIcon; href: string; label: string }[] = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Youtube, href: "#", label: "YouTube" },
];

export const dashboardCourses = [
  "Tableau",
  "AI_ML",
  "GenAI",
  "SQL",
  "Python",
  "React",
  "Java",
  "Docker",
];
