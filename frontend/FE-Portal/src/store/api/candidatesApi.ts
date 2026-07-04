import { createApi } from "@reduxjs/toolkit/query/react";
import { fetchBaseQuery } from "./baseQuery";

export const candidatesApi = createApi({
  reducerPath: "candidatesApi",
  baseQuery: fetchBaseQuery,
  keepUnusedDataFor: 300,
  tagTypes: ["Candidates", "CandidateDetail"],
  endpoints: (builder) => ({
    getCandidates: builder.query<any, string>({
      query: (endpoint) => ({ url: endpoint }),
      providesTags: ["Candidates"],
    }),
    getCandidatesByTechnology: builder.query<any, string>({
        query: (endpoint) => ({ url: endpoint }),
        providesTags: ["Candidates"],
    }),
    getCandidateDetails: builder.query<any, number>({
      query: (id) => ({ url: `/my-admin/candidates/${id}/details/` }),
      providesTags: (_r, _e, id) => [{ type: "CandidateDetail", id }],
    }),
    getCandidateResume: builder.query<any, number>({
      query: (id) => ({ url: `/my-admin/candidates/${id}/resume/` }),
    }),
    addCandidate: builder.mutation<any, FormData>({
      query: (data) => ({
        url: "/my-admin/candidates/add/",
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
      invalidatesTags: ["Candidates"],
    }),
    deleteCandidate: builder.mutation<any, number>({
      query: (id) => ({
        url: `/candidates/${id}/delete/`,
        method: "DELETE",
      }),
      invalidatesTags: ["Candidates"],
    }),
    bulkDeleteCandidates: builder.mutation<any, number[]>({
      query: (candidate_ids) => ({
        url: "/candidates/bulk-delete/",
        method: "POST",
        data: { candidate_ids },
      }),
      invalidatesTags: ["Candidates"],
    }),
    exportCandidates: builder.query<Blob, void>({
      query: () => ({
        url: "/my-admin/export/candidates/",
        responseType: "blob",
      }),
    }),
    quickAssignAssessment: builder.mutation<any, { userId: number; data: any }>({
      query: ({ userId, data }) => ({
        url: `/candidates/${userId}/quick-assign/`,
        method: "POST",
        data,
      }),
      invalidatesTags: ["CandidateDetail"],
    }),
  }),
});

export const {
  useGetCandidatesQuery,
  useLazyGetCandidatesQuery,
  useGetCandidateDetailsQuery,
  useLazyGetCandidateDetailsQuery,
  useLazyGetCandidateResumeQuery,
  useAddCandidateMutation,
  useDeleteCandidateMutation,
  useBulkDeleteCandidatesMutation,
  useLazyExportCandidatesQuery,
  useQuickAssignAssessmentMutation,
  useLazyGetCandidatesByTechnologyQuery,
} = candidatesApi;
