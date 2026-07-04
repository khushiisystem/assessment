import { createApi } from "@reduxjs/toolkit/query/react";
import { fetchBaseQuery } from "./baseQuery";

export const technologiesApi = createApi({
  reducerPath: "technologiesApi",
  baseQuery: fetchBaseQuery,
  keepUnusedDataFor: 300, // 5 min cache
  tagTypes: ["Technologies", "TechnologyDetail", "Assignments", "Progress", "Completions"],
  endpoints: (builder) => ({
    getTechnologies: builder.query<any,{ page?: number; page_size?: number; search?: string; category?: string } | any>({
    query: (params) => {
    const p = params ?? {};
    const queryParams = new URLSearchParams();
    queryParams.set("page", String(p.page ?? 1));
    if (p.page_size) queryParams.set("page_size", String(p.page_size));
    if (p.search) queryParams.set("search", p.search);
    if (p.category) queryParams.set("category", p.category);
    return { url: `/api/technologies/?${queryParams.toString()}` };
  },
  providesTags: ["Technologies"],
}),
    getTechnologyById: builder.query<any, any>({
      query: (id) => ({ url: `api/technologies/${id}/` }),
      providesTags: (_r, _e, id) => [{ type: "TechnologyDetail", id }],
    }),
    getTechnologyQuestions: builder.query<any, string>({
      query: (url) => ({ url }),
    }),
    createTechnology: builder.mutation<any, FormData | any>({
      query: (data) => ({
        url: "/api/technologies/",
        method: "POST",
        data,
      }),
      invalidatesTags: ["Technologies"],
    }),
    updateTechnology: builder.mutation<any, { id: number; data: FormData | any }>({
      query: ({ id, data }) => ({
        url: `/api/technologies/${id}/`,
        method: "PATCH",
        data,
      }),
      invalidatesTags: ["Technologies", "TechnologyDetail"],
    }),
    deleteTechnology: builder.mutation<any, number>({
      query: (id) => ({
        url: `/api/technologies/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["Technologies"],
    }),
    bulkDeleteTechnologies: builder.mutation<any, number[]>({
      query: (technology_ids) => ({
        url: "/api/technologies/bulk-delete/",
        method: "POST",
        data: { technology_ids },
      }),
      invalidatesTags: ["Technologies"],
    }),

    // Assignments
    createAssignment: builder.mutation<any, any>({
      query: (data) => ({
        url: "api/assignments/",
        method: "POST",
        data,
      }),
      invalidatesTags: ["Assignments"],
    }),
    deleteAssignment: builder.mutation<any, number>({
      query: (id) => ({
        url: `/api/assignments/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["Assignments"],
    }),
    unassignAssignment: builder.mutation<any, number>({
      query: (id) => ({
        url: `/api/assignments/${id}/unassign/`,
        method: "POST",
      }),
      invalidatesTags: ["Assignments"],
    }),

    updateAssignmentDueDate: builder.mutation<any, { assignmentId: number; due_at: string }>({
      query: ({ assignmentId, due_at }) => ({
        url: `api/assignments/${assignmentId}/update-due-date/`,
        method: "PATCH",
        data: { due_at },
      }),
      invalidatesTags: ["Assignments"],
    }),

    // Progress & Completions
    getProgress: builder.query<any, void>({
      query: () => ({ url: "/api/progress/" }),
      providesTags: ["Progress"],
    }),
    getCompletions: builder.query<any, string>({
      query: (endpoint) => ({ url: endpoint }),
      providesTags: ["Completions"],
    }),
    createCompletion: builder.mutation<any, any>({
      query: (data) => ({
        url: "/api/completions/",
        method: "POST",
        data,
      }),
      invalidatesTags: ["Progress", "Completions"],
    }),
    completeModule: builder.mutation<any, { url: string; data: any }>({
      query: ({ url, data }) => ({ url, method: "POST", data }),
      invalidatesTags: ["Progress"],
    }),

    sendCourseCompleteEmail: builder.mutation<any, any>({
      query: (data) => ({
      url: "/api/course-complete-email/",
      method: "POST",
      data,
    }),
    }), 

    // Question Template
    downloadQuestionTemplate: builder.query<Blob, void>({
      query: () => ({
        url: "/api/questions/template/download/",
        responseType: "blob",
      }),
    }),
    uploadQuestions: builder.mutation<any, { technologyId: any; data: FormData }>({
      query: ({ technologyId, data }) => ({
        url: `/api/technologies/${technologyId}/questions/import/`,
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    }),
    addTechQuestion: builder.mutation<any, { technologyId: any; data: any }>({
      query: ({ technologyId, data }) => ({
        url: `api/technologies/${technologyId}/questions/`,
        method: "POST",
        data,
      }),
    }),
    updateTechQuestion: builder.mutation<any, { technologyId: any; questionId: number; data: any }>({
      query: ({ technologyId, questionId, data }) => ({
        url: `api/technologies/${technologyId}/questions/${questionId}/`,
        method: "PATCH",
        data,
      }),
    }),
    deleteTechQuestion: builder.mutation<any, { technologyId: any; questionId: number }>({
      query: ({ technologyId, questionId }) => ({
        url: `api/technologies/${technologyId}/questions/${questionId}/`,
        method: "DELETE",
      }),
    }),

    // Assign Study Materials (generic endpoint)
    getAssignmentsForCandidate: builder.query<any, string>({
      query: (endpoint) => ({ url: endpoint }),
      providesTags: ["Assignments"],
    }),

    getTechnologyCandidates: builder.query<any, number>({
      query: (technologyId) => ({ url: `/api/technologies/${technologyId}/candidates/` }),
      providesTags: ["Assignments"],
    }),
    getAllCandidatesActivity: builder.query<any, { page: number; page_size: number }>({
      query: ({ page, page_size }) => ({
        url: `/api/activities/?page=${page}&page_size=${page_size}`,
      }),
      providesTags: ["Assignments"],
    }),
  }),
});
  
export const {
  useGetTechnologiesQuery,
  useLazyGetTechnologiesQuery,
  useGetTechnologyByIdQuery,
  useLazyGetTechnologyByIdQuery,
  useGetTechnologyQuestionsQuery,
  useLazyGetTechnologyQuestionsQuery,
  useCreateTechnologyMutation,
  useUpdateTechnologyMutation,
  useDeleteTechnologyMutation,
  useBulkDeleteTechnologiesMutation,
  useCreateAssignmentMutation,
  useDeleteAssignmentMutation,
  useUnassignAssignmentMutation,
  useGetProgressQuery,
  useLazyGetProgressQuery,
  useLazyGetCompletionsQuery,
  useCreateCompletionMutation,
  useCompleteModuleMutation,
  useSendCourseCompleteEmailMutation,
  useLazyDownloadQuestionTemplateQuery,
  useUploadQuestionsMutation,
  useAddTechQuestionMutation,
  useUpdateTechQuestionMutation,
  useDeleteTechQuestionMutation,
  useGetAssignmentsForCandidateQuery,
  useLazyGetAssignmentsForCandidateQuery,
  useGetTechnologyCandidatesQuery,
  useLazyGetTechnologyCandidatesQuery,
  useGetAllCandidatesActivityQuery,
  useLazyGetAllCandidatesActivityQuery,
  useUpdateAssignmentDueDateMutation,
} = technologiesApi;
