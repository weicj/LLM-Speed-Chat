const { test, expect } = require("@playwright/test");
const { spawn } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const APP_PORT = 18080;
const SMALL_LIMIT_APP_PORT = 18082;
const UPSTREAM_PORT = 18000;

let appProcess;
let smallLimitAppProcess;
let upstreamProcess;

test.beforeAll(async () => {
  upstreamProcess = await startProcess("node", ["e2e/mock-upstream.js"], {
    MOCK_UPSTREAM_HOST: "127.0.0.1",
    MOCK_UPSTREAM_PORT: String(UPSTREAM_PORT),
  }, "mock-upstream listening");

  appProcess = await startProcess("python3", ["server.py"], {
    HOST: "127.0.0.1",
    PORT: String(APP_PORT),
    UPSTREAM_BASE_URL: `http://127.0.0.1:${UPSTREAM_PORT}`,
    MODEL: "",
  }, `http://127.0.0.1:${APP_PORT}`);

  smallLimitAppProcess = await startProcess("python3", ["server.py"], {
    HOST: "127.0.0.1",
    PORT: String(SMALL_LIMIT_APP_PORT),
    UPSTREAM_BASE_URL: `http://127.0.0.1:${UPSTREAM_PORT}`,
    MODEL: "",
    MAX_REQUEST_BYTES: "20000",
  }, `http://127.0.0.1:${SMALL_LIMIT_APP_PORT}`);
});

test.afterAll(async () => {
  await stopProcess(appProcess);
  await stopProcess(smallLimitAppProcess);
  await stopProcess(upstreamProcess);
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("loads models and streams a chat response with live metrics", async ({ page }) => {
  await expect(page.locator("#apiStatus")).toContainText("Loaded 1 model");
  await expect(page.locator("#model")).toHaveValue("demo-model");

  await page.locator("#prompt").fill("hello browser");
  await page.locator("#sendBtn").click();

  await expect(page.locator(".msg.user").last()).toContainText("hello browser");
  await expect(page.locator(".msg.assistant").last()).toContainText("Hello from the browser test.");
  await expect(page.locator("#promptThroughput")).toContainText("tok/s");
  await expect(page.locator("#decodeSpeed")).toContainText("tok/s");
  await expect(page.locator("#tokens")).toHaveText("5");
  await expect(page.locator("#wallTime")).toContainText("s");
});

test("marks token metrics as provisional when an API does not return usage", async ({ page }) => {
  await page.locator("#prompt").fill("no-usage");
  await page.locator("#sendBtn").click();

  await expect(page.locator(".msg.assistant").last()).toContainText("Response without usage metadata.");
  await expect(page.locator("#promptThroughput")).toContainText("~");
  await expect(page.locator("#decodeSpeed")).toContainText("~");
  await expect(page.locator("#tokens")).toContainText("~");
  await expect(page.locator("#wallTime")).toContainText("s");
});

test("auto-detects vLLM and replaces live speed with the final decode rate", async ({ page }) => {
  const chatRequests = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/chat")) chatRequests.push(JSON.parse(request.postData() || "{}"));
  });

  await page.locator("#apiKey").fill("local-vllm");
  await page.locator("#connectBtn").click();
  await expect(page.locator("#apiStatus")).toContainText("Loaded 1 model");
  await expect(page.locator("#model")).toHaveValue("local-vllm-model");

  await page.locator("#prompt").fill("local-live-metrics");
  await page.locator("#sendBtn").click();

  await expect(page.locator(".msg.assistant").last()).toContainText("Exact local");
  await expect(page.locator("#promptThroughput")).toContainText("tok/s");
  await expect(page.locator("#promptThroughput")).not.toContainText("~");
  await expect(page.locator("#tokens")).toHaveText("1");

  const wallBefore = await page.locator("#wallTime").textContent();
  await page.waitForTimeout(200);
  const wallAfter = await page.locator("#wallTime").textContent();
  expect(wallAfter).not.toBe(wallBefore);

  await expect(page.locator("#tokens")).toHaveText("2");
  await expect(page.locator("#decodeSpeed")).toContainText("tok/s");
  await expect(page.locator("#decodeSpeed")).not.toContainText("~");
  const liveDecodeRate = Number.parseFloat(await page.locator("#decodeSpeed").textContent());
  expect(liveDecodeRate).toBeGreaterThan(2);
  expect(liveDecodeRate).toBeLessThan(3);
  await expect(page.locator(".msg.assistant").last()).toContainText("Done.");
  const finalDecodeRate = Number.parseFloat(await page.locator("#decodeSpeed").textContent());
  expect(finalDecodeRate).toBeGreaterThan(2);
  expect(finalDecodeRate).toBeLessThan(2.5);
  expect(finalDecodeRate).toBeLessThan(liveDecodeRate);

  expect(chatRequests).toHaveLength(1);
  expect(chatRequests[0].return_token_ids).toBe(true);
  expect(chatRequests[0].stream_options).toEqual({include_usage: true});
});

