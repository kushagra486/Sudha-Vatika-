// Sends an email alert for a new website enquiry. Works with whichever of
// these is configured as a function secret (all are free, no card needed):
//   GMAIL_USER + GMAIL_APP_PASSWORD   send from a Gmail account (an "app password")
//   BREVO_API_KEY + EMAIL_FROM        Brevo free plan (EMAIL_FROM = a verified sender)
// NOTIFY_EMAILS (comma separated) overrides who is told. A failure here never
// blocks the enquiry: the caller records it and carries on.
// @ts-ignore: nodemailer ships no types for the Deno checker
import nodemailer from 'npm:nodemailer@6.9.16';

const DEFAULT_TO = ['guptaatin1@gmail.com', 'Kushagra.gupta.ald@gmail.com'];

export interface Mail {
  subject: string;
  text: string;
  html: string;
}

export function recipients(): string[] {
  const env = Deno.env.get('NOTIFY_EMAILS');
  const list = env
    ? env
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_TO;
  return list.length ? list : DEFAULT_TO;
}

export function emailConfigured(): 'gmail' | 'brevo' | null {
  if (Deno.env.get('GMAIL_USER') && Deno.env.get('GMAIL_APP_PASSWORD')) return 'gmail';
  if (Deno.env.get('BREVO_API_KEY') && Deno.env.get('EMAIL_FROM')) return 'brevo';
  return null;
}

/** Sends the mail. Returns null on success, or a short reason it failed. */
export async function sendMail(mail: Mail, replyTo?: string): Promise<string | null> {
  const to = recipients();
  try {
    const kind = emailConfigured();
    if (kind === 'gmail') {
      const user = Deno.env.get('GMAIL_USER')!;
      const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass: Deno.env.get('GMAIL_APP_PASSWORD')!.replace(/\s+/g, '') },
        connectionTimeout: 10_000,
        socketTimeout: 15_000,
      });
      await transport.sendMail({
        from: `"Sudha Vatika website" <${user}>`,
        to: to.join(', '),
        replyTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      return null;
    }
    if (kind === 'brevo') {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': Deno.env.get('BREVO_API_KEY')!, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'Sudha Vatika website', email: Deno.env.get('EMAIL_FROM') },
          to: to.map((email) => ({ email })),
          ...(replyTo ? { replyTo: { email: replyTo } } : {}),
          subject: mail.subject,
          textContent: mail.text,
          htmlContent: mail.html,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      return res.ok ? null : `brevo ${res.status}: ${(await res.text()).slice(0, 200)}`;
    }
    return 'email not configured (no GMAIL_USER/GMAIL_APP_PASSWORD or BREVO_API_KEY)';
  } catch (e) {
    return e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : String(e).slice(0, 300);
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface EnquiryMail {
  name: string;
  phone: string; // +91…
  whatsapp: string; // +91…
  email?: string;
  rows: [string, string][]; // label, value (only filled ones)
  questions?: string;
  leadUrl: string;
}

/** The notification: who, how to reach them, what they want, and a dashboard link. */
export function enquiryMail(e: EnquiryMail): Mail {
  const show = (p: string) => p.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2');
  const wa = `https://wa.me/${e.whatsapp.replace(/\D/g, '')}`;
  const rows: [string, string][] = [
    ['Name', e.name],
    ['Phone', show(e.phone)],
    ['WhatsApp', e.whatsapp === e.phone ? `${show(e.whatsapp)} (same as phone)` : show(e.whatsapp)],
    ...(e.email ? ([['Email', e.email]] as [string, string][]) : []),
    ...e.rows,
  ];
  const text = [
    'New enquiry from the Sudha Vatika website',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(e.questions ? ['', 'Questions / requirements:', e.questions] : []),
    '',
    `Open in the dashboard: ${e.leadUrl}`,
    `WhatsApp them: ${wa}`,
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2b2220">
  <div style="background:#6b1d2a;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#e7cf96">New website enquiry</div>
    <div style="font-size:20px;font-weight:bold;margin-top:4px">${esc(e.name)}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e3d7c3;border-top:0">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:9px 14px;border-bottom:1px solid #eee;color:#6d625c;width:34%">${esc(k)}</td><td style="padding:9px 14px;border-bottom:1px solid #eee"><strong>${esc(v)}</strong></td></tr>`,
      )
      .join('')}
  </table>
  ${
    e.questions
      ? `<div style="margin-top:14px;padding:12px 14px;background:#fbf7f0;border-left:4px solid #c19a4b"><div style="color:#6d625c;font-size:12px;margin-bottom:4px">Questions / requirements</div>${esc(e.questions).replace(/\n/g, '<br>')}</div>`
      : ''
  }
  <p style="margin:20px 0 0">
    <a href="${esc(e.leadUrl)}" style="background:#6b1d2a;color:#fff;padding:11px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Open in dashboard</a>
    &nbsp;<a href="${esc(wa)}" style="background:#25d366;color:#fff;padding:11px 18px;border-radius:999px;text-decoration:none;font-weight:bold">WhatsApp</a>
    &nbsp;<a href="tel:${esc(e.phone)}" style="border:1px solid #6b1d2a;color:#6b1d2a;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Call</a>
  </p>
  <p style="color:#999;font-size:12px;margin-top:20px">Sent automatically by the Sudha Vatika website. Call them back soon: the dashboard has set a follow-up for now.</p>
</div>`;
  return {
    subject: `New enquiry: ${e.name}${e.rows.find(([k]) => k === 'Event')?.[1] ? ` · ${e.rows.find(([k]) => k === 'Event')![1]}` : ''}`,
    text,
    html,
  };
}
