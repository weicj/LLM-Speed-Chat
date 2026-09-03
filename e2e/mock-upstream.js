const http = require("node:http");

const host = process.env.MOCK_UPSTREAM_HOST || "127.0.0.1";
const port = Number(process.env.MOCK_UPSTREAM_PORT || "18000");

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const bodyText = Buffer.concat(chunks).toString("utf8");

    if (req.method === "GET" && req.url === "/v1/models") {
      if ((req.headers.authorization || "") === "Bearer rate-limit-models") {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": "11",
        });
        res.end(JSON.stringify({error: "model list rate limit"}));
        return;
      }

      const authorization = req.headers.authorization || "";
      const isLocalVllm = authorization === "Bearer local-vllm";
      const isLocalLlama = authorization === "Bearer local-llama";
      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify({
        data: isLocalVllm
          ? [{id: "local-vllm-model", owned_by: "vllm"}]
          : isLocalLlama
            ? [{id: "local-llama-model", owned_by: "llamacpp"}]
            : [{id: "demo-model", root: "demo-root"}],
      }));
      return;
    }

    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      let payload = {};
      try {
        payload = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        res.writeHead(400, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: "invalid json"}));
        return;
      }

      const messages = Array.isArray(payload.messages)
        ? payload.messages.filter((item) => item && typeof item === "object")
        : [];
      const userMessages = messages.filter((item) => item.role === "user");
      const lastUserText = extractMessageText(userMessages.at(-1));

      if (lastUserText.includes("upstream-rate-limit")) {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": "7",
        });
        res.end(JSON.stringify({error: "upstream rate limit"}));
        return;
      }

      if (lastUserText.includes("cancel-me")) {
        streamChunks(res, [
          {delayMs: 0, data: {choices: [{delta: {content: "Starting long answer. "}}]}},
          {delayMs: 1500, data: {choices: [{delta: {content: "This should be interrupted."}}]}},
          {delayMs: 0, data: {usage: {prompt_tokens: 4, completion_tokens: 6}}},
        ]);
        return;
      }

      if (lastUserText.includes("thinking-message")) {
        streamChunks(res, [
          {delayMs: 0, data: {choices: [{delta: {reasoning_content: "Line one\nLine two\nLine three\nLine four\nLine five\nLine six"}}]}},
          {delayMs: 0, data: {choices: [{delta: {content: "Answer after thinking."}}]}},
          {delayMs: 0, data: {usage: {prompt_tokens: 7, completion_tokens: 3}}},
        ]);
        return;
      }

      if (lastUserText.includes("thinking-unlimited")) {
        streamChunks(res, [
          {delayMs: 0, data: {choices: [{delta: {content: `Thinking budget: ${payload.thinking_budget_tokens}; template thinking: ${payload.chat_template_kwargs && payload.chat_template_kwargs.enable_thinking}`}}]}},
          {delayMs: 0, data: {usage: {prompt_tokens: 4, completion_tokens: 3}}},
        ]);
        return;
      }

      if (lastUserText.includes("thinking-disabled")) {
        streamChunks(res, [
          {delayMs: 0, data: {choices: [{delta: {content: `Template thinking: ${payload.chat_template_kwargs && payload.chat_template_kwargs.enable_thinking}`}}]}},
          {delayMs: 0, data: {usage: {prompt_tokens: 4, completion_tokens: 3}}},
        ]);
        return;
      }

      if (lastUserText.includes("markdown-message")) {
        streamChunks(res, [
          {delayMs: 0, data: {choices: [{delta: {content: "## Formatted answer\n\n- **Bold item**\n- `inline code`\n\n```html\n<div class=\"card\">Copy this HTML</div>\n```\n\n> A quote\n\n[Safe link](https://example.com)\n\n<script>window.markdownUnsafe = true</script>"}}]}},
          {delayMs: 0, data: {usage: {prompt_tokens: 6, completion_tokens: 8}}},
        ]);
        return;
      }

      if (lastUserText.includes("html-only-message")) {
        streamChunks(res, [
          {delayMs: 0, data: {choices: [{delta: {content: "```html\n<!doctype html><title>Saved HTML</title>\n```"}}]}},
          {delayMs: 0, data: {usage: {prompt_tokens: 4, completion_tokens: 8}}},
        ]);
        return;
      }

      if (lastUserText.includes("no-usage")) {
        streamChunks(res, [
          {delayMs: 100, data: {choices: [{delta: {content: "Response without "}}]}},
          {delayMs: 150, data: {choices: [{delta: {content: "usage metadata."}}]}},
        ]);
        return;
      }

      if (lastUserText.includes("local-live-metrics")) {
        const includeTokenIds = payload.return_token_ids === true;
        streamChunks(res, [
          {
            delayMs: 100,
            data: includeTokenIds
              ? {prompt_token_ids: [1, 2, 3, 4, 5, 6], choices: [{delta: {role: "assistant"}}]}
              : {choices: [{delta: {role: "assistant"}}]},
          },
          {
            delayMs: 400,
            data: {
              choices: [{delta: {content: "Exact local "}, ...(includeTokenIds ? {token_ids: [7]} : {})}],
            },
          },
          {
            delayMs: 500,
            data: {
              choices: [{delta: {content: "metrics stream."}, ...(includeTokenIds ? {token_ids: [8]} : {})}],
            },
          },
          {
            delayMs: 0,
            data: {
              choices: [{delta: {content: " Done."}, ...(includeTokenIds ? {token_ids: [9]} : {})}],
            },
          },
        ]);
        return;
      }

      if (lastUserText.includes("llama-live-metrics")) {
        streamChunks(res, [
          {
            delayMs: 300,
            data: {
              choices: [{delta: {content: "llama "}}],
              timings: {prompt_n: 11, prompt_per_second: 55, predicted_n: 1, predicted_per_second: 0},
            },
          },
          {
            delayMs: 700,
            data: {
              choices: [{delta: {content: "timings."}}],
              timings: {prompt_n: 11, prompt_per_second: 55, predicted_n: 2, predicted_per_second: 25},
            },
          },
          {
            delayMs: 0,
            data: {
              choices: [{delta: {content: " Live."}}],
              timings: {prompt_n: 11, prompt_per_second: 55, predicted_n: 3, predicted_per_second: 25},
            },
          },
        ]);
        return;
      }

      if (lastUserText.includes("sglang-live-metrics")) {
        const continuousUsage = Boolean(payload.stream_options && payload.stream_options.continuous_usage_stats);
        streamChunks(res, [
          {
            delayMs: 150,
            data: {
              choices: [{delta: {content: "SGLang "}}],
              ...(continuousUsage ? {usage: {prompt_tokens: 9, completion_tokens: 1}} : {}),
            },
          },
          {
            delayMs: 400,
            data: {
              choices: [{delta: {content: "reports usage."}}],
              ...(continuousUsage ? {usage: {prompt_tokens: 9, completion_tokens: 2}} : {}),
            },
          },
        ]);
        return;
      }

      if (lastUserText.includes("recall-last-user")) {
        const previousUserText = extractMessageText(userMessages.at(-2)) || "nothing yet";
        streamChunks(res, [
          {
            delayMs: 0,
            data: {
              choices: [
                {
                  delta: {
                    content: `Earlier you said: ${previousUserText}`,
                  },
                },
              ],
            },
          },
          {
            delayMs: 0,
            data: {
              usage: {prompt_tokens: 8, completion_tokens: 7},
            },
          },
        ]);
        return;
      }

      streamChunks(res, [
        {delayMs: 0, data: {choices: [{delta: {content: "Hello "}}]}},
        {delayMs: 100, data: {choices: [{delta: {content: "from the browser test."}}]}},
        {
          delayMs: 0,
          data: {
            usage: {prompt_tokens: 3, completion_tokens: 5},
          },
        },
      ]);
      return;
    }

    res.writeHead(404, {"Content-Type": "application/json"});
    res.end(JSON.stringify({error: "not found"}));
  });
});

server.listen(port, host, () => {
  process.stdout.write(`mock-upstream listening on http://${host}:${port}\n`);
});

function extractMessageText(message) {
  if (!message || typeof message !== "object") return "";
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";

  return message.content
    .filter((item) => item && typeof item === "object" && item.type === "text")
    .map((item) => String(item.text || ""))
    .join(" ")
    .trim();
}

function streamChunks(res, chunks) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let index = 0;
  const sendNext = () => {
    if (index >= chunks.length) {
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const chunk = chunks[index];
    index += 1;
    res.write(`data: ${JSON.stringify(chunk.data)}\n\n`);

    if (chunk.delayMs > 0) {
      setTimeout(sendNext, chunk.delayMs);
    } else {
      setImmediate(sendNext);
    }
  };

  reqCloseSafe(res, sendNext);
}

function reqCloseSafe(res, start) {
  if (res.destroyed) return;
  res.on("close", () => {
    if (!res.writableEnded) {
      try {
        res.end();
      } catch {
        // Best-effort shutdown on client disconnect.
      }
    }
  });
  start();
}
