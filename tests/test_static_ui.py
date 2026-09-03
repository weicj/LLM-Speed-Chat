from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "src" / "llm_speed_chat" / "static" / "app.js"
INDEX_HTML = ROOT / "src" / "llm_speed_chat" / "static" / "index.html"
STYLES_CSS = ROOT / "src" / "llm_speed_chat" / "static" / "styles.css"


class StaticUiTest(unittest.TestCase):
    def test_index_exposes_core_benchmark_controls(self) -> None:
        source = INDEX_HTML.read_text(encoding="utf-8")

        self.assertIn('id="apiBaseUrl"', source)
        self.assertIn('id="apiKey"', source)
        self.assertIn('id="model"', source)
        self.assertIn('id="maxTokens"', source)
        self.assertIn('id="temp"', source)
        self.assertIn('id="connectBtn"', source)
        self.assertNotIn("<details", source)
        self.assertIn('id="prompt"', source)
        self.assertIn('id="sendBtn"', source)
        self.assertIn('id="cancelBtn"', source)
        self.assertIn('id="clearBtn"', source)
        self.assertIn('id="requestSizeHint"', source)
        self.assertIn('id="promptThroughput"', source)
        self.assertIn('id="decodeSpeed"', source)
        self.assertIn('id="tokens"', source)
        self.assertIn('id="wallTime"', source)
        self.assertNotIn('id="requestMeta"', source)
        self.assertIn('id="previewModal"', source)
        self.assertIn('id="fileInput"', source)
        self.assertIn('id="thinkingEnabled"', source)
        self.assertIn('id="thinkingBudget"', source)
        self.assertIn('id="metricBackend"', source)
        self.assertIn('id="languageButton"', source)
        self.assertIn('id="languageMenu"', source)
        self.assertIn('href="https://github.com/weicj/llm-speed-chat"', source)
        self.assertNotIn('id="modelName"', source)

    def test_app_supports_streaming_chat_metrics_and_recovery(self) -> None:
        source = APP_JS.read_text(encoding="utf-8")

        self.assertIn("new AbortController()", source)
        self.assertIn("buildConnectionPayload()", source)
        self.assertIn("queueModelLoad(", source)
        self.assertIn('messages: history.concat([{role: "user", content}])', source)
        self.assertIn('response.headers.get("Retry-After")', source)
        self.assertIn("Request exceeds the configured limit", source)
        self.assertIn("Generation cancelled. This partial reply was not added to history.", source)
        self.assertIn("sessionStorage", source)
        self.assertIn("renderRequestSizeHint()", source)
        self.assertNotIn("requestMetaEl", source)
        self.assertIn("previewFrame", source)
        self.assertIn("input_audio", source)
        self.assertIn("Open sandboxed preview", source)
        self.assertIn("thinkingBudget", source)
        self.assertIn("thinking_budget_tokens", source)
        self.assertIn("stream_options: {include_usage: true}", source)
        self.assertIn("continuous_usage_stats", source)
        self.assertIn("return_token_ids = true", source)
        self.assertIn("timings_per_token = true", source)
        self.assertIn("currentFramework", source)
        self.assertIn("detectedFramework", source)
        self.assertIn("modelMetadataById", source)
        self.assertIn("setInterval(render, 100)", source)
        self.assertIn("recordEvent(event, choice", source)
        self.assertIn("timings.prompt_n", source)
        self.assertIn("timings.predicted_n", source)
        self.assertIn("recordDecodeTokens", source)
        self.assertIn("latestLlamaDecodeRate", source)
        self.assertIn('framework === "llamacpp" ? latestLlamaDecodeRate : null', source)
        self.assertIn("finish({completed})", source)
        self.assertNotIn("decodeTimingRate", source)
        self.assertIn("chat_template_kwargs: {enable_thinking: thinkingEnabledEl.checked}", source)
        self.assertIn("reasoning_content", source)
        self.assertIn("renderReasoningMessage", source)
        self.assertIn("window.marked.parse", source)
        self.assertIn("window.DOMPurify.sanitize", source)
        self.assertIn("copyMessage", source)
        self.assertIn("copyText", source)
        self.assertIn("codeCopyButton", source)
        self.assertIn("saveMessage", source)
        self.assertIn("retryMessage", source)
        self.assertIn('event.key === "Enter" && !event.shiftKey', source)
        self.assertIn("!activeRequestController", source)
        self.assertNotIn("promptEl.disabled = isRunning", source)
        self.assertIn("return budget === 0 ? -1 : budget", source)
        self.assertIn("TRANSLATIONS", source)
        self.assertNotIn("attachmentStatusHint", source)

    def test_styles_define_text_first_chat_layout(self) -> None:
        source = STYLES_CSS.read_text(encoding="utf-8")

        self.assertIn(".toolbar", source)
        self.assertIn(".headerActions", source)
        self.assertIn(".repoLink", source)
        self.assertIn(".stats", source)
        self.assertIn(".chatShell", source)
        self.assertIn(".emptyState", source)
        self.assertIn(".msg.user", source)
        self.assertIn(".msg.assistant.cancelled", source)
        self.assertIn(".advancedGrid", source)
        self.assertIn("grid-template-columns:repeat(5,minmax(0,1fr))", source)
        self.assertIn(".detectModels", source)
        self.assertIn(".hint[data-state=\"error\"]", source)
        self.assertNotIn(".requestMeta", source)
        self.assertIn(".previewModal", source)
        self.assertIn(".attachments", source)
        self.assertIn(".reasoningMessage", source)
        self.assertIn(".reasoningContent", source)
        self.assertIn("max-height:7.75em", source)
        self.assertIn(".msg.assistant pre", source)
        self.assertIn(".msg.assistant table", source)
        self.assertIn(".messageActions", source)
        self.assertIn(".composerMain", source)


if __name__ == "__main__":
    unittest.main()
