/**
 * Gift Card Patachoca - Backend (Google Apps Script)
 *
 * Emite, envía y canjea gift cards. Los datos viven en Google Sheets y la
 * app (React, en Vercel) habla con este script por POST.
 *
 * Despliegue:
 *   Extensiones > Apps Script > pegar este archivo (y appsscript.json)
 *   > Implementar > Aplicación web
 *   > Ejecutar como: Yo | Quién tiene acceso: Cualquier usuario
 *
 * Primera vez: ejecuta la función `instalar` (botón Ejecutar en el editor, o
 * menú "Gift Card" de la hoja tras recargarla). Crea las pestañas y un admin
 * inicial (la contraseña aparece en el registro de ejecución, no queda guardada
 * en la hoja: solo su hash).
 * Funciona vinculado a un Sheet (Extensiones > Apps Script) o como proyecto
 * independiente (script.google.com): en ese caso crea el Sheet "Gift Card
 * Patachoca" en tu Drive y guarda su ID en la propiedad SPREADSHEET_ID.
 *
 * Pestañas (fila 1 = encabezados):
 *   "GiftCards":  id | codigo | comprador | destinatario | email | telefono | monto |
 *                 mensaje | notas | fechaEmision | fechaVencimiento | estado | fechaUso |
 *                 canjeadoPor | sucursalCanje | creadoPor | sucursalId | fechaAnulacion |
 *                 anuladoPor | motivoAnulacion
 *   "Sucursales": id | nombre | direccion | activo
 *   "Usuarios":   usuario | password | rol | activo | sucursales | nombre
 *
 * Roles:
 *   admin    control total (usuarios, sucursales, todas las tarjetas).
 *   gerente  emite, anula y reenvía tarjetas de SU sucursal; también canjea.
 *   cajero   solo consulta y canjea.
 *
 * Seguridad: cada acción valida usuario y contraseña en el servidor (las
 * contraseñas se guardan con hash SHA-256 + sal), valida todos los datos,
 * toma usuario y sucursal de la sesión y canjea con bloqueo para que una
 * tarjeta no se pueda usar dos veces.
 */

var SHEET_GIFTCARDS = 'GiftCards';
var SHEET_SUCURSALES = 'Sucursales';
var SHEET_USUARIOS = 'Usuarios';

var MARCA = 'Gift Card Patachoca';
var LOGO_URL = 'https://www.patachoca.com.py/assets/patachoca/images/logo.png';
var WEB_URL = 'https://www.patachoca.com.py';
var WHATSAPP_URL = 'https://wa.me/595984105482';

// Índices de columnas (0-based).
var COL_GC = {
  id: 0, codigo: 1, comprador: 2, destinatario: 3, email: 4, telefono: 5, monto: 6,
  mensaje: 7, notas: 8, fechaEmision: 9, fechaVencimiento: 10, estado: 11, fechaUso: 12,
  canjeadoPor: 13, sucursalCanje: 14, creadoPor: 15, sucursalId: 16, fechaAnulacion: 17,
  anuladoPor: 18, motivoAnulacion: 19
};
var COL_SUC = { id: 0, nombre: 1, direccion: 2, activo: 3 };
var COL_USR = { usuario: 0, password: 1, rol: 2, activo: 3, sucursales: 4, nombre: 5 };

var ESTADOS = ['ACTIVA', 'USADA', 'VENCIDA', 'ANULADA'];
var ROLES = ['admin', 'gerente', 'cajero'];

var MONTO_MINIMO = 1000;
var MONTO_MAXIMO = 100000000;
var MAX_INTENTOS = 10;
var VENTANA_INTENTOS_S = 900;

function doGet() {
  return jsonOut_({ ok: true, service: 'giftcard' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Solicitud inválida' });
  }

  try {
    switch (body.action) {
      case 'login':             return handleLogin_(body);
      case 'getRevisions':      return handleGetRevisions_(body);
      case 'listarGiftCards':   return handleListarGiftCards_(body);
      case 'crearGiftCard':     return handleCrearGiftCard_(body);
      case 'verificarGiftCard': return handleVerificarGiftCard_(body);
      case 'canjearGiftCard':   return handleCanjearGiftCard_(body);
      case 'anularGiftCard':    return handleAnularGiftCard_(body);
      case 'reenviarEmail':     return handleReenviarEmail_(body);
      case 'listSucursales':    return handleListSucursales_(body);
      case 'createSucursal':    return handleCreateSucursal_(body);
      case 'updateSucursal':    return handleUpdateSucursal_(body);
      case 'deleteSucursal':    return handleDeleteSucursal_(body);
      case 'listUsuarios':      return handleListUsuarios_(body);
      case 'createUsuario':     return handleCreateUsuario_(body);
      case 'updateUsuario':     return handleUpdateUsuario_(body);
      case 'deleteUsuario':     return handleDeleteUsuario_(body);
      case 'cambiarMiPassword': return handleCambiarMiPassword_(body);
      default:                  return jsonOut_({ ok: false, error: 'Acción desconocida' });
    }
  } catch (err) {
    // "codigo" deja que el frontend distinga una sesión caída de cualquier
    // otro error sin depender del texto del mensaje (ver requireAuth_).
    return jsonOut_({
      ok: false,
      error: err.message || ('Error del servidor: ' + err),
      codigo: err.codigo || ''
    });
  }
}

// ---------- Autenticación ----------

function handleLogin_(body) {
  var user = findUser_(body.usuario, body.password);
  if (!user) return jsonOut_({ ok: false, error: 'Usuario o contraseña incorrectos' });
  return jsonOut_({ ok: true, usuario: user.usuario, nombre: user.nombre, rol: user.rol, sucursales: user.sucursales });
}

/**
 * Valida credenciales y devuelve el usuario, o lanza error.
 * El error lleva codigo 'SESION' para que el frontend cierre la sesión en vez
 * de mostrar el error en cada pantalla (pasa si te desactivan, te renombran o
 * te cambian la contraseña mientras estabas dentro).
 */
function requireAuth_(body) {
  var user = findUser_(body.usuario, body.password);
  if (!user) {
    var e = new Error('Sesión no válida. Vuelve a iniciar sesión.');
    e.codigo = 'SESION';
    throw e;
  }
  return user;
}

/** Valida que el usuario tenga uno de los roles indicados, o lanza error. */
function requireRol_(body, roles) {
  var user = requireAuth_(body);
  if (roles.indexOf(user.rol) === -1) throw new Error('No autorizado para esta acción.');
  return user;
}

function requireAdmin_(body) {
  return requireRol_(body, ['admin']);
}

/** Admin o gerente: pueden emitir, anular y reenviar. */
function requireGestion_(body) {
  return requireRol_(body, ['admin', 'gerente']);
}

/**
 * Busca un usuario activo con usuario y contraseña coincidentes.
 * Devuelve { usuario, rol, activo, nombre, sucursales } o null.
 * Tras MAX_INTENTOS fallos seguidos para un mismo usuario, rechaza todo
 * intento de ese usuario durante VENTANA_INTENTOS_S segundos.
 */
function findUser_(usuario, password) {
  var nombre = String(usuario || '').trim();
  var pass = String(password || '');
  if (!nombre || !pass) return null;

  var cache = CacheService.getScriptCache();
  var claveCache = 'fallos_' + nombre.toUpperCase().slice(0, 100);
  var fallos = Number(cache.get(claveCache)) || 0;
  if (fallos >= MAX_INTENTOS) {
    throw new Error('Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.');
  }

  var sheet = getSheet_(SHEET_USUARIOS);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var rowUsuario = String(rows[i][COL_USR.usuario]).trim();
    // El usuario no distingue mayúsculas/minúsculas; la contraseña sí.
    if (rowUsuario.toUpperCase() !== nombre.toUpperCase()) continue;
    if (!passwordCoincide_(sheet, i + 1, rows[i][COL_USR.password], pass)) break;
    if (!esActivo_(rows[i][COL_USR.activo])) return null;
    if (fallos) cache.remove(claveCache);
    return {
      usuario: rowUsuario,
      rol: normalizarRol_(rows[i][COL_USR.rol]),
      activo: true,
      nombre: String(rows[i][COL_USR.nombre] || '').trim(),
      sucursales: parseSucursales_(rows[i][COL_USR.sucursales])
    };
  }

  if (!fallos) cache.put(claveCache, '1', VENTANA_INTENTOS_S);
  else cache.put(claveCache, String(fallos + 1), VENTANA_INTENTOS_S);
  return null;
}

