(function () {
  const DEPLOYMENT_CONFIG = {
    ENVIRONMENT_OVERRIDE: null,
    LOCAL_API_BASE_URL: "http://localhost:8000",
    REMOTE_API_BASE_URL: "https://api-medoptionstraining.overturegroup.com",
    USE_MOCK_API: false,
    LOCAL_REQUEST_TIMEOUT_MS: 10000,
    REMOTE_REQUEST_TIMEOUT_MS: 15000,
  };
  const local = DEPLOYMENT_CONFIG.ENVIRONMENT_OVERRIDE === "local" ||
    (!DEPLOYMENT_CONFIG.ENVIRONMENT_OVERRIDE && ["localhost", "127.0.0.1"].includes(location.hostname));
  const localApi = location.hostname === "127.0.0.1"
    ? DEPLOYMENT_CONFIG.LOCAL_API_BASE_URL.replace("localhost", "127.0.0.1")
    : DEPLOYMENT_CONFIG.LOCAL_API_BASE_URL;
  window.MedOptionsConfig = {...DEPLOYMENT_CONFIG,
    API_BASE_URL: local ? localApi : DEPLOYMENT_CONFIG.REMOTE_API_BASE_URL,
    REQUEST_TIMEOUT_MS: local ? DEPLOYMENT_CONFIG.LOCAL_REQUEST_TIMEOUT_MS : DEPLOYMENT_CONFIG.REMOTE_REQUEST_TIMEOUT_MS};
})();
