/**
 * messengerWebhook.js
 *
 * Simple, repaired & readable Messenger webhook handler.
 * - Works with Express (or any framework that calls these handlers similarly)
 * - Exports: config, verifyHandler (GET), messageHandler (POST)
 *
 * Requirements:
 *  - Node >= 16 (Node >=18 has native fetch). If Node <18: install node-fetch.
 *    npm i node-fetch@2  (and import like: const fetch = require('node-fetch'))
 *  - Set environment variables:
 *      VERIFY_TOKEN    -> your webhook verify token
 *      PAGE_ACCESS_TOKEN -> (optional) token to send replies (if you want bot to reply)
 *
 * Usage with Express (example):
 *   const express = require('express');
 *   const bodyParser = require('body-parser');
 *   const { verifyHandler, messageHandler } = require('./messengerWebhook');
 *   const app = express();
 *   app.use(bodyParser.json());
 *   app.get('/webhook', verifyHandler);
 *   app.post('/webhook', messageHandler);
 *   app.listen(3000);
 */

/* --- Configurable area --- */
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'replace_with_verify_token';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || null; // optional: used to send replies
const FB_GRAPH_SEND_API = 'https://graph.facebook.com/v17.0/me/messages'; // adjust version if needed
/* ------------------------- */

// Use global fetch if available (Node 18+). If you run older node, you may `npm i node-fetch`
// and uncomment the next two lines:
// const fetch = require('node-fetch');
// (if your environment already has fetch, the below line will use it)
const _fetch = (typeof fetch !== 'undefined') ? fetch : (...args) => { throw new Error('Fetch not available - install node-fetch or run on Node 18+'); };

/* Helper: send reply to a user (via Graph API) */
async function sendTextMessage(recipientId, text) {
  if (!PAGE_ACCESS_TOKEN) {
    console.warn('PAGE_ACCESS_TOKEN not set — cannot send messages.');
    return;
  }

  const payload = {
    recipient: { id: recipientId },
    message: { text: text }
  };

  const url = `${FB_GRAPH_SEND_API}?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`;
  try {
    const res = await _fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Failed to send message:', res.status, data);
    }
    return data;
  } catch (err) {
    console.error('Error sending message:', err);
    throw err;
  }
}

/* GET /webhook verification handler for Facebook */
function verifyHandler(req, res) {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook verified.');
        return res.status(200).send(challenge);
      } else {
        console.warn('Webhook verification failed. Tokens do not match.');
        return res.sendStatus(403);
      }
    }
    return res.sendStatus(400);
  } catch (err) {
    console.error('Verify handler error:', err);
    return res.sendStatus(500);
  }
}

/* POST /webhook message handler for Facebook */
async function messageHandler(req, res) {
  try {
    // Basic validation
    if (!req.body || req.body.object !== 'page') {
      return res.sendStatus(400);
    }

    // Facebook may send multiple entry items
    const entries = Array.isArray(req.body.entry) ? req.body.entry : [req.body.entry];
    for (const entry of entries) {
      const changes = entry.messaging || [];
      for (const event of changes) {
        // Handle messages
        if (event.message) {
          await handleIncomingMessage(event);
        } else if (event.postback) {
          await handlePostback(event);
        } else {
          console.log('Unhandled event:', Object.keys(event));
        }
      }
    }

    // Must return 200 quickly to acknowledge
    return res.sendStatus(200);
  } catch (err) {
    console.error('Message handler error:', err);
    return res.sendStatus(500);
  }
}

/* Process a single incoming message event */
async function handleIncomingMessage(event) {
  try {
    const senderId = event.sender?.id;
    const message = event.message;

    // ignore messages from pages or echoes
    if (!senderId || message?.is_echo) return;

    // simple text handling:
    if (message.text) {
      const text = message.text.trim();

      // Example: a few quick commands/responses
      if (/^(hi|hello|hey)$/i.test(text)) {
        await safeSend(senderId, 'হাই! আমি ফিরে এসেছি — কীভাবে সাহায্য করব?'); // Bengali friendly reply
        return;
      }

      if (/^help$/i.test(text)) {
        await safeSend(senderId, 'আপনি "status" লিখলে আমি স্ট্যাটাস দিবো বা সরাসরি প্রশ্ন করতে পারেন।');
        return;
      }

      if (/^status$/i.test(text)) {
        // pretend to call some internal API or return static
        await safeSend(senderId, 'সার্ভার চলছে ✅ — সব ঠিক আছে।');
        return;
      }

      // fallback: echo or call an external api
      // Here you can call your external API (like AgSy in the old file).
      // Example: echo back the message
      await safeSend(senderId, `আপনি বললেন: "${text}"`);
      return;
    }

    // attachments (images, etc)
    if (message.attachments && message.attachments.length) {
      await safeSend(senderId, 'ধন্যবাদ ছবি/ফাইল পাঠানোর জন্য — বর্তমানে আমি শুধু টেক্সট হ্যান্ডেল করছি।');
      return;
    }
  } catch (err) {
    console.error('handleIncomingMessage error:', err);
  }
}

/* Simple postback handler */
async function handlePostback(event) {
  try {
    const senderId = event.sender?.id;
    const payload = event.postback?.payload;
    if (!senderId) return;
    await safeSend(senderId, `Postback received: ${payload || '<empty>'}`);
  } catch (err) {
    console.error('handlePostback error:', err);
  }
}

/* safe wrapper to send message but don't crash if token not set */
async function safeSend(recipientId, text) {
  try {
    if (!PAGE_ACCESS_TOKEN) {
      // If page token not configured, just log and return.
      console.log(`Would send to ${recipientId}: ${text}`);
      return;
    }
    await sendTextMessage(recipientId, text);
  } catch (err) {
    console.error('safeSend failed:', err);
  }
}

/* Exports: compatible with simple require(...) usage */
module.exports = {
  config: {
    verifyToken: VERIFY_TOKEN,
    pageAccessToken: PAGE_ACCESS_TOKEN,
    path: '/webhook',
    methods: ['GET', 'POST']
  },
  verifyHandler,
  messageHandler,
  /* For backwards compatibility: default handler that handles both verify & message if you pass express app */
  attachToExpress: function (app, options = {}) {
    const path = options.path || module.exports.config.path;
    app.get(path, verifyHandler);
    app.post(path, messageHandler);
    console.log(`Messenger webhook mounted at ${path}`);
  }
};