// ---------- Contraseñas (SHA-256 con sal) ----------

function sha256Hex_(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var h = (b < 0 ? b + 256 : b).toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('');
}

/** "h1$<sal>$<hash>" */
function hashPassword_(password) {
  var sal = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  return 'h1$' + sal + '$' + sha256Hex_(sal + password);
}

/**
 * Compara la contraseña con lo guardado. Si la celda aún tiene una contraseña
 * en texto plano (por ejemplo, escrita a mano en la hoja), la acepta una vez y
 * la reemplaza por su hash.
 */
function passwordCoincide_(sheet, fila, guardado, password) {
  var g = String(guardado);
  var partes = g.split('$');
  if (partes.length === 3 && partes[0] === 'h1') {
    return constanteIgual_(sha256Hex_(partes[1] + password), partes[2]);
  }
  if (!constanteIgual_(g, password)) return false;
  sheet.getRange(fila, COL_USR.password + 1).setValue(hashPassword_(password));
  return true;
}

/** Comparación sin salida temprana. */
function constanteIgual_(a, b) {
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ---------- Gift cards ----------

/** Admin ve todas; el gerente solo las de su sucursal. El cajero no lista. */
function handleListarGiftCards_(body) {
  var user = requireGestion_(body);
  var sheet = getSheet_(SHEET_GIFTCARDS);
  var rows = sheet.getDataRange().getValues();
  var hoy = hoyISO_();
  var giftcards = [];
  var cambios = [];

  for (var i = 1; i < rows.length; i++) {
    if (!String(rows[i][COL_GC.id]).trim()) continue;
    var gc = rowToGiftCard_(rows[i]);
    if (gc.estado === 'ACTIVA' && gc.fechaVencimiento && gc.fechaVencimiento < hoy) {
      gc.estado = 'VENCIDA';
      cambios.push(i + 1);
    }
    if (user.rol === 'gerente' && user.sucursales.indexOf(gc.sucursalId) === -1) continue;
    giftcards.push(gc);
  }

  // Persiste los vencimientos descubiertos (una sola escritura por fila, fuera del bucle de lectura).
  if (cambios.length) {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      cambios.forEach(function (fila) {
        var celda = sheet.getRange(fila, COL_GC.estado + 1);
        if (String(celda.getValue()).toUpperCase() === 'ACTIVA') celda.setValue('VENCIDA');
      });
      bumpRevision_('giftcards');
    } finally {
      lock.releaseLock();
    }
  }

  // Las filas se agregan en orden cronológico: la última es la más nueva.
  giftcards.reverse();
  return jsonOut_({ ok: true, giftcards: giftcards });
}