test("auto-detects llama.cpp and uses its live server decode rate", async ({ page }) => {
  const requestPromise = page.waitForRequest((request) => request.url().endsWith("/chat"));

  await page.locator("#apiKey").fill("local-llama");
  await page.locator("#connectBtn").click();
  await expect(page.locator("#model")).toHaveValue("local-llama-model");
  await expect(page.locator("#metricBackend option[value='auto']")).toHaveText("Auto-detected (llama.cpp)");

  await page.locator("#prompt").fill("llama-live-metrics");
  await page.locator("#sendBtn").click();

  const request = await requestPromise;
  const payload = JSON.parse(request.postData() || "{}");
  expect(payload.return_token_ids).toBe(true);
  expect(payload.timings_per_token).toBe(true);

  await expect(page.locator(".msg.assistant").last()).toContainText("llama");
  await expect(page.locator("#promptThroughput")).toHaveText("55.0 tok/s");
  await expect(page.locator("#tokens")).toHaveText("1");
  await expect(page.locator("#tokens")).toHaveText("2");
  await expect(page.locator("#decodeSpeed")).toHaveText("25.0 tok/s");

  await expect(page.locator("#tokens")).toHaveText("3");
  await expect(page.locator(".msg.assistant").last()).toContainText("Live.");
  await expect(page.locator("#decodeSpeed")).toHaveText("25.0 tok/s");
});

test("Universal framework suppresses local-only metric fields and falls back cleanly", async ({ page }) => {
  const requestPromise = page.waitForRequest((request) => request.url().endsWith("/chat"));

  await page.locator("#apiKey").fill("local-vllm");
  await page.locator("#connectBtn").click();
  await expect(page.locator("#model")).toHaveValue("local-vllm-model");
  await page.locator("#metricBackend").selectOption("universal");
  await page.locator("#prompt").fill("local-live-metrics");
  await page.locator("#sendBtn").click();

  const request = await requestPromise;
  const payload = JSON.parse(request.postData() || "{}");
  expect(payload.return_token_ids).toBeUndefined();
  expect(payload.timings_per_token).toBeUndefined();
  expect(payload.stream_options).toEqual({include_usage: true});

  await expect(page.locator(".msg.assistant").last()).toContainText("Done.");
  await expect(page.locator("#tokens")).toContainText("~");
  await expect(page.locator("#promptThroughput")).toContainText("~");
});

test("SGLang source requests exact continuous usage without unsupported token IDs", async ({ page }) => {
  const requestPromise = page.waitForRequest((request) => request.url().endsWith("/chat"));

  await page.locator("#metricBackend").selectOption("sglang");
  await page.locator("#prompt").fill("sglang-live-metrics");
  await page.locator("#sendBtn").click();

  const request = await requestPromise;
  const payload = JSON.parse(request.postData() || "{}");
  expect(payload.return_token_ids).toBeUndefined();
  expect(payload.stream_options).toEqual({include_usage: true, continuous_usage_stats: true});

  await expect(page.locator(".msg.assistant").last()).toContainText("SGLang");
  await expect(page.locator("#tokens")).toHaveText("1");
  await expect(page.locator("#promptThroughput")).not.toContainText("~");
  await expect(page.locator("#tokens")).toHaveText("2");
  await expect(page.locator("#decodeSpeed")).not.toContainText("~");
});

test("gives every message copy and save actions, with retry on user messages", async ({ page }) => {
  await page.locator("#prompt").fill("hello browser");
  await page.locator("#sendBtn").click();
  await expect(page.locator(".msg.assistant").last()).toContainText("Hello from the browser test.");

  const userMessage = page.locator(".msg.user").last();
  const assistantMessage = page.locator(".msg.assistant").last();
  await expect(userMessage.getByRole("button", {name: "Copy"})).toBeVisible();
  await expect(userMessage.getByRole("button", {name: "Save"})).toBeVisible();
  await expect(userMessage.getByRole("button", {name: "Retry"})).toBeVisible();
  await expect(assistantMessage.getByRole("button", {name: "Copy"})).toBeVisible();
  await expect(assistantMessage.getByRole("button", {name: "Save"})).toBeVisible();
  await expect(userMessage.getByRole("button", {name: "Copy"})).toHaveText("\u29c9");
  await expect(userMessage.getByRole("button", {name: "Save"})).toHaveText("\u21e9");
  await expect(userMessage.getByRole("button", {name: "Retry"})).toHaveText("\u21bb");

  const downloadPromise = page.waitForEvent("download");
  await assistantMessage.getByRole("button", {name: "Save"}).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^llm-speed-chat-answer-.*\.md$/);

  await userMessage.getByRole("button", {name: "Retry"}).click();
  await expect(page.locator(".msg.user")).toHaveCount(2);
  await expect(page.locator(".msg.assistant")).toHaveCount(2);
});

