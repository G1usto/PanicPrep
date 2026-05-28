"use client";

import { ChangeEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";

type ModeId = "explain" | "simplify" | "summarize" | "quiz";

type HistoryItem = {
  id: string;
  mode: ModeId;
  modeLabel: string;
  imageName: string;
  imagePreview: string;
  response: string;
  prompt: string;
  createdAt: string;
};

const STORAGE_KEY = "panicprep-history";
const API_KEY_STORAGE_KEY = "panicprep-test-api-key";
const HISTORY_CHANGE_EVENT = "panicprep-history-change";
const API_KEY_CHANGE_EVENT = "panicprep-api-key-change";

const modes: Array<{ id: ModeId; label: string; description: string }> = [
  {
    id: "explain",
    label: "Explain",
    description: "Step-by-step help",
  },
  {
    id: "simplify",
    label: "Simplify",
    description: "Make it less scary",
  },
  {
    id: "summarize",
    label: "Summarize",
    description: "Pull out what matters",
  },
  {
    id: "quiz",
    label: "Quiz Me",
    description: "Practice check",
  },
];

const mockResponses: Record<ModeId, string> = {
  explain:
    "Start by identifying what the question is asking, then list the given information. Work one small step at a time, write the formula or rule you are using, and check whether the answer fits the original question.",
  simplify:
    "This looks like a worksheet problem. In plain English: find the important numbers, ignore extra wording, and turn the question into one clear task before solving it.",
  summarize:
    "Key idea: the problem wants you to understand the instructions, choose the right method, and show your work clearly. Focus on the question, the known details, and the final answer format.",
  quiz:
    "Practice round: 1. What is the question asking for? 2. Which details are useful? 3. What rule or formula applies? 4. Can you explain your first step out loud?",
};

function subscribeToHistory(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(HISTORY_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(HISTORY_CHANGE_EVENT, callback);
  };
}

function subscribeToApiKey(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(API_KEY_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(API_KEY_CHANGE_EVENT, callback);
  };
}

function getHistorySnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
}

function getApiKeySnapshot() {
  return window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
}

function getServerHistorySnapshot() {
  return "[]";
}

function getServerApiKeySnapshot() {
  return "";
}

function subscribeToClientReady(callback: () => void) {
  callback();
  return () => {};
}

function getClientReadySnapshot() {
  return true;
}

function getServerClientReadySnapshot() {
  return false;
}

function parseHistory(snapshot: string) {
  try {
    return JSON.parse(snapshot) as HistoryItem[];
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event(HISTORY_CHANGE_EVENT));
}