function handleCrearGiftCard_(body) {
  var user = requireGestion_(body);

  var comprador = limpiar_(body.comprador, 30);
  var destinatario = limpiar_(body.destinatario, 30);
  var mensaje = limpiar_(body.mensaje, 50) || 'Con cariño de:';
  var email = limpiar_(body.email, 120);
  var telefono = limpiar_(body.telefono, 25);
  var notas = limpiar_(body.notas, 50);
  var monto = Number(body.monto);
  var vencimiento = String(body.fechaVencimiento || '').trim();

  if (!comprador) throw new Error('Falta el nombre del comprador.');
  if (!destinatario) throw new Error('Falta el nombre del destinatario.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('El email no es válido.');
  if (telefono && !/^[0-9+()\s-]{6,25}$/.test(telefono)) throw new Error('El teléfono no es válido.');
  if (!isFinite(monto) || Math.floor(monto) !== monto || monto < MONTO_MINIMO || monto > MONTO_MAXIMO) {
    throw new Error('El monto debe ser un número entero entre ' + MONTO_MINIMO + ' y ' + MONTO_MAXIMO + ' Gs.');
  }
  if (!fechaIsoValida_(vencimiento)) throw new Error('La fecha de vencimiento no es válida.');
  if (vencimiento < hoyISO_()) throw new Error('La fecha de vencimiento no puede ser anterior a hoy.');

  // El gerente emite siempre en su sucursal; el admin, en la suya si tiene (si no, queda sin sucursal).
  var sucursalId = user.sucursales.length ? user.sucursales[0] : '';

  var sheet = getSheet_(SHEET_GIFTCARDS);
  var id = Utilities.getUuid();
  var codigo;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    codigo = generarCodigoUnico_(sheet);
    var fila = [];
    fila[COL_GC.id] = id;
    fila[COL_GC.codigo] = codigo;
    fila[COL_GC.comprador] = comprador;
    fila[COL_GC.destinatario] = destinatario;
    fila[COL_GC.email] = email;
    fila[COL_GC.telefono] = telefono;
    fila[COL_GC.monto] = String(monto);
    fila[COL_GC.mensaje] = mensaje;
    fila[COL_GC.notas] = notas;
    fila[COL_GC.fechaEmision] = hoyISO_();
    fila[COL_GC.fechaVencimiento] = vencimiento;
    fila[COL_GC.estado] = 'ACTIVA';
    fila[COL_GC.fechaUso] = '';
    fila[COL_GC.canjeadoPor] = '';
    fila[COL_GC.sucursalCanje] = '';
    fila[COL_GC.creadoPor] = user.usuario;
    fila[COL_GC.sucursalId] = sucursalId;
    fila[COL_GC.fechaAnulacion] = '';
    fila[COL_GC.anuladoPor] = '';
    fila[COL_GC.motivoAnulacion] = '';
    agregarFilaTexto_(sheet, fila);
    bumpRevision_('giftcards');
  } finally {
    lock.releaseLock();
  }

  // La tarjeta ya está guardada: si el email falla no se pierde ni se duplica,
  // se avisa y se puede reenviar desde la lista.
  var emailEnviado = false;
  var emailError = '';
  if (email) {
    try {
      enviarEmailGiftCard_({
        codigo: codigo, comprador: comprador, destinatario: destinatario, email: email,
        monto: monto, mensaje: mensaje, notas: notas, fechaVencimiento: vencimiento
      });
      emailEnviado = true;
    } catch (err) {
      emailError = err.message || String(err);
    }
  }
  return jsonOut_({ ok: true, id: id, codigo: codigo, emailEnviado: emailEnviado, emailError: emailError });
}

/** Consulta un código (todos los roles autenticados). */
function handleVerificarGiftCard_(body) {
  requireAuth_(body);
  var encontrada = buscarPorCodigo_(getSheet_(SHEET_GIFTCARDS), body.codigo);
  if (!encontrada) return jsonOut_({ ok: true, encontrada: false });
  var gc = rowToGiftCard_(encontrada.valores);
  if (gc.estado === 'ACTIVA' && gc.fechaVencimiento < hoyISO_()) gc.estado = 'VENCIDA';
  return jsonOut_({
    ok: true,
    encontrada: true,
    estado: gc.estado,
    codigo: gc.codigo,
    comprador: gc.comprador,
    destinatario: gc.destinatario,
    monto: gc.monto,
    fechaVencimiento: gc.fechaVencimiento,
    fechaUso: gc.fechaUso,
    canjeadoPor: gc.canjeadoPor,
    sucursalCanje: gc.sucursalCanje
  });
}

/**
 * Canje atómico: con el bloqueo tomado se vuelve a leer la fila y solo se
 * marca USADA si sigue ACTIVA y vigente, así dos cajas no pueden canjear la
 * misma tarjeta a la vez.
 */
function handleCanjearGiftCard_(body) {
  var user = requireAuth_(body);
  var sheet = getSheet_(SHEET_GIFTCARDS);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var encontrada = buscarPorCodigo_(sheet, body.codigo);
    if (!encontrada) throw new Error('Código no encontrado.');
    var gc = rowToGiftCard_(encontrada.valores);
    if (gc.estado === 'USADA') throw new Error('Esta gift card ya fue canjeada.');
    if (gc.estado === 'ANULADA') throw new Error('Esta gift card fue anulada.');
    if (gc.estado === 'VENCIDA' || gc.fechaVencimiento < hoyISO_()) throw new Error('Esta gift card está vencida.');

    var fila = encontrada.indice;
    sheet.getRange(fila, COL_GC.estado + 1).setValue('USADA');
    sheet.getRange(fila, COL_GC.fechaUso + 1).setValue(ahoraLocal_());
    sheet.getRange(fila, COL_GC.canjeadoPor + 1).setValue(user.usuario);
    sheet.getRange(fila, COL_GC.sucursalCanje + 1).setValue(nombreSucursal_(user.sucursales[0]));
    bumpRevision_('giftcards');
  } finally {
    lock.releaseLock();
  }
  return jsonOut_({ ok: true });
}

function handleAnularGiftCard_(body) {
  var user = requireGestion_(body);
  var motivo = limpiar_(body.motivo, 100);
  var sheet = getSheet_(SHEET_GIFTCARDS);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var encontrada = filaPorId_(sheet, COL_GC.id, body.id);
    if (!encontrada) throw new Error('La gift card ya no existe.');
    var gc = rowToGiftCard_(encontrada.valores);
    requireSucursalDe_(user, gc);
    if (gc.estado !== 'ACTIVA') throw new Error('Solo se pueden anular tarjetas activas.');

    var fila = encontrada.indice;
    sheet.getRange(fila, COL_GC.estado + 1).setValue('ANULADA');
    sheet.getRange(fila, COL_GC.fechaAnulacion + 1).setValue(ahoraLocal_());
    sheet.getRange(fila, COL_GC.anuladoPor + 1).setValue(user.usuario);
    sheet.getRange(fila, COL_GC.motivoAnulacion + 1).setValue(motivo);
    bumpRevision_('giftcards');
  } finally {
    lock.releaseLock();
  }
  return jsonOut_({ ok: true });
}

