import { createApi } from "@reduxjs/toolkit/query/react";
import { fetchBaseQuery } from "./baseQuery";

export const mockInterviewApi = createApi({
  reducerPath: "mockInterviewApi",
  baseQuery: fetchBaseQuery,
  keepUnusedDataFor: 300,
  tagTypes: ["MockSessions", "MockQuestions", "MockTemplates", "MockCandidates", "MockStacks"],
  endpoints: (builder) => ({
    // Sessions
    getSessions: builder.query<any, string | void>({
      query: (params) => ({
        url: `/api/mock-interview/sessions/${params ? `?${params}` : ""}`,
      }),
      providesTags: ["MockSessions"],
    }),
    getSessionById: builder.query<any, number>({
      query: (id) => ({ url: `/api/mock-interview/sessions/${id}/` }),
      providesTags: (_r, _e, id) => [{ type: "MockSessions", id }],
    }),
    createSession: builder.mutation<any, any>({
      query: (data) => ({
        url: "/api/mock-interview/sessions/",
        method: "POST",
        data,
      }),
      invalidatesTags: ["MockSessions"],
    }),
    updateSession: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `api/mock-interview/sessions/${id}/`,
        method: "PUT",
        data,
      }),
      invalidatesTags: ["MockSessions"],
    }),
    deleteSession: builder.mutation<any, number>({
      query: (id) => ({
        url: `/api/mock-interview/sessions/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["MockSessions"],
    }),
    bulkDeleteSessions: builder.mutation<any, any>({
      query: (ids) => ({
        url: "/api/mock-interview/sessions/bulk-delete/",
        method: "POST",
        data: ids,
      }),
      invalidatesTags: ["MockSessions"],
    }),

    // Questions
    getMockQuestions: builder.query<any, void>({
      query: () => ({ url: "/api/mock-interview/questions/" }),
      providesTags: ["MockQuestions"],
    }),
    createMockQuestion: builder.mutation<any, any>({
      query: (data) => ({
        url: "/api/mock-interview/questions/",
        method: "POST",
        data,
      }),
      invalidatesTags: ["MockQuestions"],
    }),
    updateMockQuestion: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/api/mock-interview/questions/${id}/`,
        method: "PUT",
        data,
      }),
      invalidatesTags: ["MockQuestions"],
    }),
    deleteMockQuestion: builder.mutation<any, number>({
      query: (id) => ({
        url: `/api/mock-interview/questions/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["MockQuestions"],
    }),
    bulkDeleteMockQuestions: builder.mutation<any, any>({
      query: (ids) => ({
        url: "/api/mock-interview/questions/bulk-delete/",
        method: "POST",
        data: ids,
      }),
      invalidatesTags: ["MockQuestions"],
    }),
    bulkCreateMockQuestions: builder.mutation<any, any[]>({
      query: (questions) => ({
        url: "/api/mock-interview/questions/bulk/",
        method: "POST",
        data: questions,
      }),
      invalidatesTags: ["MockQuestions"],
    }),

    // Templates
    getTemplates: builder.query<any, void>({
      query: () => ({ url: "/api/mock-interview/templates/" }),
      providesTags: ["MockTemplates"],
    }),
    createTemplate: builder.mutation<any, any>({
      query: (data) => ({
        url: "/api/mock-interview/templates/",
        method: "POST",
        data,
      }),
      invalidatesTags: ["MockTemplates"],
    }),
    updateTemplate: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/api/mock-interview/templates/${id}/`,
        method: "PUT",
        data,
      }),
      invalidatesTags: ["MockTemplates"],
    }),
    deleteTemplate: builder.mutation<any, number>({
      query: (id) => ({
        url: `/api/mock-interview/templates/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["MockTemplates"],
    }),

    // Candidates
    getMockCandidates: builder.query<any, void>({
      query: () => ({ url: "/api/mock-interview/candidates/" }),
      providesTags: ["MockCandidates"],
    }),
    deleteMockCandidate: builder.mutation<any, number>({
      query: (id) => ({
        url: `/api/mock-interview/candidates/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["MockCandidates"],
    }),
    getCandidateAnalytics: builder.query<any, number>({
      query: (candidateId) => ({
        url: `/api/mock-interview/analytics/candidate/${candidateId}/`,
      }),
    }),

    // Stacks
    getStacks: builder.query<any, void>({
      query: () => ({ url: "/api/mock-interview/stacks/" }),
      providesTags: ["MockStacks"],
    }),

    // Candidate-side
    getCandidateMockInterviews: builder.query<any, string>({
      query: (endpoint) => ({ url: endpoint }),
    }),
  }),
});

export const {
  // Sessions
  useGetSessionsQuery,
  useLazyGetSessionsQuery,
  useGetSessionByIdQuery,
  useLazyGetSessionByIdQuery,
  useCreateSessionMutation,
  useUpdateSessionMutation,
  useDeleteSessionMutation,
  useBulkDeleteSessionsMutation,
  // Questions
  useGetMockQuestionsQuery,
  useLazyGetMockQuestionsQuery,
  useCreateMockQuestionMutation,
  useUpdateMockQuestionMutation,
  useDeleteMockQuestionMutation,
  useBulkDeleteMockQuestionsMutation,
  useBulkCreateMockQuestionsMutation,
  // Templates
  useGetTemplatesQuery,
  useLazyGetTemplatesQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  // Candidates
  useGetMockCandidatesQuery,
  useLazyGetMockCandidatesQuery,
  useDeleteMockCandidateMutation,
  useGetCandidateAnalyticsQuery,
  useLazyGetCandidateAnalyticsQuery,
  // Stacks
  useGetStacksQuery,
  // Candidate-side
  useGetCandidateMockInterviewsQuery,
  useLazyGetCandidateMockInterviewsQuery,
} = mockInterviewApi;
