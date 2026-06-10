import OpenAI from "openai";
import { OPENROUTER_API_KEY } from "astro:env/server";
import type { CanvasBlocks } from "@/types";

const BMC_KEYS = [
  "key_partners",
  "key_activities",
  "key_resources",
  "value_propositions",
  "customer_relationships",
  "channels",
  "customer_segments",
  "cost_structure",
  "revenue_streams",
] as const;

const BMC_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    key_partners: { type: "string" },
    key_activities: { type: "string" },
    key_resources: { type: "string" },
    value_propositions: { type: "string" },
    customer_relationships: { type: "string" },
    channels: { type: "string" },
    customer_segments: { type: "string" },
    cost_structure: { type: "string" },
    revenue_streams: { type: "string" },
  },
  required: ["name", ...BMC_KEYS],
  additionalProperties: false,
};

export async function generateBMCCanvas(idea: string): Promise<{ name: string } & CanvasBlocks> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured — add it to .dev.vars and restart npm run dev");
  }

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: OPENROUTER_API_KEY,
  });

  const response = await client.chat.completions.create({
    model: "openai/gpt-4o",
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "bmc_canvas",
        strict: true,
        schema: BMC_SCHEMA,
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You are a business model expert. Given a business idea, fill each of the 9 Business Model Canvas blocks with 2-4 concise, idea-specific bullet points (separate bullets with newlines). Also provide a short 3-6 word canvas title as 'name'. Be specific and actionable.",
      },
      {
        role: "user",
        content: idea,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from AI");
  }

  return JSON.parse(content) as { name: string } & CanvasBlocks;
}