function handleReenviarEmail_(body) {
  var user = requireGestion_(body);
  var encontrada = filaPorId_(getSheet_(SHEET_GIFTCARDS), COL_GC.id, body.id);
  if (!encontrada) throw new Error('La gift card ya no existe.');
  var gc = rowToGiftCard_(encontrada.valores);
  requireSucursalDe_(user, gc);
  if (!gc.email) throw new Error('La tarjeta no tiene email cargado.');
  if (gc.estado !== 'ACTIVA') throw new Error('Solo se reenvían tarjetas activas.');
  enviarEmailGiftCard_(gc);
  return jsonOut_({ ok: true });
}

/** El gerente solo opera sobre tarjetas de su sucursal. */
function requireSucursalDe_(user, gc) {
  if (user.rol === 'gerente' && user.sucursales.indexOf(gc.sucursalId) === -1) {
    throw new Error('Esta gift card pertenece a otra sucursal.');
  }
}

/** Código PAT-XXXX-XXXX sin caracteres ambiguos (I, O, 0, 1), con bytes de UUID v4 y sin repetir. */
function generarCodigoUnico_(sheet) {
  var existentes = {};
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) existentes[String(rows[i][COL_GC.codigo]).trim()] = true;

  for (var intento = 0; intento < 20; intento++) {
    var codigo = generarCodigo_();
    if (!existentes[codigo]) return codigo;
  }
  throw new Error('No se pudo generar un código único. Intenta de nuevo.');
}

function generarCodigo_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 símbolos: 256 % 32 == 0, sin sesgo
  // Dos UUID v4 sin guiones; se descartan los nibbles fijos de versión/variante.
  var hex = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var aleatorio = hex.slice(0, 12) + hex.slice(13, 16) + hex.slice(17, 32);
  var out = '';
  for (var i = 0; i < 8; i++) {
    out += chars.charAt(parseInt(aleatorio.substr(i * 2, 2), 16) % 32);
  }
  return 'PAT-' + out.slice(0, 4) + '-' + out.slice(4);
}

function buscarPorCodigo_(sheet, codigo) {
  var buscado = String(codigo || '').trim().toUpperCase();
  if (!/^PAT-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(buscado)) return null;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][COL_GC.codigo]).trim().toUpperCase() === buscado) {
      return { indice: i + 1, valores: rows[i] };
    }
  }
  return null;
}

function rowToGiftCard_(row) {
  return {
    id: String(row[COL_GC.id]).trim(),
    codigo: String(row[COL_GC.codigo]).trim(),
    comprador: String(row[COL_GC.comprador]),
    destinatario: String(row[COL_GC.destinatario]),
    email: String(row[COL_GC.email]),
    telefono: String(row[COL_GC.telefono]),
    monto: Number(row[COL_GC.monto]) || 0,
    mensaje: String(row[COL_GC.mensaje]),
    notas: String(row[COL_GC.notas]),
    fechaEmision: fechaTexto_(row[COL_GC.fechaEmision], 'yyyy-MM-dd'),
    fechaVencimiento: fechaTexto_(row[COL_GC.fechaVencimiento], 'yyyy-MM-dd'),
    estado: normalizarEstado_(row[COL_GC.estado]),
    fechaUso: fechaTexto_(row[COL_GC.fechaUso], 'yyyy-MM-dd HH:mm'),
    canjeadoPor: String(row[COL_GC.canjeadoPor]),
    sucursalCanje: String(row[COL_GC.sucursalCanje]),
    creadoPor: String(row[COL_GC.creadoPor]),
    sucursalId: String(row[COL_GC.sucursalId]).trim(),
    fechaAnulacion: fechaTexto_(row[COL_GC.fechaAnulacion], 'yyyy-MM-dd HH:mm'),
    anuladoPor: String(row[COL_GC.anuladoPor]),
    motivoAnulacion: String(row[COL_GC.motivoAnulacion])
  };
}

// ---------- Email ----------

