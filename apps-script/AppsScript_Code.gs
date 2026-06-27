// ============================================
// TO ALEMANA - Lector de correo + carga a Supabase
// ============================================

// CONFIGURACION - rellenar antes de usar
const SUPABASE_URL = 'https://djyeniaelzxrmpkrgkjr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWVuaWFlbHp4cm1wa3Jna2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzQyNjUsImV4cCI6MjA5NzcxMDI2NX0.4aCN38oiASNJ_WNoGtLXJVKsbhTSLUsylIO6f7YHo-w';
const REMITENTE = 'serviciodesaludcat@gmail.com';

const DIAGNOSTICOS = {
  '1': 'Neumonia',
  '2': 'Cirugía abdominal laparoscópica',
  '3': 'Cirugía abdominal laparotomía',
  '4': 'Cirugía tórax',
  '5': 'ITU',
  '6': 'Trauma raquimedular',
  '7': 'Trombosis',
  '8': 'Sepsis',
  '9': 'ACV',
  '10': 'Neuroquirúrgico',
  '12': 'Hipoxia perinatal',
  '13': 'SBO pediátrico',
  '14': 'ATL',
  '15': 'Cardiológico',
  '16': 'Cáncer',
  '17': 'Prótesis de cadera',
  '18': 'Prótesis de rodilla',
  '19': 'Otro',
  '20': 'Plastía de cadera',
  '21': 'Plastía de rodilla',
  '22': 'TEC',
  '23': 'PTM',
  '24': 'Paratiroidectomía',
  '25': 'Cirugía plástica',
  '26': 'EPOC / Respiratorio crónico',
  '27': 'RNPT',
  '28': 'Cirugía columna',
  '29': 'Síndrome convulsivo',
  '30': 'Falla renal',
  '31': 'Traumatológico',
  '32': 'Psiquiatría'
};

function procesarCorreoDiario() {
  const hoy = new Date();
  const nombreHoja = obtenerNombreHojaMes(hoy);
  const fechaHoyStr = formatearFecha(hoy);

  // Buscar correo del remitente, mas reciente, con adjunto
  const hilos = GmailApp.search('from:' + REMITENTE + ' has:attachment newer_than:2d');
  if (hilos.length === 0) {
    Logger.log('No se encontraron correos recientes de ' + REMITENTE);
    return;
  }

  // Recopilar todos los mensajes con adjunto de TODOS los hilos encontrados,
  // y quedarse con el mas reciente (por fecha real del mensaje, no del hilo)
  let mensajeMasReciente = null;
  for (const hilo of hilos) {
    const mensajesHilo = hilo.getMessages();
    for (const msg of mensajesHilo) {
      const tieneExcel = msg.getAttachments().some(a => {
        const n = a.getName().toLowerCase();
        return n.endsWith('.xlsx') || n.endsWith('.xls');
      });
      if (tieneExcel) {
        if (!mensajeMasReciente || msg.getDate() > mensajeMasReciente.getDate()) {
          mensajeMasReciente = msg;
        }
      }
    }
  }

  if (!mensajeMasReciente) {
    Logger.log('No se encontro ningun mensaje con Excel adjunto');
    return;
  }

  Logger.log('Correo seleccionado, fecha: ' + mensajeMasReciente.getDate());
  const ultimoMensaje = mensajeMasReciente;
  const adjuntos = ultimoMensaje.getAttachments();

  let archivoExcel = null;
  for (const adj of adjuntos) {
    const nombre = adj.getName().toLowerCase();
    if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
      archivoExcel = adj;
      break;
    }
  }

  if (!archivoExcel) {
    Logger.log('No se encontro archivo Excel adjunto');
    return;
  }

  // Convertir excel a Google Sheet temporal para poder leerlo
  const blob = archivoExcel.copyBlob();
  const archivoTemp = Drive.Files.create(
    { name: 'temp_excel_to_alemana', mimeType: 'application/vnd.google-apps.spreadsheet' },
    blob
  );

  const ss = SpreadsheetApp.openById(archivoTemp.id);
  const hoja = ss.getSheetByName(nombreHoja);

  if (!hoja) {
    Logger.log('No se encontro hoja con nombre: ' + nombreHoja);
    DriveApp.getFileById(archivoTemp.id).setTrashed(true);
    return;
  }

  const datos = hoja.getDataRange().getValues();
  const pacientesHoy = [];

  // Asume fila 1 = encabezados, datos desde fila 2 (indice 1)
  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const fechaAtencion = fila[1]; // columna B (indice 1)
    const habitacion = fila[3];    // columna D (indice 3)
    const atencionesDia = fila[4]; // columna E (indice 4)
    const nombre = fila[5];        // columna F (indice 5)
    const apellido = fila[6];      // columna G (indice 6) - paterno
    const apellidoMaterno = fila[7]; // columna H (indice 7) - materno
    const edad = fila[8];          // columna I (indice 8)
    const diagnosticoCodigo = fila[9]; // columna J (indice 9) - codigo numerico
    const cuentaId = fila[13];     // columna N (indice 13)

    if (!fechaAtencion) continue;

    const fechaFilaStr = formatearFecha(new Date(fechaAtencion));
    if (fechaFilaStr !== fechaHoyStr) continue; // solo pacientes de hoy

    const diagnosticoTexto = DIAGNOSTICOS[String(diagnosticoCodigo).trim()] || ('Código ' + diagnosticoCodigo);

    pacientesHoy.push({
      cuenta_id: String(cuentaId || ''),
      nombre: String(nombre || '').trim(),
      apellido: String(apellido || '').trim(),
      apellido_materno: String(apellidoMaterno || '').trim(),
      edad: parseInt(edad) || null,
      diagnostico: diagnosticoTexto,
      habitacion: String(habitacion || ''),
      atenciones_dia: parseInt(atencionesDia) || null,
      fecha_atencion: fechaFilaStr
    });
  }

  Logger.log('Pacientes encontrados para hoy: ' + pacientesHoy.length);

  // Respeta ediciones manuales: solo agrega pacientes que NO existen aun
  // (mismo cuenta_id + misma fecha). Nunca sobrescribe ni borra.
  const pacientesNuevos = filtrarPacientesNuevos(pacientesHoy, fechaHoyStr);
  Logger.log('Pacientes nuevos a insertar: ' + pacientesNuevos.length);
  subirPacientes(pacientesNuevos);

  // Borrar archivo temporal
  DriveApp.getFileById(archivoTemp.id).setTrashed(true);
}