function saveApiKey(apiKey: string) {
  const trimmedKey = apiKey.trim();

  if (trimmedKey) {
    window.localStorage.setItem(API_KEY_STORAGE_KEY, trimmedKey);
  } else {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
  }

  window.dispatchEvent(new Event(API_KEY_CHANGE_EVENT));
}

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<ModeId>("explain");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [activeResponse, setActiveResponse] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasResponse, setHasResponse] = useState(false);
  const [copied, setCopied] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isClientReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerClientReadySnapshot,
  );
  const historySnapshot = useSyncExternalStore(
    subscribeToHistory,
    getHistorySnapshot,
    getServerHistorySnapshot,
  );
  const savedApiKey = useSyncExternalStore(
    subscribeToApiKey,
    getApiKeySnapshot,
    getServerApiKeySnapshot,
  );

  const selectedModeMeta = modes.find((mode) => mode.id === selectedMode) ?? modes[0];
  const history = useMemo(() => parseHistory(historySnapshot), [historySnapshot]);
  const generatedPrompt = useMemo(() => {
    return `I uploaded a homework or worksheet image named "${imageName || "my image"}". Please ${selectedModeMeta.label.toLowerCase()} it for a stressed student. Keep the answer clear, friendly, and step-by-step when useful.`;
  }, [imageName, selectedModeMeta]);
  const response = hasResponse ? activeResponse || mockResponses[selectedMode] : "";
  const prompt = activePrompt || generatedPrompt;

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImageName(file.name);
    setActiveResponse("");
    setActivePrompt("");
    setHasResponse(false);
    setCopied(false);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  function handleGenerate() {
    if (!imagePreview) {
      fileInputRef.current?.click();
      return;
    }

    const nextResponse = mockResponses[selectedMode];
    const nextPrompt = generatedPrompt;
    const nextHistoryItem: HistoryItem = {
      id: crypto.randomUUID(),
      mode: selectedMode,
      modeLabel: selectedModeMeta.label,
      imageName: imageName || "Homework image",
      imagePreview,
      response: nextResponse,
      prompt: nextPrompt,
      createdAt: new Date().toISOString(),
    };

    setActiveResponse(nextResponse);
    setActivePrompt(nextPrompt);
    setHasResponse(true);
    setCopied(false);
    saveHistory([nextHistoryItem, ...history].slice(0, 8));
  }

  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function restoreHistoryItem(item: HistoryItem) {
    setSelectedMode(item.mode);
    setImageName(item.imageName);
    setImagePreview(item.imagePreview);
    setActiveResponse(item.response);
    setActivePrompt(item.prompt);
    setHasResponse(true);
    setCopied(false);
  }

  function clearHistory() {
    saveHistory([]);
  }

  function handleSaveApiKey() {
    saveApiKey(apiKeyInput);
    setApiKeyInput("");
    setApiKeySaved(true);
    window.setTimeout(() => setApiKeySaved(false), 1800);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-8">
        <header className="pt-3 sm:pt-4">
          <p className="text-sm font-medium text-emerald-300">Student panic helper</p>
          <h1 className="mt-2 text-4xl font-bold tracking-normal sm:text-5xl">PanicPrep</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">
            Upload a homework screenshot, pick the kind of help you need, then copy a ready prompt into ChatGPT or Claude.
          </p>
        </header>

        <section className="rounded-2xl border border-amber-400/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100 sm:rounded-3xl sm:p-4">
          This public MVP uses mock AI responses. Paste the copied prompt into ChatGPT or Claude, or connect real AI later after validation.
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-3 shadow-2xl shadow-black/30 sm:p-4">
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
          />

          <button
            className="flex min-h-44 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-950/70 text-left transition hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 sm:min-h-52"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt="Uploaded homework preview"
                width={360}
                height={288}
                unoptimized
                className="h-full max-h-72 w-full object-contain"
              />
            ) : (
              <span className="flex flex-col items-center gap-3 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-300 text-2xl text-zinc-950">
                  +
                </span>
                <span className="font-semibold">Upload worksheet image</span>
                <span className="text-sm leading-6 text-zinc-400">Tap to add a photo or screenshot.</span>
              </span>
            )}
          </button>

          {imageName ? (
            <p className="mt-3 truncate text-sm text-zinc-400">Selected: {imageName}</p>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
            {modes.map((mode) => {
              const isSelected = mode.id === selectedMode;

              return (
                <button
                  key={mode.id}
                  className={`rounded-2xl border p-3 text-left transition sm:p-4 ${
                    isSelected
                      ? "border-emerald-300 bg-emerald-300 text-zinc-950"
                      : "border-zinc-800 bg-zinc-800 text-white hover:border-zinc-600"
                  }`}
                  type="button"
                  onClick={() => {
                    setSelectedMode(mode.id);
                    setActiveResponse("");
                    setActivePrompt("");
                    setHasResponse(false);
                    setCopied(false);
                  }}
                >
                  <span className="block font-semibold">{mode.label}</span>
                  <span className={`mt-1 block text-xs ${isSelected ? "text-zinc-800" : "text-zinc-400"}`}>
                    {mode.description}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            className="mt-4 w-full rounded-2xl bg-white px-5 py-4 font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 sm:mt-5"
            type="button"
            onClick={handleGenerate}
          >
            {imagePreview ? `Mock ${selectedModeMeta.label} Response` : "Upload Image to Start"}
          </button>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
          <div className="flex flex-col gap-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Mock AI Response</h2>
              <p className="text-sm text-zinc-400">{selectedModeMeta.label}</p>
            </div>
            <button
              className="w-full rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-300 hover:text-emerald-200 min-[360px]:w-auto"
              type="button"
              onClick={handleCopyPrompt}
            >
              {copied ? "Copied" : "Copy Prompt"}
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-950 p-4">
            <p className="min-h-28 text-sm leading-7 text-zinc-200">
              {response || "Your mock response will appear here after you upload an image and choose a mode."}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Prompt for ChatGPT or Claude</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{prompt}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Optional testing only: save an API key locally in this browser. PanicPrep does not send it anywhere yet.
          </p>
          <div className="mt-4 flex flex-col gap-2 min-[380px]:flex-row">
            <input
              className="min-h-12 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300"
              type="password"
              value={apiKeyInput}
              placeholder={isClientReady && savedApiKey ? "Saved locally" : "Paste test API key"}
              autoComplete="off"
              onChange={(event) => {
                setApiKeyInput(event.target.value);
                setApiKeySaved(false);
              }}
            />
            <button
              className="min-h-12 rounded-2xl bg-zinc-100 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
              type="button"
              onClick={handleSaveApiKey}
            >
              {apiKeySaved ? "Saved" : "Save"}
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            {isClientReady && savedApiKey
              ? "A key is saved on this device for future testing."
              : "No key is saved on this device."}
          </p>
        </section>

        <section className="pb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Local History</h2>
            {isClientReady && history.length ? (
              <button className="text-sm text-zinc-400 hover:text-white" type="button" onClick={clearHistory}>
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            {history.length ? (
              history.map((item) => (
                <button
                  key={item.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left transition hover:border-zinc-600"
                  type="button"
                  onClick={() => restoreHistoryItem(item)}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{item.modeLabel}</span>
                    <span className="text-xs text-zinc-500">
                      {new Date(item.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                  <span className="mt-2 block truncate text-sm text-zinc-400">{item.imageName}</span>
                  <span className="mt-2 line-clamp-2 block text-sm leading-6 text-zinc-300">{item.response}</span>
                </button>
              ))
            ) : (
              <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm leading-6 text-zinc-400">
                {isClientReady
                  ? "No saved runs yet. Your last mock responses will stay on this device only."
                  : "Loading local history..."}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
