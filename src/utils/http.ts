/**
 * 网络请求重试封装：上游（深交所/东财）偶发 502 / 连接重置时自动重试一次。
 * 仅对网络层与 5xx 重试，4xx（参数/鉴权问题）直接抛出。
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 600): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    const retriable = /HTTP 5\d\d|failed to fetch|network|reset|timeout|aborted/i.test(msg) || !(err instanceof Error);
    if (!retriable) throw err;
    await new Promise((r) => setTimeout(r, delayMs));
    return fn();
  }
}

/** fetch + 状态码检查，非 2xx 抛错（供 withRetry 包装）。 */
export async function fetchOk(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}
