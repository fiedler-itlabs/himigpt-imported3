/**
 * Generic transactional email for the migrated app (EU providers). Unlike
 * notification.ts (owner-only, Forge-compatible), this sends to an arbitrary
 * recipient — used for account-recovery magic links.
 *
 * Provider is picked from the environment (first match wins):
 *   BREVO_API_KEY                       → Brevo (api.brevo.com, EU/GDPR)
 *   SCW_EMAIL_API_KEY [+SCW_EMAIL_REGION, default fr-par]
 *                                       → Scaleway Transactional Email
 *
 * Shared configuration:
 *   EMAIL_FROM       verified sender address (e.g. no-reply@your-domain.eu)
 *   EMAIL_FROM_NAME  optional display name shown as the sender (e.g. the app name)
 *
 * Best-effort: resolves true when the provider accepted the message, false when
 * email is not configured or the provider rejected it. Never throws.
 */

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function sender(): { email: string; name?: string } | null {
  const email = process.env.EMAIL_FROM;
  if (!email) return null;
  const name = process.env.EMAIL_FROM_NAME || undefined;
  return name ? { email, name } : { email };
}

async function sendViaBrevo(
  apiKey: string,
  from: { email: string; name?: string },
  input: SendMailInput
): Promise<boolean> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: from,
      to: [{ email: input.to }],
      subject: input.subject,
      textContent: input.text,
      ...(input.html ? { htmlContent: input.html } : {}),
    }),
  });
  if (!res.ok) {
    console.warn(`[mail] Brevo responded HTTP ${res.status}`);
    return false;
  }
  return true;
}

async function sendViaScaleway(
  apiKey: string,
  region: string,
  from: { email: string; name?: string },
  input: SendMailInput
): Promise<boolean> {
  const res = await fetch(
    `https://api.scaleway.com/transactional-email/v1alpha1/regions/${region}/emails`,
    {
      method: "POST",
      headers: {
        "X-Auth-Token": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [{ email: input.to }],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    }
  );
  if (!res.ok) {
    console.warn(`[mail] Scaleway TEM responded HTTP ${res.status}`);
    return false;
  }
  return true;
}

/** Send a transactional email best-effort. Never throws. */
export async function sendMail(input: SendMailInput): Promise<boolean> {
  const from = sender();
  if (!from) {
    console.warn("[mail] EMAIL_FROM not configured — skipping send to", input.to);
    return false;
  }

  try {
    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) return await sendViaBrevo(brevoKey, from, input);

    const scalewayKey = process.env.SCW_EMAIL_API_KEY;
    if (scalewayKey) {
      const region = process.env.SCW_EMAIL_REGION || "fr-par";
      return await sendViaScaleway(scalewayKey, region, from, input);
    }
  } catch (error) {
    console.warn("[mail] Failed to send:", error);
    return false;
  }

  console.warn(
    "[mail] No email provider configured (BREVO_API_KEY or SCW_EMAIL_API_KEY) — skipping send"
  );
  return false;
}
