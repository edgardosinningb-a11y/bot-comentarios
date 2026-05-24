const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// ============================================================
//  CONFIGURACIÓN
//  ⚠️  El PAGE_ACCESS_TOKEN se lee desde variable de entorno.
//      En Railway: Variables → PAGE_ACCESS_TOKEN → pega tu token
// ============================================================
const CONFIG = {
  PAGE_ACCESS_TOKEN: process.env.PAGE_ACCESS_TOKEN || 'EAAZAlarWapqwBRmHNKPpa4gFr5YTGfDUUi5tt5qJnriJTHlsZCWbXlYkqZBEkw3eTOehOg4rYDhXAQwT1K5C5dErRz6ZBHrfBOWaKIxRNaFsPPaf5EDPZCmMISN01CdsWlL3DzNVr6is6ixbhWsSMQEZCasUKQu5SLXLBhLQh7lhcdgEr3VCBEpCw5OcXE4tqpXD4pC0BfACM8hTxQ9LCKDBMHKKWRZCxbDzvL6ujLxEztqvjjKJ9ApNtB752wcCAzzeDIqs3wFrZBk7gBw59QZDZD',
  APP_SECRET:        process.env.APP_SECRET || 'be863837053b96dd853975b5cd88468f',
  IG_ACCOUNT_ID:     '17841478577595371',
  VERIFY_TOKEN:      'mi-token-secreto-2025',

  RESPUESTAS_COMENTARIO: [
    'Cuando entiendes como soltar con intención, tu vida empieza a sentirse diferente. Revisa tus mensajes, ahí te dejé más información 💌',
    'Si esto te resonó, no es casualidad. Revisa tus mensajes 💌 te dejé información para empezar a soltar de verdad',
    '¡Esto puede ser un antes y un después en tu proceso de soltar! Revisa tus mensajes 📩, te dejé algo importante',
  ],

  DM_TEXTO:  '¡Hola! Gracias por tu comentario. A veces no extrañas a la persona… extrañas lo que esperabas que fuera.\nY soltar eso cuesta.\n\nPor eso creé este proceso: para ayudarte a cerrar la historia, dejar de esperar y volver a sentirte en paz contigo.\n\n✨ Aquí puedes verlo:',
  DM_ENLACE: 'https://puntointerno.my.canva.site/web-suelta-sin-mirar-atr-s',

  HISTORIA_DM_TEXTO:  'A veces no extrañas a la persona… extrañas lo que esperabas que fuera.\nY soltar eso cuesta.\n\nPor eso creé este proceso: para ayudarte a cerrar la historia, dejar de esperar y volver a sentirte en paz contigo.\n\n✨ Aquí puedes verlo:',
  HISTORIA_DM_ENLACE: 'https://puntointerno.my.canva.site/web-suelta-sin-mirar-atr-s',
};
// ============================================================

// ---- Anti-spam: registro de usuarios contactados recientemente ----
// Guarda { userId: timestamp } para no escribirles dos veces en 24h
const usuariosContactados = new Map();
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 horas

function yaContactado(userId) {
  const ultima = usuariosContactados.get(userId);
  if (!ultima) return false;
  return Date.now() - ultima < COOLDOWN_MS;
}

function marcarContactado(userId) {
  usuariosContactados.set(userId, Date.now());
}

// Limpia el mapa cada hora para no acumular memoria
setInterval(() => {
  const ahora = Date.now();
  for (const [id, ts] of usuariosContactados) {
    if (ahora - ts > COOLDOWN_MS) usuariosContactados.delete(id);
  }
}, 60 * 60 * 1000);

// ---- Helpers ----
function respuestaAleatoria() {
  const lista = CONFIG.RESPUESTAS_COMENTARIO;
  return lista[Math.floor(Math.random() * lista.length)];
}

// Espera N milisegundos (evita detección de spam)
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ID de tu página de Facebook — para ignorar los propios comentarios del bot
const PAGE_ID = '907360732458163';

// Códigos de error de Meta que NO vale la pena reintentar
const ERRORES_IGNORAR = new Set([100, 200, 551, 368, 10]);

function debeIgnorar(error) {
  const code = error.response?.data?.error?.code;
  return code && ERRORES_IGNORAR.has(code);
}

