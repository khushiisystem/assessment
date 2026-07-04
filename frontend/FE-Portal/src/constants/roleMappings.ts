export const AI_ROLE_TO_LABEL_MAP: Record<string, string> = {
  frontend_developer: "Frontend Developer",
  fullstack_developer: "Full Stack Developer",
  java_developer: "Java Developer",
  python_developer: "Python Developer",
  mern_stack_developer: "MERN Stack Developer",
  devops_engineer: "DevOps Engineer",
  machine_learning_engineer: "Machine Learning Engineer",
  data_scientist: "Data Scientist",
  data_engineer: "Data Engineer",
  ai_engineer: "AI Engineer",
  ux_designer: "UX Designer",
  salesforce_developer: "Salesforce Developer",
  salesforce_admin: "Salesforce Admin",
  tableau_developer: "Tableau Developer",
  power_bi_developer: "Power BI Developer",
  data_analyst: "Data Analyst",
  backend_developer: "Backend Developer",
  mean_stack_developer: "MEAN Stack Developer",
};

export const AI_EXPERIENCE_TO_LABEL_MAP: Record<string, string> = {
  fresher: "Fresher",
  "0-2_years": "0-2 years",
  "1-2_years": "1-2 years",
  "2-5_years": "2-5 years",
  "5-8_years": "5-8 years",
  "5-10_years": "5-10 years",
  "8+_years": "8+ years",
  "10+_years": "10+ years",
  "5+_years": "5+ years",
};

export const AI_LABEL_TO_ROLE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(AI_ROLE_TO_LABEL_MAP).map(([backendValue, label]) => [label, backendValue])
);

export const AI_LABEL_TO_EXPERIENCE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(AI_EXPERIENCE_TO_LABEL_MAP).map(([backendValue, label]) => [label, backendValue])
);
