# Instrucciones para desplegar en Railway

## 1. Editar el archivo index.js antes de subir

Abre `index.js` y en la sección CONFIG rellena:

- PAGE_ACCESS_TOKEN → el token que generaste en Graph API Explorer
- APP_SECRET        → tu App Secret de Meta Developers
- IG_ACCOUNT_ID     → 17841478577595371 (ya está puesto)
- VERIFY_TOKEN      → déjalo como está o cámbialo por algo tuyo
- RESPUESTA_COMENTARIO → el texto que responderá públicamente
- DM_TEXTO          → el texto del mensaje privado
- DM_ENLACE         → tu enlace (ej: https://mipagina.com)

## 2. Crear cuenta en Railway

1. Ve a https://railway.app
2. Clic en "Start a New Project"
3. Inicia sesión con GitHub (crea cuenta si no tienes)

## 3. Subir el código

Opción A — Sin GitHub (más fácil):
1. En Railway haz clic en "Deploy from template" → "Empty project"
2. Arrastra la carpeta bot-comentarios completa

Opción B — Con GitHub:
1. Sube la carpeta a un repositorio de GitHub
2. En Railway conecta ese repositorio

## 4. Obtener la URL pública

Una vez desplegado, Railway te dará una URL como:
https://bot-comentarios-production.up.railway.app

## 5. Configurar el Webhook en Meta Developers

1. Ve a tu app → Messenger → Configuración → Webhooks
2. Callback URL: https://tu-url-railway.app/webhook
3. Verify Token: mi-token-secreto-2025 (o el que pusiste en CONFIG)
4. Clic en "Verificar y guardar"
5. Suscríbete a: messages, messaging_postbacks, feed

6. Repite en Instagram → Webhooks con:
   - Los mismos datos
   - Campos: comments, messages
