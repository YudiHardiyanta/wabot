require('dotenv').config();
const { Worker } = require('bullmq');

const db = require('./database');
const { connection } = require('./queue');

// =====================================================
// MESSAGE HANDLER
// =====================================================

async function handleMessage(session, payload) {
  const messageId = payload.id;

  if (!messageId) {
    console.warn('Message ID tidak ditemukan');
    return;
  }

  // Incoming atau outgoing
  const direction = payload.fromMe
    ? 'outgoing'
    : 'incoming';

  // Identifikasi chat
  const chatId = payload.fromMe
    ? payload.to
    : payload.from;

  // Pengirim dan penerima
  const sender = payload.fromMe
    ? null
    : (payload.participant || payload.from);

  const recipient = payload.fromMe
    ? payload.to
    : null;

  const messageType = payload.type || 'unknown';

  const hasMedia = Boolean(payload.hasMedia);

  await db.query(
    `
    INSERT INTO wa_messages (
      session,
      message_id,
      chat_id,
      sender,
      recipient,
      direction,
      message_type,
      body,
      has_media,
      media,
      ack,
      message_timestamp,
      raw_payload
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,
      $8,$9,$10,$11,$12,$13
    )
    ON CONFLICT (session, message_id)
    DO UPDATE SET
      ack = COALESCE(EXCLUDED.ack, wa_messages.ack),
      updated_at = NOW()
    `,
    [
      session,
      messageId,
      chatId || null,
      sender || null,
      recipient || null,
      direction,
      messageType,
      payload.body || null,
      hasMedia,
      payload.media
        ? JSON.stringify(payload.media)
        : null,
      payload.ack ?? null,
      payload.timestamp ?? null,
      JSON.stringify(payload),
    ]
  );

  console.log('MESSAGE:', {
    session,
    messageId,
    direction,
    sender,
    chatId,
    body: payload.body,
  });

  // Hanya incoming yang boleh masuk chatbot
  if (direction === 'incoming') {
    console.log('Incoming message - ready for chatbot');

    // TODO:
    // Integrasi chatbot AI / Ollama di sini.
  }
}

// =====================================================
// ACK HANDLER
// =====================================================

async function handleAck(session, payload) {
  if (!payload.id || payload.ack === undefined) {
    return;
  }

  await db.query(
    `
    UPDATE wa_messages
    SET
      ack = $1,
      updated_at = NOW()
    WHERE session = $2
      AND message_id = $3
    `,
    [
      payload.ack,
      session,
      payload.id,
    ]
  );

  console.log('MESSAGE ACK:', {
    session,
    messageId: payload.id,
    ack: payload.ack,
  });
}

// =====================================================
// SESSION HANDLER
// =====================================================

async function handleSession(session, payload, engine) {
  const status = payload.status || 'UNKNOWN';

  await db.query(
    `
    INSERT INTO wa_sessions (
      session,
      status,
      engine,
      last_event_at
    )
    VALUES ($1,$2,$3,NOW())

    ON CONFLICT (session)
    DO UPDATE SET
      status = EXCLUDED.status,
      engine = EXCLUDED.engine,
      last_event_at = NOW(),
      updated_at = NOW()
    `,
    [
      session,
      status,
      engine || null,
    ]
  );

  console.log('SESSION STATUS:', {
    session,
    status,
  });
}

// =====================================================
// OTHER EVENT HANDLER
// =====================================================

async function handleOtherEvent(event, session, payload) {
  console.log('OTHER EVENT:', {
    event,
    session,
    payload,
  });
}

// =====================================================
// MAIN EVENT ROUTER
// =====================================================

async function processEvent(job) {
  const {
    eventId,
    event,
    session,
    payload,
    engine,
  } = job.data;

  console.log('PROCESSING:', {
    eventId,
    event,
    session,
  });

  try {
    switch (event) {

      // Pesan masuk dan keluar
      case 'message.any':
        await handleMessage(session, payload);
        break;

      // Pesan masuk saja
      case 'message':
        await handleMessage(session, payload);
        break;

      // Status pesan
      case 'message.ack':
        await handleAck(session, payload);
        break;

      // Status session
      case 'session.status':
        await handleSession(session, payload, engine);
        break;

      // Event lainnya
      default:
        await handleOtherEvent(
          event,
          session,
          payload
        );
        break;
    }

    // Tandai event berhasil
    await db.query(
      `
      UPDATE waha_events
      SET
        processed = TRUE,
        processed_at = NOW(),
        error_message = NULL
      WHERE id = $1
      `,
      [eventId]
    );

    console.log('COMPLETED:', eventId);

  } catch (error) {

    await db.query(
      `
      UPDATE waha_events
      SET error_message = $1
      WHERE id = $2
      `,
      [error.message, eventId]
    );

    console.error(
      'PROCESSING ERROR:',
      eventId,
      error.message
    );

    // BullMQ melakukan retry
    throw error;
  }
}

// =====================================================
// BULLMQ WORKER
// =====================================================

const worker = new Worker(
  'waha-events',
  processEvent,
  {
    connection,
    concurrency: 10,
  }
);

worker.on('completed', job => {
  console.log('JOB COMPLETED:', job.id);
});

worker.on('failed', (job, error) => {
  console.error(
    'JOB FAILED:',
    job?.id,
    error.message
  );
});

worker.on('error', error => {
  console.error('WORKER ERROR:', error);
});

console.log('================================');
console.log('WAHA WORKER RUNNING');
console.log('Queue: waha-events');
console.log('Concurrency: 10');
console.log('================================');

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down worker...');

  await worker.close();
  await connection.quit();
  await db.end();

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
