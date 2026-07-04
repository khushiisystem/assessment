const ACCESS_TOKEN_KEY = "accessToken";
const USER_KEY = "user";
const REFRESH_COOKIE_KEY = "zec_refresh_token";

const WEEK_IN_SECONDS = 60 * 60 * 24 * 7;

const isBrowser = typeof document !== "undefined";

const setCookie = (value: string, maxAge = WEEK_IN_SECONDS) => {
  if (!isBrowser) return;
  document.cookie = `${REFRESH_COOKIE_KEY}=${value}; path=/; max-age=${maxAge}; secure; samesite=strict`;
};

const getCookie = (): string | null => {
  if (!isBrowser) return null;
  const match = document.cookie
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${REFRESH_COOKIE_KEY}=`));

  return match ? decodeURIComponent(match.split("=")[1]) : null;
};

const clearCookie = () => {
  if (!isBrowser) return;
  document.cookie = `${REFRESH_COOKIE_KEY}=; path=/; max-age=0; secure; samesite=strict`;
};

export const tokenStorage = {
  getAccessToken: () => sessionStorage.getItem(ACCESS_TOKEN_KEY),

  setAccessToken: (token: string) => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  },

  clearAccessToken: () => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  },

  getUser: <T = unknown>() => {
    const userStr = sessionStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr) as T;
    } catch {
      sessionStorage.removeItem(USER_KEY);
      return null;
    }
  },

  setUser: (user: unknown) => {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearUser: () => {
    sessionStorage.removeItem(USER_KEY);
  },

  setRefreshToken: (token: string) => setCookie(token),

  getRefreshToken: () => getCookie(),

  clearRefreshToken: () => clearCookie(),

  clearAll: () => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    clearCookie();
  },
};

export type StoredUser = ReturnType<typeof tokenStorage.getUser>;

