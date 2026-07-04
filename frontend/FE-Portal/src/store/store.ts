import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import authReducer from "./slices/authSlice";
import { authApi } from "./api/authApi";
import { candidatesApi } from "./api/candidatesApi";
import { assessmentsApi } from "./api/assessmentsApi";
import { questionsApi } from "./api/questionsApi";
import { technologiesApi } from "./api/technologiesApi";
import { organizationsApi } from "./api/organizationsApi";
import { mockInterviewApi } from "./api/mockInterviewApi";
import { bulkUploadApi } from "./api/bulkUploadApi";

export const store = configureStore({
  reducer: {
    // Global state slices
    auth: authReducer,
    // API slices
    [authApi.reducerPath]: authApi.reducer,
    [candidatesApi.reducerPath]: candidatesApi.reducer,
    [assessmentsApi.reducerPath]: assessmentsApi.reducer,
    [questionsApi.reducerPath]: questionsApi.reducer,
    [technologiesApi.reducerPath]: technologiesApi.reducer,
    [organizationsApi.reducerPath]: organizationsApi.reducer,
    [mockInterviewApi.reducerPath]: mockInterviewApi.reducer,
    [bulkUploadApi.reducerPath]: bulkUploadApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(authApi.middleware)
      .concat(candidatesApi.middleware)
      .concat(assessmentsApi.middleware)
      .concat(questionsApi.middleware)
      .concat(technologiesApi.middleware)
      .concat(organizationsApi.middleware)
      .concat(mockInterviewApi.middleware)
      .concat(bulkUploadApi.middleware),
});

// Enable refetchOnFocus / refetchOnReconnect
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
