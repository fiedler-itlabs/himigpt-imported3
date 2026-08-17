/**
 * Owner notifications via transactional email (EU providers) — replaces the
 * Manus Forge notification module with an API-compatible implementation.
 *
 * Provider is picked from the environment (first match wins):
 *   SOVYN_FORGE_URL + SOVYN_FORGE_TOKEN → Sovyn Forge gateway (default:
 *                                         injected at provision, metered,
 *                                         sender managed by the platform)
 *   BREVO_API_KEY                       → Brevo (api.brevo.com, EU/GDPR)
 *   SCW_EMAIL_API_KEY [+SCW_EMAIL_REGION, default fr-par]
 *                                       → Scaleway Transactional Email
 *
 * The direct-provider paths are the escape hatch: set your own key in the
 * app's custom env and the platform stops injecting the gateway binding —
 * your key, your account, no Sovyn in the path.
 *
 * Shared configuration:
 *   EMAIL_FROM       verified sender address (direct providers only —
 *                    the gateway sets the sender platform-side)
 *   EMAIL_FROM_NAME  optional display name shown as the sender (e.g. the app name)
 *   OWNER_EMAIL      recipient of owner notifications
 *
 * Without configuration this fails cleanly (returns false, logs a warning) —
 * exactly like the Forge module without its env.
 */

export interface NotifyOwnerInput {
  title: string;
  content: string;
}

interface EmailMessage {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text: string;
}

/** Sender object for the provider APIs — display name only when set. */
function sender(message: EmailMessage): { email: string; name?: string } {
  return message.fromName
    ? { email: message.from, name: message.fromName }
    : { email: message.from };
}

async function sendViaGateway(
  url: string,
  token: string,
  message: Omit<EmailMessage, "from">
): Promise<boolean> {
  const res = await fetch(
    `${url.replace(/\/+$/, "")}/forge/v1/email/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.fromName ? { fromName: message.fromName } : {}),
      }),
    }
  );
  if (!res.ok) {
    // The gateway explains itself (e.g. a 429 names the cap and its reset
    // time) — surface that instead of a bare status code.
    const detail = await res.text().catch(() => "");
    console.warn(
      `[notification] Sovyn Forge gateway responded HTTP ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
    return false;
  }
  return true;
}

async function sendViaBrevo(
  apiKey: string,
  message: EmailMessage
): Promise<boolean> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: sender(message),
      to: [{ email: message.to }],
      subject: message.subject,
      textContent: message.text,
    }),
  });
  if (!res.ok) {
    console.warn(`[notification] Brevo responded HTTP ${res.status}`);
    return false;
  }
  return true;
}

async function sendViaScaleway(
  apiKey: string,
  region: string,
  message: EmailMessage
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
        from: sender(message),
        to: [{ email: message.to }],
        subject: message.subject,
        text: message.text,
      }),
    }
  );
  if (!res.ok) {
    console.warn(`[notification] Scaleway TEM responded HTTP ${res.status}`);
    return false;
  }
  return true;
}

/**
 * Send an owner notification. API-compatible with the Manus Forge module:
 * resolves true when the email was accepted by the provider, false when
 * email is not configured or the provider rejected it. Never throws.
 */
export async function notifyOwner(input: NotifyOwnerInput): Promise<boolean> {
  const to = process.env.OWNER_EMAIL;
  if (!to) {
    console.warn(
      "[notification] OWNER_EMAIL not configured — skipping owner notification"
    );
    return false;
  }
  const fromName = process.env.EMAIL_FROM_NAME || undefined;

  try {
    // Default path: the Sovyn Forge gateway (metered, platform-managed
    // sender). A direct provider key in the env wins by NOT being here —
    // the platform skips injecting the gateway binding when you bring one.
    const forgeUrl = process.env.SOVYN_FORGE_URL;
    const forgeToken = process.env.SOVYN_FORGE_TOKEN;
    if (forgeUrl && forgeToken) {
      return await sendViaGateway(forgeUrl, forgeToken, {
        fromName,
        to,
        subject: input.title,
        text: input.content,
      });
    }

    const from = process.env.EMAIL_FROM;
    if (!from) {
      console.warn(
        "[notification] EMAIL_FROM not configured — skipping owner notification"
      );
      return false;
    }
    const message: EmailMessage = {
      from,
      fromName,
      to,
      subject: input.title,
      text: input.content,
    };

    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) return await sendViaBrevo(brevoKey, message);

    const scalewayKey = process.env.SCW_EMAIL_API_KEY;
    if (scalewayKey) {
      const region = process.env.SCW_EMAIL_REGION || "fr-par";
      return await sendViaScaleway(scalewayKey, region, message);
    }
  } catch (error) {
    console.warn("[notification] Failed to send owner notification:", error);
    return false;
  }

  console.warn(
    "[notification] No email provider configured (SOVYN_FORGE_TOKEN, BREVO_API_KEY or SCW_EMAIL_API_KEY) — skipping owner notification"
  );
  return false;
}
