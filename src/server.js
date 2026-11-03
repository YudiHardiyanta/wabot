require('dotenv').config();

const Fastify = require('fastify');
const crypto = require('crypto');
const db = require('./database');
const { wahaQueue } = require('./queue');

const app = Fastify({
  logger: true,
  bodyLimit: 10 * 1024 * 1024,
});

// Simpan raw body untuk validasi HMAC WAHA
app.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body, done) => {
    try {
      req.rawBody = body;
      done(null, JSON.parse(body.toString()));
    } catch (error) {
      done(error);
    }
  }
);

// Health check
app.get('/health', async () => ({
  status: 'ok',
  service: 'waha-webhook',
}));

// Main webhook
app.post('/webhooks/waha', async (request, reply) => {
  try {
    const rawBody = request.rawBody;
    const data = request.body;

    // Validasi HMAC jika secret dikonfigurasi
    const secret = process.env.WAHA_HMAC_SECRET;

    if (secret) {
      const receivedHmac = request.headers['x-webhook-hmac'];

      if (!receivedHmac) {
        return reply.code(401).send({
          success: false,
          message: 'Missing webhook signature',
        });
      }

      const expectedHmac = crypto
        .createHmac('sha512', secret)
        .update(rawBody)
        .digest('hex');

      const expected = Buffer.from(expectedHmac, 'hex');
      const received = Buffer.from(receivedHmac, 'hex');

      if (
        expected.length !== received.length ||
        !crypto.timingSafeEqual(expected, received)
      ) {
        return reply.code(401).send({
          success: false,
          message: 'Invalid webhook signature',
        });
      }
    }

    const event = data.event;
    const session = data.session;
    const payload = data.payload || {};

    const requestId =
      request.headers['x-webhook-request-id'] || null;

    const messageId = payload.id || null;
    const sender = payload.from || null;
    const messageBody = payload.body || null;
    const fromMe = payload.fromMe || false;

    // Simpan event ke PostgreSQL
    const result = await db.query(
      `INSERT INTO waha_events
       (request_id, session, event, message_id,
        sender, message_body, from_me, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (request_id) DO NOTHING
       RETURNING id`,
      [
        requestId,
        session,
        event,
        messageId,
        sender,
        messageBody,
        fromMe,
        JSON.stringify(data),
      ]
    );

    // Hindari enqueue ulang jika event sudah pernah diterima
    if (result.rowCount === 0) {
      return reply.code(200).send({
        success: true,
        duplicate: true,
      });
    }

    const eventId = result.rows[0].id;

    // Masukkan pekerjaan ke Redis
    await wahaQueue.add(
      'process-event',
      {
        eventId,
        session,
        event,
        payload,
      },
      {
        jobId: `event-${eventId}`,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      }
    );

    request.log.info({
      eventId,
      session,
      event,
      sender,
    }, 'WAHA event received');

    return reply.code(200).send({
      success: true,
      eventId,
      session,
      event,
    });

  } catch (error) {
    request.log.error(error);

    return reply.code(500).send({
      success: false,
      message: 'Webhook processing failed',
    });
  }
});

app.listen({
  port: Number(process.env.APP_PORT || 9224),
  host: process.env.APP_HOST || '127.0.0.1',
}).catch(error => {
  app.log.error(error);
  process.exit(1);
});