function esc_(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fechaCorta_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

function formatoGs_(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function descargarBlob_(url, nombre) {
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return null;
  return resp.getBlob().setName(nombre);
}

function enviarEmailGiftCard_(gc) {
  var imagenes = {};
  var logo = null;
  var qr = null;
  try { logo = descargarBlob_(LOGO_URL, 'logo.png'); } catch (e) {}
  try {
    qr = descargarBlob_('https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=4&data=' + encodeURIComponent(gc.codigo), 'qr.png');
  } catch (e) {}
  if (logo) imagenes.logo = logo;
  if (qr) imagenes.qr = qr;

  var html =
    '<div style="background:#f0f4f8;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">' +
    '<div style="padding:22px 28px;text-align:center;border-bottom:4px solid #0093D7">' +
      (logo ? '<img src="cid:logo" alt="Patachoca" style="height:30px">' : '<strong style="font-size:22px;color:#0093D7">PATACHOCA</strong>') +
    '</div>' +
    '<div style="padding:28px">' +
      '<p style="margin:0 0 6px;font-size:18px;color:#221F32">¡Hola, <strong>' + esc_(gc.destinatario) + '</strong>!</p>' +
      '<p style="margin:0 0 20px;color:#555;font-size:15px">' + esc_(gc.comprador) + ' te regaló una Gift Card Patachoca.</p>' +
      '<div style="background:linear-gradient(135deg,#0093D7,#0a6fa8);border-radius:14px;padding:22px;color:#fff">' +
        '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85">Gift Card</div>' +
        '<div style="margin:10px 0 4px;font-size:14px">' + esc_(gc.mensaje) + ' <strong>' + esc_(gc.comprador) + '</strong></div>' +
        '<div style="font-size:40px;font-weight:bold;line-height:1.1">' + formatoGs_(gc.monto) + ' <span style="font-size:18px">Gs</span></div>' +
        '<div style="margin-top:16px;font-family:Courier New,monospace;font-size:22px;font-weight:bold;letter-spacing:2px">' + esc_(gc.codigo) + '</div>' +
        '<div style="margin-top:6px;font-size:13px;opacity:.9">Válida hasta el ' + esc_(fechaCorta_(gc.fechaVencimiento)) + '</div>' +
      '</div>' +
      (qr ? '<div style="text-align:center;margin-top:22px"><img src="cid:qr" alt="QR" width="180" height="180" style="border:1px solid #e2e8f0;border-radius:8px"><p style="margin:6px 0 0;color:#718096;font-size:12px">Mostrá este código QR en caja</p></div>' : '') +
      '<p style="margin:22px 0 0;color:#555;font-size:14px;text-align:center">Canjeala en cualquier sucursal Patachoca presentando este email o el código.</p>' +
    '</div>' +
    '<div style="background:#221F32;color:#cbd5e0;padding:18px 28px;text-align:center;font-size:12px">' +
      '<a href="' + WEB_URL + '" style="color:#fff;text-decoration:none">www.patachoca.com.py</a> · ' +
      '<a href="' + WHATSAPP_URL + '" style="color:#fff;text-decoration:none">WhatsApp</a><br>' +
      'Tiendas Asunción y Ciudad del Este · Esta Gift Card es personal e intransferible' +
    '</div>' +
    '</div></div>';

  var opciones = { htmlBody: html, name: MARCA };
  if (logo || qr) opciones.inlineImages = imagenes;
  MailApp.sendEmail(
    gc.email,
    gc.comprador + ' te regaló una Gift Card Patachoca',
    'Tu Gift Card Patachoca: código ' + gc.codigo + ' por ' + formatoGs_(gc.monto) + ' Gs, válida hasta el ' + fechaCorta_(gc.fechaVencimiento) + '.',
    opciones
  );
}

// ---------- Revisiones (caché del frontend) ----------
// Cada tabla lleva un contador que sube con cada alta, edición o baja; el
// frontend lo consulta para saber si tiene que volver a bajar los datos.
// Siempre se llama con el lock tomado. Editar el Sheet a mano NO lo
// incrementa: para eso está el botón "Actualizar" de la app.

function bumpRevision_(key) {
  var props = PropertiesService.getScriptProperties();
  var actual = Number(props.getProperty('rev_' + key)) || 0;
  props.setProperty('rev_' + key, String(actual + 1));
}

function handleGetRevisions_(body) {
  requireAuth_(body);
  var props = PropertiesService.getScriptProperties().getProperties();
  var revisiones = {};
  ['giftcards', 'sucursales', 'usuarios'].forEach(function (k) {
    revisiones[k] = Number(props['rev_' + k]) || 0;
  });
  return jsonOut_({ ok: true, revisiones: revisiones });
}

// ---------- Sucursales ----------

/** Todos los autenticados las leen: se necesitan para mostrar nombres. */
function handleListSucursales_(body) {
  requireAuth_(body);
  var rows = getSheet_(SHEET_SUCURSALES).getDataRange().getValues();
  var sucursales = [];
  for (var i = 1; i < rows.length; i++) {
    if (!String(rows[i][COL_SUC.id]).trim()) continue;
    sucursales.push(rowToSucursal_(rows[i]));
  }
  sucursales.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  return jsonOut_({ ok: true, sucursales: sucursales });
}

function handleCreateSucursal_(body) {
  requireAdmin_(body);
  var nombre = limpiar_(body.nombre, 60);
  var direccion = limpiar_(body.direccion, 150);
  if (!nombre) throw new Error('El nombre es obligatorio.');

  var sheet = getSheet_(SHEET_SUCURSALES);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (sucursalPorNombre_(sheet, nombre)) throw new Error('Ya existe una sucursal con ese nombre.');
    agregarFilaTexto_(sheet, [Utilities.getUuid().slice(0, 8), nombre, direccion, true]);
    bumpRevision_('sucursales');
  } finally {
    lock.releaseLock();
  }
  return jsonOut_({ ok: true });
}

function handleUpdateSucursal_(body) {
  requireAdmin_(body);
  var id = String(body.id || '').trim();
  var nombre = limpiar_(body.nombre, 60);
  var direccion = limpiar_(body.direccion, 150);
  var activo = body.activo !== false;
  if (!nombre) throw new Error('El nombre es obligatorio.');

  var sheet = getSheet_(SHEET_SUCURSALES);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var encontrada = filaPorId_(sheet, COL_SUC.id, id);
    if (!encontrada) throw new Error('La sucursal ya no existe.');
    var otra = sucursalPorNombre_(sheet, nombre);
    if (otra && otra !== encontrada.indice) throw new Error('Ya existe una sucursal con ese nombre.');
    sheet.getRange(encontrada.indice, COL_SUC.nombre + 1).setValue(nombre);
    sheet.getRange(encontrada.indice, COL_SUC.direccion + 1).setValue(direccion);
    sheet.getRange(encontrada.indice, COL_SUC.activo + 1).setValue(activo);
    bumpRevision_('sucursales');
  } finally {
    lock.releaseLock();
  }
  return jsonOut_({ ok: true });
}

/** Solo se borra si no tiene gift cards ni usuarios; si tiene, hay que desactivarla. */
function handleDeleteSucursal_(body) {
  requireAdmin_(body);
  var id = String(body.id || '').trim();
  var sheet = getSheet_(SHEET_SUCURSALES);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var encontrada = filaPorId_(sheet, COL_SUC.id, id);
    if (!encontrada) throw new Error('La sucursal ya no existe.');

    var tarjetas = getSheet_(SHEET_GIFTCARDS).getDataRange().getValues();
    for (var i = 1; i < tarjetas.length; i++) {
      if (String(tarjetas[i][COL_GC.sucursalId]).trim() === id) {
        throw new Error('La sucursal tiene gift cards emitidas. Desactívala en lugar de borrarla.');
      }
    }
    var usuarios = getSheet_(SHEET_USUARIOS).getDataRange().getValues();
    for (var j = 1; j < usuarios.length; j++) {
      if (parseSucursales_(usuarios[j][COL_USR.sucursales]).indexOf(id) !== -1) {
        throw new Error('La sucursal tiene usuarios asignados. Desactívala en lugar de borrarla.');
      }
    }

    borrarFila_(sheet, encontrada.indice);
    bumpRevision_('sucursales');
  } finally {
    lock.releaseLock();
  }
  return jsonOut_({ ok: true });
}

