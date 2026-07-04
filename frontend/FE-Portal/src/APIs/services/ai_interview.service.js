import { performRequest } from "../performRequest";
import { apiEndPoints, methodType } from "../apiConfig";

/* =========================
   START INTERVIEW
========================= */
export const startInterview = async (data = {}) => {
  const response = await performRequest(
    methodType.POST,
    apiEndPoints.START_INTERVIEW,
    data,
    false,
    false,
  );

  return response.data;
};

// Add to ai_interview.service.js
export const getSession = async (sessionId) => {
  const response = await performRequest(
    methodType.GET,
    apiEndPoints.GET_SESSION(sessionId),
    {},
    false,
    false,
  );
  return response.data;
};

/* =========================
   GET ROLES
========================= */
export const getRoles = async () => {
  const response = await performRequest(
    methodType.GET,
    apiEndPoints.GET_ROLES,
    {},
    false,
    false,
  );

  return response.data;
};

/* =========================
   PARSE RESUME
========================= */
export const parseResume = async (file) => {
  const formData = new FormData();

  formData.append("resume", file, file.name);

  const response = await performRequest(
    methodType.POST,
    apiEndPoints.PARSE_RESUME,
    formData,
    false,
    true,
  );

  return response.data.resume_data;
};

/* =========================
   GET INTERVIEW INTRO
========================= */
export const getInterviewIntro = async (sessionId) => {
  const response = await performRequest(
    methodType.GET,
    apiEndPoints.GET_INTERVIEW_INTRO(sessionId),
    {},
    false,
    false,
  );
  return response.data;
};

export const transcribeAudio = async (data, sessionId) => {
  const response = await performRequest(
    methodType.POST,
    apiEndPoints.TRANSCRIBE_AUDIO(sessionId),
    data,
    false,
    true, // form data
  );

  return response.data;
};

/* =========================
   SUBMIT ANSWER
========================= */
export const submitAnswer = async (sessionId, answer) => {
  const response = await performRequest(
    methodType.POST,
    apiEndPoints.SUBMIT_ANSWER(sessionId),
    { answer },
    false,
    false,
  );

  return response.data;
};
