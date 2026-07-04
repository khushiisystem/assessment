import { createApi } from "@reduxjs/toolkit/query/react";
import { fetchBaseQuery } from "./baseQuery";

export const questionsApi = createApi({
  reducerPath: "questionsApi",
  baseQuery: fetchBaseQuery,
  tagTypes: ["Questions", "QuestionDetail", "SqlDatasets", "AiMockQuestions"],
  endpoints: (builder) => ({
    addAiMockQuestion: builder.mutation<any, any>({
    query: (data) => ({
      url: "/my-admin/ai-assessments/hardcoded-questions/create/",  //  Change to this
      method: "POST",
      data,
    }),
    invalidatesTags: ["AiMockQuestions"],
  }),
 
    deleteAiMockQuestion: builder.mutation<any, number>({
      query: (id) => ({
        url: `/my-admin/ai-assessments/mock-questions/${id}/delete/`,
        method: "DELETE",
    }),
    invalidatesTags: ["AiMockQuestions"],
  }),

    getQuestions: builder.query<any, string>({
      query: (endpoint) => ({ url: endpoint }),
      providesTags: ["Questions"],
    }),
    getQuestionById: builder.query<any, number>({
      query: (id) => ({ url: `/my-admin/questions/${id}/` }),
      providesTags: (_r, _e, id) => [{ type: "QuestionDetail", id }],
    }),
    addQuestion: builder.mutation<any, any>({
      query: (data) => ({
        url: "/my-admin/questions/add/",
        method: "POST",
        data,
      }),
      invalidatesTags: ["Questions"],
    }),
    updateQuestion: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({
        url: `/my-admin/questions/${id}/edit/`,
        method: "PUT",
        data,
      }),
      invalidatesTags: ["Questions", "QuestionDetail"],
    }),
    deleteQuestion: builder.mutation<any, number>({
      query: (id) => ({
        url: `/my-admin/questions/${id}/delete/`,
        method: "DELETE",
      }),
      invalidatesTags: ["Questions"],
    }),
    bulkDeleteQuestions: builder.mutation<any, number[]>({
      query: (question_ids) => ({
        url: "/questions/bulk-delete/",
        method: "POST",
        data: { question_ids },
      }),
      invalidatesTags: ["Questions"],
    }),
    exportQuestions: builder.query<Blob, void>({
      query: () => ({
        url: "/my-admin/export/questions/",
        responseType: "blob",
      }),
    }),
    // SQL
    getSqlDatasets: builder.query<any, void>({
      query: () => ({ url: "/my-admin/sql-datasets/" }),
      providesTags: ["SqlDatasets"],
    }),
    createSqlDataset: builder.mutation<any, any>({
      query: (data) => ({
        url: "/my-admin/sql/dataset/create/",
        method: "POST",
        data,
      }),
      invalidatesTags: ["SqlDatasets"],
    }),
    runSql: builder.mutation<any, any>({
      query: (data) => ({
        url: "/api/sql/run/",
        method: "POST",
        data,
      }),
    }),
    gradeSql: builder.mutation<any, any>({
      query: (data) => ({
        url: "/api/sql/grade/",
        method: "POST",
        data,
      }),
    }),
 getAiMockQuestions: builder.query<any, { stack?: string; page?: number; page_size?: number ;  difficulty?: string; search?: string} | undefined>({
    query: (params) => ({
      url: "/my-admin/ai-assessments/hardcoded-questions/",
      params: params,
    }),
    providesTags: ["AiMockQuestions"], 
    }),

getAiMockQuestionById: builder.query<any, number>({
    query: (id) => ({ url: `/my-admin/ai-assessments/mock-questions/${id}/` }),
}),

updateAiMockQuestion: builder.mutation<any, { id: number; data: any }>({
    query: ({ id, data }) => ({
        url: `/my-admin/ai-assessments/mock-questions/${id}/`,
        method: "PUT",
        data,
    }),
}),

getStacks: builder.query<any, void>({
  query: () => ({
    url: "/v1/api/mock-interview/stacks/",
  }),
}),
    runCode: builder.mutation<any, any>({
      query: (data) => ({
        url: "/api/run-code/",
        method: "POST",
        data,
      }),
    }),
  }),
});

export const {
  useGetQuestionsQuery,
  useLazyGetQuestionsQuery,
  useGetQuestionByIdQuery,
  useLazyGetQuestionByIdQuery,
  useAddQuestionMutation,
  useUpdateQuestionMutation,
  useDeleteQuestionMutation,
  useBulkDeleteQuestionsMutation,
  useLazyExportQuestionsQuery,
  useGetSqlDatasetsQuery,
  useCreateSqlDatasetMutation,
  useRunSqlMutation,
  useGradeSqlMutation,
  useRunCodeMutation,
  useLazyGetAiMockQuestionsQuery,
  useLazyGetAiMockQuestionByIdQuery,
  useUpdateAiMockQuestionMutation,
  useAddAiMockQuestionMutation, 
  useGetStacksQuery,
  useDeleteAiMockQuestionMutation, // ✅ Yeh add karo
} = questionsApi;
