import { createApi } from "@reduxjs/toolkit/query/react";
import { fetchBaseQuery } from "./baseQuery";

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery,
  endpoints: (builder) => ({
    login: builder.mutation<any, { email: string; password: string }>({
      query: (credentials) => ({
        url: "/api/auth/login",
        method: "POST",
        data: credentials,
      }),
    }),
    googleLogin: builder.query<any, void>({
      query: () => ({ url: "/api/auth/google/login" }),
    }),
    googleCallback: builder.query<any, string>({
      query: (callbackUrl) => ({ url: callbackUrl }),
    }),
    register: builder.mutation<any, FormData>({
      query: (formData) => ({
        url: "/register/",
        method: "POST",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    }),
    verifyOtp: builder.mutation<any, { otpId: string; otp_code: string }>({
      query: ({ otpId, otp_code }) => ({
        url: `/verify-otp/${otpId}/`,
        method: "POST",
        data: { otp_code },
      }),
    }),
    resendOtp: builder.mutation<any, string>({
      query: (otpId) => ({
        url: `/resend-otp/${otpId}/`,
        method: "POST",
      }),
    }),
    forgotPassword: builder.mutation<any, { contact: string }>({
      query: (data) => ({
        url: "/forgot-password/",
        method: "POST",
        data,
      }),
    }),
    verifyResetOtp: builder.mutation<any, { otpId: string; otp_code: string }>({
      query: ({ otpId, otp_code }) => ({
        url: `/verify-reset-otp/${otpId}/`,
        method: "POST",
        data: { otp_code },
      }),
    }),
    resetPassword: builder.mutation<any, { otpId: string; new_password: string; confirm_password: string }>({
      query: ({ otpId, ...data }) => ({
        url: `/reset-password/${otpId}/`,
        method: "POST",
        data,
      }),
    }),
    getProfile: builder.query<any, void>({
      query: () => ({ url: "/profile/" }),
    }),
    getMySubscription: builder.query<any, void>({
      query: () => ({ url: "/api/subscription/me/" }),
    }),
    updateProfile: builder.mutation<any, FormData>({
      query: (formData) => ({
        url: "/profile/",
        method: "PUT",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    }),
    changePassword: builder.mutation<any, { current_password: string; new_password: string; confirm_password: string }>({
      query: (data) => ({
        url: "/change-password/",
        method: "POST",
        data,
      }),
    }),
    // Org-admin invite: validate token → render set-password page.
    acceptInviteInfo: builder.query<any, string>({
      query: (token) => ({ url: `/api/auth/accept-invite/info?token=${encodeURIComponent(token)}` }),
    }),
    // Org-admin invite: set password → returns login tokens (auto-login).
    acceptInvite: builder.mutation<any, { token: string; password: string }>({
      query: (data) => ({
        url: "/api/auth/accept-invite",
        method: "POST",
        data,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useLazyGoogleLoginQuery,
  useLazyGoogleCallbackQuery,
  useRegisterMutation,
  useVerifyOtpMutation,
  useResendOtpMutation,
  useForgotPasswordMutation,
  useVerifyResetOtpMutation,
  useResetPasswordMutation,
  useGetProfileQuery,
  useLazyGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useAcceptInviteInfoQuery,
  useAcceptInviteMutation,
  useGetMySubscriptionQuery,
} = authApi;
