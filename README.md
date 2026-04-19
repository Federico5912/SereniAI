# SereniAI

SereniAI quedó reorientado como una SPA independiente y lista para deployar en Netlify desde `artifacts/sereni`.

## Estado actual

- Frontend standalone con React + Vite
- Netlify Function para chat real con OpenAI
- Persistencia de conversaciones con Netlify Blobs
- Sin dependencias obligatorias de auth o backend externo propio
- UI/UX enfocada en bienestar emocional, assessment ligero y chat funcional
- Build preparado para hosting estático

## Uso local

Opción recomendada desde la raíz:

```bash
npm run install:app
npm run dev
```

Eso levanta la SPA en Vite.

Si querés probar localmente con IA + función serverless:

```bash
npm run dev:netlify
```

Para eso necesitás definir `OPENAI_API_KEY` en Netlify o en tu entorno local. Usá `artifacts/sereni/.env.example` como referencia.

## Build producción

```bash
npm run build
```

El output se genera en `artifacts/sereni/dist`.

## Netlify

El repositorio incluye `netlify.toml` en la raíz de `SereniAI` con esta configuración:

- Base directory: `artifacts/sereni`
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

También incluye redirect SPA para que cualquier ruta resuelva a `index.html`.

## Variables de entorno

- `OPENAI_API_KEY`: requerida para que el chat funcione
- `OPENAI_MODEL`: opcional, por defecto `gpt-5-mini`
- `VITE_FUNCTIONS_BASE_URL`: opcional, sólo si querés apuntar el frontend a otra base de funciones

## Qué quedó implementado

- Chat real con OpenAI desde una Netlify Function
- Historial persistente de conversaciones con Netlify Blobs
- Carga y borrado de conversaciones desde la UI
- Estado de conexión y mensajes de error más claros
- Scripts utilizables desde la raíz del proyecto
