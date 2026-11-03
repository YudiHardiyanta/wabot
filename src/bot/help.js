const { sendText } = require('../services/waha');

async function handleHelpCommand(session, payload) {
  const message = (payload.body || '').trim();
  const command = message.toLowerCase();
  const echoMatch = message.match(/^!echo\s+([\s\S]+)$/i);

  if (echoMatch) {
    await sendText(session, payload.from, echoMatch[1].trim(), payload.id);
    console.log('BOT ECHOED:', { session, chatId: payload.from });
    return true;
  }

  if (command !== '!help') return false;

  const chatId = payload.from;
  const reply = [
    'Halo! Saya bot WhatsApp.',
    'Perintah yang tersedia:',
    '!help - menampilkan bantuan',
    '!echo teks - mengulang teks yang dikirim',
  ].join('\n');

  await sendText(session, chatId, reply, payload.id);
  console.log('BOT REPLIED:', { session, chatId, command });
  return true;
}

module.exports = { handleHelpCommand };