/** Devuelve el índice (1-based) de la sucursal con ese nombre, o 0. */
function sucursalPorNombre_(sheet, nombre) {
  var buscado = String(nombre).trim().toUpperCase();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][COL_SUC.nombre]).trim().toUpperCase() === buscado) return i + 1;
  }
  return 0;
}

function nombreSucursal_(id) {
  if (!id) return '';
  var encontrada = filaPorId_(getSheet_(SHEET_SUCURSALES), COL_SUC.id, id);
  return encontrada ? String(encontrada.valores[COL_SUC.nombre]).trim() : '';
}

// ---------- Usuarios ----------

function handleListUsuarios_(body) {
  requireAdmin_(body);
  var rows = getSheet_(SHEET_USUARIOS).getDataRange().getValues();
  var usuarios = [];
  for (var i = 1; i < rows.length; i++) {
    var nombre = String(rows[i][COL_USR.usuario]).trim();
    if (!nombre) continue;
    usuarios.push({
      usuario: nombre,
      rol: normalizarRol_(rows[i][COL_USR.rol]),
      nombre: String(rows[i][COL_USR.nombre] || '').trim(),
      activo: esActivo_(rows[i][COL_USR.activo]),
      sucursales: parseSucursales_(rows[i][COL_USR.sucursales])
    });
  }
  return jsonOut_({ ok: true, usuarios: usuarios });
}

function handleCreateUsuario_(body) {
  requireAdmin_(body);
  var nombre = String(body.nuevoUsuario || '').trim().toUpperCase(); // nombres siempre en mayúsculas
  var password = String(body.nuevaPassword || '');
  var rol = normalizarRol_(body.rol);
  var activo = body.activo !== false;
  var nombreCompleto = limpiar_(body.nombre, 80);
  var sucursales = validarSucursalesDeRol_(rol, body.sucursales);

  if (!nombre) throw new Error('El nombre de usuario es obligatorio.');
  if (!/^[A-Z0-9._-]{2,30}$/.test(nombre)) throw new Error('El usuario solo puede llevar letras, números, punto, guion y guion bajo (2 a 30).');
  validarPassword_(password);

  var sheet = getSheet_(SHEET_USUARIOS);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (usuarioExiste_(sheet, nombre)) throw new Error('Ya existe un usuario con ese nombre.');
    agregarFilaTexto_(sheet, [nombre, hashPassword_(password), rol, activo, sucursales.join(','), nombreCompleto]);
    bumpRevision_('usuarios');
  } finally {
    lock.releaseLock();
  }
  return jsonOut_({ ok: true });
}

function handleUpdateUsuario_(body) {
  requireAdmin_(body);
  var nombre = String(body.targetUsuario || '').trim();
  if (!nombre) throw new Error('Falta el usuario a editar.');
  var rol = normalizarRol_(body.rol);
  var activo = body.activo !== false;
  var nombreCompleto = limpiar_(body.nombre, 80);
  var nuevaPassword = String(body.nuevaPassword || '');
  var nuevoNombre = String(body.nuevoUsuario || '').trim().toUpperCase();
  var sucursales = validarSucursalesDeRol_(rol, body.sucursales);
  if (nuevaPassword) validarPassword_(nuevaPassword);
  if (nuevoNombre && !/^[A-Z0-9._-]{2,30}$/.test(nuevoNombre)) throw new Error('El usuario solo puede llevar letras, números, punto, guion y guion bajo (2 a 30).');

  var sheet = getSheet_(SHEET_USUARIOS);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var seRenombra;
  try {
    var encontrada = usuarioPorNombre_(sheet, nombre);
    if (!encontrada) throw new Error('El usuario ya no existe.');

    // Evita dejar el sistema sin ningún Admin activo.
    var eraAdminActivo = normalizarRol_(encontrada.valores[COL_USR.rol]) === 'admin' && esActivo_(encontrada.valores[COL_USR.activo]);
    if (eraAdminActivo && !(rol === 'admin' && activo) && contarAdminsActivos_(sheet) <= 1) {
      throw new Error('No puedes quitar el último Admin activo.');
    }

    // Renombrar es opcional: solo si viene un nombre distinto al actual.
    seRenombra = !!nuevoNombre && nuevoNombre !== nombre.toUpperCase();
    if (seRenombra && usuarioExiste_(sheet, nuevoNombre)) throw new Error('Ya existe un usuario con ese nombre.');

    var fila = encontrada.indice;
    if (seRenombra) {
      sheet.getRange(fila, COL_USR.usuario + 1).setValue(nuevoNombre);
      renombrarEnGiftCards_(String(encontrada.valores[COL_USR.usuario]).trim(), nuevoNombre);
    }
    sheet.getRange(fila, COL_USR.rol + 1).setValue(rol);
    sheet.getRange(fila, COL_USR.activo + 1).setValue(activo);
    sheet.getRange(fila, COL_USR.sucursales + 1).setValue(sucursales.join(','));
    sheet.getRange(fila, COL_USR.nombre + 1).setValue(nombreCompleto);
    if (nuevaPassword) sheet.getRange(fila, COL_USR.password + 1).setValue(hashPassword_(nuevaPassword));
    bumpRevision_('usuarios');
  } finally {
    lock.releaseLock();
  }
  return jsonOut_({ ok: true, usuario: seRenombra ? nuevoNombre : nombre.toUpperCase() });
}

/** Mantiene el historial (quién emitió, canjeó o anuló) al renombrar a un usuario. */
function renombrarEnGiftCards_(viejo, nuevo) {
  var sheet = getSheet_(SHEET_GIFTCARDS);
  var rows = sheet.getDataRange().getValues();
  var columnas = [COL_GC.creadoPor, COL_GC.canjeadoPor, COL_GC.anuladoPor];
  var tocado = false;
  for (var i = 1; i < rows.length; i++) {
    columnas.forEach(function (c) {
      if (String(rows[i][c]).trim().toUpperCase() === viejo.toUpperCase()) {
        sheet.getRange(i + 1, c + 1).setValue(nuevo);
        tocado = true;
      }
    });
  }
  if (tocado) bumpRevision_('giftcards');
}

