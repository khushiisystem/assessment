import { tokenStorage } from "@/lib/tokenStorage";

interface User {
  id?: string;
  email?: string;
  name?: string;
  role?: "super_admin" | "org_admin" | "manager" | "candidate" | string;
  organization_id?: number | null;
  [key: string]: any;
}

/**
 * Custom hook to check authentication status
 * Returns authentication state and user information
 * Reads from storage on each call to ensure fresh data
 */
export const useAuth = () => {
  const accessToken = tokenStorage.getAccessToken();
  const user = tokenStorage.getUser<User>();

  const isAuthenticated = !!(accessToken && user);

  return {
    isAuthenticated,
    user,
    accessToken,
    isAdmin: user?.role === "super_admin" || user?.role === "org_admin" || user?.role === "manager",
    isManager: user?.role === "manager",
    isEmployee: user?.role === "candidate",
  };
};

