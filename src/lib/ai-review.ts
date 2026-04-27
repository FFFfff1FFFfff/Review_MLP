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
const SYSTEM_PROMPT = `You write very short, natural-sounding draft Google reviews for small businesses, based on a brief input from a happy customer. The customer will see your output in a textarea and can edit it before posting.

Constraints:
- Sound human, not templated. Vary phrasing and openers each time — even if the input is similar.
- 1 sentence, 10-25 words total. Brevity matters more than polish; a real customer writing quickly wouldn't produce more than this.
- If a business type is provided, use vocabulary a real customer of that kind of place would use (e.g. "haircut" / "stylist" for a hair salon, "latte" / "barista" for a coffee shop) — but only for type-appropriate language, not invented details.
- If the customer's note is non-empty, lean on the sentiment they expressed. If empty, write something plain and authentic.
- Avoid corporate or formal language. No emojis. No exclamation marks. No gushing ("amazing", "incredible", "the best").
- Don't always start with "I". Mix up openers (the business name, the experience, a feeling, the visit).
- Don't invent specific facts (services received, prices, staff names, particular menu items) the customer didn't mention.
- Output the review text only — no preamble, no quotes, no explanation.`;

export async function generateSuggestedReview(
  businessName: string,
  businessType: string | null,
  customerNote: string | null
): Promise<string> {
  const note = customerNote?.trim() || "(none provided)";
  const typeLine = businessType?.trim()
    ? `\nBusiness type: ${businessType.trim()}`
    : "";
  const userPrompt = `Business: ${businessName}${typeLine}\nCustomer's optional note: ${note}\n\nWrite the draft Google review.`;

  const response = await getClient().messages.create({
    model: "claude-opus-4-7",
    max_tokens: 120,
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
