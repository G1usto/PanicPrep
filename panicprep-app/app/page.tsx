"use client";

import { ChangeEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";

type ModeId = "explain" | "simplify" | "summarize" | "quiz";
type FeedbackStatus = "correct" | "almost" | "incorrect";

type QuizQuestion = {
  id: string;
  type: "short" | "multiple";
  question: string;
  options?: string[];
  idealAnswer: string;
  acceptedKeywords: string[];
  strongWording: string;
  example: string;
  explanation: string;
};

type QuizFeedback = {
  status: FeedbackStatus;
  message: string;
};

type QuizState = {
  currentIndex: number;
  answers: string[];
  feedback: Array<QuizFeedback | null>;
  showIdeal: boolean[];
  isComplete: boolean;
};

type HistoryItem = {
  id: string;
  mode: ModeId;
  modeLabel: string;
  imageName: string;
  imagePreview: string;
  response: string;
  prompt: string;
  aiSource?: "mock" | "groq";
  quizState?: QuizState;
  createdAt: string;
};

const STORAGE_KEY = "panicprep-history";
const HISTORY_CHANGE_EVENT = "panicprep-history-change";

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
    "Mock mode cannot read your image yet.\n\nCopy this prompt into ChatGPT/Claude with your image attached for real answers.\n\nThe prompt will ask the AI to read the exact question, use the visible numbers, wording, diagrams, and context, then explain the actual problem step by step.",
  simplify:
    "Mock mode cannot read your image yet.\n\nCopy this prompt into ChatGPT/Claude with your image attached for real answers.\n\nThe prompt will ask the AI to explain the exact visible problem in simple student language and use an example based on the image.",
  summarize:
    "Mock mode cannot read your image yet.\n\nCopy this prompt into ChatGPT/Claude with your image attached for real answers.\n\nThe prompt will ask the AI to summarize only the visible notes or worksheet content and pull out key facts, formulas, definitions, or tasks.",
  quiz:
    "Mock mode cannot read your image yet.\n\nCopy this prompt into ChatGPT/Claude with your image attached for real answers.\n\nMeanwhile, this in-app mock quiz uses sample questions so you can test the quiz flow locally.",
};

const mockQuizQuestions: QuizQuestion[] = [
  {
    id: "exact-source",
    type: "short",
    question: "Before answering from an uploaded worksheet image, what should the AI identify first?",
    idealAnswer: "The AI should identify the exact question or problem shown in the image.",
    acceptedKeywords: ["exact question", "problem shown", "actual problem", "question in the image"],
    strongWording: "First, identify the exact question or problem shown in the image.",
    example: "For example: 'The image asks me to solve for x in the triangle diagram.'",
    explanation: "Starting with the actual visible problem prevents a generic answer.",
  },
  {
    id: "image-evidence",
    type: "multiple",
    question: "Which answer best describes what a real image-based quiz should use?",
    options: [
      "General study tips from the subject",
      "Only the visible words, numbers, diagrams, and context in the image",
      "A random practice worksheet from memory",
      "The shortest possible answer",
    ],
    idealAnswer: "Only the visible words, numbers, diagrams, and context in the image",
    acceptedKeywords: ["visible", "words", "numbers", "diagrams", "context", "image"],
    strongWording: "Use only the visible words, numbers, diagrams, and context in the image.",
    example: "For example: if the image shows a graph, the quiz should ask about that graph's labels and values.",
    explanation: "A useful quiz should be grounded in the student's actual uploaded work.",
  },
  {
    id: "unclear-image",
    type: "short",
    question: "If part of the uploaded image is blurry or cut off, what should the AI do?",
    idealAnswer: "It should say what it cannot read and ask for clarification instead of guessing.",
    acceptedKeywords: ["cannot read", "unclear", "clarify", "ask", "not guess", "blurry"],
    strongWording: "Say exactly what is unclear, then ask the student to clarify that part instead of guessing.",
    example: "For example: 'I can read the equation, but the exponent is blurry. Can you resend that part?'",
    explanation: "This keeps feedback accurate and avoids teaching from made-up details.",
  },
];

