(async () => {
  const isDirectTransport = document.documentElement.dataset.transport === "direct";
  const STATIC_CONFIG = Object.freeze({
    upstream_base_url: "",
    model: "",
    defaultMaxTokens: 512,
    defaultTemperature: 0.2,
    defaultThinkingBudget: 0,
    maxRequestBytes: 64 * 1024 * 1024,
  });

  let CONFIG = STATIC_CONFIG;
  if (!isDirectTransport) {
    const configResponse = await fetch("/config");
    if (!configResponse.ok) {
      document.body.textContent = "Failed to load config.";
      return;
    }
    CONFIG = await configResponse.json();
  }

  const el = (id) => document.getElementById(id);
  const titleEl = el("title");
  const introEl = el("intro");
  const chatEl = el("chat");
  const requestSizeHintEl = el("requestSizeHint");
  const promptEl = el("prompt");
  const sendBtn = el("sendBtn");
  const cancelBtn = el("cancelBtn");
  const clearBtn = el("clearBtn");
  const apiBaseUrlEl = el("apiBaseUrl");
  const apiKeyEl = el("apiKey");
  const modelEl = el("model");
  const modelOptionsEl = el("modelOptions");
  const maxTokensEl = el("maxTokens");
  const tempEl = el("temp");
  const thinkingEnabledEl = el("thinkingEnabled");
  const thinkingBudgetEl = el("thinkingBudget");
  const metricBackendEl = el("metricBackend");
  const connectBtn = el("connectBtn");
  const apiStatusEl = el("apiStatus");
  const promptThroughputEl = el("promptThroughput");
  const decodeSpeedEl = el("decodeSpeed");
  const tokensEl = el("tokens");
  const wallTimeEl = el("wallTime");
  const attachBtn = el("attachBtn");
  const fileInput = el("fileInput");
  const attachmentsEl = el("attachments");
  const previewModal = el("previewModal");
  const previewFrame = el("previewFrame");
  const closePreviewBtn = el("closePreviewBtn");
  const languageButton = el("languageButton");
  const languageMenu = el("languageMenu");
  const themeButton = el("themeButton");

  const storage = window.localStorage;
  const session = window.sessionStorage;
  const textEncoder = new TextEncoder();
  const upstreamStorageKey = "llm-speed-chat.upstream-base-url";
  const modelStorageKey = "llm-speed-chat.model";
  const apiKeyStorageKey = "llm-speed-chat.upstream-api-key";
  const promptStorageKey = "llm-speed-chat.prompt-draft";
  const languageStorageKey = "llm-speed-chat.language";
  const themeStorageKey = "llm-speed-chat.theme";
  const metricBackendStorageKey = "llm-speed-chat.metric-backend";
  const autoModelLoadDelayMs = 400;

  const TRANSLATIONS = {
    en: {
      title: "LLM Speed Chat",
      intro: "Chat with any OpenAI-compatible endpoint and track speed.",
      language: "Switch language",
      enableDarkMode: "Enable dark mode",
      enableLightMode: "Enable light mode",
      english: "English",
      chinese: "Chinese",
      connectionSettings: "Connection Settings",
      apiUrl: "API URL",
      apiUrlPlaceholder: "http://127.0.0.1:8000 or http://127.0.0.1:8000/v1",
      apiKey: "API Key",
      optional: "Optional",
      model: "Model",
      modelPlaceholder: "Auto-detected or manual",
      detectModels: "Detect Models",
      advancedSettings: "Advanced Generation Settings",
      maxTokens: "Max Tokens",
      temperature: "Temperature",
      thinking: "Thinking",
      enableReasoning: "Enable reasoning",
      thinkingBudget: "Thinking Budget",
      thinkingBudgetTitle: "0 means unlimited thinking",
      framework: "Framework",
      frameworkTitle: "Detected from the model list. Select a framework to override.",
      frameworkAuto: "Auto-detected",
      frameworkUniversal: "Universal",
      benchmarkMetrics: "Benchmark Metrics",
      promptThroughput: "Prompt Throughput",
      decodeSpeed: "Decode Speed",
      generatedTokens: "Generated Tokens",
      wallTime: "Wall Time",
      chatBenchmark: "Chat Benchmark",
      prompt: "Prompt",
      promptPlaceholder: "Send a prompt, continue the conversation, and watch the live throughput.",
      attach: "Attach",
      attachTitle: "Attach image, audio, or text file",
      send: "Send",
      cancel: "Cancel",
      clear: "Clear",
      htmlPreview: "HTML Preview",
      htmlPreviewMeta: "Runs in an isolated iframe. Network, storage, forms, navigation, and popups are blocked.",
      close: "Close",
      emptyState: "Start a multi-turn conversation to measure LLM serving speed.",
      thinkingLabel: "Thinking",
      copy: "Copy",
      save: "Save",
      preview: "Preview",
      retry: "Retry",
      copied: "Copied",
      copyFailed: "Copy failed",
    },
    zh: {
      title: "LLM Speed Chat",
      intro: "连接任意 OpenAI 兼容端点，实时查看速度。",
      language: "切换语言",
      enableDarkMode: "开启深色模式",
      enableLightMode: "开启浅色模式",
      english: "English",
      chinese: "中文",
      connectionSettings: "连接设置",
      apiUrl: "API 地址",
      apiUrlPlaceholder: "http://127.0.0.1:8000 或 http://127.0.0.1:8000/v1",
      apiKey: "API 密钥",
      optional: "可选",
      model: "模型",
      modelPlaceholder: "自动发现或手动填写",
      detectModels: "发现模型",
      advancedSettings: "高级生成设置",
      maxTokens: "最大 Token 数",
      temperature: "温度",
      thinking: "思考",
      enableReasoning: "启用思考",
      thinkingBudget: "思考预算",
      thinkingBudgetTitle: "输入 0 表示无限思考",
      framework: "推理框架",
      frameworkTitle: "从模型列表中检测；可手动覆盖。",
      frameworkAuto: "自动检测",
      frameworkUniversal: "通用",
      benchmarkMetrics: "性能指标",
      promptThroughput: "提示吞吐",
      decodeSpeed: "解码速度",
      generatedTokens: "生成 Token 数",
      wallTime: "总耗时",
      chatBenchmark: "对话测试",
      prompt: "输入内容",
      promptPlaceholder: "发送提示词、继续对话，并查看实时吞吐。",
      attach: "附件",
      attachTitle: "添加图片、音频或文本文件",
      send: "发送",
      cancel: "取消",
      clear: "清空",
      htmlPreview: "HTML 预览",
      htmlPreviewMeta: "在隔离 iframe 中运行，网络、存储、表单、跳转和弹窗均被阻止。",
      close: "关闭",
      emptyState: "开始多轮对话，测试 LLM 服务速度。",
      thinkingLabel: "思考",
      copy: "复制",
      save: "保存",
      preview: "预览",
      retry: "重试",
      copied: "已复制",
      copyFailed: "复制失败",
    },
  };

  let language = storage.getItem(languageStorageKey) === "zh" ? "zh" : "en";
  let theme = storage.getItem(themeStorageKey) === "dark" ? "dark" : "light";

  let history = [];
  let attachments = [];
  let activeRequestController = null;
  let modelLoadController = null;
  let pendingModelLoadTimer = 0;
  let modelLoadVersion = 0;
  let modelMetadataById = new Map();
  let detectedFramework = "universal";

  apiBaseUrlEl.value = storage.getItem(upstreamStorageKey) || CONFIG.upstream_base_url || "";
  apiKeyEl.value = session.getItem(apiKeyStorageKey) || "";
  modelEl.value = storage.getItem(modelStorageKey) || CONFIG.model || "";
  maxTokensEl.value = String(CONFIG.defaultMaxTokens);
  tempEl.value = String(CONFIG.defaultTemperature);
  thinkingBudgetEl.value = String(CONFIG.defaultThinkingBudget || 0);
  thinkingEnabledEl.checked = Number(CONFIG.defaultThinkingBudget) > 0;
  metricBackendEl.value = storage.getItem(metricBackendStorageKey) || "auto";
  if (metricBackendEl.value === "standard") metricBackendEl.value = "universal";
  if (!new Set(["auto", "universal", "llamacpp", "vllm", "sglang", "exllama"]).has(metricBackendEl.value)) {
    metricBackendEl.value = "auto";
  }
  promptEl.value = session.getItem(promptStorageKey) || "";

  applyLanguage();
  renderEmptyState();
  resetMetrics();
  renderRequestSizeHint();
  renderControlState();

  if (currentUpstreamBaseUrl()) {
    queueModelLoad({immediate: true});
  } else {
    setApiStatus("Enter an API URL to auto-detect models.");
  }

  function currentUpstreamBaseUrl() {
    const rawValue = apiBaseUrlEl.value.trim().replace(/\/+$/, "");
    return isDirectTransport ? normalizeDirectUpstreamBaseUrl(rawValue) : rawValue;
  }

  function normalizeDirectUpstreamBaseUrl(value) {
    if (!value) return "";

    let normalized = value;
    if (!normalized.includes("://")) normalized = `http://${normalized}`;

    try {
      const url = new URL(normalized);
      if (url.protocol !== "http:" && url.protocol !== "https:") return value;

      let path = url.pathname.replace(/\/+$/, "");
      for (const suffix of ["/v1/chat/completions", "/chat/completions", "/v1/models", "/models", "/v1"]) {
        if (path === suffix) {
          path = "";
          break;
        }
        if (path.endsWith(suffix)) {
          path = path.slice(0, -suffix.length).replace(/\/+$/, "");
          break;
        }
      }
      url.pathname = path || "/";
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    } catch {
      return value;
    }
  }

  function directEndpoint(path) {
    return `${currentUpstreamBaseUrl()}${path}`;
  }

  function requestHeaders({json = false} = {}) {
    const headers = {};
    if (json) headers["Content-Type"] = "application/json";
    if (isDirectTransport) {
      const apiKey = apiKeyEl.value.trim();
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    }
    return headers;
  }

  function requestFailureMessage(error) {
    const message = error && error.message ? error.message : "request failed";
    return isDirectTransport
      ? `${message}. Confirm that this API allows browser CORS requests.`
      : message;
  }

  function currentModel() {
    return modelEl.value.trim();
  }

  function inferFramework(model) {
    if (!model || typeof model !== "object") return "universal";
    const owner = String(model.owned_by || model.owner || "").toLowerCase();
    if (owner.includes("llamacpp") || owner.includes("llama.cpp")) return "llamacpp";
    if (owner.includes("vllm")) return "vllm";
    if (owner.includes("sglang")) return "sglang";
    if (owner.includes("exllama")) return "exllama";
    return "universal";
  }

  function frameworkLabel(framework) {
    return {
      llamacpp: "llama.cpp",
      vllm: "vLLM",
      sglang: "SGLang",
      exllama: "ExLlama",
      universal: t("frameworkUniversal"),
    }[framework] || t("frameworkUniversal");
  }

  function refreshFrameworkDetection() {
    detectedFramework = inferFramework(modelMetadataById.get(currentModel()));
    const automaticOption = metricBackendEl.querySelector('option[value="auto"]');
    if (automaticOption) {
      automaticOption.textContent = `${t("frameworkAuto")} (${frameworkLabel(detectedFramework)})`;
    }
  }

  function currentFramework() {
    return metricBackendEl.value === "auto" ? detectedFramework : metricBackendEl.value;
  }

  function t(key) {
    return TRANSLATIONS[language][key] || TRANSLATIONS.en[key] || key;
  }

  function refreshActionButton(button) {
    const label = t(button.dataset.action);
    button.dataset.label = label;
    button.dataset.title = label;
    if (!button.dataset.state) {
      button.setAttribute("aria-label", label);
      button.title = label;
    }
  }

  function applyLanguage() {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title = t("title");
    titleEl.textContent = t("title");
    introEl.textContent = t("intro");
    for (const node of document.querySelectorAll("[data-i18n]")) {
      node.textContent = t(node.dataset.i18n);
    }
    for (const node of document.querySelectorAll("[data-i18n-placeholder]")) {
      node.placeholder = t(node.dataset.i18nPlaceholder);
    }
    for (const node of document.querySelectorAll("[data-i18n-title]")) {
      node.title = t(node.dataset.i18nTitle);
    }
    for (const node of document.querySelectorAll("[data-i18n-aria-label]")) {
      node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
      node.title = t(node.dataset.i18nAriaLabel);
    }
    for (const button of document.querySelectorAll(".messageAction, .codeCopyButton, .codeSaveButton")) {
      refreshActionButton(button);
    }
    for (const label of document.querySelectorAll(".reasoningLabel")) {
      label.textContent = t("thinkingLabel");
    }
    const emptyState = chatEl.querySelector(".emptyState");
    if (emptyState) emptyState.textContent = t("emptyState");
    for (const option of languageMenu.querySelectorAll("[data-language]")) {
      option.classList.toggle("active", option.dataset.language === language);
    }
    applyTheme();
    refreshFrameworkDetection();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    themeButton.dataset.theme = theme;
    const action = theme === "dark" ? "enableLightMode" : "enableDarkMode";
    themeButton.setAttribute("aria-label", t(action));
    themeButton.title = t(action);
  }

  function setLanguage(nextLanguage) {
    language = nextLanguage === "zh" ? "zh" : "en";
    storage.setItem(languageStorageKey, language);
    applyLanguage();
    languageMenu.hidden = true;
  }

  function thinkingBudgetTokens() {
    if (!thinkingEnabledEl.checked) return 0;
    const budget = Math.max(0, Math.trunc(Number(thinkingBudgetEl.value) || 0));
    return budget === 0 ? -1 : budget;
  }

  function persistConnectionState() {
    const upstreamBaseUrl = currentUpstreamBaseUrl();
    const model = currentModel();
    const apiKey = apiKeyEl.value.trim();

    if (upstreamBaseUrl) {
      storage.setItem(upstreamStorageKey, upstreamBaseUrl);
    } else {
      storage.removeItem(upstreamStorageKey);
    }
    if (model) {
      storage.setItem(modelStorageKey, model);
    } else {
      storage.removeItem(modelStorageKey);
    }
    if (apiKey) {
      session.setItem(apiKeyStorageKey, apiKey);
    } else {
      session.removeItem(apiKeyStorageKey);
    }
    storage.setItem(metricBackendStorageKey, metricBackendEl.value);
  }

  function persistPromptDraft() {
    const draft = promptEl.value;
    if (draft) {
      session.setItem(promptStorageKey, draft);
    } else {
      session.removeItem(promptStorageKey);
    }
  }

  function buildConnectionPayload() {
    if (isDirectTransport) return {};
    const payload = {
      upstream_base_url: currentUpstreamBaseUrl(),
    };
    const apiKey = apiKeyEl.value.trim();
    if (apiKey) {
      payload.upstream_api_key = apiKey;
    }
    return payload;
  }

  function setApiStatus(message, isError = false) {
    apiStatusEl.textContent = message;
    apiStatusEl.dataset.state = isError ? "error" : "";
  }

  function readRetryAfterSeconds(response) {
    if (!response || !response.headers) return null;
    const raw = response.headers.get("Retry-After");
    if (!raw) return null;

    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.trunc(seconds);
    }

    const targetMs = Date.parse(raw);
    if (!Number.isFinite(targetMs)) {
      return null;
    }
    return Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
  }

  function appendRetryAfterHint(message, response, retryAfterS) {
    const normalizedRetryAfterS = Number.isFinite(retryAfterS)
      ? Math.max(0, Math.trunc(retryAfterS))
      : null;
    const trimmed = String(message || "").trim();

    if (
      normalizedRetryAfterS === null
      || !response
      || (response.status !== 429 && response.status !== 503)
    ) {
      return trimmed || `HTTP ${response ? response.status : "error"}`;
    }

    const suffix = `Retry in ${normalizedRetryAfterS}s.`;
    if (!trimmed) return suffix;
    if (trimmed.endsWith(suffix)) return trimmed;
    return /[.!?]$/.test(trimmed) ? `${trimmed} ${suffix}` : `${trimmed}. ${suffix}`;
  }

  function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let value = Math.max(Number(bytes) || 0, 0);
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    const decimals = value >= 100 || unitIndex === 0 ? 0 : 1;
    return `${value.toFixed(decimals)} ${units[unitIndex]}`;
  }

  function formatRate(value, provisional = false) {
    if (!Number.isFinite(value) || value <= 0) return "--";
    return `${provisional ? "~" : ""}${value >= 100 ? value.toFixed(0) : value.toFixed(1)} tok/s`;
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--";
    return `${seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2)}s`;
  }

  function updateMetrics(metrics) {
    promptThroughputEl.textContent = formatRate(metrics.prompt_tok_s, metrics.prompt_provisional);
    decodeSpeedEl.textContent = formatRate(metrics.decode_tok_s, metrics.decode_provisional);
    tokensEl.textContent = Number.isFinite(metrics.completion_tokens)
      ? `${metrics.completion_provisional ? "~" : ""}${Math.trunc(metrics.completion_tokens)}`
      : "--";
    wallTimeEl.textContent = formatDuration(metrics.wall_s);
  }

  function readTokenCount(value) {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  function countTokenIds(value) {
    return Array.isArray(value) ? value.length : null;
  }

  function estimateTextTokens(value) {
    const text = String(value || "");
    if (!text.trim()) return 0;

    const cjkCharacters = text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || [];
    const remaining = text.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, " ");
    const units = remaining.match(/[A-Za-z0-9]+|[^\sA-Za-z0-9]/g) || [];
    const nonCjkTokens = units.reduce((total, unit) => {
      return total + (/^[A-Za-z0-9]+$/.test(unit) ? Math.ceil(unit.length / 4) : 1);
    }, 0);
    return cjkCharacters.length + nonCjkTokens;
  }

  function estimateContentTokens(content) {
    if (typeof content === "string") return estimateTextTokens(content);
    if (!Array.isArray(content)) return 0;
    return content.reduce((total, item) => {
      if (!item || typeof item !== "object" || item.type !== "text") return total;
      return total + estimateTextTokens(item.text);
    }, 0);
  }

  function estimatePromptTokens(payload) {
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const textTokens = messages.reduce((total, message) => {
      if (!message || typeof message !== "object") return total;
      return total + estimateContentTokens(message.content) + 4;
    }, 0);
    return Math.max(1, textTokens + 2);
  }

  function readTimingRate(timings, field) {
    if (!timings || typeof timings !== "object") return null;
    const value = Number(timings[field]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function createClientMetrics({framework, payload}) {
    const startedAt = performance.now();
    let firstContentAt = null;
    let finishedAt = null;
    let promptTokens = null;
    let completionTokens = null;
    let generatedText = "";
    let promptTimingRate = null;
    let liveDecodeRate = null;
    let liveDecodeIsProvisional = true;
    let finalDecodeRate = null;
    let finalDecodeIsProvisional = true;
    let latestLlamaDecodeRate = null;
    let firstDecodeAt = null;
    let lastDecodeAt = null;
    let streamedCompletionTokens = 0;

    function now() {
      return finishedAt === null ? performance.now() : finishedAt;
    }

    function recordUsage(usage) {
      if (!usage || typeof usage !== "object") return;
      const reportedPromptTokens = readTokenCount(usage.prompt_tokens);
      const reportedCompletionTokens = readTokenCount(usage.completion_tokens);
      if (reportedPromptTokens !== null) promptTokens = reportedPromptTokens;
      if (reportedCompletionTokens !== null) completionTokens = reportedCompletionTokens;
    }

    function recordDecodeTokens(count, exact, at) {
      if (!Number.isFinite(count) || count <= 0) return;
      if (firstDecodeAt === null) firstDecodeAt = at;
      if (lastDecodeAt !== null && at > lastDecodeAt) {
        liveDecodeRate = count * 1000 / (at - lastDecodeAt);
        liveDecodeIsProvisional = !exact;
      }
      lastDecodeAt = at;
    }

    function finalBrowserDecodeRate() {
      if (!Number.isFinite(completionTokens) || completionTokens <= 1) return null;
      if (firstDecodeAt === null || lastDecodeAt === null || lastDecodeAt <= firstDecodeAt) return null;
      return (completionTokens - 1) * 1000 / (lastDecodeAt - firstDecodeAt);
    }

    function useFinalDecodeRate() {
      if (framework === "llamacpp" && latestLlamaDecodeRate !== null) {
        finalDecodeRate = latestLlamaDecodeRate;
        finalDecodeIsProvisional = false;
        return;
      }

      const browserRate = finalBrowserDecodeRate();
      if (browserRate === null) return;
      finalDecodeRate = browserRate;
      // Token IDs and SGLang's continuous usage make every measured stream
      // boundary exact. Other endpoints retain the approximation marker.
      finalDecodeIsProvisional = streamedCompletionTokens < completionTokens;
    }

    function recordLocalFields(event, choice, at) {
      if (framework === "universal") return 0;

      let exactDelta = 0;
      let cumulativeCompletionTokens = null;

      const eventPromptTokenIds = countTokenIds(event.prompt_token_ids);
      const choicePromptTokenIds = choice && countTokenIds(choice.prompt_token_ids);
      const promptTokenIdCount = eventPromptTokenIds ?? choicePromptTokenIds;
      if (promptTokenIdCount !== null) promptTokens = promptTokenIdCount;

      const completionTokenIds = choice && countTokenIds(choice.token_ids);
      if (completionTokenIds !== null && completionTokenIds > 0) {
        completionTokens = (completionTokens || 0) + completionTokenIds;
        streamedCompletionTokens += completionTokenIds;
        exactDelta += completionTokenIds;
      }

      for (const metadata of [event.meta_info, choice && choice.meta_info]) {
        if (!metadata || typeof metadata !== "object") continue;
        const reportedPromptTokens = readTokenCount(metadata.prompt_tokens);
        const reportedCompletionTokens = readTokenCount(metadata.completion_tokens);
        if (reportedPromptTokens !== null) promptTokens = reportedPromptTokens;
        if (reportedCompletionTokens !== null) {
          completionTokens = reportedCompletionTokens;
          cumulativeCompletionTokens = Math.max(cumulativeCompletionTokens || 0, reportedCompletionTokens);
        }
      }

      for (const timings of [event.timings, choice && choice.timings]) {
        const reportedPromptTokens = readTokenCount(timings && timings.prompt_n);
        const reportedCompletionTokens = readTokenCount(timings && timings.predicted_n);
        const reportedPromptRate = readTimingRate(timings, "prompt_per_second");
        const reportedDecodeRate = readTimingRate(timings, "predicted_per_second");
        if (reportedPromptTokens !== null) promptTokens = reportedPromptTokens;
        if (reportedCompletionTokens !== null) {
          completionTokens = reportedCompletionTokens;
          cumulativeCompletionTokens = Math.max(cumulativeCompletionTokens || 0, reportedCompletionTokens);
        }
        if (reportedPromptRate !== null) promptTimingRate = reportedPromptRate;
        if (framework === "llamacpp" && reportedDecodeRate !== null) {
          latestLlamaDecodeRate = reportedDecodeRate;
        }
      }

      if (framework === "sglang") {
        const reportedCompletionTokens = readTokenCount(event.usage && event.usage.completion_tokens);
        if (reportedCompletionTokens !== null) {
          cumulativeCompletionTokens = Math.max(cumulativeCompletionTokens || 0, reportedCompletionTokens);
        }
      }

      if (cumulativeCompletionTokens !== null && cumulativeCompletionTokens > streamedCompletionTokens) {
        const missingTokens = cumulativeCompletionTokens - streamedCompletionTokens;
        streamedCompletionTokens = cumulativeCompletionTokens;
        exactDelta += missingTokens;
      }
      if (exactDelta > 0) recordDecodeTokens(exactDelta, true, at);
      return exactDelta;
    }

    function render() {
      const currentTime = now();
      const ttftSeconds = firstContentAt === null ? null : (firstContentAt - startedAt) / 1000;
      const wallSeconds = (currentTime - startedAt) / 1000;
      const provisionalPromptTokens = estimatePromptTokens(payload);
      const provisionalCompletionTokens = generatedText ? estimateTextTokens(generatedText) : null;
      const visiblePromptTokens = promptTokens === null ? provisionalPromptTokens : promptTokens;
      const visibleCompletionTokens = completionTokens === null
        ? provisionalCompletionTokens
        : completionTokens;
      const promptTokS = promptTimingRate ?? (
        visiblePromptTokens !== null && ttftSeconds && ttftSeconds > 0
          ? visiblePromptTokens / ttftSeconds
          : null
      );
      const localDecodeRate = framework === "llamacpp" ? latestLlamaDecodeRate : null;
      const decodeTokS = finalDecodeRate ?? localDecodeRate ?? liveDecodeRate;
      const decodeIsProvisional = finalDecodeRate !== null
        ? finalDecodeIsProvisional
        : localDecodeRate === null && (liveDecodeRate === null || liveDecodeIsProvisional);
      updateMetrics({
        prompt_tok_s: promptTokS,
        decode_tok_s: decodeTokS,
        completion_tokens: visibleCompletionTokens,
        wall_s: wallSeconds,
        prompt_provisional: promptTimingRate === null && promptTokens === null,
        decode_provisional: decodeIsProvisional,
        completion_provisional: completionTokens === null,
      });
    }

    const refreshTimer = window.setInterval(render, 100);

    return {
      recordEvent(event, choice, pieces = {}) {
        if (!event || typeof event !== "object") return;
        const eventTime = performance.now();
        recordUsage(event.usage);
        recordUsage(event.metrics);
        const exactTokenDelta = recordLocalFields(event, choice, eventTime);

        const reasoningPiece = typeof pieces.reasoning === "string" ? pieces.reasoning : "";
        const contentPiece = typeof pieces.content === "string" ? pieces.content : "";
        const generatedTokenIds = choice && countTokenIds(choice.token_ids);
        if (firstContentAt === null && (reasoningPiece || contentPiece || (generatedTokenIds || 0) > 0)) {
          firstContentAt = eventTime;
        }
        if (reasoningPiece || contentPiece) generatedText += reasoningPiece + contentPiece;
        if (exactTokenDelta === 0) {
          const estimatedTokenDelta = estimateTextTokens(reasoningPiece + contentPiece);
          if (estimatedTokenDelta > 0) recordDecodeTokens(estimatedTokenDelta, false, eventTime);
        }
        render();
      },
      finish({completed = false} = {}) {
        if (finishedAt !== null) return;
        finishedAt = performance.now();
        if (completed) useFinalDecodeRate();
        window.clearInterval(refreshTimer);
        render();
      },
    };
  }

  function resetMetrics() {
    promptThroughputEl.textContent = "--";
    decodeSpeedEl.textContent = "--";
    tokensEl.textContent = "--";
    wallTimeEl.textContent = "--";
  }

  function ensureEmptyStateCleared() {
    const emptyState = chatEl.querySelector(".emptyState");
    if (emptyState) {
      emptyState.remove();
    }
  }

  function renderEmptyState() {
    chatEl.innerHTML = "";
    const emptyState = document.createElement("div");
    emptyState.className = "emptyState";
    emptyState.textContent = t("emptyState");
    chatEl.appendChild(emptyState);
  }

  function scrollChatToBottom() {
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function renderAssistantMessage(body, text) {
    body.textContent = "";
    if (!window.marked || !window.DOMPurify) {
      body.textContent = text;
      return;
    }

    const markdownHtml = window.marked.parse(String(text), {breaks: true, gfm: true});
    body.innerHTML = window.DOMPurify.sanitize(markdownHtml, {
      USE_PROFILES: {html: true},
    });

    for (const link of body.querySelectorAll("a")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    for (const code of body.querySelectorAll("pre > code")) {
      const block = code.parentElement;
      const copyButton = document.createElement("button");
      copyButton.className = "codeCopyButton";
      copyButton.type = "button";
      copyButton.textContent = "\u29c9";
      copyButton.dataset.action = "copy";
      refreshActionButton(copyButton);
      copyButton.addEventListener("click", () => copyText(code.textContent || "", copyButton));
      block.appendChild(copyButton);

      const languageClass = Array.from(code.classList).find((name) => name.startsWith("language-"));
      const language = languageClass ? languageClass.slice("language-".length).toLowerCase() : "";
      const documentLanguage = language === "htm" ? "html" : language;
      if (documentLanguage !== "html" && documentLanguage !== "svg") continue;

      const saveButton = document.createElement("button");
      saveButton.className = "codeSaveButton";
      saveButton.type = "button";
      saveButton.textContent = "\u21e9";
      saveButton.dataset.action = "save";
      refreshActionButton(saveButton);
      saveButton.addEventListener("click", () => saveCodeBlock(code.textContent || "", documentLanguage));
      block.appendChild(saveButton);

      const preview = document.createElement("button");
      preview.className = "previewBtn";
      preview.type = "button";
      preview.textContent = "\u25a3";
      preview.setAttribute("aria-label", "Open sandboxed preview");
      preview.title = "Open sandboxed preview";
      preview.addEventListener("click", () => openPreview(code.textContent || ""));
      block.appendChild(preview);
    }
  }

  function renderReasoningMessage(reasoningMessage, text) {
    reasoningMessage.rawText = text;
    reasoningMessage.container.hidden = !text;
    reasoningMessage.body.textContent = text;
    reasoningMessage.body.scrollTop = reasoningMessage.body.scrollHeight;
  }

  function messageText(message) {
    return String(message.rawText || "");
  }

  function filenameTimestamp() {
    return new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  }

  function fileDetailsForLanguage(language) {
    return language === "svg"
      ? {extension: "svg", type: "image/svg+xml;charset=utf-8"}
      : {extension: "html", type: "text/html;charset=utf-8"};
  }

  function singleDocumentCodeBlock(text) {
    const match = String(text).trim().match(/^```(html|htm|svg)\s*\r?\n([\s\S]*?)\r?\n?```$/i);
    if (!match) return null;
    const language = match[1].toLowerCase() === "svg" ? "svg" : "html";
    return {text: match[2], ...fileDetailsForLanguage(language)};
  }

  function rawDocumentMarkup(text) {
    const markup = String(text || "").trim();
    if (!markup) return null;
    if (/^<svg\b/i.test(markup)) {
      return {text: markup, ...fileDetailsForLanguage("svg")};
    }
    if (/^(?:<!doctype\s+html[^>]*>\s*)?<html\b/i.test(markup)) {
      return {text: markup, ...fileDetailsForLanguage("html")};
    }
    if (/^<(?:style|main|section|article|div|canvas)\b/i.test(markup)) {
      return {text: markup, ...fileDetailsForLanguage("html")};
    }
    return null;
  }

  function documentMarkup(text) {
    return singleDocumentCodeBlock(text) || rawDocumentMarkup(text);
  }

  function messageFilename(message, extension = null) {
    const role = message.role === "assistant" ? "answer" : message.role;
    const defaultExtension = message.role === "assistant" ? "md" : "txt";
    return `llm-speed-chat-${role}-${filenameTimestamp()}.${extension || defaultExtension}`;
  }

  function downloadTextFile(text, filename, type) {
    const blob = new Blob([text], {type});
    const url = URL.createObjectURL(blob);
    const download = document.createElement("a");
    download.href = url;
    download.download = filename;
    document.body.appendChild(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function setActionState(button, label, state) {
    const originalLabel = button.dataset.label;
    const originalTitle = button.dataset.title;
    button.dataset.state = state;
    button.setAttribute("aria-label", label);
    button.title = label;
    window.setTimeout(() => {
      button.dataset.state = "";
      button.setAttribute("aria-label", originalLabel);
      button.title = originalTitle;
    }, 1200);
  }

  async function copyText(text, button) {
    if (!text) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const fallback = document.createElement("textarea");
        fallback.value = text;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.focus();
        fallback.select();
        const copied = document.execCommand("copy");
        fallback.remove();
        if (!copied) throw new Error("copy failed");
      }
      setActionState(button, t("copied"), "copied");
    } catch {
      setActionState(button, t("copyFailed"), "error");
    }
  }

  async function copyMessage(message, button) {
    return copyText(messageText(message), button);
  }

  function saveMessage(message) {
    const text = messageText(message);
    if (!text) return;
    const documentCode = message.role === "assistant" ? documentMarkup(text) : null;
    downloadTextFile(
      documentCode ? documentCode.text : text,
      messageFilename(message, documentCode && documentCode.extension),
      documentCode ? documentCode.type : "text/plain;charset=utf-8"
    );
  }

  function saveCodeBlock(text, language) {
    const details = fileDetailsForLanguage(language);
    downloadTextFile(text, `llm-speed-chat-code-${filenameTimestamp()}.${details.extension}`, details.type);
  }

  function appendActionButton(actions, icon, action, onClick) {
    const button = document.createElement("button");
    button.className = "messageAction";
    button.type = "button";
    button.textContent = icon;
    button.dataset.action = action;
    refreshActionButton(button);
    button.addEventListener("click", onClick);
    actions.appendChild(button);
    return button;
  }

  function addMessageActions(message) {
    const actions = document.createElement("div");
    actions.className = "messageActions";
    message.actions = actions;
    const copyButton = appendActionButton(actions, "\u29c9", "copy", () => copyMessage(message, copyButton));
    appendActionButton(actions, "\u21e9", "save", () => saveMessage(message));
    if (message.role === "user") {
      appendActionButton(actions, "\u21bb", "retry", () => retryMessage(message));
    }
    updateAssistantPreviewAction(message);
    message.container.appendChild(actions);
  }

  function updateAssistantPreviewAction(message) {
    if (message.role !== "assistant" || !message.actions) return;
    const documentCode = rawDocumentMarkup(messageText(message));
    if (!documentCode) {
      if (message.previewButton) message.previewButton.hidden = true;
      return;
    }
    if (!message.previewButton) {
      message.previewButton = appendActionButton(message.actions, "\u25a3", "preview", () => {
        const currentDocument = rawDocumentMarkup(messageText(message));
        if (currentDocument) openPreview(currentDocument.text);
      });
    }
    message.previewButton.hidden = false;
  }

  function addReasoningActions(reasoningMessage) {
    const actions = document.createElement("div");
    actions.className = "messageActions reasoningActions";
    const copyButton = appendActionButton(actions, "\u29c9", "copy", () => copyMessage(reasoningMessage, copyButton));
    appendActionButton(actions, "\u21e9", "save", () => saveMessage(reasoningMessage));
    reasoningMessage.container.appendChild(actions);
  }

  function appendMessage(role, text = "", extraClass = "") {
    ensureEmptyStateCleared();
    const container = document.createElement("article");
    container.className = `msg ${role}${extraClass ? ` ${extraClass}` : ""}`;

    const body = document.createElement("div");
    body.className = "messageBody";
    if (role === "assistant") renderAssistantMessage(body, text); else body.textContent = text;
    container.appendChild(body);

    const message = {container, body, rawText: text, role};

    if (role === "assistant") {
      const turn = document.createElement("div");
      turn.className = "assistantTurn";

      const reasoningContainer = document.createElement("aside");
      reasoningContainer.className = "reasoningMessage";
      reasoningContainer.hidden = true;
      const reasoningLabel = document.createElement("div");
      reasoningLabel.className = "reasoningLabel";
      reasoningLabel.textContent = t("thinkingLabel");
      const reasoningBody = document.createElement("div");
      reasoningBody.className = "reasoningContent";
      reasoningContainer.append(reasoningLabel, reasoningBody);

      message.reasoning = {container: reasoningContainer, body: reasoningBody, rawText: "", role: "thinking"};
      addReasoningActions(message.reasoning);
      addMessageActions(message);
      turn.append(reasoningContainer, container);
      chatEl.appendChild(turn);
      scrollChatToBottom();
      return message;
    }

    addMessageActions(message);
    chatEl.appendChild(container);
    scrollChatToBottom();
    return message;
  }

  function openPreview(markup) {
    const policy = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none';";
    previewFrame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="${policy}">${markup}`;
    previewModal.hidden = false;
    closePreviewBtn.focus();
  }

  function closePreview() {
    previewModal.hidden = true;
    previewFrame.srcdoc = "";
  }

  function renderAttachments() {
    attachmentsEl.textContent = "";
    attachments.forEach((item, index) => {
      const chip = document.createElement("div"); chip.className = "attachmentChip";
      if (item.preview) { const img = document.createElement("img"); img.src = item.preview; chip.append(img); }
      const label = document.createElement("span"); label.textContent = item.name; chip.append(label);
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "x"; remove.title = "Remove attachment";
      remove.addEventListener("click", () => { attachments.splice(index, 1); renderAttachments(); renderRequestSizeHint(); renderControlState(); });
      chip.append(remove); attachmentsEl.append(chip);
    });
  }

  async function addFiles(files) {
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} exceeds the 8 MB attachment limit.`);
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      let text = null;
      if (file.type.startsWith("text/") || /\.(md|json|csv|html|js|css)$/i.test(file.name)) text = await file.text();
      attachments.push({name: file.name, type: file.type || "application/octet-stream", dataUrl, text, preview: file.type.startsWith("image/") ? dataUrl : null});
    }
    fileInput.value = ""; renderAttachments(); renderRequestSizeHint(); renderControlState();
  }

  function setMessageNote(message, text) {
    const existing = message.container.querySelector(".msgNote");
    if (existing) {
      existing.textContent = text;
      scrollChatToBottom();
      return;
    }

    const note = document.createElement("div");
    note.className = "msgNote";
    note.textContent = text;
    message.container.appendChild(note);
    scrollChatToBottom();
  }

  function buildChatContent(text) {
    const content = [{type: "text", text}];
    for (const item of attachments) {
      if (item.text !== null) content.push({type: "text", text: `\n\n[Attached file: ${item.name}]\n${item.text}`});
      else if (item.type.startsWith("image/")) content.push({type: "image_url", image_url: {url: item.dataUrl}});
      else if (item.type.startsWith("audio/")) content.push({type: "input_audio", input_audio: {data: item.dataUrl.split(",", 2)[1], format: item.type.split("/")[1]}});
    }
    return content.length === 1 ? text : content;
  }

  function buildChatPayload(text, contentOverride = null) {
    const content = contentOverride === null ? buildChatContent(text) : contentOverride;
    const framework = currentFramework();
    const payload = {
      ...buildConnectionPayload(),
      model: currentModel(),
      messages: history.concat([{role: "user", content}]),
      stream: true,
      // OpenAI-compatible servers may return exact final token usage in the stream.
      stream_options: {include_usage: true},
      max_tokens: Math.max(1, Math.trunc(Number(maxTokensEl.value) || CONFIG.defaultMaxTokens)),
      temperature: Number.isFinite(Number(tempEl.value))
        ? Number(tempEl.value)
        : CONFIG.defaultTemperature,
      thinking_budget_tokens: thinkingBudgetTokens(),
      // The budget stops an existing thought; this controls whether the template starts one.
      chat_template_kwargs: {enable_thinking: thinkingEnabledEl.checked},
    };

    if (framework === "sglang") {
      // SGLang chat streams expose exact cumulative usage through this standard extension.
      payload.stream_options.continuous_usage_stats = true;
    }
    if (framework === "llamacpp" || framework === "vllm") {
      // These local servers return request-scoped exact token IDs in their chat stream.
      payload.return_token_ids = true;
    }
    if (framework === "llamacpp") {
      payload.timings_per_token = true;
    }
    return payload;
  }

  function estimateRequestBytes(text) {
    const draft = String(text || "").trim();
    if (!draft || !currentModel()) {
      return 0;
    }
    return textEncoder.encode(JSON.stringify(buildChatPayload(draft))).length;
  }

  function renderRequestSizeHint() {
    const requestBytes = estimateRequestBytes(promptEl.value);
    requestSizeHintEl.dataset.state = requestBytes > CONFIG.maxRequestBytes ? "error" : "";
    requestSizeHintEl.textContent = `Estimated request size: ${formatBytes(requestBytes)} / ${formatBytes(CONFIG.maxRequestBytes)}.`;
  }

  function renderControlState() {
    const hasPrompt = Boolean(promptEl.value.trim());
    const hasTarget = Boolean(currentUpstreamBaseUrl() && currentModel());
    const isRunning = Boolean(activeRequestController);

    sendBtn.disabled = !hasPrompt || !hasTarget || isRunning;
    cancelBtn.disabled = !isRunning;
    clearBtn.disabled = isRunning || (!history.length && !promptEl.value.trim() && chatEl.querySelectorAll(".msg").length === 0);
    connectBtn.disabled = !currentUpstreamBaseUrl() || Boolean(modelLoadController) || isRunning;

    apiBaseUrlEl.disabled = isRunning;
    apiKeyEl.disabled = isRunning;
    modelEl.disabled = isRunning;
    maxTokensEl.disabled = isRunning;
    tempEl.disabled = isRunning;
    thinkingEnabledEl.disabled = isRunning;
    thinkingBudgetEl.disabled = isRunning || !thinkingEnabledEl.checked;
    metricBackendEl.disabled = isRunning;
  }

  function replaceModelOptions(models) {
    modelOptionsEl.innerHTML = "";
    for (const model of models) {
      if (!model || typeof model.id !== "string") continue;
      const option = document.createElement("option");
      option.value = model.id;
      modelOptionsEl.appendChild(option);
    }
  }

  async function readErrorMessage(response) {
    let message = "";
    try {
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        if (payload && typeof payload.error === "string") {
          message = payload.error;
        } else {
          message = JSON.stringify(payload);
        }
      } else {
        message = (await response.text()).trim();
      }
    } catch {
      message = "";
    }
    return appendRetryAfterHint(message, response, readRetryAfterSeconds(response));
  }

  async function loadModels({reason = "auto"} = {}) {
    const upstreamBaseUrl = currentUpstreamBaseUrl();
    if (!upstreamBaseUrl) {
      replaceModelOptions([]);
      modelMetadataById = new Map();
      refreshFrameworkDetection();
      modelEl.value = "";
      renderRequestSizeHint();
      setApiStatus("Enter an API URL to auto-detect models.");
      renderControlState();
      return;
    }

    persistConnectionState();
    const version = ++modelLoadVersion;
    if (modelLoadController) {
      modelLoadController.abort();
    }
    modelLoadController = new AbortController();
    modelMetadataById = new Map();
    refreshFrameworkDetection();
    setApiStatus(reason === "manual" ? "Refreshing models..." : "Detecting models...");
    renderControlState();

    try {
      const response = isDirectTransport
        ? await fetch(directEndpoint("/v1/models"), {
          headers: requestHeaders(),
          signal: modelLoadController.signal,
        })
        : await fetch("/models", {
          method: "POST",
          headers: requestHeaders({json: true}),
          body: JSON.stringify(buildConnectionPayload()),
          signal: modelLoadController.signal,
        });

      if (version !== modelLoadVersion) return;

      if (!response.ok) {
        const message = await readErrorMessage(response);
        setApiStatus(`Failed to load models: ${message}`, true);
        renderControlState();
        return;
      }

      const payload = await response.json();
      const models = Array.isArray(payload.data)
        ? payload.data
          .filter((item) => item && typeof item === "object" && typeof item.id === "string" && item.id.trim())
          .map((item) => ({...item, id: item.id.trim()}))
        : [];
      const modelIds = models.map((model) => model.id);

      replaceModelOptions(models);
      modelMetadataById = new Map(models.map((model) => [model.id, model]));
      const current = currentModel();
      if (!current || !modelIds.includes(current)) {
        modelEl.value = modelIds[0] || current;
      }
      refreshFrameworkDetection();
      persistConnectionState();
      renderRequestSizeHint();

      if (modelIds.length) {
        setApiStatus(`Loaded ${models.length} model${models.length === 1 ? "" : "s"}.`);
      } else {
        setApiStatus("No models returned. Type a model name manually.");
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
      if (version !== modelLoadVersion) return;
      setApiStatus(`Failed to load models: ${requestFailureMessage(err)}`, true);
    } finally {
      if (version === modelLoadVersion) {
        modelLoadController = null;
        renderControlState();
      }
    }
  }

  function queueModelLoad({immediate = false, reason = "auto"} = {}) {
    window.clearTimeout(pendingModelLoadTimer);
    if (immediate) {
      loadModels({reason});
      return;
    }
    pendingModelLoadTimer = window.setTimeout(() => {
      loadModels({reason});
    }, autoModelLoadDelayMs);
  }

  async function streamAssistantResponse(response, assistantMessage, clientMetrics) {
    if (!response.body) {
      return "";
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantText = "";
    let reasoningText = "";

    const processEventBlock = (block) => {
      const dataLines = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (!dataLines.length) return;
      const data = dataLines.join("\n");
      if (!data || data === "[DONE]") return;

      let payload;
      try {
        payload = JSON.parse(data);
      } catch {
        return;
      }
      if (!payload || typeof payload !== "object") return;

      const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
      const delta = choice && typeof choice === "object" ? choice.delta : null;
      const reasoningPiece = delta && typeof delta === "object" && typeof delta.reasoning_content === "string"
        ? delta.reasoning_content
        : "";
      const contentPiece = delta && typeof delta === "object" && typeof delta.content === "string"
        ? delta.content
        : "";
      clientMetrics.recordEvent(payload, choice, {reasoning: reasoningPiece, content: contentPiece});
      if (!reasoningPiece && !contentPiece) return;

      if (reasoningPiece) {
        reasoningText += reasoningPiece;
        renderReasoningMessage(assistantMessage.reasoning, reasoningText);
      }
      if (contentPiece) {
        assistantText += contentPiece;
        assistantMessage.rawText = assistantText;
        renderAssistantMessage(assistantMessage.body, assistantText);
        updateAssistantPreviewAction(assistantMessage);
      }
      scrollChatToBottom();
    };

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, {stream: true});
      let boundaryIndex = buffer.indexOf("\n\n");
      while (boundaryIndex !== -1) {
        const block = buffer.slice(0, boundaryIndex).replaceAll("\r", "");
        buffer = buffer.slice(boundaryIndex + 2);
        processEventBlock(block);
        boundaryIndex = buffer.indexOf("\n\n");
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      processEventBlock(buffer.replaceAll("\r", ""));
    }
    return assistantText;
  }

  async function sendPrompt({text = promptEl.value, contentOverride = null, preserveDraft = false} = {}) {
    const draftText = String(text || "").trim();
    if (!draftText || activeRequestController) return;

    if (!currentUpstreamBaseUrl()) {
      setApiStatus("Enter an API URL first.", true);
      return;
    }
    if (!currentModel()) {
      setApiStatus("Select or type a model before sending.", true);
      return;
    }

    const requestBytes = estimateRequestBytes(draftText);
    if (requestBytes > CONFIG.maxRequestBytes) {
      appendMessage(
        "assistant",
        `ERROR: Request exceeds the configured limit of ${formatBytes(CONFIG.maxRequestBytes)} (${formatBytes(requestBytes)} estimated). Shorten the prompt before sending.`,
        "err"
      );
      renderRequestSizeHint();
      renderControlState();
      return;
    }

    const framework = currentFramework();
    const payload = buildChatPayload(draftText, contentOverride);
    const userMessage = appendMessage("user", draftText);
    userMessage.requestContent = payload.messages.at(-1).content;
    const assistantMessage = appendMessage("assistant", "");

    if (!preserveDraft) {
      promptEl.value = "";
      persistPromptDraft();
    }
    resetMetrics();
    renderRequestSizeHint();

    const controller = new AbortController();
    const clientMetrics = createClientMetrics({framework, payload});
    let completed = false;
    activeRequestController = controller;
    renderControlState();

    try {
      const response = await fetch(isDirectTransport ? directEndpoint("/v1/chat/completions") : "/chat", {
        method: "POST",
        headers: requestHeaders({json: true}),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await readErrorMessage(response);
        assistantMessage.container.classList.add("err");
        assistantMessage.rawText = `ERROR: ${message}`;
        assistantMessage.body.textContent = assistantMessage.rawText;
        if (!preserveDraft) {
          promptEl.value = draftText;
          persistPromptDraft();
        }
        renderRequestSizeHint();
        return;
      }

      const assistantText = await streamAssistantResponse(response, assistantMessage, clientMetrics);
      completed = true;
      assistantMessage.rawText = assistantText;
      history.push({role: "user", content: userMessage.requestContent});
      if (assistantText) {
        history.push({role: "assistant", content: assistantText});
      }
      if (contentOverride === null) {
        attachments = [];
        renderAttachments();
      }
    } catch (err) {
      if (err && err.name === "AbortError") {
        assistantMessage.container.classList.add("cancelled");
        if (!assistantMessage.body.textContent) {
          assistantMessage.rawText = "Generation cancelled.";
          assistantMessage.body.textContent = assistantMessage.rawText;
        }
        setMessageNote(assistantMessage, "Generation cancelled. This partial reply was not added to history.");
        return;
      }

      assistantMessage.container.classList.add("err");
      assistantMessage.rawText = `ERROR: ${err && err.message ? err.message : "request failed"}`;
      assistantMessage.body.textContent = assistantMessage.rawText;
      if (!preserveDraft) {
        promptEl.value = draftText;
        persistPromptDraft();
      }
      renderRequestSizeHint();
      userMessage.container.dataset.failed = "true";
    } finally {
      clientMetrics.finish({completed});
      if (activeRequestController === controller) {
        activeRequestController = null;
      }
      renderControlState();
    }
  }

  function retryMessage(message) {
    if (activeRequestController || !message.rawText) return;
    sendPrompt({
      text: message.rawText,
      contentOverride: message.requestContent || message.rawText,
      preserveDraft: true,
    });
  }

  function clearConversation() {
    if (activeRequestController) {
      return;
    }
    history = [];
    attachments = [];
    renderAttachments();
    promptEl.value = "";
    persistPromptDraft();
    resetMetrics();
    renderRequestSizeHint();
    renderEmptyState();
    renderControlState();
  }

  connectBtn.addEventListener("click", () => {
    queueModelLoad({immediate: true, reason: "manual"});
  });

  sendBtn.addEventListener("click", () => {
    sendPrompt();
  });

  cancelBtn.addEventListener("click", () => {
    if (activeRequestController) {
      activeRequestController.abort();
    }
  });

  clearBtn.addEventListener("click", clearConversation);

  languageButton.addEventListener("click", () => {
    languageMenu.hidden = !languageMenu.hidden;
  });
  themeButton.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    storage.setItem(themeStorageKey, theme);
    applyTheme();
  });
  for (const option of languageMenu.querySelectorAll("[data-language]")) {
    option.addEventListener("click", () => setLanguage(option.dataset.language));
  }

  fileInput.addEventListener("change", async () => { try { await addFiles(Array.from(fileInput.files || [])); } catch (err) { appendMessage("assistant", `ERROR: ${err.message || err}`, "err"); } });
  closePreviewBtn.addEventListener("click", closePreview);
  previewModal.addEventListener("click", (event) => { if (event.target === previewModal) closePreview(); });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePreview();
      languageMenu.hidden = true;
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".languageControl")) languageMenu.hidden = true;
  });

  apiBaseUrlEl.addEventListener("input", () => {
    persistConnectionState();
    renderRequestSizeHint();
    renderControlState();
    queueModelLoad({reason: "auto"});
  });

  apiBaseUrlEl.addEventListener("blur", () => {
    persistConnectionState();
    queueModelLoad({immediate: true, reason: "auto"});
  });

  apiKeyEl.addEventListener("input", () => {
    persistConnectionState();
    renderControlState();
  });

  apiKeyEl.addEventListener("change", () => {
    persistConnectionState();
    if (currentUpstreamBaseUrl()) {
      queueModelLoad({immediate: true, reason: "manual"});
    }
  });

  modelEl.addEventListener("input", () => {
    persistConnectionState();
    refreshFrameworkDetection();
    renderRequestSizeHint();
    renderControlState();
  });

  maxTokensEl.addEventListener("input", renderRequestSizeHint);
  tempEl.addEventListener("input", renderRequestSizeHint);
  thinkingEnabledEl.addEventListener("change", () => {
    renderRequestSizeHint();
    renderControlState();
  });
  thinkingBudgetEl.addEventListener("input", renderRequestSizeHint);
  metricBackendEl.addEventListener("change", () => {
    persistConnectionState();
    renderRequestSizeHint();
  });

  promptEl.addEventListener("input", () => {
    persistPromptDraft();
    renderRequestSizeHint();
    renderControlState();
  });

  promptEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && !activeRequestController) {
      event.preventDefault();
      sendPrompt();
    }
  });
})();
