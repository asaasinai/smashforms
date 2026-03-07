import { Resend } from "resend";

export async function sendDevSpec(params: {
  to: string;
  reviewTitle: string;
  targetUrl: string;
  specMarkdown: string;
  reviewUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping email");
    return;
  }

  const resend = new Resend(apiKey);

  const escapedMarkdown = params.specMarkdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");

  await resend.emails.send({
    from: "SmashForms <feedback@smashforms.com>",
    to: params.to,
    subject: `Dev Spec Ready: ${params.reviewTitle || params.targetUrl}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 680px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">⚡ SmashForms Dev Spec</h1>
        <p>A client review has been submitted for <a href="${params.targetUrl}">${params.targetUrl}</a></p>
        <p><a href="${params.reviewUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Full Spec →</a></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <div style="font-size: 14px; line-height: 1.6; color: #374151;">${escapedMarkdown}</div>
      </div>
    `,
  });
}