// ============================================================
//  WEBHOOK — verificación
// ============================================================
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === CONFIG.VERIFY_TOKEN) {
    console.log('✅ Webhook verificado');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ============================================================
//  WEBHOOK — recibe eventos
// ============================================================
app.post('/webhook', async (req, res) => {
  // Responde 200 de inmediato para que Meta no reintente
  res.sendStatus(200);

  const body = req.body;
  if (!body?.object) return;

  // ---- FACEBOOK ----
  if (body.object === 'page') {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'feed' && change.value.item === 'comment') {
          const comentario = change.value;
          if (comentario.verb !== 'add') continue;

          const commentId = comentario.comment_id;
          const senderId  = comentario.from?.id;

          // Ignorar comentarios del propio bot para evitar bucle infinito
          if (senderId === PAGE_ID) continue;

          console.log(`📩 Comentario FB de ${senderId}: ${comentario.message}`);

          await responderComentarioFB(commentId);

          // Delay anti-spam entre respuesta pública y DM
          await esperar(1500);

          if (senderId && !yaContactado(senderId)) {
            await enviarDMFacebook(senderId);
            marcarContactado(senderId);
          } else if (senderId) {
            console.log(`⏭️  FB: ${senderId} ya fue contactado recientemente, omitiendo DM`);
          }
        }
      }
    }
  }

  // ---- INSTAGRAM ----
  if (body.object === 'instagram') {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {

        if (change.field === 'comments') {
          const comentario = change.value;
          const commentId  = comentario.id;
          const senderId   = comentario.from?.id;
          console.log(`📩 Comentario IG de ${senderId}: ${comentario.text}`);

          await responderComentarioIG(commentId);
          await esperar(1500);

          if (senderId && !yaContactado(senderId)) {
            await enviarDMInstagram(senderId, false);
            marcarContactado(senderId);
          } else if (senderId) {
            console.log(`⏭️  IG: ${senderId} ya fue contactado recientemente, omitiendo DM`);
          }
        }

        if (change.field === 'messages') {
          const msg      = change.value;
          const senderId = msg.sender?.id;
          if (msg.message?.attachments?.[0]?.type === 'story_mention') {
            console.log(`📖 Respuesta a historia de ${senderId}`);
            if (senderId && !yaContactado(senderId)) {
              await esperar(1000);
              await enviarDMInstagram(senderId, true);
              marcarContactado(senderId);
            }
          }
        }
      }
    }
  }
});

// ============================================================
//  FUNCIONES DE ENVÍO
// ============================================================
async function responderComentarioFB(commentId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${commentId}/comments`,
      { message: respuestaAleatoria() },
      { params: { access_token: CONFIG.PAGE_ACCESS_TOKEN } }
    );
    console.log('✅ Comentario FB respondido');
  } catch (e) {
    if (debeIgnorar(e)) {
      console.warn(`⚠️  FB comentario ignorado (código ${e.response?.data?.error?.code})`);
    } else {
      console.error('❌ Error respondiendo comentario FB:', e.response?.data || e.message);
    }
  }
}

async function enviarDMFacebook(recipientId) {
  try {
    await axios.post(
      'https://graph.facebook.com/v19.0/me/messages',
      {
        recipient: { id: recipientId },
        message:   { text: `${CONFIG.DM_TEXTO}\n\n${CONFIG.DM_ENLACE}` },
      },
      { params: { access_token: CONFIG.PAGE_ACCESS_TOKEN } }
    );
    console.log(`✅ DM FB enviado a ${recipientId}`);
  } catch (e) {
    if (debeIgnorar(e)) {
      console.warn(`⚠️  DM FB ignorado para ${recipientId} (código ${e.response?.data?.error?.code})`);
    } else {
      console.error('❌ Error enviando DM FB:', e.response?.data || e.message);
    }
  }
}

async function responderComentarioIG(commentId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${commentId}/replies`,
      { message: respuestaAleatoria() },
      { params: { access_token: CONFIG.PAGE_ACCESS_TOKEN } }
    );
    console.log('✅ Comentario IG respondido');
  } catch (e) {
    if (debeIgnorar(e)) {
      console.warn(`⚠️  IG comentario ignorado (código ${e.response?.data?.error?.code})`);
    } else {
      console.error('❌ Error respondiendo comentario IG:', e.response?.data || e.message);
    }
  }
}

async function enviarDMInstagram(recipientId, esHistoria = false) {
  const texto = esHistoria
    ? `${CONFIG.HISTORIA_DM_TEXTO}\n\n${CONFIG.HISTORIA_DM_ENLACE}`
    : `${CONFIG.DM_TEXTO}\n\n${CONFIG.DM_ENLACE}`;

  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${CONFIG.IG_ACCOUNT_ID}/messages`,
      {
        recipient: { id: recipientId },
        message:   { text: texto },
      },
      { params: { access_token: CONFIG.PAGE_ACCESS_TOKEN } }
    );
    console.log(`✅ DM IG enviado a ${recipientId} (historia: ${esHistoria})`);
  } catch (e) {
    if (debeIgnorar(e)) {
      console.warn(`⚠️  DM IG ignorado para ${recipientId} (código ${e.response?.data?.error?.code})`);
    } else {
      console.error('❌ Error enviando DM IG:', e.response?.data || e.message);
    }
  }
}

// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Bot corriendo en puerto ${PORT}`));
