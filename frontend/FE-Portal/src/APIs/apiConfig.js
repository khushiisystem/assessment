export const methodType = {
  PUT: "put",
  GET: "get",
  POST: "post",
  DELETE: "delete",
  PATCH: "patch",
};

export const apiEndPoints = {

  START_INTERVIEW: '/api/interview/start/',
  GET_ROLES: '/api/interview/roles/',
  PARSE_RESUME: '/api/interview/parse-resume/',
  TRANSCRIBE_AUDIO: '/api/interview/transcribe/',

  SUBMIT_ANSWER: (sessionId) =>
    `/api/interview/${sessionId}/answer/`,

  GET_SESSION: (sessionId) =>
    `/api/interview/${sessionId}/`,

  GET_INTERVIEW_INTRO: (sessionId) =>
    `/api/interview/${sessionId}/intro/`,
};
