import { NextRequest, NextResponse } from "next/server";

const GROQ_MODEL = "llama-3.3-70b-versatile";

type GroqRequestBody = {
  prompt?: string;
  mode?: string;
  imageName?: string;
  extractedText?: string;
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  const body = (await request.json().catch(() => ({}))) as GroqRequestBody;
  const prompt = body.prompt?.trim();
  const extractedText = body.extractedText?.trim();

  if (!prompt) {
    return NextResponse.json(
      {
        ok: false,
        fallback: true,
        error: "Missing prompt.",
      },
      { status: 400 },
    );
  }

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      fallback: true,
      error: "GROQ_API_KEY is not configured. Using local mock mode.",
    });
  }

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are PanicPrep, a calm student homework helper. Use only the text or prompt the app sends. If image content is not provided as OCR/extracted text, say that clearly and ask for the missing text instead of pretending to see an image.",
          },
          {
            role: "user",
            content: [
              `Mode: ${body.mode || "unknown"}`,
              `Uploaded image file name: ${body.imageName || "not provided"}`,
              `Extracted OCR text: ${extractedText || "not available yet"}`,
              "",
              prompt,
            ].join("\n"),
          },
        ],
        temperature: 0.4,
        max_tokens: 900,
      }),
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      return NextResponse.json({
        ok: false,
        fallback: true,
        error: data?.error?.message || "Groq request failed. Using local mock mode.",
      });
    }

    return NextResponse.json({
      ok: true,
      fallback: false,
      model: GROQ_MODEL,
      response: data?.choices?.[0]?.message?.content || "",
    });
  } catch {
    return NextResponse.json({
      ok: false,
      fallback: true,
      error: "Could not reach Groq. Using local mock mode.",
    });
  }
}
