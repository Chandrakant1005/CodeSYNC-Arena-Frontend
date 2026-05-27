import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiCode, FiPlay, FiRefreshCcw, FiSlash, FiXCircle } from "react-icons/fi";

const languageOptions = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" }
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepEqual(left, right) {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => rightKeys.includes(key) && deepEqual(left[key], right[key]))
    );
  }

  return false;
}

function formatValue(value) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
}

function buildJavaScriptExecutor(code) {
  const capturedLogs = [];
  const sandboxConsole = {
    log: (...args) => capturedLogs.push(args.map((arg) => formatValue(arg)).join(" ")),
    error: (...args) => capturedLogs.push(args.map((arg) => formatValue(arg)).join(" ")),
    warn: (...args) => capturedLogs.push(args.map((arg) => formatValue(arg)).join(" "))
  };

  const module = { exports: {} };
  const evaluator = new Function(
    "module",
    "exports",
    "console",
    `${code}\nreturn module.exports;`
  );

  evaluator(module, module.exports, sandboxConsole);

  return {
    exports: module.exports,
    logs: capturedLogs
  };
}

function isSafeJavaScriptIdentifier(value) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

async function runFunctionTestCasesWithCode(code, testCases, options = {}) {
  const { functionName } = options;
  const executable = buildJavaScriptExecutor(code);
  const exportedValue = executable.exports;
  const selectedTestCases = Array.isArray(options.testCases) ? options.testCases : testCases;
  let resolvedFunction =
    functionName && exportedValue && typeof exportedValue === "object"
      ? exportedValue[functionName]
      : undefined;

  if (!resolvedFunction && !functionName && typeof exportedValue === "function") {
    resolvedFunction = exportedValue;
  }

  if (!resolvedFunction && functionName && isSafeJavaScriptIdentifier(functionName)) {
    resolvedFunction = new Function(
      `${code}\nreturn typeof ${functionName} !== "undefined" ? ${functionName} : undefined;`
    )();
  }

  if (typeof resolvedFunction !== "function") {
    throw new Error(
      functionName
        ? `Function "${functionName}" was not found in the editor code.`
        : "No callable function was found in the editor code."
    );
  }

  const results = [];

  for (const testCase of selectedTestCases) {
    const args = Array.isArray(testCase?.input)
      ? testCase.input
      : Array.isArray(testCase?.args)
        ? testCase.args
        : testCase?.input !== undefined
          ? [testCase.input]
          : [];

    try {
      const actual = await resolvedFunction(...args);
      const passed = deepEqual(actual, testCase.expected);

      results.push({
        name: testCase?.name || `Test ${results.length + 1}`,
        passed,
        details: passed
          ? `Expected ${formatValue(testCase.expected)} and received ${formatValue(actual)}.`
          : `Expected ${formatValue(testCase.expected)} but received ${formatValue(actual)}.`
      });
    } catch (error) {
      results.push({
        name: testCase?.name || `Test ${results.length + 1}`,
        passed: false,
        details: error instanceof Error ? error.message : "Execution failed."
      });
    }
  }

  return {
    summary: `${results.filter((item) => item.passed).length}/${results.length} tests passed`,
    results,
    logs: executable.logs
  };
}

