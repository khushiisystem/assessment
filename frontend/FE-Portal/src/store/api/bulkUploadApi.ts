import { createApi } from "@reduxjs/toolkit/query/react";
import { fetchBaseQuery } from "./baseQuery";

export const bulkUploadApi = createApi({
  reducerPath: "bulkUploadApi",
  baseQuery: fetchBaseQuery,
  endpoints: (builder) => ({
    bulkUpload: builder.mutation<any, { endpoint: string; data: FormData; onUploadProgress?: (e: any) => void }>({
      query: ({ endpoint, data }) => ({
        url: endpoint,
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    }),
    downloadTemplate: builder.query<Blob, { baseUrl: string; format: string }>({
      query: ({ baseUrl, format }) => ({
        url: `${baseUrl}${format}/`,
        responseType: "blob",
      }),
    }),
  }),
});

export const {
  useBulkUploadMutation,
  useLazyDownloadTemplateQuery,
} = bulkUploadApi;
