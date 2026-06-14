import OpenAI from "openai";
import { z } from "zod";
import { OPENROUTER_API_KEY } from "astro:env/server";
import type { CanvasBlocks, CanvasCritique } from "@/types";

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

const aiCanvasShape = BMC_KEYS.reduce<z.ZodRawShape>(
  (shape, key) => {
    shape[key] = z.string();
    return shape;
  },
  {
    name: z.string(),
  } satisfies z.ZodRawShape,
);

const aiCanvasSchema = z.object(aiCanvasShape);

export const CRITIQUE_MODEL = "openai/gpt-4o";

export const CRITIQUE_SYSTEM_PROMPT = `You are an expert business model advisor evaluating a Business Model Canvas.

For each of the 9 BMC blocks, return exactly one critique item with:
- category: "consistency" (the block conflicts with or undermines another block), "completeness" (the block is vague, generic, or missing key specifics), or "investor" (an assumption a seed-stage investor would challenge).
- text: 1–2 sentences of direct, actionable feedback specific to the content of the block.

Pay particular attention to:
1. Value Propositions ↔ Customer Segments fit: does the VP address real, named pains of the stated segments?
2. Cost Structure ↔ Revenue Streams balance: are the key costs proportionate to and justified by the revenue model?

Return one critique item per block even if a block appears strong — note the most important missing detail.`;

const CRITIQUE_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(
    BMC_KEYS.map((key) => [
      key,
      {
        type: "object",
        properties: {
          category: { type: "string", enum: ["consistency", "completeness", "investor"] },
          text: { type: "string" },
        },
        required: ["category", "text"],
        additionalProperties: false,
      },
    ]),
  ),
  required: [...BMC_KEYS],
  additionalProperties: false,
};

export async function critiqueBMCCanvas(blocks: CanvasBlocks): Promise<CanvasCritique> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured — add it to .dev.vars and restart npm run dev");
  }

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: OPENROUTER_API_KEY,
  });

  const userMessage = BMC_KEYS.map((key) => {
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return `${label}: ${blocks[key]}`;
  }).join("\n");

  const response = await client.chat.completions.create({
    model: CRITIQUE_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "bmc_critique",
        strict: true,
        schema: CRITIQUE_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: CRITIQUE_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from AI");
  }

  return JSON.parse(content) as CanvasCritique;
}

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

  const parsed: unknown = JSON.parse(content);
  return aiCanvasSchema.parse(parsed) as { name: string } & CanvasBlocks;
}
