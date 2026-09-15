export const API = `${import.meta.env.BASE_URL}api`;
export async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "X-Requested-With": "asset-manager",
      ...(!isForm && options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
    body:
      options.body && !isForm && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body,
  });
  const result = await response
    .json()
    .catch(() => ({ error: "服务器响应异常" }));
  if (!response.ok) {
    const error = new Error(result.error);
    error.details = result.details;
    error.status = response.status;
    if (response.status === 401 && path !== "/login" && path !== "/me")
      window.dispatchEvent(new Event("session-expired"));
    throw error;
  }
  return result;
}