function obtenerNombreHojaMes(fecha) {
  const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const mes = meses[fecha.getMonth()];
  const anio = fecha.getFullYear().toString().slice(-2);
  return mes + ' ' + anio; // ej: "JUN 24"
}

function formatearFecha(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function filtrarPacientesNuevos(pacientesHoy, fechaHoyStr) {
  // Consulta que cuenta_id ya existen para la fecha de hoy
  const url = SUPABASE_URL + '/rest/v1/pacientes?fecha_atencion=eq.' + fechaHoyStr + '&select=cuenta_id';
  const opciones = {
    method: 'get',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY
    },
    muteHttpExceptions: true
  };
  const respuesta = UrlFetchApp.fetch(url, opciones);
  let existentes = [];
  try {
    existentes = JSON.parse(respuesta.getContentText()).map(function (p) { return p.cuenta_id; });
  } catch (e) {
    Logger.log('Error leyendo existentes: ' + e);
  }

  return pacientesHoy.filter(function (p) {
    return existentes.indexOf(p.cuenta_id) === -1;
  });
}

function subirPacientes(pacientes) {
  if (pacientes.length === 0) return;

  const url = SUPABASE_URL + '/rest/v1/pacientes';
  const opciones = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      Prefer: 'resolution=merge-duplicates'
    },
    payload: JSON.stringify(pacientes),
    muteHttpExceptions: true
  };
  const respuesta = UrlFetchApp.fetch(url, opciones);
  Logger.log('Subida pacientes: ' + respuesta.getResponseCode() + ' - ' + respuesta.getContentText());
}

// Funcion que permite llamar el script desde la app web (boton "Revisar correo nuevo")
function doGet(e) {
  try {
    procesarCorreoDiario();
    return ContentService.createTextOutput(JSON.stringify({ ok: true, mensaje: 'Procesado correctamente' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, mensaje: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Funcion para crear el trigger automatico (correr UNA VEZ manualmente)
function crearTriggerDiario() {
  ScriptApp.newTrigger('procesarCorreoDiario')
    .timeBased()
    .everyDays(1)
    .atHour(6) // se ejecuta a las 6 AM todos los dias
    .create();
}
