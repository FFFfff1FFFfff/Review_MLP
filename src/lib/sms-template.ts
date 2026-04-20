const DEFAULT_TEMPLATE =
  "Hi! {owner_first_name} from {business_name} here. How was your visit? {SHORT_LINK} Reply STOP to opt out.";

interface BusinessLike {
  name: string;
  ownerFirstName: string;
  smsTemplate: string | null;
}

// Interpolate the business's SMS template (or default) for a given review
// request token. Logs a warning if the result exceeds 160 chars (the single-
// segment SMS limit; carrier gateways may split or truncate past that).
export function renderSmsBody(
  business: BusinessLike,
  token: string,
  appUrl: string
): string {
  const template = business.smsTemplate ?? DEFAULT_TEMPLATE;
  const shortLink = `${appUrl}/r/${token}`;
  const body = template
    .replaceAll("{owner_first_name}", business.ownerFirstName)
    .replaceAll("{business_name}", business.name)
    .replaceAll("{SHORT_LINK}", shortLink);
  if (body.length > 160) {
    console.warn(`sms body is ${body.length} chars (>160)`);
  }
  return body;
}