test("sends with Enter while Shift+Enter keeps a newline", async ({ page }) => {
  await page.locator("#prompt").fill("first line");
  await page.locator("#prompt").press("Shift+Enter");
  await page.locator("#prompt").type("second line");
  await expect(page.locator("#prompt")).toHaveValue("first line\nsecond line");
  await page.locator("#prompt").press("Enter");

  await expect(page.locator(".msg.user").last()).toContainText("first line");
  await expect(page.locator(".msg.user").last()).toContainText("second line");
});

test("aligns the composer action stack to the text box", async ({ page }) => {
  const promptBox = await page.locator("#prompt").boundingBox();
  const actionBox = await page.locator(".composerActions").boundingBox();

  expect(promptBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(Math.abs(promptBox.y - actionBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs((promptBox.y + promptBox.height) - (actionBox.y + actionBox.height))).toBeLessThanOrEqual(1);
});

test("keeps connection controls level and generation settings expanded", async ({ page }) => {
  const apiInput = await page.locator("#apiBaseUrl").boundingBox();
  const detectButton = await page.locator("#connectBtn").boundingBox();
  const status = await page.locator("#apiStatus").boundingBox();

  expect(apiInput).not.toBeNull();
  expect(detectButton).not.toBeNull();
  expect(status).not.toBeNull();
  expect(Math.abs(apiInput.y - detectButton.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(apiInput.height - detectButton.height)).toBeLessThanOrEqual(1);
  expect(status.y + status.height).toBeLessThanOrEqual(apiInput.y);
  await expect(page.locator("details")).toHaveCount(0);
  await expect(page.locator(".advancedGrid")).toBeVisible();
});

test("switches the interface between English and Chinese without exposing the model path in the header", async ({ page }) => {
  await expect(page.locator("#modelName")).toHaveCount(0);
  await expect(page.locator("#title")).toHaveText("LLM Speed Chat");
  await expect(page.getByRole("link", {name: "github.com/weicj/LLM-Speed-Chat"})).toHaveAttribute(
    "href",
    "https://github.com/weicj/LLM-Speed-Chat"
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#themeButton")).toHaveAccessibleName("Enable dark mode");
  await page.locator("#themeButton").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#themeButton")).toHaveAccessibleName("Enable light mode");
  await page.locator("#themeButton").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.locator("#languageButton").click();
  await page.locator("#languageMenu [data-language='zh']").click();
  await expect(page.locator("#intro")).toContainText("连接任意");
  await expect(page.locator("#sendBtn")).toHaveText("发送");
  await expect(page.locator("#thinkingBudget")).toHaveAttribute("title", "输入 0 表示无限思考");

  await page.locator("#languageButton").click();
  await page.locator("#languageMenu [data-language='en']").click();
  await expect(page.locator("#sendBtn")).toHaveText("Send");
  await expect(page.locator("#themeButton")).toHaveAccessibleName("Enable dark mode");
});

test("uses an unlimited thinking budget when enabled with zero", async ({ page }) => {
  await page.locator("#thinkingEnabled").check();
  await page.locator("#thinkingBudget").fill("0");
  await page.locator("#prompt").fill("thinking-unlimited");
  await page.locator("#sendBtn").click();

  await expect(page.locator(".msg.assistant").last()).toContainText("Thinking budget: -1");
  await expect(page.locator(".msg.assistant").last()).toContainText("template thinking: true");
});

test("explicitly disables template thinking when reasoning is unchecked", async ({ page }) => {
  await expect(page.locator("#thinkingEnabled")).not.toBeChecked();
  await page.locator("#prompt").fill("thinking-disabled");
  await page.locator("#sendBtn").click();

  await expect(page.locator(".msg.assistant").last()).toContainText("Template thinking: false");
});

test("keeps streamed reasoning in its own five-line scrolling bubble", async ({ page }) => {
  await page.locator("#thinkingEnabled").check();
  await page.locator("#prompt").fill("thinking-message");
  await page.locator("#sendBtn").click();

  const reasoning = page.locator(".reasoningContent").last();
  await expect(reasoning).toContainText("Line six");
  await expect(reasoning).toHaveCSS("overflow-y", "auto");
  expect(await reasoning.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  await expect(page.locator(".msg.assistant").last().locator(".messageBody")).toHaveText("Answer after thinking.");
  await expect(page.locator(".msg.assistant").last()).not.toContainText("Line one");
});

test("renders assistant output as sanitized Markdown", async ({ page }) => {
  await page.locator("#prompt").fill("markdown-message");
  await page.locator("#sendBtn").click();

  const reply = page.locator(".msg.assistant").last();
  await expect(reply.locator("h2")).toHaveText("Formatted answer");
  await expect(reply.locator("strong")).toHaveText("Bold item");
  await expect(reply.locator("li code")).toHaveText("inline code");
  await expect(reply.locator("pre code.language-html")).toHaveText('<div class="card">Copy this HTML</div>');
  await expect(reply.locator(".codeCopyButton")).toHaveAccessibleName("Copy");
  await expect(reply.locator(".codeSaveButton")).toHaveAccessibleName("Save");
  await expect(reply.locator(".previewBtn")).toBeVisible();
  await expect(reply.locator("blockquote")).toHaveText("A quote");
  await expect(reply.locator("a")).toHaveAttribute("rel", "noopener noreferrer");
  await expect(reply.locator("a")).toHaveAttribute("target", "_blank");
  await expect(reply.locator("script")).toHaveCount(0);
  expect(await page.evaluate(() => window.markdownUnsafe)).toBeUndefined();

  await page.evaluate(() => {
    window.copiedCode = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {writeText: async (text) => { window.copiedCode = text; }},
    });
  });
  await reply.locator(".codeCopyButton").click();
  await expect.poll(() => page.evaluate(() => window.copiedCode)).toBe('<div class="card">Copy this HTML</div>\n');

  const htmlDownloadPromise = page.waitForEvent("download");
  await reply.locator(".codeSaveButton").click();
  const htmlDownload = await htmlDownloadPromise;
  expect(htmlDownload.suggestedFilename()).toMatch(/^llm-speed-chat-code-.*\.html$/);
});

test("saves a standalone HTML assistant reply as an HTML document", async ({ page }) => {
  await page.locator("#prompt").fill("html-only-message");
  await page.locator("#sendBtn").click();

  const reply = page.locator(".msg.assistant").last();
  await expect(reply.locator("pre code.language-html")).toContainText("Saved HTML");
  const downloadPromise = page.waitForEvent("download");
  await reply.locator(".messageAction[data-action='save']").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^llm-speed-chat-answer-.*\.html$/);
});

test("api url changes auto-discover models without manual refresh", async ({ page }) => {
  await expect(page.locator("#apiStatus")).toContainText("Loaded 1 model");
  await expect(page.locator("#model")).toHaveValue("demo-model");

  await page.locator("#apiBaseUrl").fill("");
  await page.locator("#apiBaseUrl").blur();
  await expect(page.locator("#apiStatus")).toContainText("Enter an API URL to auto-detect models.");
  await expect(page.locator("#model")).toHaveValue("");

  await page.locator("#apiBaseUrl").fill(`http://127.0.0.1:${UPSTREAM_PORT}`);
  await page.locator("#apiBaseUrl").blur();

  await expect(page.locator("#apiStatus")).toContainText("Loaded 1 model");
  await expect(page.locator("#model")).toHaveValue("demo-model");
});

test("model refresh surfaces upstream retry timing from forwarded Retry-After headers", async ({ page }) => {
  await expect(page.locator("#apiStatus")).toContainText("Loaded 1 model");

  await page.locator("#apiKey").fill("rate-limit-models");
  await page.locator("#connectBtn").click();

  await expect(page.locator("#apiStatus")).toContainText("Failed to load models: model list rate limit. Retry in 11s.");
});

test("multi-turn chat preserves prior context across sends", async ({ page }) => {
  await page.locator("#prompt").fill("first turn memory");
  await page.locator("#sendBtn").click();
  await expect(page.locator(".msg.assistant").last()).toContainText("Hello from the browser test.");

  await page.locator("#prompt").fill("recall-last-user");
  await page.locator("#sendBtn").click();

  const assistantMessages = page.locator(".msg.assistant");
  await expect(assistantMessages).toHaveCount(2);
  await expect(assistantMessages.nth(1)).toContainText("Earlier you said: first turn memory");
});

test("cancel keeps partial output visible but does not append assistant reply to history", async ({ page }) => {
  await page.locator("#prompt").fill("cancel-me");
  await page.locator("#sendBtn").click();

  await expect(page.locator(".msg.assistant").last()).toContainText("Starting long answer.");
  await page.locator("#cancelBtn").click();
  await expect(page.locator(".msg.assistant").last()).toContainText("Generation cancelled.");

  await page.locator("#prompt").fill("hello after cancel");
  await page.locator("#sendBtn").click();

  const userMessages = page.locator(".msg.user");
  await expect(userMessages).toHaveCount(2);
  await expect(userMessages.nth(0)).toContainText("cancel-me");
  await expect(userMessages.nth(1)).toContainText("hello after cancel");

  const assistantMessages = page.locator(".msg.assistant");
  await expect(assistantMessages).toHaveCount(2);
  await expect(assistantMessages.nth(0)).toContainText("Generation cancelled.");
  await expect(assistantMessages.nth(1)).toContainText("Hello from the browser test.");
});

test("keeps the next prompt editable while an answer is streaming", async ({ page }) => {
  await page.locator("#prompt").fill("cancel-me");
  await page.locator("#sendBtn").click();

  await expect(page.locator(".msg.assistant").last()).toContainText("Starting long answer.");
  await expect(page.locator("#prompt")).toBeEnabled();
  await expect(page.locator("#sendBtn")).toBeDisabled();

  await page.locator("#prompt").fill("next prompt");
  await page.locator("#prompt").press("Enter");
  await expect(page.locator("#prompt")).toHaveValue("next prompt\n");

  await page.locator("#cancelBtn").click();
  await expect(page.locator("#prompt")).toHaveValue("next prompt\n");
  await expect(page.locator("#sendBtn")).toBeEnabled();
});

test("client-side request-size guardrail blocks oversized payloads before /chat", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${SMALL_LIMIT_APP_PORT}`,
  });
  const page = await context.newPage();
  await page.goto("/");

  await expect(page.locator("#apiStatus")).toContainText("Loaded 1 model");
  await expect(page.locator("#model")).toHaveValue("demo-model");

  let chatRequests = 0;
  await page.route("**/chat", async (route) => {
    chatRequests += 1;
    await route.continue();
  });

  const oversizedPrompt = "x".repeat(21000);
  await page.locator("#prompt").fill(oversizedPrompt);
  await expect(page.locator("#requestSizeHint")).toContainText("20");

  await page.locator("#sendBtn").click();

  await expect(page.locator(".msg.assistant.err").last()).toContainText("Request exceeds the configured limit");
  await expect(page.locator(".msg.user")).toHaveCount(0);
  await expect(page.locator("#prompt")).toHaveValue(oversizedPrompt);
  expect(chatRequests).toBe(0);

  await context.close();
});

test("upstream chat rate limits preserve retry timing and restore the draft", async ({ page }) => {
  await expect(page.locator("#apiStatus")).toContainText("Loaded 1 model");
  await expect(page.locator("#model")).toHaveValue("demo-model");

  await page.locator("#prompt").fill("upstream-rate-limit");
  await page.locator("#sendBtn").click();

  await expect(page.locator(".msg.assistant.err").last()).toContainText("ERROR: upstream rate limit. Retry in 7s.");
  await expect(page.locator("#prompt")).toHaveValue("upstream-rate-limit");
});

test("clear resets the local benchmark session", async ({ page }) => {
  await page.locator("#prompt").fill("hello once");
  await page.locator("#sendBtn").click();
  await expect(page.locator(".msg.assistant").last()).toContainText("Hello from the browser test.");
  await expect(page.locator("#tokens")).toHaveText("5");

  await page.locator("#clearBtn").click();

  await expect(page.locator(".msg")).toHaveCount(0);
  await expect(page.locator("#chat")).toContainText("Start a multi-turn conversation");
  await expect(page.locator("#tokens")).toHaveText("--");
  await expect(page.locator("#prompt")).toHaveValue("");
});

async function startProcess(command, args, envOverrides, expected) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      ...envOverrides,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForOutput(child, expected);
  return child;
}

async function waitForOutput(child, expected) {
  if (!child) throw new Error("process not started");
  if (child.exitCode !== null) {
    throw new Error(`process exited early with code ${child.exitCode}`);
  }

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timed out waiting for output: ${expected}`));
    }, 15000);

    const onData = (chunk) => {
      const text = String(chunk);
      if (text.includes(expected)) {
        cleanup();
        resolve();
      }
    };

    const onExit = (code) => {
      cleanup();
      reject(new Error(`process exited before ready: ${code}`));
    };

    const cleanup = () => {
      clearTimeout(timer);
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
      child.off("exit", onExit);
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", onExit);
  });
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}
