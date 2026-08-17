/**
 * Renders the sign-in ("magic") link email for account recovery. Pure: takes
 * the URL, returns subject + HTML/text bodies. Self-contained so it needs no
 * shared email helpers from the control plane.
 */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeHttpUrl = (url: string): string =>
  /^https?:\/\//i.test(url) ? escapeHtml(url) : "#";

export interface RenderedMagicLinkEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderMagicLinkEmail(url: string): RenderedMagicLinkEmail {
  const safeUrl = safeHttpUrl(url);
  const subject = "Your sign-in link";

  const text = [
    "Here is your sign-in link:",
    url,
    "",
    "It expires shortly and can only be used once.",
    "If you didn't request it, you can safely ignore this email.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>Your sign-in link</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px 36px;">
              <h1 style="margin:0 0 14px 0;font-size:22px;line-height:1.3;font-weight:700;color:#111827;">
                Sign in
              </h1>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.65;color:#4b5563;">
                Click the button below to sign in. This link expires shortly and
                can only be used once.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" bgcolor="#6d5cff" style="border-radius:10px;">
                    <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#6d5cff;">
                      Sign in
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#9ca3af;">
                Or copy and paste this URL into your browser:
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="${safeUrl}" target="_blank" style="color:#6d5cff;text-decoration:none;">${safeUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 36px 0 36px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
