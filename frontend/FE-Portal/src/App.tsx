import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import RouteLoader from "./components/RouteLoader";
import {Toaster} from "./components/ui/toaster";

const ProvidersLayout = lazy(() => import("./components/ProvidersLayout"));



// ── Eager loads (critical path — shown immediately) ──
import LandingPage from "./pages/LandingPage";
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OAuthCallback = lazy(() => import("./hooks/OAuthCallback"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));
const AdminRoute = lazy(() => import("./components/AdminRoute"));
const UserLayout = lazy(() => import("./components/UserLayout"));

// ── Lazy loads — Admin pages ──
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const OrganizationsManagement = lazy(() => import("./pages/OrganizationsManagement"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const UserListView = lazy(() => import("./pages/UserListView"));
const AddCandidate = lazy(() => import("./pages/AddCandidate").then(m => ({ default: m.AddCandidate })));
const OrgUserManagement = lazy(() => import("./pages/OrgUserManagement"));
const ManagersList = lazy(() => import("./pages/ManagersList"));
const UserDetailView = lazy(() => import("./pages/adminpages/UserDetailView"));
const Technologies = lazy(() => import("./pages/Technologies"));
const TechnologyQuestions = lazy(() => import("./pages/TechnologyQuestions"));
const QuestionBank = lazy(() => import("./pages/QuestionBank").then(m => ({ default: m.QuestionBank })));
const AddQuestions = lazy(() => import("./pages/AddQuestions").then(m => ({ default: m.AddQuestions })));
const AssessmentManagement = lazy(() => import("./pages/AssessmentManagment").then(m => ({ default: m.AssessmentManagement })));
const CreateAssessment = lazy(() => import("./pages/CreateAssessment").then(m => ({ default: m.CreateAssessment })));
const CreateAIAssessment = lazy(() => import("./pages/CreateAiAssessment").then(m => ({ default: m.CreateAIAssessment })));
const AssessmentDetails = lazy(() => import("./pages/AssessmentDetails").then(m => ({ default: m.AssessmentDetails })));
const AiAssessmentDetails = lazy(() => import("./pages/AiAssessmentDetails"));
const AssessmentAssignment = lazy(() => import("./pages/AssessmentAssignment"));
const AssignAIAssessment = lazy(() => import("./pages/AssignAIAssessment"));
const AsssesmentResult = lazy(() => import("./pages/AsssessmentResult").then(m => ({ default: m.AsssesmentResult })));
const AssessmentResultDetails = lazy(() => import("./pages/AssessmentResultDetails").then(m => ({ default: m.AssessmentResultDetails })));
const AssessmentCandidateSubmission = lazy(() => import("./pages/AssessmentCandidateSubmission").then(m => ({ default: m.AssessmentCandidateSubmission })));
const AssessmentCandidateResults = lazy(() => import("./pages/AssessmentCandidateResults").then(m => ({ default: m.AssessmentCandidateResults })));
const AiAssessmentResults = lazy(() => import("./pages/AiAssessmentResults"));
const RegularAssessmentResults = lazy(() => import("./pages/RegularAssessmentResults"));
const AiAssessmentResultDetails = lazy(() => import("./pages/AiAssessmentResultDetails"));
const BulkUpload = lazy(() => import("./pages/BulkUpload").then(m => ({ default: m.BulkUpload })));
const AssignAssessmentPage = lazy(() => import("./pages/AssignAssessmentPage"));
const AssignStudyMaterials = lazy(() => import("./pages/AssignStudyMaterials"));
const MockInterviewDashboard = lazy(() => import("./pages/adminpages/MockInterviewDashboard"));
const MockQuestionBank = lazy(() => import("./pages/adminpages/MockQuestionBank"));
const MockTemplates = lazy(() => import("./pages/adminpages/MockTemplates"));
const StartInterview = lazy(() => import("./pages/adminpages/StartInterview"));
const ActiveSession = lazy(() => import("./pages/adminpages/ActiveSession"));
const CandidateProfile = lazy(() => import("./pages/adminpages/CandidateProfile"));
const SharedContentManagement = lazy(() => import("./pages/adminpages/SharedContentManagement"));

// ── Lazy loads — Candidate/Employee pages ──
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const EmployeeProgress = lazy(() => import("./pages/EmployeeProgress"));
const Profile = lazy(() => import("./pages/Profile"));
const MyAssessments = lazy(() => import("./pages/userpages/MyAssessment"));
const CompletedAssessments = lazy(() => import("./pages/userpages/CompletedAssessments"));
const UpcomingAssessments = lazy(() => import("./pages/userpages/UpcomingAssessments"));
const AssessmentResults = lazy(() => import("./pages/userpages/AssessmentResults"));
const AssessmentTestInterface = lazy(() => import("./pages/userpages/AssessmentTestInterface"));
const AiAssessmentTestInterface = lazy(() => import("./pages/userpages/AiAssessmentTestInterface"));
const RecordIntroduction = lazy(() => import("./pages/userpages/RecordIntroduction"));
const AiInterviewResultspage = lazy(() => import("./pages/userpages/AiInterviewResultspage"));
const CandidateMockInterviews = lazy(() => import("./pages/userpages/CandidateMockInterviews"));
const CandidateActiveSession = lazy(() => import("./pages/userpages/CandidateActiveSession"));
const SubscriptionPlans = lazy(() => import("./pages/userpages/SubscriptionPlans"));

// Premium AI Routes
const AiInterviewIntro = lazy(() => import("./pages/premium_interview/InterviewIntro"));
const AiInterviewRoom = lazy(() => import("./pages/premium_interview/InterviewRoom"));
const AiInterviewSetup = lazy(() => import("./pages/premium_interview/InterviewSetup"));
const AiInterviewResults = lazy(() => import("./pages/premium_interview/InterviewResults"));

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true }}>
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route element={<ProvidersLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Login />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />

          {/* Admin-only routes */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/organizations" element={<AdminRoute><OrganizationsManagement /></AdminRoute>} />
          <Route path="/admin/candidates" element={<AdminRoute><UserListView /></AdminRoute>} />
          <Route path="/admin/candidate/add" element={<AdminRoute><AddCandidate /></AdminRoute>} />
          <Route path="/admin/org/users/create" element={<AdminRoute><OrgUserManagement /></AdminRoute>} />
          <Route path="/admin/managers" element={<AdminRoute><ManagersList /></AdminRoute>} />
          <Route path="/admin/technologies" element={<AdminRoute><Technologies /></AdminRoute>} />
          <Route path="/admin/technologies/:technologyId" element={<AdminRoute><TechnologyQuestions /></AdminRoute>} />
          <Route path="/admin/questions" element={<AdminRoute><QuestionBank /></AdminRoute>} />
          <Route path="/admin/question/add" element={<AdminRoute><AddQuestions /></AdminRoute>} />
          <Route path="/admin/question/:id/edit" element={<AdminRoute><AddQuestions /></AdminRoute>} />
          <Route path="/admin/mock-interview" element={<AdminRoute><MockInterviewDashboard /></AdminRoute>} />
          <Route path="/admin/mock-interview/questions" element={<AdminRoute><MockQuestionBank /></AdminRoute>} />
          <Route path="/admin/mock-interview/templates" element={<AdminRoute><MockTemplates /></AdminRoute>} />
          <Route path="/admin/mock-interview/start" element={<AdminRoute><StartInterview /></AdminRoute>} />
          <Route path="/admin/mock-interview/session/:sessionId" element={<AdminRoute><ActiveSession /></AdminRoute>} />
          <Route path="/admin/mock-interview/candidate/:candidateId" element={<AdminRoute><CandidateProfile /></AdminRoute>} />
          <Route path="/admin/assessments" element={<AdminRoute><AssessmentManagement /></AdminRoute>} />
          <Route path="/admin/assessment/:id" element={<AdminRoute><AssessmentDetails /></AdminRoute>} />
          <Route path="/admin/ai-assessment/:id" element={<AdminRoute><AiAssessmentDetails /></AdminRoute>} />
          <Route path="/admin/assessment/:id/edit" element={<AdminRoute><CreateAssessment /></AdminRoute>} />
          <Route path="/admin/assessment/:id/assign" element={<AdminRoute><AssessmentAssignment /></AdminRoute>} />
          <Route path="/admin/ai-assessment/:id/assign" element={<AdminRoute><AssignAIAssessment /></AdminRoute>} />
          <Route path="/admin/assessment/create" element={<AdminRoute><CreateAssessment /></AdminRoute>} />
          <Route path="/admin/assessment/:assessmentId/candidate/:candidateId" element={<AdminRoute><AssessmentCandidateSubmission /></AdminRoute>} />
          <Route path="/admin/ai-assessment/create" element={<AdminRoute><CreateAIAssessment /></AdminRoute>} />
          <Route path="/admin/ai-assessment/:id/edit" element={<AdminRoute><CreateAIAssessment /></AdminRoute>} />
          <Route path="/admin/results" element={<AdminRoute><AsssesmentResult /></AdminRoute>} />
          <Route path="/admin/results/candidate/:id" element={<AdminRoute><AssessmentCandidateResults /></AdminRoute>} />
          <Route path="/admin/results/assessment-summary/:id" element={<AdminRoute><RegularAssessmentResults /></AdminRoute>} />
          <Route path="/admin/results/assessment/:id" element={<AdminRoute><AssessmentResultDetails /></AdminRoute>} />
          <Route path="/admin/results/assessment/:assessmentId/report/:id" element={<AdminRoute><AssessmentResultDetails /></AdminRoute>} />
          <Route path="/admin/results/ai-assessment/:id" element={<AdminRoute><AiAssessmentResults /></AdminRoute>} />
          <Route path="/admin/result/ai-assessment/:assessmentId/report/:id" element={<AdminRoute><AiAssessmentResultDetails /></AdminRoute>} />
          <Route path="/admin/bulk-upload" element={<AdminRoute><BulkUpload /></AdminRoute>} />
          <Route path="/admin/shared-content" element={<AdminRoute><SharedContentManagement /></AdminRoute>} />
          <Route path="/admin/subscription" element={<AdminRoute><SubscriptionPlans /></AdminRoute>} />
          <Route path="/admin/learner/:id" element={<AdminRoute><UserDetailView /></AdminRoute>} />
          <Route path="/admin/profile" element={<AdminRoute><Profile /></AdminRoute>} />
          <Route path="/admin/assign-assessment/:userId" element={<AssignAssessmentPage />} />
          <Route path="/admin/assign-study-materials/:id" element={<AssignStudyMaterials />} />



          {/* Candidate/Employee routes */}
          <Route path="/candidate" element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<EmployeeDashboard />} />
            <Route path="my-assessments" element={<MyAssessments />} />
            <Route path="my-assessments/:id/result" element={<AssessmentResults />} />
            <Route path="ai-assessment/:id/result" element={<AiInterviewResultspage />} />
            <Route path="completed-assessments" element={<CompletedAssessments />} />
            <Route path="upcoming-assessments" element={<UpcomingAssessments />} />
            <Route path="mock-interviews" element={<CandidateMockInterviews />} />
            <Route path="mock-interview/session/:sessionId" element={<CandidateActiveSession />} />
            <Route path="my-learning" element={<EmployeeProgress />} />
            <Route path="subscription" element={<SubscriptionPlans />} />
            <Route path="profile" element={<Profile />} />


          </Route>
          {/* AI Premium Routes */}
          <Route path="/candidate/AiInterviewSetup" element={<AiInterviewSetup />} />
          <Route path="/candidate/AiInterviewIntro/:session_id" element={<AiInterviewIntro />} />
          <Route path="/candidate/AiInterviewRoom/:session_id" element={<AiInterviewRoom />} />
          <Route path="/candidate/AiInterviewResults/:session_id" element={<AiInterviewResults />} />
          <Route path="/candidate/assessment/:id/introduction" element={<ProtectedRoute><RecordIntroduction /></ProtectedRoute>} />
          <Route path="/candidate/ai-assessment/:id/introduction" element={<ProtectedRoute><RecordIntroduction /></ProtectedRoute>} />
          <Route path="/candidate/ai-assessment/:id/running" element={<ProtectedRoute><AiAssessmentTestInterface /></ProtectedRoute>} />
          <Route path="/candidate/my-assessment/:id/running" element={<ProtectedRoute><AssessmentTestInterface /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
     <Toaster />
  </BrowserRouter>
);

export default App;
