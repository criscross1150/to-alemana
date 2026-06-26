# TO Alemana — Información del Proyecto

## Qué es

App web para gestionar lista diaria de pacientes atendidos en Clínica Alemana Temuco. Lee un Excel adjunto que llega cada noche por correo, extrae los pacientes del día, los muestra en una app mobile-friendly, editable, con guardado en base de datos compartida.

## Stack técnico

- **Origen de datos:** Gmail (correo de `serviciodesaludcat@gmail.com`, llega de noche con Excel adjunto)
- **Procesamiento:** Google Apps Script (lee Gmail, parsea Excel, sube a Supabase)
- **Base de datos:** Supabase (Postgres + API REST)
- **Frontend:** React, mobile-first
- **Hosting:** Vercel
- **Código:** GitHub — usuario `criscross1150`, repo `to-alemana`

## Credenciales y accesos

- **Supabase Project URL:** `https://djyeniaelzxrmpkrgkjr.supabase.co`
- **Supabase anon key:** guardada en script Apps Script (no se sube a GitHub)
- **Supabase service_role key:** NO se usa en ningún código, solo se usó una vez para configuración manual. No guardar en archivos del proyecto.
- **GitHub usuario:** criscross1150
- **Hosting:** Vercel (cuenta ya existente, usada antes)

## Estructura tabla `pacientes` (Supabase)

| Columna | Tipo | Origen Excel | Descripción |
|---|---|---|---|
| id | uuid (auto) | — | clave primaria |
| cuenta_id | text | columna N (CTA.CTE) | identificador único de paciente/cuenta |
| nombre | text | columna F | nombre |
| apellido | text | columna G | apellido paterno |
| apellido_materno | text | columna H | apellido materno (agregado tras revisar Excel real) |
| edad | int | columna I | edad |
| diagnostico | text | columna J (DG) | diagnóstico traducido desde código numérico (ver tabla DIAGNOSTICOS en script) |
| habitacion | text | columna D | habitación |
| atenciones_dia | int | columna E (N°INDICADOS) | número de atenciones diarias |
| fecha_atencion | date | columna B (FECHA) | fecha de atención |
| created_at | timestamp (auto) | — | fecha de creación del registro |
| updated_at | timestamp (auto) | — | fecha de última edición |

RLS habilitado, policy abierta (sin login por ahora).

## Estructura tabla `atenciones` (Supabase)

Registra el marcaje horario de cada atención realizada a un paciente. Permite múltiples atenciones por día (ej: paciente con `atenciones_dia = 2` tendrá hasta 2 registros).

| Columna | Tipo | Descripción |
|---|---|---|
| id | uuid (auto) | clave primaria |
| paciente_id | uuid | referencia a `pacientes.id`, borrado en cascada |
| numero_atencion | int | 1, 2, etc. (cuál de las atenciones del día) |
| hora_marcaje | timestamp (auto) | momento exacto en que se marcó la atención como realizada |

Constraint único: (`paciente_id`, `numero_atencion`) — evita marcar dos veces la misma atención.

En la app: cada paciente muestra un "ticket" por cada atención indicada (según `atenciones_dia`). Ticket pendiente = naranja, sin hora. Al tocarlo, se marca y muestra la hora exacta (ej: "✓ 14:32"). Tocar de nuevo permite deshacer el marcaje (con confirmación). Esto permite registrar el horario real de atención para uso posterior en la ficha clínica del paciente.

El Excel usa códigos numéricos en columna J. El script `AppsScript_Code.gs` traduce automáticamente vía diccionario `DIAGNOSTICOS`:

1=Neumonia, 2=Cirugía abdominal laparoscópica, 3=Cirugía abdominal laparotomía, 4=Cirugía tórax, 5=ITU, 6=Trauma raquimedular, 7=Trombosis, 8=Sepsis, 9=ACV, 10=Neuroquirúrgico, 12=Hipoxia perinatal, 13=SBO pediátrico, 14=ATL, 15=Cardiológico, 16=Cáncer, 17=Prótesis de cadera, 18=Prótesis de rodilla, 19=Otro, 20=Plastía de cadera, 21=Plastía de rodilla, 22=TEC, 23=PTM, 24=Paratiroidectomía, 25=Cirugía plástica, 26=EPOC/Respiratorio crónico, 27=RNPT, 28=Cirugía columna, 29=Síndrome convulsivo, 30=Falla renal, 31=Traumatológico, 32=Psiquiatría.

Nota: código 11 no existe en la fuente original (salto intencional, confirmado por el usuario).

## Lógica del Excel

- Adjunto llega siempre en formato `.xlsx` o `.xls`
- Tiene varias hojas, una por mes
- Nombre de hoja del mes en curso: formato `MES AA` (ej: `JUN 24` para junio, `JUL 24` para julio)
- Filtrar solo filas donde columna B (fecha_atencion) = fecha de hoy
- No considerar pacientes de días anteriores en cada lectura

## Reglas de negocio clave

- **Historial se acumula**, nunca se borra automáticamente
- **App muestra solo pacientes de "hoy"** (filtro por fecha_atencion = hoy)
- **Ediciones manuales se respetan**: el script de carga SOLO inserta pacientes nuevos (que no existan aún para esa fecha + cuenta_id). Nunca sobrescribe ni borra lo ya editado en la app
- App debe permitir: ver, editar, agregar y eliminar pacientes. **Eliminar = borrado real de la fila** (no "marcar inactivo")
- Sin login por ahora (acceso abierto vía link)
- Debe poder leerse el correo "en cualquier momento" (botón o ejecución manual del script, no solo automático)
- Trigger automático configurado a las 6:00 AM diario

## Archivos del proyecto

- `AppsScript_Code.gs` — script que corre en script.google.com, lee Gmail y sube a Supabase
- (pendiente) App React — frontend de la app
- (pendiente) SQL de creación de tabla — ya ejecutado manualmente en Supabase SQL Editor

## Preferencias del usuario (Criss)

- Respuestas breves, precisas, sin relleno
- No asumir información no confirmada — siempre preguntar antes
- Explicaciones paso a paso, asumiendo que no es desarrollador
- Todo gratuito: Supabase free tier, Vercel free tier, GitHub público o privado
