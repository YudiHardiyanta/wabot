const baseUrl = (process.env.WAHA_BASE_URL || 'http://127.0.0.1:3000')
  .replace(/\/+$/, '');

async function sendText(session, chatId, text, replyTo) {
  if (!chatId) {
    throw new Error('Cannot send WAHA message: chatId is missing.');
  }

  const response = await fetch(`${baseUrl}/api/sendText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.WAHA_API_KEY
        ? { 'X-Api-Key': process.env.WAHA_API_KEY }
        : {}),
    },
    body: JSON.stringify({
      session,
      chatId,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`WAHA sendText failed (${response.status}): ${responseBody}`);
  }

  return response.json();
}

module.exports = { sendText };
