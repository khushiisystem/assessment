import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import { tokenStorage } from "@/lib/tokenStorage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/v1/";
// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/v1/";

interface BaseQueryArgs {
  url: string;
  method?: string;
  data?: any;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  responseType?: "blob" | "json";
}

interface BaseQueryError {
  status?: number;
  data?: any;
  message?: string;
}

// Build full URL with query params
const buildUrl = (url: string, params?: Record<string, string | number | boolean | undefined>): string => {
  const base = url.startsWith("http") ? url : `${API_BASE_URL}${url.startsWith("/") ? url.slice(1) : url}`;
  if (!params) return base;
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) searchParams.append(key, String(val));
  });
  const qs = searchParams.toString();
  return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
};

// Build fetch RequestInit from args
const buildInit = (
  method: string,
  data: any,
  headers: Record<string, string>,
  responseType?: string
): RequestInit => {
  const init: RequestInit = { method, headers: { ...headers } };

  if (data !== undefined && data !== null) {
    if (data instanceof FormData) {
      init.body = data;
      // Let browser set Content-Type with boundary for FormData
      delete (init.headers as Record<string, string>)["Content-Type"];
    } else {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      init.body = JSON.stringify(data);
    }
  }

  return init;
};

// Parse response based on content type
const parseResponse = async (response: Response, responseType?: string): Promise<any> => {
  if (responseType === "blob") return response.blob();
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
const forceLogout = () => {
  tokenStorage.clearAll();
  // Only redirect if not already on a login/auth page
  const currentPath = window.location.pathname;
  if (!currentPath.startsWith("/login") && !currentPath.startsWith("/orglogin") && !currentPath.startsWith("/signup")) {
    window.location.href = "/login?reason=session_expired";
  }
};

// Token refresh with dedup
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        forceLogout();
        return null;
      }

      try {
        const res = await fetch(`${API_BASE_URL}api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (!res.ok) {
          forceLogout();
          return null;
        }

        const json = await res.json();
        if (json.access) {
          tokenStorage.setAccessToken(json.access);
          return json.access;
        }
        return null;
      } catch {
         forceLogout();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
};

/**
 * RTK Query baseQuery using native fetch.
 * Handles auth headers and automatic token refresh on 401.
 */
export const fetchBaseQuery: BaseQueryFn<BaseQueryArgs, unknown, BaseQueryError> =
  async ({ url, method = "GET", data, params, headers = {}, responseType }) => {
    const token = tokenStorage.getAccessToken();
    const user = tokenStorage.getUser<{ organization_id?: number | null }>();

    const makeRequest = async (accessToken: string | null) => {
      const authHeaders: Record<string, string> = {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(user?.organization_id ? { "X-Organization-Id": String(user.organization_id) } : {}),
        ...headers,
      };
      const fullUrl = buildUrl(url, params);
      const init = buildInit(method, data, authHeaders, responseType);
      return fetch(fullUrl, init);
    };

    try {
      let response = await makeRequest(token);

      // 401 → try refresh once
      if (response.status === 401) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          response = await makeRequest(newToken);
        }
      }

      const responseData = await parseResponse(response, responseType);

      if (!response.ok) {
        return {
          error: {
            status: response.status,
            data: responseData,
            message: typeof responseData?.detail === "string" ? responseData.detail : response.statusText,
          },
        };
      }

      return { data: responseData };
    } catch (err: any) {
      return {
        error: {
          status: undefined,
          data: undefined,
          message: err?.message || "Network error",
        },
      };
    }
  };

/**
 * Standalone upload with progress tracking via XMLHttpRequest.
 * Used for BulkUpload where progress callback is needed.
 */
const doXhrUpload = (
  url: string,
  formData: FormData,
  token: string | null,
  onUploadProgress?: (progress: number) => void
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fullUrl = buildUrl(url);
    xhr.open("POST", fullUrl);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (onUploadProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onUploadProgress(Math.round((e.loaded * 100) / e.total));
        }
      });
    }
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        let errorData: any;
        try {
          errorData = JSON.parse(xhr.responseText);
        } catch {
          errorData = xhr.responseText;
        }
        reject({ status: xhr.status, data: errorData, message: xhr.statusText });
      }
    });
    xhr.addEventListener("error", () => {
      reject({ status: undefined, data: undefined, message: "Network error" });
    });
    xhr.send(formData);
  });
};

export const uploadWithProgress = async (
  url: string,
  formData: FormData,
  onUploadProgress?: (progress: number) => void
): Promise<any> => {
  const token = tokenStorage.getAccessToken();
  try {
    return await doXhrUpload(url, formData, token, onUploadProgress);
  } catch (err: any) {
    if (err?.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) throw err;
      return await doXhrUpload(url, formData, newToken, onUploadProgress);
    }
    throw err;
  }
};