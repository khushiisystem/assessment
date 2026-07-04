import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { tokenStorage } from "@/lib/tokenStorage";

interface User {
  id?: string;
  email?: string;
  name?: string;
  role?: "super_admin" | "org_admin" | "manager" | "candidate" | string;
  organization_id?: number | null;
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

// Initialize from storage
const storedUser = tokenStorage.getUser<User>();
const storedToken = tokenStorage.getAccessToken();

const initialState: AuthState = {
  user: storedUser,
  accessToken: storedToken,
  isAuthenticated: !!(storedToken && storedUser),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: User; accessToken: string; refreshToken?: string }>) => {
      const { user, accessToken, refreshToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.isAuthenticated = true;
      // Persist
      tokenStorage.setAccessToken(accessToken);
      tokenStorage.setUser(user);
      if (refreshToken) tokenStorage.setRefreshToken(refreshToken);
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        tokenStorage.setUser(state.user);
      }
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      tokenStorage.clearAll();
    },
  },
});

export const { setCredentials, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;

// Selectors
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
// Staff who get the admin panel: super_admin, org_admin and manager.
export const selectIsAdmin = (state: { auth: AuthState }) => {
  const role = state.auth.user?.role;
  return role === "super_admin" || role === "org_admin" || role === "manager";
};
export const selectIsManager = (state: { auth: AuthState }) => state.auth.user?.role === "manager";
export const selectIsEmployee = (state: { auth: AuthState }) => state.auth.user?.role === "candidate";
