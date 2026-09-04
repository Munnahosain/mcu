import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { eventTitle, eventCategory, eventDate, apiKey } = await req.json();

    if (!apiKey) {
        return NextResponse.json({ success: false, error: 'No API key provided.' }, { status: 400 });
    }

    const groq = new Groq({ apiKey });
    
    const prompt = `You are an expert AI Content Planner and Stock Photography Strategist. 
I need a highly actionable content strategy for the following event:
Event: ${eventTitle}
Category: ${eventCategory}
Date: ${eventDate}

Please provide the output EXACTLY as a raw JSON object with no markdown formatting, no backticks, and no conversational text.
Structure the JSON exactly like this:
{
  "stock_ideas": ["Professional description of what photo to take/buy 1", "Idea 2", "Idea 3"],
  "uploader_insight": {
    "orientation": "Vertical or Horizontal",
    "content_style": "Minimalist, Lifestyle, Flat-lay, Corporate, etc.",
    "advice": "Short sentence on why this style works best for this specific event."
  },
  "keywords": ["trending keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"],
  "prompts": ["Cinematic lighting, 8k, bokeh, highly detailed midjourney prompt...", "Prompt 2..."],
  "captions": ["Engaging social media caption with 3 hashtags...", "Caption 2"]
}`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const resultText = response.choices[0]?.message?.content?.trim() || "{}";
    const resultJson = JSON.parse(resultText);

    return NextResponse.json({ success: true, data: resultJson });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("AI Generation failed:", err);
    return NextResponse.json({ success: false, error: err.message || 'AI Generation failed' }, { status: 500 });
  }
}
