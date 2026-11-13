/**
 * ============================================================================
 * AURELIA UA — Portable Email Service (Brevo HTTPS REST API)
 * Sends 6-digit OTP codes for email verification & password recovery over HTTPS.
 * Falls back cleanly to console logging when BREVO_API_KEY / EMAIL_FROM are unset.
 * ============================================================================
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOtpEmailHtml({ title, greetingName, subtitle, code, footerNote }) {
  const safeName = escapeHtml(greetingName || 'користувачу');
  const safeCode = escapeHtml(code);
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const safeFooter = escapeHtml(footerNote);

  return `
    <!DOCTYPE html>
    <html lang="uk">
    <head>
      <meta charset="UTF-8">
      <title>${safeTitle}</title>
    </head>
    <body style="margin:0;padding:24px;background-color:#09090b;color:#f4f4f6;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background-color:#131318;border:1px solid #2a2a35;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:28px 32px 16px;border-bottom:1px solid #2a2a35;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#d4af37;font-weight:700;">AURELIA UA</div>
            <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;color:#f4f4f6;">${safeTitle}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 28px;">
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f4f4f6;">Вітаємо, ${safeName}!</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#a1a1aa;">${safeSubtitle}</p>
            <div style="margin:0 0 22px;padding:18px 20px;background-color:#09090b;border:1px solid #d4af37;border-radius:12px;text-align:center;">
              <span style="display:block;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#a1a1aa;margin-bottom:8px;">Ваш 6-значний код</span>
              <strong style="font-family:'JetBrains Mono',monospace;font-size:32px;letter-spacing:0.28em;color:#d4af37;">${safeCode}</strong>
            </div>
            <p style="margin:0;font-size:12px;line-height:1.5;color:#8e8e9a;">${safeFooter}</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `.trim();
}

async function sendBrevoEmail({ toEmail, name, subject, htmlContent, code }) {
  const apiKey = process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.trim() : '';
  const senderEmail = process.env.EMAIL_FROM ? process.env.EMAIL_FROM.trim() : '';
  const senderName = (process.env.EMAIL_SENDER_NAME || 'AURELIA UA').trim();

  if (!apiKey || !senderEmail) {
    console.log(`[EMAIL OTP] ${toEmail}: ${code}`);
    return { delivered: false, devCode: String(code) };
  }

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail, name: name || toEmail }],
        subject,
        htmlContent
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`⚠️ [Brevo Email Error ${response.status}]:`, errorText);
      console.log(`[EMAIL OTP] ${toEmail}: ${code}`);
      return { delivered: false, devCode: String(code) };
    }

    return { delivered: true };
  } catch (err) {
    console.warn('⚠️ [Brevo Network Error]:', err.message);
    console.log(`[EMAIL OTP] ${toEmail}: ${code}`);
    return { delivered: false, devCode: String(code) };
  }
}

async function sendVerificationEmail(toEmail, name, code) {
  const htmlContent = buildOtpEmailHtml({
    title: 'Підтвердження електронної пошти',
    greetingName: name,
    subtitle: 'Введіть цей 6-значний код у вікні авторизації AURELIA UA, щоб активувати ваш персональний гаманець карток лояльності.',
    code,
    footerNote: 'Код дійсний протягом 15 хвилин. Якщо ви не створювали акаунт, просто проігноруйте цей лист.'
  });

  return sendBrevoEmail({
    toEmail,
    name,
    subject: `AURELIA UA — Код підтвердження: ${code}`,
    htmlContent,
    code
  });
}

async function sendPasswordResetEmail(toEmail, name, code) {
  const htmlContent = buildOtpEmailHtml({
    title: 'Відновлення пароля',
    greetingName: name,
    subtitle: 'Ми отримали запит на зміну пароля для вашого акаунту AURELIA UA. Введіть код нижче та задайте новий пароль.',
    code,
    footerNote: 'Код дійсний протягом 15 хвилин. Якщо ви не надсилали запит на зміну пароля, ваш обліковий запис залишається захищеним.'
  });

  return sendBrevoEmail({
    toEmail,
    name,
    subject: `AURELIA UA — Код відновлення пароля: ${code}`,
    htmlContent,
    code
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
