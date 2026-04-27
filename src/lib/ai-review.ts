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
const PUBLIC_SYSTEM_PROMPT = `You write very short, natural-sounding draft Google reviews for small businesses, based on a brief input from a happy customer. The customer will see your output in a textarea and can edit it before posting.

Constraints:
- Sound human, not templated. Vary phrasing and openers each time — even if the input is similar.
- 1 sentence, 10-25 words total. Brevity matters more than polish; a real customer writing quickly wouldn't produce more than this.
- If a business type is provided, use vocabulary a real customer of that kind of place would use (e.g. "haircut" / "stylist" for a hair salon, "latte" / "barista" for a coffee shop).
- If an "About" section is provided, you may lightly reference one specific aspect from it (e.g. a service the business is known for) — but only what's stated there. Don't invent staff names, prices, particular menu items, or services not listed.
- If the customer's note is non-empty, lean on the sentiment they expressed. If empty, write something plain and authentic.
- Avoid corporate or formal language. No emojis. No exclamation marks. No gushing ("amazing", "incredible", "the best").
- Don't always start with "I". Mix up openers (the business name, the experience, a feeling, the visit).
- Output the review text only — no preamble, no quotes, no explanation.`;

// 1-3★ rows route to private feedback only — the owner is the audience, not
// Google. Tone is constructive, not glowing or apologetic.
const PRIVATE_SYSTEM_PROMPT = `You write very short, natural-sounding drafts of private feedback that a customer would send directly to a small-business owner after a less-than-great visit. The customer will see your output in a textarea and can edit it before sending.

Constraints:
- Sound like a real customer venting briefly but constructively — not a complaint letter, not a Google review.
- 1-2 sentences, 15-35 words total.
- Stick to what the customer's note (if any) actually says. Don't invent specific incidents, staff names, prices, menu items, or services.
- If the customer's note is empty, write something generic about the experience falling short — no fabricated details.
- Avoid corporate language, emojis, exclamation marks, threats, or demands for refunds. No gushing or sarcasm either.
- Output the feedback text only — no preamble, no quotes, no explanation.`;

export async function generateSuggestedReview(
  businessName: string,
  businessType: string | null,
  editorialSummary: string | null,
  ownerDescription: string | null,
  customerNote: string | null,
  rating: number,
  // Match the prompt to the routing decision rather than to rating alone, so a
  // 5★ customer who opted into "Submit privately" gets a private-feedback
  // draft (not a Google review) and a 1★ customer always gets the private one.
  routedTo: "google" | "private"
): Promise<string> {
  const note = customerNote?.trim() || "(none provided)";
  const typeLine = businessType?.trim()
    ? `\nBusiness type: ${businessType.trim()}`
    : "";
  // Owner-written description is the more authoritative grounding (they know
  // their own business better than Google's auto-classification), so it's
  // labeled distinctly. Both feed into the same "About" frame.
  const aboutParts: string[] = [];
  if (editorialSummary?.trim()) {
    aboutParts.push(`From Google: ${editorialSummary.trim()}`);
  }
  if (ownerDescription?.trim()) {
    aboutParts.push(`From owner: ${ownerDescription.trim()}`);
  }
  const aboutBlock = aboutParts.length
    ? `\nAbout this business:\n  ${aboutParts.join("\n  ")}`
    : "";
  const isPrivate = routedTo === "private";
  const userPrompt = `Business: ${businessName}${typeLine}${aboutBlock}\nRating: ${rating}/5\nCustomer's optional note: ${note}\n\n${
    isPrivate
      ? "Write the draft private feedback to the owner."
      : "Write the draft Google review."
  }`;

  const response = await getClient().messages.create({
    model: "claude-opus-4-7",
    max_tokens: 160,
    system: isPrivate ? PRIVATE_SYSTEM_PROMPT : PUBLIC_SYSTEM_PROMPT,
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
