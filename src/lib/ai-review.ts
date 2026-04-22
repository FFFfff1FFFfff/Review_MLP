import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

// The whole point of generating per-customer is to avoid Google's
// templated-review filter — so the prompt biases hard toward variety in
// phrasing, length, and openers. Customer can edit the result before pasting.
const SYSTEM_PROMPT = `You write short, natural-sounding draft Google reviews for small businesses, based on a brief input from a happy customer. The customer will see your output in a textarea and can edit it before posting.

Constraints:
- Sound human, not templated. Vary phrasing, sentence structure, and length each time you're called — even if the input is similar.
- 1-3 sentences, 20-80 words total.
- If the customer's note is non-empty, build on the sentiment they expressed. If empty, write something general but warm and authentic.
- Avoid corporate or formal language. No emojis. No exclamation chains.
- Don't always start with "I". Mix up openers (the business name, the experience, a feeling, the visit).
- Don't invent specific facts (services received, prices, staff names) the customer didn't mention.
- Output the review text only — no preamble, no quotes, no explanation.`;

export async function generateSuggestedReview(
  businessName: string,
  customerNote: string | null
): Promise<string> {
  const note = customerNote?.trim() || "(none provided)";
  const userPrompt = `Business: ${businessName}\nCustomer's optional note: ${note}\n\nWrite the draft Google review.`;

  const response = await getClient().messages.create({
    model: "claude-opus-4-7",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }]
  });

  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  text = text.trim();
  if (!text) throw new Error("empty AI response");
  return text;
}