function handleDeleteUsuario_(body) {
  var actual = requireAdmin_(body);
  var nombre = String(body.targetUsuario || '').trim();
  if (!nombre) throw new Error('Falta el usuario a borrar.');
  if (nombre.toUpperCase() === actual.usuario.toUpperCase()) throw new Error('No puedes borrarte a ti mismo.');

  var sheet = getSheet_(SHEET_USUARIOS);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var encontrada = usuarioPorNombre_(sheet, nombre);
    if (!encontrada) throw new Error('El usuario ya no existe.');
    var esAdminActivo = normalizarRol_(encontrada.valores[COL_USR.rol]) === 'admin' && esActivo_(encontrada.valores[COL_USR.activo]);
    if (esAdminActivo && contarAdminsActivos_(sheet) <= 1) throw new Error('No puedes borrar el último Admin activo.');
    borrarFila_(sheet, encontrada.indice);
    bumpRevision_('usuarios');
  } finally {
    lock.releaseLock();
  }
  return jsonOut_({ ok: true });
}

/** Cualquier usuario autenticado cambia su propia contraseña. */
function handleCambiarMiPassword_(body) {
  var user = requireAuth_(body);
  var nuevaPassword = String(body.nuevaPassword || '');
  validarPassword_(nuevaPassword);

  var sheet = getSheet_(SHEET_USUARIOS);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var encontrada = usuarioPorNombre_(sheet, user.usuario);
    if (!encontrada) throw new Error('El usuario ya no existe.');
    sheet.getRange(encontrada.indice, COL_USR.password + 1).setValue(hashPassword_(nuevaPassword));
  } finally {
    lock.releaseLock();
  }
  return jsonOut_({ ok: true });
}

function validarPassword_(password) {
  if (!password) throw new Error('La contraseña es obligatoria.');
  if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  if (password.length > 100) throw new Error('La contraseña es demasiado larga.');
}

/**
 * Normaliza las sucursales según el rol: el admin no lleva, gerente y cajero
 * exactamente una. Debe existir y estar activa.
 */
function validarSucursalesDeRol_(rol, valor) {
  if (rol === 'admin') return [];
  var lista = Array.isArray(valor) ? valor.map(function (s) { return String(s).trim(); }).filter(String) : parseSucursales_(valor);
  if (lista.length !== 1) throw new Error('Elige la sucursal del usuario.');
  var encontrada = filaPorId_(getSheet_(SHEET_SUCURSALES), COL_SUC.id, lista[0]);
  if (!encontrada) throw new Error('La sucursal no existe.');
  return lista;
}

// ---------- Instalación ----------

var ENCABEZADOS = {
  GiftCards: ['id', 'codigo', 'comprador', 'destinatario', 'email', 'telefono', 'monto', 'mensaje', 'notas',
              'fechaEmision', 'fechaVencimiento', 'estado', 'fechaUso', 'canjeadoPor', 'sucursalCanje',
              'creadoPor', 'sucursalId', 'fechaAnulacion', 'anuladoPor', 'motivoAnulacion'],
  Sucursales: ['id', 'nombre', 'direccion', 'activo'],
  Usuarios: ['usuario', 'password', 'rol', 'activo', 'sucursales', 'nombre']
};

/** Agrega el menú "Gift Card" al abrir la hoja. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Gift Card')
    .addItem('Instalar / reparar hoja', 'instalar')
    .addToUi();
}

/**
 * Crea las pestañas y encabezados que falten, con validaciones y formato, y
 * deja un admin inicial y una sucursal de ejemplo si no hay ninguno.
 * Es idempotente: se puede ejecutar varias veces sin pisar datos existentes.
 */
function instalar() {
  var ss = getSpreadsheet_(true);
  var creadas = [];

  Object.keys(ENCABEZADOS).forEach(function (nombre) {
    var sheet = ss.getSheetByName(nombre);
    if (!sheet) {
      // Reutiliza la hoja vacía por defecto en lugar de dejarla sobrando.
      var primera = ss.getSheets()[0];
      var vacia = ss.getSheets().length === 1 && primera.getLastRow() === 0 && primera.getName() !== nombre;
      sheet = vacia ? primera.setName(nombre) : ss.insertSheet(nombre);
      creadas.push(nombre);
    }
    var cols = ENCABEZADOS[nombre];
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#0093D7').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    // Todo como texto (menos las casillas "activo"): evita que Sheets convierta fechas o interprete fórmulas.
    for (var c = 0; c < cols.length; c++) {
      if (cols[c] === 'activo') continue;
      sheet.getRange(1, c + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
    }
  });

  aplicarValidaciones_(ss);

  var mensaje = creadas.length ? 'Pestañas creadas: ' + creadas.join(', ') + '. ' : 'Las pestañas ya existían. ';

  var sucursales = ss.getSheetByName(SHEET_SUCURSALES);
  if (sucursales.getLastRow() < 2) {
    agregarFilaTexto_(sucursales, [Utilities.getUuid().slice(0, 8), 'Central', '', true]);
    mensaje += 'Sucursal de ejemplo "Central" creada. ';
  }

  var usuarios = ss.getSheetByName(SHEET_USUARIOS);
  if (contarAdminsActivos_(usuarios) === 0) {
    var password = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    agregarFilaTexto_(usuarios, ['ADMIN', hashPassword_(password), 'admin', true, '', 'Administrador']);
    mensaje += 'Admin inicial: usuario ADMIN, contraseña ' + password + ' (anótala: no queda guardada, solo su hash). Cámbiala al entrar. ';
  }

  mensaje += 'Hoja: ' + ss.getUrl();
  Logger.log(mensaje);
  try { ss.toast('Instalación terminada. Mira el registro de ejecución.', MARCA, 10); } catch (e) {}
  return mensaje;
}

/** Listas desplegables y casillas para que editar a mano la hoja no rompa valores. */
function aplicarValidaciones_(ss) {
  var lista = function (valores) {
    return SpreadsheetApp.newDataValidation().requireValueInList(valores, true).setAllowInvalid(false).build();
  };
  var casilla = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  var filas = 1000;

  ss.getSheetByName(SHEET_GIFTCARDS).getRange(2, COL_GC.estado + 1, filas, 1).setDataValidation(lista(ESTADOS));
  ss.getSheetByName(SHEET_SUCURSALES).getRange(2, COL_SUC.activo + 1, filas, 1).setDataValidation(casilla);
  var usuarios = ss.getSheetByName(SHEET_USUARIOS);
  usuarios.getRange(2, COL_USR.rol + 1, filas, 1).setDataValidation(lista(ROLES));
  usuarios.getRange(2, COL_USR.activo + 1, filas, 1).setDataValidation(casilla);
}

// ---------- Helpers de hoja ----------

/**
 * Hoja de cálculo de datos. Si el script está vinculado a un Sheet se usa
 * ese; si es un proyecto independiente se usa la propiedad SPREADSHEET_ID.
 * Con `crear`, un proyecto independiente sin propiedad crea el Sheet.
 */
function getSpreadsheet_(crear) {
  var activa = SpreadsheetApp.getActiveSpreadsheet();
  if (activa) return activa;

  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      throw new Error('No se pudo abrir la hoja (SPREADSHEET_ID). Revisa el ID y los permisos.');
    }
  }
  if (!crear) {
    throw new Error('El backend no está configurado: ejecuta la función "instalar" una vez.');
  }
  var ss = SpreadsheetApp.create(MARCA);
  props.setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('Hoja creada: ' + ss.getUrl());
  return ss;
}