export default function CodeEditorPanel({
  content,
  language,
  testCases,
  validationScript,
  isOwner,
  embedded = false,
  canCurrentUserEdit,
  canGuestsEdit,
  updatedAt,
  updatedBy,
  onToggleGuestsEditing,
  onResetEditor,
  onChangeLanguage,
  onChangeContent,
  onChangeTestCases,
  onChangeValidationScript
}) {
  const [verificationResult, setVerificationResult] = useState(null);
  const statusCopy = useMemo(() => {
    if (isOwner) {
      return canGuestsEdit ? "Everyone can edit" : "Only you can edit";
    }

    return canCurrentUserEdit ? "Editing enabled by owner" : "Read-only editor";
  }, [canCurrentUserEdit, canGuestsEdit, isOwner]);

  const lineNumbers = useMemo(() => {
    const totalLines = Math.max((content || "").split("\n").length, 1);
    return Array.from({ length: totalLines }, (_, index) => index + 1).join("\n");
  }, [content]);

  const updatedCopy = updatedAt
    ? `Last update ${new Date(updatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })}${updatedBy ? ` by ${updatedBy}` : ""}`
    : "Ready for collaboration";

  const wrapperClass = embedded ? "code-editor-panel code-editor-panel-embedded" : "code-editor-panel";

  useEffect(() => {
    if (!verificationResult) {
      return undefined;
    }

    const timer = window.setTimeout(() => setVerificationResult(null), 3200);
    return () => window.clearTimeout(timer);
  }, [verificationResult]);

  function normalizeVerificationResult(rawResult) {
    if (Array.isArray(rawResult)) {
      return {
        summary: `${rawResult.filter((item) => item?.passed).length}/${rawResult.length} tests passed`,
        results: rawResult
      };
    }

    if (rawResult && typeof rawResult === "object") {
      const results = Array.isArray(rawResult.results) ? rawResult.results : [];
      return {
        summary:
          rawResult.summary ||
          `${results.filter((item) => item?.passed).length}/${results.length} tests passed`,
        results
      };
    }

    return {
      summary: "Verifier did not return a valid result.",
      results: []
    };
  }

  function handleRunVerification() {
    Promise.resolve()
      .then(async () => {
        const parsedTestCases = JSON.parse(testCases || "[]");
        const verifier = new Function(
          "code",
          "language",
          "testCases",
          "runFunctionTestCases",
          `"use strict";\n${validationScript || "return [];"}`
        );
        const rawResult = await verifier(
          content,
          language,
          parsedTestCases,
          (options) => runFunctionTestCasesWithCode(content, parsedTestCases, options)
        );
        setVerificationResult({
          status: "success",
          ...normalizeVerificationResult(rawResult)
        });
      })
      .catch((error) => {
        setVerificationResult({
          status: "error",
          summary: "Verification failed",
          message: error instanceof Error ? error.message : "Unknown verifier error",
          results: []
        });
      });
  }

  return (
    <section className={wrapperClass}>
      <div className="code-editor-header">
        <div>
          <p className="eyebrow">Live Code Editor</p>
          <h3>Collaborative coding surface</h3>
          <p className="code-editor-status">{statusCopy}</p>
        </div>
        <div className="code-editor-actions">
          <label className="code-editor-language">
            <FiCode />
            <select
              value={language}
              onChange={(event) => onChangeLanguage(event.target.value)}
              disabled={!canCurrentUserEdit}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {isOwner ? (
            <button
              type="button"
              className={`code-editor-toggle ${canGuestsEdit ? "active" : ""}`.trim()}
              onClick={() => onToggleGuestsEditing(!canGuestsEdit)}
            >
              {canGuestsEdit ? <FiCode /> : <FiSlash />}
              <span>{canGuestsEdit ? "Guests can edit" : "Lock editing"}</span>
            </button>
          ) : null}
          {isOwner ? (
            <button type="button" className="code-editor-reset" onClick={onResetEditor}>
              <FiRefreshCcw />
              <span>Reset</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className={`code-editor-shell ${canCurrentUserEdit ? "editable" : "readonly"}`.trim()}>
        <div className="code-editor-meta">
          <span>{updatedCopy}</span>
          <span>{language}</span>
        </div>
        <div className="code-editor-workspace">
          <pre className="code-editor-gutter" aria-hidden="true">
            {lineNumbers}
          </pre>
          <textarea
            className="code-editor-input"
            spellCheck="false"
            value={content}
            onChange={(event) => onChangeContent(event.target.value)}
            readOnly={!canCurrentUserEdit}
          />
        </div>
        {!canCurrentUserEdit ? (
          <div className="code-editor-readonly-banner">Waiting for owner to enable editing</div>
        ) : null}
      </div>

      <div className="code-tests-panel">
        <div className="code-tests-header">
          <div>
            <p className="eyebrow">Verification</p>
            <h4>Test cases and verifier script</h4>
          </div>
          <button type="button" className="code-verify-button" onClick={handleRunVerification}>
            <FiPlay />
            <span>Run tests</span>
          </button>
        </div>

        <div className={`code-tests-grid ${isOwner ? "" : "single-column"}`.trim()}>
          <label className="code-tests-field">
            <span>Test cases (JSON)</span>
            <textarea
              value={testCases}
              onChange={(event) => onChangeTestCases(event.target.value)}
              readOnly={!isOwner}
              spellCheck="false"
            />
          </label>

          {isOwner ? (
            <label className="code-tests-field">
              <span>Verification script (JavaScript)</span>
              <textarea
                value={validationScript}
                onChange={(event) => onChangeValidationScript(event.target.value)}
                readOnly={false}
                spellCheck="false"
              />
            </label>
          ) : null}
        </div>

        <div className="code-tests-note">
          {isOwner
            ? "The script runs in the browser with `code`, `language`, parsed `testCases`, and `runFunctionTestCases({ functionName, testCases })` for real JavaScript execution."
            : "Run tests to check the current code against the owner-configured test cases."}
        </div>
      </div>

      {verificationResult ? (
        <div className={`code-tests-toast ${verificationResult.status}`.trim()} role="status">
          <div className="code-tests-toast-icon">
            {verificationResult.status === "success" ? <FiCheckCircle /> : <FiXCircle />}
          </div>
          <div>
            <strong>{verificationResult.summary}</strong>
            {verificationResult.message ? <p>{verificationResult.message}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
