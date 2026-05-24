const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// ============================================================
//  CONFIGURACIÓN — edita solo esta sección
// ============================================================
const CONFIG = {
  // Token que generaste en Graph API Explorer
  PAGE_ACCESS_TOKEN: 'EAAZAlarWapqwBRm5Q1FgZA5tqtMM6KxfMBmN2cx7tQZBweHEjkGU99VNNQAFcDL9bQUEALUuwxwNK4GnSfti1hY8AMcZBZAtX9CZBwKtcXvN7kO1QDot3ujNppTIztQTchRpBNIdYlqDNvBsgtFd2cWT7sjbKBBNZCxkvM1ZCMECmXof8RGBcjbWDEhLZC7OvmZCpZC73wZD',

  // App Secret de Meta Developers → Configuración → Información básica
  APP_SECRET: 'be863837053b96dd853975b5cd88468f',

  // ID de tu cuenta de Instagram
  IG_ACCOUNT_ID: '17841478577595371',

  // Token que inventas tú — debe coincidir con el que pongas en Meta Developers → Webhook
  VERIFY_TOKEN: 'mi-token-secreto-2025',

  // ---- Mensajes automáticos ----
  // Varias respuestas públicas al comentario — el bot elige una al azar
  RESPUESTAS_COMENTARIO: [
    'Cuando entiendes como soltar con intención,tu vida empieza a sentirse diferente.Revisa tus mensajes, ahí te deje mas información',
    'Si esto te resonó,no es casualidad.Revisa tus mensajes💌 te dejé información para empezar a soltar de verdad',
    '¡Esto puede ser un antes y un después en tu proceso de soltar.Revisa tus mensajes📩, te dejé algo importante',
  ],

  // Mensaje privado (DM) que se envía al que comenta
  DM_TEXTO: '¡Hola! Gracias por tu comentario. A veces no extrañas a la persona… extrañas lo que esperabas que fuera.\nY soltar eso cuesta.\n\nPor eso creé este proceso: para ayudarte a cerrar la historia, dejar de esperar y volver a sentirte en paz contigo.\n\n✨ Aquí puedes verlo!:',
  DM_ENLACE: 'https://puntointerno.my.canva.site/web-suelta-sin-mirar-atr-s',

  // Mensaje para quien responde una historia de Instagram
  HISTORIA_DM_TEXTO: 'A veces no extrañas a la persona… extrañas lo que esperabas que fuera.\nY soltar eso cuesta.\n\nPor eso creé este proceso: para ayudarte a cerrar la historia, dejar de esperar y volver a sentirte en paz contigo.\n\n✨ Aquí puedes verlo!:',
  HISTORIA_DM_ENLACE: 'https://puntointerno.my.canva.site/web-suelta-sin-mirar-atr-s',
};
// ============================================================

// Función para elegir respuesta aleatoria
function respuestaAleatoria() {
  const lista = CONFIG.RESPUESTAS_COMENTARIO;
  return lista[Math.floor(Math.random() * lista.length)];
}

// Verificación del webhook
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === CONFIG.VERIFY_TOKEN) {
    console.log('Webhook verificado correctamente');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recibe los eventos de Meta
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  if (!body || !body.object) return;

  // ---- FACEBOOK ----
  if (body.object === 'page') {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'feed' && change.value.item === 'comment') {
          const comentario = change.value;
          if (comentario.verb !== 'add') continue;
          const commentId = comentario.comment_id;
          const senderId = comentario.from?.id;
          console.log(`Nuevo comentario FB de ${senderId}: ${comentario.message}`);
          await responderComentarioFB(commentId);
          if (senderId) await enviarDMFacebook(senderId);
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
          const commentId = comentario.id;
          const senderId = comentario.from?.id;
          console.log(`Nuevo comentario IG de ${senderId}: ${comentario.text}`);
          await responderComentarioIG(commentId);
          if (senderId) await enviarDMInstagram(senderId, false);
        }

        if (change.field === 'messages') {
          const msg = change.value;
          if (msg.message?.attachments?.[0]?.type === 'story_mention') {
            const senderId = msg.sender?.id;
            console.log(`Respuesta a historia de ${senderId}`);
            if (senderId) await enviarDMInstagram(senderId, true);
          }
        }
      }
    }
  }
});

async function responderComentarioFB(commentId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${commentId}/comments`,
      { message: respuestaAleatoria() },
      { params: { access_token: CONFIG.PAGE_ACCESS_TOKEN } }
    );
    console.log('Comentario FB respondido');
  } catch (e) {
    console.error('Error respondiendo comentario FB:', e.response?.data || e.message);
  }
}

async function enviarDMFacebook(recipientId) {
  try {
    await axios.post(
      'https://graph.facebook.com/v19.0/me/messages',
      {
        recipient: { id: recipientId },
        message: { text: `${CONFIG.DM_TEXTO}\n\n${CONFIG.DM_ENLACE}` },
      },
      { params: { access_token: CONFIG.PAGE_ACCESS_TOKEN } }
    );
    console.log(`DM FB enviado a ${recipientId}`);
  } catch (e) {
    console.error('Error enviando DM FB:', e.response?.data || e.message);
  }
}

async function responderComentarioIG(commentId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${commentId}/replies`,
      { message: respuestaAleatoria() },
      { params: { access_token: CONFIG.PAGE_ACCESS_TOKEN } }
    );
    console.log('Comentario IG respondido');
  } catch (e) {
    console.error('Error respondiendo comentario IG:', e.response?.data || e.message);
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
        message: { text: texto },
      },
      { params: { access_token: CONFIG.PAGE_ACCESS_TOKEN } }
    );
    console.log(`DM IG enviado a ${recipientId} (historia: ${esHistoria})`);
  } catch (e) {
    console.error('Error enviando DM IG:', e.response?.data || e.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot corriendo en puerto ${PORT}`));

