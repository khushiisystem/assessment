import { createApi } from "@reduxjs/toolkit/query/react";
import { fetchBaseQuery } from "./baseQuery";

export const assessmentsApi = createApi({
  reducerPath: "assessmentsApi",
  baseQuery: fetchBaseQuery,
  keepUnusedDataFor: 300,
  tagTypes: ["Assessments", "AssessmentDetail", "AiAssessments", "AiAssessmentDetail", "Categories", "AssessmentResults"],
  endpoints: (builder) => ({
    // --- Regular Assessments ---
    getAssessments: builder.query<any, string>({
      query: (endpoint) => ({ url: endpoint }),
      providesTags: ["Assessments"],
    }),
    getAssessmentById: builder.query<any, number>({
      query: (id) => ({ url: `/my-admin/assessments/${id}/` }),
      providesTags: (_r, _e, id) => [{ type: "AssessmentDetail", id }],
    }),
    getAssessmentCandidatesByStatus: builder.query<any, { id: number; status: string; page?: number; page_size?: number }>({
      query: ({ id, status, page = 1, page_size = 10 }) => ({
        url: `/my-admin/assessments/${id}/candidates/status/`,
        params: { status, page, page_size },
      }),
      providesTags: ["AssessmentDetail"],
    }),
    getAssessmentCandidatesWithScore: builder.query<any, { id: number; status: string; page?: number; page_size?: number }>({
  query: ({ id, status, page = 1, page_size = 10 }) => ({
    url: `/my-admin/assessments/${id}/candidates-score/`,
    params: { status, page, page_size },
  }),
}),

    getAssessmentDetailPage: builder.query<any, string>({
      query: (url) => ({ url }),
      providesTags: ["AssessmentDetail"],
    }),
    createAssessment: builder.mutation<any, any>({
      query: (data) => ({
        url: "/my-admin/assessments/create/",
        method: "POST",
        data,
      }),
      invalidatesTags: ["Assessments"],
    }),
    updateAssessment: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/my-admin/assessments/${id}/edit/`,
        method: "PUT",
        data,
      }),
      invalidatesTags: ["Assessments", "AssessmentDetail"],
    }),
    bulkDeleteAssessments: builder.mutation<any, number[]>({
      query: (assessment_ids) => ({
        url: "/assessments/bulk-delete/",
        method: "POST",
        data: { assessment_ids },
      }),
      invalidatesTags: ["Assessments"],
    }),
    assignAssessment: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/my-admin/assessments/${id}/assign/`,
        method: "POST",
        data,
      }),
      invalidatesTags: ["AssessmentDetail"],
    }),
    unassignAssessment: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/my-admin/assessments/${id}/unassign/`,
        method: "POST",
        data,
      }),
      invalidatesTags: ["AssessmentDetail"],
    }),

    // --- AI Assessments ---
    getAiAssessments: builder.query<any, string>({
      query: (endpoint) => ({ url: endpoint }),
      providesTags: ["AiAssessments"],
    }),
    getAiAssessmentById: builder.query<any, number>({
      query: (id) => ({ url: `/my-admin/ai-assessments/${id}/` }),
      providesTags: (_r, _e, id) => [{ type: "AiAssessmentDetail", id }],
    }),
    createAiAssessment: builder.mutation<any, any>({
      query: (data) => ({
        url: "/my-admin/ai-assessments/create/",
        method: "POST",
        data,
      }),
      invalidatesTags: ["AiAssessments"],
    }),
    updateAiAssessment: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/my-admin/ai-assessments/${id}/`,
        method: "PUT",
        data,
      }),
      invalidatesTags: ["AiAssessments", "AiAssessmentDetail"],
    }),
    bulkDeleteAiAssessments: builder.mutation<any, number[]>({
      query: (ai_assessment_ids) => ({
        url: "/my-admin/ai-assessments/bulk-delete/",
        method: "POST",
        data: { ai_assessment_ids },
      }),
      invalidatesTags: ["AiAssessments"],
    }),
    assignAiAssessment: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/my-admin/ai-assessments/${id}/assign/`,
        method: "POST",
        data,
      }),
      invalidatesTags: ["AiAssessmentDetail"],
    }),
    unassignAiAssessment: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/my-admin/ai-assessments/${id}/unassign/`,
        method: "POST",
        data,
      }),
      invalidatesTags: ["AiAssessmentDetail"],
    }),
    getHardcodedQuestions: builder.query<any, Record<string, string>>({
      query: (params) => ({
        url: "/my-admin/ai-assessments/hardcoded-questions/",
        params,
      }),
    }),
    deleteAiAssessmentCandidate: builder.mutation<any, number>({
      query: (resultId) => ({
        url: `/my-admin/ai-assessments/candidate/${resultId}/delete/`,
        method: "POST",
      }),
      invalidatesTags: ["AiAssessmentDetail"],
    }),

    // --- Categories ---
    getCategories: builder.query<any, void>({
      query: () => ({ url: "/my-admin/category/" }),
      providesTags: ["Categories"],
    }),

    // --- Assessment Results ---
    getAssessmentResults: builder.query<any, string>({
      query: (endpoint) => ({ url: endpoint }),
      providesTags: ["AssessmentResults"],
    }),
    getCandidateAssessmentResult: builder.query<any, number>({
      query: (id) => ({ url: `/my-admin/candidate-assessment/${id}/result/` }),
    }),

    // --- Candidate-side ---
    takeAssessment: builder.query<any, number>({
      query: (id) => ({ url: `/candidate-assessment/${id}/take/` }),
    }),
    submitAssessment: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/candidate-assessment/${id}/submit/`,
        method: "POST",
        data,
      }),
    }),
    saveAnswer: builder.mutation<any, any>({
      query: (data) => ({
        url: "api/v1/save-answer/",
        method: "POST",
        data,
      }),
    }),
    getCandidateResult: builder.query<any, number>({
      query: (id) => ({ url: `/candidate-assessment/${id}/result/` }),
    }),
    submitCandidateFeedback: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/candidate-assessment/${id}/result/`,
        method: "POST",
        data,
      }),
    }),

    // --- AI Assessment Candidate-side ---
    getAiIntroduction: builder.query<any, number>({
      query: (id) => ({ url: `/ai-assessment/${id}/introduction/` }),
    }),
    submitAiIntroduction: builder.mutation<any, { url: string; data: any }>({
      query: ({ url, data }) => ({ url, method: "POST", data }),
    }),
    saveAiAnswer: builder.mutation<any, any>({
      query: (data) => ({
        url: "/ai-assessment/save-answer/",
        method: "POST",
        data,
      }),
    }),
    submitAiAssessment: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/ai-assessment/${id}/submit/`,
        method: "POST",
        data,
      }),
    }),
    checkAiAssessmentStatus: builder.query<any, number>({
      query: (id) => ({ url: `/ai-assessment/${id}/status/` }),
    }),
    getPresignedUrl: builder.mutation<any, FormData>({
      query: (data) => ({
        url: "/api/ai/get-presigned-url/",
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    }),
    uploadVideoChunk: builder.mutation<any, FormData>({
      query: (data) => ({
        url: "/api/ai/upload-video-chunk/",
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    }),
    getVideoPartUrl: builder.mutation<any, { upload_id: string; file_key: string; part_number: number }>({
      query: (data) => ({
        url: "/api/ai/get-video-part-url/",
        method: "POST",
        data,
      }),
    }),
    completeMultipartUpload: builder.mutation<any, any>({
      query: (data) => ({
        url: "/api/ai/complete-multipart-upload/",
        method: "POST",
        data,
      }),
    }),
    uploadVideo: builder.mutation<any, any>({
      query: (data) => ({
        url: "/api/ai/upload-video/",
        method: "POST",
        data,
      }),
    }),
    uploadVideoForm: builder.mutation<any, FormData>({
      query: (data) => ({
        url: "/api/ai/upload-video/",
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    }),
    uploadAudio: builder.mutation<any, FormData>({
      query: (data) => ({
        url: "/api/ai/upload-audio/",
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    }),
    getSignedUrl: builder.mutation<any, any>({
      query: (data) => ({
        url: "/api/ai/get-presigned-download-url/",
        method: "POST",
        data, 
      }),
    }),

    // --- AI Assessment Candidate-side (additional) ---
    takeAiAssessment: builder.query<any, number>({
      query: (id) => ({ url: `/ai-assessment/${id}/take/` }),
    }),
    checkQuestionsReady: builder.query<any, number>({
      query: (id) => ({ url: `/candidate/api/assessment/${id}/check-questions/` }),
    }),
    prepareQuestionsAsync: builder.mutation<any, number>({
      query: (id) => ({
       url: `/candidate/api/assessment/${id}/prepare-questions/`,
       method: 'POST',
   }),
}),
    saveProctoringIncident: builder.mutation<any, FormData>({
      query: (data) => ({
        url: "ai-assessment/save-proctoring-incident/",
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    }),

    // --- AI Assessment Results (admin) ---
    getAiAssessmentResults: builder.query<any, number>({
      query: (id) => ({ url: `/my-admin/ai-assessments/${id}/results/` }),
    }),
    getAiAssessmentCandidateReport: builder.query<any, number>({
      query: (id) => ({ url: `/my-admin/ai-assessments/candidate/${id}/report/` }),
    }),
    patchAdminFeedback: builder.mutation<any, { id: number; admin_feedback: string }>({
      query: ({ id, admin_feedback }) => ({
            url: `/my-admin/ai-assessments/candidate/${id}/report/`,
            method: "PATCH",
            data: { admin_feedback },
            }),
          }),
    
    getAiInterviewResults: builder.query<any, string>({
      query: (endpoint) => ({ url: endpoint }),
    }),

    // --- Assessment Questions (admin) ---
    getAssessmentQuestions: builder.query<any, { page?: number; page_size?: number; categories?: number[]; search?: string }>({
      query: ({ page = 1, page_size = 20, categories = [], search }) => ({
        url: "/my-admin/questions/",
        params: {
          page,
          page_size,
          ...(categories.length > 0 ? { categories: categories.join(",") } : {}),
          ...(search?.trim() ? { search: search.trim() } : {}),
        },
      }),
    }),
    // Client-side auto-fill: fetch questions matching a single rule (category /
    // type / difficulty). Empty or "any" values are omitted so the BE applies no
    // filter for them. category accepts an id or a name.
    getQuestionsByRule: builder.query<
      any,
      { category?: string | number; question_type?: string; difficulty?: string; page_size?: number }
    >({
      query: ({ category, question_type, difficulty, page_size = 100 }) => ({
        url: "/my-admin/questions/",
        params: {
          page_size,
          ...(category !== undefined && category !== "" && category !== "any"
            ? { category }
            : {}),
          ...(question_type && question_type !== "any" ? { question_type } : {}),
          ...(difficulty && difficulty !== "any" ? { difficulty } : {}),
        },
      }),
    }),
    sendAssessmentEmails: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/my-admin/assessments/${id}/send-emails/`,
        method: "POST",
        data,
      }),
    }),

    autofillAssessmentQuestions: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/my-admin/assessments/${id}/autofill-questions/`,
        method: "POST",
        data,
      }),
      invalidatesTags: ["AssessmentDetail"],
    }),

    // --- Misc admin ---
    sendReminderEmail: builder.mutation<any, { url: string; data: any }>({
      query: ({ url, data }) => ({ url, method: "POST", data }),
    }),

    // --- Introduction uploads ---
    getPresignedUrlIntro: builder.mutation<any, FormData>({
      query: (data) => ({
        url: "/api/ai/get-presigned-url-intro/",
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    }),
    uploadIntroductionVideo: builder.mutation<any, { url: string; data: any; headers?: any }>({
      query: ({ url, data, headers }) => ({ url, method: "POST", data, headers }),
    }),

    // --- Dashboard ---
    getAdminDashboard: builder.query<any, void>({
      query: () => ({ url: "/my-admin/dashboard/" }),
    }),
  }),
});

export const {
  // Regular Assessments
  useGetAssessmentsQuery,
  useLazyGetAssessmentsQuery,
  useGetAssessmentByIdQuery,
  useLazyGetAssessmentByIdQuery,
  useLazyGetAssessmentCandidatesByStatusQuery,
  useGetAssessmentDetailPageQuery,
  useLazyGetAssessmentDetailPageQuery,
  useCreateAssessmentMutation,
  useUpdateAssessmentMutation,
  useBulkDeleteAssessmentsMutation,
  useAssignAssessmentMutation,
  useUnassignAssessmentMutation,
  // AI Assessments
  useGetAiAssessmentsQuery,
  useLazyGetAiAssessmentsQuery,
  useGetAiAssessmentByIdQuery,
  useLazyGetAiAssessmentByIdQuery,
  useCreateAiAssessmentMutation,
  useUpdateAiAssessmentMutation,
  useBulkDeleteAiAssessmentsMutation,
  useAssignAiAssessmentMutation,
  useUnassignAiAssessmentMutation,
  useLazyGetHardcodedQuestionsQuery,
  useDeleteAiAssessmentCandidateMutation,
  // Categories
  useGetCategoriesQuery,
  // Results
  useGetAssessmentResultsQuery,
  useLazyGetAssessmentResultsQuery,
  useGetCandidateAssessmentResultQuery,
  // Candidate-side
  useLazyTakeAssessmentQuery,
  useSubmitAssessmentMutation,
  useSaveAnswerMutation,
  useGetCandidateResultQuery,
  useLazyGetCandidateResultQuery,
  useSubmitCandidateFeedbackMutation,
  // AI Candidate-side
  useGetAiIntroductionQuery,
  useLazyGetAiIntroductionQuery,
  useSubmitAiIntroductionMutation,
  useSaveAiAnswerMutation,
  useSubmitAiAssessmentMutation,
  useLazyCheckAiAssessmentStatusQuery,
  useGetPresignedUrlMutation,
  useUploadVideoChunkMutation,
  useGetVideoPartUrlMutation,
  useCompleteMultipartUploadMutation,
  useUploadVideoMutation,
  useUploadVideoFormMutation,
  useUploadAudioMutation,
  useGetSignedUrlMutation,
  // AI Candidate-side (additional)
  useLazyTakeAiAssessmentQuery,
  useLazyCheckQuestionsReadyQuery,
  usePrepareQuestionsAsyncMutation, 
  useSaveProctoringIncidentMutation,
  // AI Assessment Results (admin)
  useLazyGetAiAssessmentResultsQuery,
  useLazyGetAiAssessmentCandidateReportQuery,
  usePatchAdminFeedbackMutation,
  useLazyGetAiInterviewResultsQuery,
  // Assessment Questions (admin)
  useLazyGetAssessmentQuestionsQuery,
  useLazyGetQuestionsByRuleQuery,
  useSendAssessmentEmailsMutation,
  useAutofillAssessmentQuestionsMutation,
  // Misc admin
  useSendReminderEmailMutation,
  // Introduction uploads
  useGetPresignedUrlIntroMutation,
  useUploadIntroductionVideoMutation,
  // Dashboard
  useGetAdminDashboardQuery,
  useLazyGetAdminDashboardQuery,
  useLazyGetAssessmentCandidatesWithScoreQuery,
} = assessmentsApi;
