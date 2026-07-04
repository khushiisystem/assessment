import { createApi } from "@reduxjs/toolkit/query/react";
import { fetchBaseQuery } from "./baseQuery";

export interface Organization {
  id: number;
  name: string;
  legal_name?: string;
  short_name?: string;
  organization_type: string;
  description?: string;
  logo_url?: string;
  founded_date?: string;
  status: string;
  primary_email?: string;
  secondary_email?: string;
  phone?: string;
  alternate_phone?: string;
  toll_free?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  slug: string;
  is_active: boolean;
  candidate_limit?: number | null;
  candidates_count?: number;
  created_at: string;
  updated_at: string;
}

export const organizationsApi = createApi({
  reducerPath: 'organizationsApi',
  baseQuery: fetchBaseQuery,
  tagTypes: ['Organization'],
  endpoints: (builder) => ({
  getOrganizations: builder.query<Organization[], void>({
  query: () => ({ url: 'api/organizations/' }),  // ← sirf yeh badla
  providesTags: ['Organization'],
  transformResponse: (response: any) =>
    Array.isArray(response) ? response : response?.results ?? [],
}),

    // Register a new organization (Super Admin). Backend gates POST to IsSuperAdmin.
    createOrganization: builder.mutation<Organization, Partial<Organization>>({
      query: (data) => ({
        url: 'api/organizations/',
        method: 'POST',
        data,
      }),
      invalidatesTags: ['Organization'],
    }),

    // Update an organization — used for enable/disable (`status`) and profile edits.
    updateOrganization: builder.mutation<Organization, { id: number; data: Partial<Organization> }>({
      query: ({ id, data }) => ({
        url: `api/organizations/${id}/`,
        method: 'PATCH',
        data,
      }),
      invalidatesTags: ['Organization'],
    }),

    deleteOrganization: builder.mutation<void, number>({
      query: (id) => ({
        url: `api/organizations/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Organization'],
    }),

    // Invite (or attach) the first/admin user for an organization. Returns a
    // signed invite link the super admin can share; email is sent best-effort.
    inviteOrgAdmin: builder.mutation<
      { detail: string; email: string; invite_link: string; email_sent: boolean },
      { id: number; data: { email: string; first_name?: string; last_name?: string } }
    >({
      query: ({ id, data }) => ({
        url: `api/organizations/${id}/invite-admin/`,
        method: 'POST',
        data,
      }),
      invalidatesTags: ['Organization'],
    }),
  }),
});

export const {
  useGetOrganizationsQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationMutation,
  useDeleteOrganizationMutation,
  useInviteOrgAdminMutation,
} = organizationsApi;
