const { sendText } = require('../services/waha');

async function handleHelpCommand(session, payload) {
  const command = (payload.body || '').trim().toLowerCase();
  if (command !== '!help') return false;

  const chatId = payload.from;
  const reply = [
    'Halo! Saya bot WhatsApp.',
    'Perintah yang tersedia:',
    '!help - menampilkan bantuan',
  ].join('\n');

  await sendText(session, chatId, reply, payload.id);
  console.log('BOT REPLIED:', { session, chatId, command });
  return true;
}

module.exports = { handleHelpCommand };