const promptInstructions: Record<ModeId, string> = {
  explain: `I am attaching a homework or worksheet image. Read the image carefully and help me with the exact problem shown.

Requirements:
- Identify the exact question or problem in the image before solving.
- Use the actual numbers, wording, diagrams, labels, units, and context visible in the image.
- Explain the solution step by step using the actual problem.
- If anything in the image is unclear, say what you cannot read and ask me to clarify that specific part.
- Do not give a generic study answer.
- Do not solve a different example. Use only the image I attached.`,
  simplify: `I am attaching a homework or worksheet image. Explain the exact problem from the image in simple student language.

Requirements:
- Read the image carefully first.
- Use the actual wording, numbers, diagrams, labels, units, and context visible in the image.
- Explain what the problem is asking in plain language.
- Use a simple example based on the image itself.
- If anything in the image is unclear, say what you cannot read and ask me to clarify that specific part.
- Avoid vague advice.
- Do not make up a different problem.`,
  summarize: `I am attaching a notes or worksheet image. Summarize the actual content visible in the image.

Requirements:
- Read the image carefully first.
- Summarize only the visible notes, worksheet content, questions, diagrams, or instructions.
- Pull out key facts, formulas, definitions, vocabulary, steps, or tasks from the image.
- Keep the summary organized and easy to study.
- If anything in the image is unclear, say what you cannot read and ask me to clarify that specific part.
- Do not summarize generally.
- Do not add outside content unless you clearly label it as extra context.`,
  quiz: `I am attaching a notes or worksheet image. Create quiz questions based only on the visible image content.

Requirements:
- Read the image carefully first.
- Base every question on the actual words, numbers, diagrams, definitions, formulas, or tasks visible in the image.
- Format the quiz so it can become an interactive in-app quiz.
- For each question include: question, question type, ideal answer, acceptable alternative wordings, keywords or concepts to check, explanation, and a short example.
- Include feedback rules for correct, almost correct, and incorrect answers.
- For almost correct answers, explain the stronger wording a student should use.
- Mix short answer and multiple choice questions when the image supports it.
- If anything in the image is unclear, say what you cannot read and avoid making questions about that part.
- Do not invent topics that are not visible in the image.`,
};

function subscribeToHistory(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(HISTORY_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(HISTORY_CHANGE_EVENT, callback);
  };
}

function getHistorySnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
}

