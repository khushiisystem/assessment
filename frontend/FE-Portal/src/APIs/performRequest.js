import axiosInstance from './apiClient';

export const performRequest = async (
  method,
  url,
  data = {},
  withToken = false,
  isFormData = false,
  responseType = 'json'
) => {
  const normalizedMethod = method.toLowerCase();

  const config = {
    method: normalizedMethod,
    url: url.replaceAll('#', '%23'),
    responseType,
    withToken,
    headers: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      'Content-Type': isFormData ? 'multipart/form-data' : 'application/json',
    },
  };

  if (['post', 'put', 'patch', 'delete'].includes(normalizedMethod)) {
    config.data = data;
  }

  if (normalizedMethod === 'get') {
    config.params = data;
  }

  return axiosInstance(config);
};
