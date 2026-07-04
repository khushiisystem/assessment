import { Cloud, Code, Database, Layers } from "lucide-react";

export const getIconForCategory = (category: string) => {
  switch (category.toLowerCase()) {
    case "frontend":
      return Code;
    case "backend":
      return Layers;
    case "cloud":
      return Cloud;
    case "database":
      return Database;
    case "devops":
      return Layers;
    default:
      return Code;
  }
};

export const getLevelForCategory = (category: string) => {
  switch (category.toLowerCase()) {
    case "frontend":
      return "Frontend";
    case "backend":
      return "Backend";
    case "cloud":
      return "Cloud";
    case "database":
      return "Database";
    case "devops":
      return "DevOps";
    default:
      return category;
  }
};

export const getGradientForCategory = (category: string) => {
  switch (category.toLowerCase()) {
    case "frontend":
      return "from-blue-500 to-cyan-500";
    case "backend":
      return "from-green-500 to-emerald-500";
    case "cloud":
      return "from-orange-500 to-yellow-500";
    case "database":
      return "from-green-600 to-lime-500";
    case "devops":
      return "from-sky-500 to-blue-500";
    default:
      return "from-gray-500 to-gray-600";
  }
};

export const getBgColorForCategory = (category: string) => {
  switch (category.toLowerCase()) {
    case "frontend":
      return "bg-blue-50";
    case "backend":
      return "bg-green-50";
    case "cloud":
      return "bg-orange-50";
    case "database":
      return "bg-green-50";
    case "devops":
      return "bg-sky-50";
    default:
      return "bg-gray-50";
  }
};

export const getTextColorForCategory = (category: string) => {
  switch (category.toLowerCase()) {
    case "frontend":
      return "text-blue-700";
    case "backend":
      return "text-green-700";
    case "cloud":
      return "text-orange-700";
    case "database":
      return "text-green-700";
    case "devops":
      return "text-sky-700";
    default:
      return "text-gray-700";
  }
};

export const getBorderColorForCategory = (category: string) => {
  switch (category.toLowerCase()) {
    case "frontend":
      return "border-blue-200";
    case "backend":
      return "border-green-200";
    case "cloud":
      return "border-orange-200";
    case "database":
      return "border-green-200";
    case "devops":
      return "border-sky-200";
    default:
      return "border-gray-200";
  }
};

export const getIconForTechnologyName = (techName: string) => {
  const lowerName = techName.toLowerCase();
  if (
    lowerName.includes("react") ||
    lowerName.includes("javascript") ||
    lowerName.includes("frontend")
  ) {
    return Code;
  } else if (
    lowerName.includes("node") ||
    lowerName.includes("backend") ||
    lowerName.includes("api")
  ) {
    return Layers;
  } else if (
    lowerName.includes("cloud") ||
    lowerName.includes("aws") ||
    lowerName.includes("azure")
  ) {
    return Cloud;
  } else if (
    lowerName.includes("database") ||
    lowerName.includes("sql") ||
    lowerName.includes("mongodb")
  ) {
    return Database;
  } else if (
    lowerName.includes("devops") ||
    lowerName.includes("docker") ||
    lowerName.includes("kubernetes")
  ) {
    return Layers;
  }
  return Code;
};

export const getLevelForProgress = (progress: number) => {
  if (progress === 0) return "Beginner";
  if (progress < 30) return "Getting Started";
  if (progress < 60) return "Intermediate";
  if (progress < 90) return "Advanced";
  return "Master";
};

export const getColorForProgress = (progress: number) => {
  if (progress >= 80) return "bg-green-100 text-green-700 border-green-200";
  if (progress >= 50) return "bg-blue-100 text-blue-700 border-blue-200";
  if (progress >= 25) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
};

export const getGradientForProgress = (progress: number) => {
  if (progress >= 80) return "from-green-500 to-emerald-500";
  if (progress >= 50) return "from-blue-500 to-cyan-500";
  if (progress >= 25) return "from-yellow-500 to-orange-500";
  return "from-gray-500 to-gray-600";
};

export const getProgressBarColor = (progress: number) => {
  if (progress >= 80) return "bg-green-500";
  if (progress >= 50) return "bg-blue-500";
  if (progress >= 25) return "bg-yellow-500";
  return "bg-gray-300";
};
