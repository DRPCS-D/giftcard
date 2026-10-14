# Gift Card Patachoca

PWA para emitir, enviar y canjear gift cards de Patachoca. Frontend en React + Vite + Tailwind v4
(desplegado en Vercel) y backend en Google Apps Script sobre Google Sheets. Estructura, diseño, usuarios
y PWA heredados de `gestor-tareas`; funcionalidad de negocio del sistema anterior de gift cards.

## Roles

| Rol | Puede |
|---|---|
| `admin` | Todo: usuarios, sucursales, todas las tarjetas. |
| `gerente` | Ver **todas** las tarjetas, emitir, y anular/reenviar solo las de **su** sucursal; también canjear. |
| `cajero` | Consultar y canjear (con escaneo QR). Queda registrado quién y en qué sucursal. |

## Funciones

- Emisión con código `PAT-XXXX-XXXX` (aleatorio, único, sin caracteres ambiguos) y envío por email.
- Tarjeta visual con QR generado en el navegador: descarga **PNG** o **PDF** y compartir por **WhatsApp**
  (menú nativo del celular con la imagen; en escritorio abre `wa.me` con el texto).
- Canje en caja escaneando el QR con la cámara o escribiendo el código.
- Estados: `ACTIVA`, `USADA`, `VENCIDA`, `ANULADA`. Anulación con motivo.
- Listado con búsqueda, filtro por estado, contadores y exportación a CSV.
- Instalable como app (PWA), tema claro/oscuro.

## Seguridad (mejoras sobre el sistema anterior)

- Todas las acciones validan usuario y contraseña **en el servidor**; el cajero ya no usa una página pública.
- Contraseñas guardadas con hash SHA-256 + sal; bloqueo temporal tras 10 intentos fallidos.
- Canje atómico con `LockService`: una tarjeta no puede canjearse dos veces ni canjearse si está anulada/vencida.
- Validación de todos los campos en el servidor; usuario y sucursal salen de la sesión, no del navegador.
- Todo el HTML del email y de la interfaz está escapado; las celdas del Sheet se guardan como texto.

## Puesta en marcha

### 1. Backend (Google Apps Script)

1. Crea un Google Sheet nuevo → *Extensiones > Apps Script*.
2. Pega [`apps-script/Code.gs`](apps-script/Code.gs) y, en *Configuración del proyecto*, activa
   «Mostrar el archivo de manifiesto» y pega [`apps-script/appsscript.json`](apps-script/appsscript.json).
3. Ejecuta la función `instalar` (autoriza los permisos). Crea las pestañas y un usuario `ADMIN`;
   **la contraseña inicial aparece en el registro de ejecución** (no se guarda en la hoja). Cámbiala al entrar.
4. *Implementar > Nueva implementación > Aplicación web*: ejecutar como **Yo**, acceso **Cualquier usuario**.
   Copia la URL que termina en `/exec`.
5. Si cambias `Code.gs`, haz una *nueva versión* de la implementación para que se aplique.

El email sale desde la cuenta que despliega el script (cuenta gratuita de Google: ~100 envíos por día).

### 2. Frontend (Vercel)

1. Importa este repositorio en Vercel (preset Vite, se detecta solo).
2. Variable de entorno: `VITE_APPS_SCRIPT_URL` = la URL `/exec` del paso anterior.
3. Despliega.

### Desarrollo local

```bash
npm install
cp .env.example .env     # completa VITE_APPS_SCRIPT_URL
npm run dev              # http://localhost:5178
npm run lint
npm test
npm run build
```

## Notas

- Cada release: sube `version` en `package.json` (el service worker usa esa versión para renovar su caché).
- La cámara del escáner requiere HTTPS (Vercel) o `localhost`.
- Los íconos de la PWA usan una «P» provisoria sobre el azul de marca: reemplaza `public/icons/*` y
  `public/favicon.svg` con el isotipo oficial cuando lo tengas.
