import { formatDateValue } from "@/utils/commonFunctions";

export const formatDate = (dateString: string) =>
  formatDateValue(
    dateString,
    { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" },
    dateString
  );

export const formatSimpleDate = (dateString: string) =>
  formatDateValue(dateString, { month: "short", day: "numeric", year: "numeric" }, dateString);

export const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} ${mins} minute${mins > 1 ? "s" : ""}`;
  }
  return `${mins} minute${mins > 1 ? "s" : ""}`;
};

export const getQuestionTypeDisplay = (type: string) => {
  switch (type) {
    case "mcq_single":
      return "MCQ (Single)";
    case "mcq_multiple":
      return "MCQ (Multiple)";
    case "subjective":
      return "Subjective";
    case "coding":
      return "Coding";
    case "sql":
      return "SQL";
    case "true_false":
      return "True/False";
    case "fill_blank":
      return "Fill Blank";
    default:
      return type;
  }
};

export const getDifficultyColor = (difficulty: string) => {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "bg-green-500 text-white";
    case "medium":
      return "bg-yellow-500 text-white";
    case "hard":
      return "bg-red-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
};

export const getMarksDisplay = (marks: number) =>
  marks > 0 ? `${marks} mark${marks > 1 ? "s" : ""}` : "No marks";

export const getStatusDisplay = (status: "completed" | "active" | "upcoming") => {
  switch (status) {
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "upcoming":
      return "Upcoming";
    default:
      return "Unknown Status";
  }
};

export const getStatusColor = (status: "completed" | "active" | "upcoming") => {
  switch (status) {
    case "completed":
      return "bg-green-500 text-white";
    case "active":
      return "bg-blue-500 text-white";
    case "upcoming":
      return "bg-yellow-500 text-black";
    default:
      return "bg-gray-400 text-white";
  }
};

export const getAssignmentStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-amber-100 text-amber-800";
    case "assigned":
      return "bg-blue-100 text-blue-800";
    case "expired":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export const getAssignmentStatusDisplay = (status: string) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In Progress";
    case "assigned":
      return "Assigned";
    case "expired":
      return "Expired";
    default:
      return status;
  }
};
