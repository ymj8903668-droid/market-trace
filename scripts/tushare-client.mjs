const DEFAULT_API_URL = "https://api.tushare.pro";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createTushareClient({ token, apiUrl = DEFAULT_API_URL, fetchImpl = fetch }) {
  if (!token) throw new Error("TUSHARE_TOKEN is not configured");

  return async function query(apiName, params, fields) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetchImpl(apiUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ api_name: apiName, token, params, fields }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = new Error(`${apiName} returned HTTP ${response.status}`);
          error.retryable = response.status >= 500;
          throw error;
        }
        const payload = await response.json();
        if (payload.code !== 0) throw new Error(`${apiName}: ${payload.msg || `code ${payload.code}`}`);
        const fieldNames = payload.data?.fields || [];
        return (payload.data?.items || []).map((values) => Object.fromEntries(
          fieldNames.map((field, index) => [field, values[index]]),
        ));
      } catch (error) {
        lastError = error;
        const retryable = error?.name === "AbortError" || error?.retryable === true;
        if (!retryable || attempt === 3) throw error;
        await delay(750 * attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  };
}
