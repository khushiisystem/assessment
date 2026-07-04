const API_BASE = (() => {
  const raw = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/v1/";
  return raw.replace(/\/+$/, "");
})();

const BASE = `${API_BASE}/api/interview`;

export async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

export async function get(url) {
  const res = await fetch(url);

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

export async function postForm(url, formData) {
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

export async function transcribeAudio(blob) {
  const form = new FormData();

  form.append("audio", blob, "recording.webm");

  const res = await fetch(
    `${BASE}/transcribe/`,
    {
      method: "POST",
      body: form,
    }
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data.text ?? "";
}

export async function parseResume(file) {
  const form = new FormData();

  form.append("resume", file, file.name);

  const res = await fetch(
    `${BASE}/parse-resume/`,
    {
      method: "POST",
      body: form,
    }
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data.resume_data;
}

export const api = {
  startInterview: (payload) =>
    post(`${BASE}/start/`, payload),

  submitAnswer: (sessionId, answer) =>
    post(`${BASE}/${sessionId}/answer/`, { answer }),

  endInterview: (sessionId) =>
    post(`${BASE}/${sessionId}/end/`, {}),

  getSession: (sessionId) =>
    get(`${BASE}/${sessionId}/`),

  getInterviewIntro: (sessionId) =>
    get(`${BASE}/${sessionId}/intro/`),

  getRoles: () =>
    get(`${BASE}/roles/`),

  uploadAnswerAudio: (sessionId, formData) =>
    postForm(`${BASE}/${sessionId}/upload-audio/`, formData),

  initializeInterviewVideoUpload: (sessionId, formData) =>
    postForm(`${BASE}/${sessionId}/get-video-upload-url/`, formData),

  uploadInterviewVideoChunk: (sessionId, formData) =>
    postForm(`${BASE}/${sessionId}/upload-video-chunk/`, formData),

  completeInterviewVideoUpload: (sessionId, payload) =>
    post(`${BASE}/${sessionId}/complete-video-upload/`, payload),
};
