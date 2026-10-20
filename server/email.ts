export async function sendAccountEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.');
    console.info(JSON.stringify({ level: 'info', event: 'development_email', to, subject, text }));
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(`Email provider returned ${response.status}: ${responseText.slice(0, 300)}`);
  }
}
