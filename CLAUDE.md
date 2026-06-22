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
| cuenta_id | text | columna N | identificador único de paciente/cuenta |
| nombre | text | columna F | nombre |
| apellido | text | columna G | apellido |
| edad | int | columna I | edad |
| diagnostico | text | columna J | diagnóstico de ingreso (por ahora numérico, se corrige a futuro) |
| habitacion | text | columna D | habitación |
| atenciones_dia | int | columna E | número de atenciones diarias |
| fecha_atencion | date | columna B | fecha de atención |
| created_at | timestamp (auto) | — | fecha de creación del registro |
| updated_at | timestamp (auto) | — | fecha de última edición |

RLS habilitado, policy abierta (sin login por ahora).

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