function getServerHistorySnapshot() {
  return "[]";
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

function createFreshQuizState(): QuizState {
  return {
    currentIndex: 0,
    answers: mockQuizQuestions.map(() => ""),
    feedback: mockQuizQuestions.map(() => null),
    showIdeal: mockQuizQuestions.map(() => false),
    isComplete: false,
  };
}

function normalizeAnswer(answer: string) {
  return answer.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function evaluateQuizAnswer(question: QuizQuestion, answer: string): QuizFeedback {
  const normalizedAnswer = normalizeAnswer(answer);
  const normalizedIdeal = normalizeAnswer(question.idealAnswer);
  const matchedKeywords = question.acceptedKeywords.filter((keyword) =>
    normalizedAnswer.includes(normalizeAnswer(keyword)),
  );

  if (!normalizedAnswer) {
    return {
      status: "incorrect",
      message: `Not quite yet. ${question.explanation} A strong answer would be: ${question.strongWording}`,
    };
  }

  if (
    normalizedAnswer.includes(normalizedIdeal) ||
    matchedKeywords.length >= Math.min(2, question.acceptedKeywords.length)
  ) {
    return {
      status: "correct",
      message: `Correct. Nice work. ${question.explanation}`,
    };
  }

  if (matchedKeywords.length > 0) {
    return {
      status: "almost",
      message: `You're basically right, but here's the stronger wording: ${question.strongWording} ${question.example}`,
    };
  }

  return {
    status: "incorrect",
    message: `Not quite. The correct idea is: ${question.strongWording} ${question.explanation}`,
  };
}

function getQuizCounts(quizState: QuizState) {
  return quizState.feedback.reduce(
    (counts, item) => {
      if (item?.status === "correct") {
        counts.correct += 1;
      }

      if (item?.status === "almost") {
        counts.almost += 1;
      }

      if (item?.status === "incorrect") {
        counts.incorrect += 1;
      }

      return counts;
    },
    { correct: 0, almost: 0, incorrect: 0 },
  );
}

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<ModeId>("explain");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [activeResponse, setActiveResponse] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [quizState, setQuizState] = useState<QuizState>(() => createFreshQuizState());
  const [activeHistoryId, setActiveHistoryId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [aiSource, setAiSource] = useState<"mock" | "groq">("mock");
  const [apiMessage, setApiMessage] = useState("");
  const [hasResponse, setHasResponse] = useState(false);
  const [copied, setCopied] = useState(false);
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
  const selectedModeMeta = modes.find((mode) => mode.id === selectedMode) ?? modes[0];
  const history = useMemo(() => parseHistory(historySnapshot), [historySnapshot]);
  const generatedPrompt = useMemo(() => {
    return `${promptInstructions[selectedMode]}

Student context:
- Uploaded image file name: ${imageName || "not named yet"}
- Selected PanicPrep mode: ${selectedModeMeta.label}
- Tone: friendly, calm, and clear for a stressed student.

Important: Use the image I attach in this chat as the source of truth. If you cannot read the attached image, tell me that directly instead of guessing.`;
  }, [imageName, selectedMode, selectedModeMeta]);
  const response = hasResponse ? activeResponse || mockResponses[selectedMode] : "";
  const prompt = activePrompt || generatedPrompt;
  const currentQuizQuestion = mockQuizQuestions[quizState.currentIndex];
  const quizCounts = getQuizCounts(quizState);

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImageName(file.name);
    setActiveResponse("");
    setActivePrompt("");
    setActiveHistoryId("");
    setQuizState(createFreshQuizState());
    setAiSource("mock");
    setApiMessage("");
    setLoadingMessage("");
    setHasResponse(false);
    setCopied(false);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  async function requestGroqResponse(nextPrompt: string) {
    const response = await fetch("/api/groq", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: nextPrompt,
        mode: selectedMode,
        imageName: imageName || "Homework image",
        extractedText: "",
      }),
    });
    const data = await response.json();

    if (!response.ok || data.fallback || !data.response) {
      return {
        source: "mock" as const,
        response: mockResponses[selectedMode],
        message: data.error || "Groq is unavailable. Using local mock mode.",
      };
    }

    return {
      source: "groq" as const,
      response: data.response as string,
      message: `Generated with Groq ${data.model || "llama-3.3-70b-versatile"}.`,
    };
  }

  async function handleGenerate() {
    if (!imagePreview) {
      fileInputRef.current?.click();
      return;
    }

    const nextPrompt = generatedPrompt;
    const nextQuizState = selectedMode === "quiz" ? createFreshQuizState() : undefined;
    const nextHistoryId = crypto.randomUUID();
    setIsGenerating(true);
    setLoadingMessage("Reading image...");
    setApiMessage("");
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setLoadingMessage(selectedMode === "quiz" ? "Generating quiz..." : "Thinking...");

    const groqResult = await requestGroqResponse(nextPrompt).catch(() => ({
      source: "mock" as const,
      response: mockResponses[selectedMode],
      message: "Groq request failed. Using local mock mode.",
    }));

    const nextHistoryItem: HistoryItem = {
      id: nextHistoryId,
      mode: selectedMode,
      modeLabel: selectedModeMeta.label,
      imageName: imageName || "Homework image",
      imagePreview,
      response: groqResult.response,
      prompt: nextPrompt,
      aiSource: groqResult.source,
      quizState: nextQuizState,
      createdAt: new Date().toISOString(),
    };

    setActiveResponse(groqResult.response);
    setActivePrompt(nextPrompt);
    setActiveHistoryId(nextHistoryId);
    setAiSource(groqResult.source);
    setApiMessage(groqResult.message);
    if (nextQuizState) {
      setQuizState(nextQuizState);
    }
    setHasResponse(true);
    setCopied(false);
    setIsGenerating(false);
    setLoadingMessage("");
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
    setActiveHistoryId(item.id);
    setAiSource(item.aiSource ?? "mock");
    setApiMessage("");
    setQuizState(item.quizState ?? createFreshQuizState());
    setHasResponse(true);
    setCopied(false);
  }

  function clearHistory() {
    saveHistory([]);
  }

  function saveQuizProgress(nextQuizState: QuizState) {
    if (!activeHistoryId) {
      return;
    }

    saveHistory(
      history.map((item) =>
        item.id === activeHistoryId
          ? {
              ...item,
              quizState: nextQuizState,
              response: activeResponse || item.response,
            }
          : item,
      ),
    );
  }

  function updateQuizAnswer(answer: string) {
    setQuizState((current) => {
      const nextQuizState = {
        ...current,
        answers: current.answers.map((item, index) => (index === current.currentIndex ? answer : item)),
        feedback: current.feedback.map((item, index) => (index === current.currentIndex ? null : item)),
      };

      saveQuizProgress(nextQuizState);
      return nextQuizState;
    });
  }

  function checkQuizAnswer() {
    const nextFeedback = evaluateQuizAnswer(currentQuizQuestion, quizState.answers[quizState.currentIndex]);

    setQuizState((current) => {
      const nextQuizState = {
        ...current,
        feedback: current.feedback.map((item, index) => (index === current.currentIndex ? nextFeedback : item)),
      };

      saveQuizProgress(nextQuizState);
      return nextQuizState;
    });
  }

  function showIdealAnswer() {
    setQuizState((current) => {
      const nextQuizState = {
        ...current,
        showIdeal: current.showIdeal.map((item, index) => (index === current.currentIndex ? true : item)),
      };

      saveQuizProgress(nextQuizState);
      return nextQuizState;
    });
  }

  function goToNextQuestion() {
    setQuizState((current) => {
      const nextIndex = Math.min(current.currentIndex + 1, mockQuizQuestions.length - 1);

      const nextQuizState = {
        ...current,
        currentIndex: nextIndex,
        isComplete: current.currentIndex === mockQuizQuestions.length - 1,
      };

      saveQuizProgress(nextQuizState);
      return nextQuizState;
    });
  }

  function restartQuiz() {
    const nextQuizState = createFreshQuizState();

    setQuizState(nextQuizState);
    saveQuizProgress(nextQuizState);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-8">
        <header className="pt-3 sm:pt-4">
          <p className="text-sm font-medium text-emerald-300">Student panic helper</p>
          <h1 className="mt-2 text-4xl font-bold tracking-normal sm:text-5xl">PanicPrep</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">
            Upload a homework screenshot, pick the kind of help you need, and get a Groq-powered answer when server AI is configured.
          </p>
        </header>

        <section className="rounded-2xl border border-amber-400/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100 sm:rounded-3xl sm:p-4">
          PanicPrep can use Groq when `GROQ_API_KEY` is configured on the server. If it is missing or unavailable, the app stays in local mock mode.
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
                    setActiveHistoryId("");
                    setQuizState(createFreshQuizState());
                    setAiSource("mock");
                    setApiMessage("");
                    setLoadingMessage("");
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
            disabled={isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating
              ? loadingMessage || "Thinking..."
              : imagePreview
                ? `Generate ${selectedModeMeta.label}`
                : "Upload Image to Start"}
          </button>
          {isGenerating ? (
            <p className="mt-3 text-center text-sm text-emerald-200">{loadingMessage || "Thinking..."}</p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
          <div className="flex flex-col gap-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{aiSource === "groq" ? "AI Response" : "Mock AI Response"}</h2>
              <p className="text-sm text-zinc-400">
                {aiSource === "groq"
                  ? "Generated through the server API route."
                  : "Mock mode cannot read your image yet."}
              </p>
            </div>
            <button
              className="w-full rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-300 hover:text-emerald-200 min-[360px]:w-auto"
              type="button"
              onClick={handleCopyPrompt}
            >
              {copied ? "Copied" : "Copy Prompt"}
            </button>
          </div>

          {selectedMode === "quiz" ? (
            <div className="mt-4 rounded-2xl bg-zinc-950 p-3 sm:p-4">
              {apiMessage ? (
                <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm leading-6 text-zinc-300">
                  {apiMessage}
                </div>
              ) : null}
              {aiSource === "groq" && response ? (
                <details className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm leading-6 text-zinc-300">
                  <summary className="cursor-pointer font-semibold text-zinc-100">Groq quiz draft</summary>
                  <div className="mt-3 whitespace-pre-line">{response}</div>
                </details>
              ) : null}
              {!quizState.isComplete ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-emerald-300">
                      Question {quizState.currentIndex + 1}/{mockQuizQuestions.length}
                    </p>
                    <p className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
                      {currentQuizQuestion.type === "multiple" ? "Multiple choice" : "Short answer"}
                    </p>
                  </div>

                  <p className="text-base font-semibold leading-7 text-zinc-100">{currentQuizQuestion.question}</p>

                  {currentQuizQuestion.type === "multiple" && currentQuizQuestion.options ? (
                    <div className="grid gap-2">
                      {currentQuizQuestion.options.map((option) => {
                        const isSelected = quizState.answers[quizState.currentIndex] === option;

                        return (
                          <button
                            key={option}
                            className={`rounded-2xl border p-3 text-left text-sm leading-6 transition ${
                              isSelected
                                ? "border-emerald-300 bg-emerald-300 text-zinc-950"
                                : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-zinc-600"
                            }`}
                            type="button"
                            onClick={() => updateQuizAnswer(option)}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-zinc-300">Your answer</span>
                    <textarea
                      className="min-h-24 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300"
                      value={quizState.answers[quizState.currentIndex]}
                      placeholder="Type your answer in your own words."
                      onChange={(event) => updateQuizAnswer(event.target.value)}
                    />
                  </label>

                  {quizState.feedback[quizState.currentIndex] ? (
                    <div
                      className={`rounded-2xl border p-3 text-sm leading-6 ${
                        quizState.feedback[quizState.currentIndex]?.status === "correct"
                          ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                          : quizState.feedback[quizState.currentIndex]?.status === "almost"
                            ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                            : "border-rose-300/40 bg-rose-300/10 text-rose-100"
                      }`}
                    >
                      <p className="font-semibold">
                        {quizState.feedback[quizState.currentIndex]?.status === "correct"
                          ? "Correct"
                          : quizState.feedback[quizState.currentIndex]?.status === "almost"
                            ? "Almost correct"
                            : "Incorrect"}
                      </p>
                      <p className="mt-1">{quizState.feedback[quizState.currentIndex]?.message}</p>
                    </div>
                  ) : null}

                  {quizState.showIdeal[quizState.currentIndex] ? (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm leading-6 text-zinc-200">
                      <p className="font-semibold text-zinc-100">Ideal answer</p>
                      <p className="mt-1">{currentQuizQuestion.idealAnswer}</p>
                      <p className="mt-2 text-zinc-400">{currentQuizQuestion.example}</p>
                    </div>
                  ) : null}

                  <div className="grid gap-2 min-[380px]:grid-cols-3">
                    <button
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
                      type="button"
                      onClick={checkQuizAnswer}
                    >
                      Check
                    </button>
                    <button
                      className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-emerald-300"
                      type="button"
                      onClick={showIdealAnswer}
                    >
                      Show ideal
                    </button>
                    <button
                      className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      disabled={!quizState.feedback[quizState.currentIndex]}
                      onClick={goToNextQuestion}
                    >
                      {quizState.currentIndex === mockQuizQuestions.length - 1 ? "Finish" : "Next"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">Quiz summary</p>
                    <h3 className="mt-1 text-2xl font-bold">
                      {quizCounts.correct}/{mockQuizQuestions.length} correct
                    </h3>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl bg-emerald-300/10 p-3">
                      <p className="text-xl font-bold text-emerald-200">{quizCounts.correct}</p>
                      <p className="text-xs text-zinc-400">Correct</p>
                    </div>
                    <div className="rounded-2xl bg-amber-300/10 p-3">
                      <p className="text-xl font-bold text-amber-200">{quizCounts.almost}</p>
                      <p className="text-xs text-zinc-400">Almost</p>
                    </div>
                    <div className="rounded-2xl bg-rose-300/10 p-3">
                      <p className="text-xl font-bold text-rose-200">{quizCounts.incorrect}</p>
                      <p className="text-xs text-zinc-400">Review</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm leading-6 text-zinc-200">
                    <p className="font-semibold text-zinc-100">What to review next</p>
                    <p className="mt-1">
                      Review how to anchor answers to the exact image, use visible evidence, and ask for clarification when an image is unclear.
                    </p>
                  </div>

                  <button
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
                    type="button"
                    onClick={restartQuiz}
                  >
                    Restart quiz
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-zinc-950 p-4">
              {apiMessage ? (
                <p className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm leading-6 text-zinc-300">
                  {apiMessage}
                </p>
              ) : null}
              <div className="min-h-28 whitespace-pre-line text-sm leading-7 text-zinc-200">
                {response ||
                  "Mock mode cannot read your image yet.\n\nUpload an image and choose a mode to prepare a stronger prompt for ChatGPT/Claude."}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-zinc-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Prompt for ChatGPT or Claude</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-300">{prompt}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
          <h2 className="text-lg font-semibold">Server AI Settings</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Add `GROQ_API_KEY=your_key_here` to `.env.local` and restart Next.js to enable Groq. The key is read only by `app/api/groq/route.ts` and is never pasted into the browser.
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
