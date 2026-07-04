import { store } from "@/store";
import { logout } from "@/store/slices/authSlice";
import { authApi } from "@/store/api/authApi";
import { candidatesApi } from "@/store/api/candidatesApi";
import { assessmentsApi } from "@/store/api/assessmentsApi";
import { questionsApi } from "@/store/api/questionsApi";
import { technologiesApi } from "@/store/api/technologiesApi";
import { mockInterviewApi } from "@/store/api/mockInterviewApi";
import { bulkUploadApi } from "@/store/api/bulkUploadApi";
import { tokenStorage } from "./tokenStorage";

const apiSlices = [
  authApi,
  candidatesApi,
  assessmentsApi,
  questionsApi,
  technologiesApi,
  mockInterviewApi,
  bulkUploadApi,
] as const;

export const clearSession = (delayMs = 150) => {
  window.setTimeout(() => {
    store.dispatch(logout());
    tokenStorage.clearAll();
    sessionStorage.clear();
    localStorage.removeItem("notifications_snoozed_until");

    for (const api of apiSlices) {
      store.dispatch(api.util.resetApiState());
    }
  }, delayMs);
};