/**
 * Agrega una fila con formato de texto aplicado ANTES de escribir, para que
 * nada de lo que escriba un usuario ("=...", "+...") se evalúe como fórmula.
 * Llamar con el lock tomado.
 */
function agregarFilaTexto_(sheet, fila) {
  var n = fila.length;
  var destino = sheet.getLastRow() + 1;
  if (destino > sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
  var rango = sheet.getRange(destino, 1, 1, n);
  // Las casillas de "activo" necesitan booleano real; el resto va como texto.
  rango.setNumberFormats([fila.map(function (v) { return typeof v === 'boolean' ? 'General' : '@'; })]);
  rango.setValues([fila.map(function (v) { return typeof v === 'boolean' ? v : String(v); })]);
}

/**
 * Borra una fila. Sheets no deja eliminar todas las filas no inmovilizadas de
 * una hoja (la fila 1 está fija): si solo queda una fila de datos, se agrega
 * una vacía antes de borrar.
 */
function borrarFila_(sheet, fila) {
  if (sheet.getMaxRows() - sheet.getFrozenRows() <= 1) sheet.insertRowAfter(sheet.getMaxRows());
  sheet.deleteRow(fila);
}

function getSheet_(name) {
  var sheet = getSpreadsheet_(false).getSheetByName(name);
  if (!sheet) throw new Error('No existe la pestaña "' + name + '" en la hoja de cálculo.');
  return sheet;
}

function rowToSucursal_(row) {
  return {
    id: String(row[COL_SUC.id]).trim(),
    nombre: String(row[COL_SUC.nombre]).trim(),
    direccion: String(row[COL_SUC.direccion]).trim(),
    activo: esActivo_(row[COL_SUC.activo])
  };
}

/** Devuelve { indice (1-based), valores } de la fila cuyo valor en `col` es `id`, o null. */
function filaPorId_(sheet, col, id) {
  var buscado = String(id || '').trim();
  if (!buscado) return null;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][col]).trim() === buscado) {
      return { indice: i + 1, valores: rows[i] };
    }
  }
  return null;
}

function usuarioPorNombre_(sheet, nombre) {
  var buscado = String(nombre).trim().toUpperCase();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][COL_USR.usuario]).trim().toUpperCase() === buscado) {
      return { indice: i + 1, valores: rows[i] };
    }
  }
  return null;
}

function usuarioExiste_(sheet, nombre) {
  return !!usuarioPorNombre_(sheet, nombre);
}

function contarAdminsActivos_(sheet) {
  var rows = sheet.getDataRange().getValues();
  var total = 0;
  for (var i = 1; i < rows.length; i++) {
    if (normalizarRol_(rows[i][COL_USR.rol]) === 'admin' && esActivo_(rows[i][COL_USR.activo])) total++;
  }
  return total;
}

// ---------- Utilidades ----------

function tz_() { return Session.getScriptTimeZone(); }

/** 'yyyy-MM-dd' de hoy en la zona horaria del script. */
function hoyISO_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }

function ahoraLocal_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm'); }

/** Texto de fecha; si Sheets convirtió la celda a Date, se formatea en la zona del script. */
function fechaTexto_(valor, formato) {
  if (valor instanceof Date) return Utilities.formatDate(valor, tz_(), formato);
  return String(valor || '').trim();
}

/** ¿'yyyy-MM-dd' real (rechaza 2026-02-31)? */
function fechaIsoValida_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var p = s.split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  return d.toISOString().slice(0, 10) === s;
}

/** Texto recortado y sin saltos de línea ni caracteres de control. */
function limpiar_(valor, max) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizarEstado_(valor) {
  var e = String(valor || '').trim().toUpperCase();
  return ESTADOS.indexOf(e) === -1 ? 'ACTIVA' : e;
}

function normalizarRol_(valor) {
  var r = String(valor || '').trim().toLowerCase();
  return ROLES.indexOf(r) === -1 ? 'cajero' : r;
}

/** "a1, b2" → ['a1', 'b2'] */
function parseSucursales_(valor) {
  return String(valor || '').split(',').map(function (s) { return s.trim(); }).filter(String);
}

/** Acepta TRUE, SI, SÍ o X (casilla de verificación) como "activo". */
function esActivo_(valor) {
  if (valor === true) return true;
  if (valor === false) return false;
  var texto = String(valor).trim().toUpperCase().replace('Í', 'I');
  return texto === 'TRUE' || texto === 'SI' || texto === 'X' || texto === '1';
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
