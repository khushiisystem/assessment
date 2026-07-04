export interface Question {
  id: number;
  title: string;
  description: string;
  question_type: string;
  difficulty: string;
  marks: number;
  category_name: string;
  tags: string;
  created_at: string;
  option1?: string;
  option2?: string;
  option3?: string;
  option4?: string;
  option5?: string;
  correct_answer?: string;
  sample_input?: string;
  sample_output?: string;
  category: number;
  created_by: number;
}

export interface Assessment {
  id: number;
  title: string;
  description: string;
  total_assigned?: number;
  completed?: number;
  in_progress?: number;
  expired?: number;
  categories: number[];
  question_ids: number[];
  is_active: boolean;
  duration: number;
  start_date: string;
  end_date: string;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  instructions: string;
  status: "completed" | "active" | "upcoming";
}

export interface AssessmentResponse {
  assessment: Assessment;
  questions: Question[];
}

export interface Category {
  id: number;
  name: string;
  description: string;
}

export interface AutoFillRule {
  id: number;
  category: string;
  type: string;
  difficulty: string;
  count: string;
}

export interface ApiQuestionsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: {
    questions: Question[];
    categories: Category[];
  };
}

export interface LearningAssignment {
  assignment_id: number;
  technology_id: string;
  technology_name: string;
  assigned_at: string;
  due_at: string;
  notes: string;
  progress: number;
  completed: number;
  total: number;
  user_notes: string | null;
}

export interface AssessmentAssignment {
  candidate_assessment_id: number;
  assessment_id: number;
  title: string;
  assigned_at: string;
  status: "assigned" | "in_progress" | "completed" | "expired";
  score: number;
  start_date: string;
  end_date: string;
  total_marks: number;
  percentage: number;
}

export interface Candidate {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  profile: string | null;
  role: string;
  date_joined: string;
  resume_s3_url: string | null;
  learning_assignments: LearningAssignment[];
  assessment_assignments: AssessmentAssignment[];
}

export interface CandidatesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: {
    candidates: Candidate[];
    available_assessments: Array<{
      id: number;
      title: string;
      end_date: string;
    }>;
    ai_assessments: Array<{
      id: number;
      title: string;
      end_date: string;
    }>;
  };
}

export type ModalType = "all" | "completed" | "inProgress" | "expired";

export interface StatusApiCandidate {
  candidate_assessment_id: number;
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  profile: string | null;
  date_joined: string;
  assigned_at: string;
  start_time: string | null;
  end_time: string | null;
  status: AssessmentAssignment["status"];
  score: number;
  total_marks: number;
  percentage: number;
}

export interface AssessmentStats {
  totalAssigned: number;
  completed: number;
  inProgress: number;
  expired: number;
}
