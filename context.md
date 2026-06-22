# Contexto acumulado — TO Alemana

## Historial de decisiones (en orden)

1. **Idea inicial:** app para leer Excel de correo nocturno, mostrar pacientes atendidos del día (habitación, nombre, apellido, diagnóstico, edad), con CRUD completo, mobile-friendly, hosting gratuito.

2. **Definición de columnas Excel:**
   - B = fecha de atención (filtrar solo "hoy")
   - D = habitación
   - E = número de atenciones diarias
   - F = nombre
   - G = apellido
   - I = edad
   - J = diagnóstico (numérico por ahora, se corregirá después)
   - N = cuenta_id / id del paciente

3. **Excel tiene varias hojas por mes.** Nombre de hoja del mes actual sigue patrón `MES AA` (ej: `JUN 24`, `JUL 24`).

4. **Correo origen:** Gmail, remitente fijo `serviciodesaludcat@gmail.com`, llega de noche con adjunto Excel.

5. **Decisión de arquitectura:** Opción A elegida — Google Apps Script (gratis, sin servidor) en lugar de backend con Railway/Render. Apps Script lee Gmail, parsea Excel, sube a Supabase. App web solo lee/escribe en Supabase.

6. **Guardado de cambios:** deben quedar persistentes y visibles para múltiples usuarios simultáneos → se usa Supabase como base compartida.

7. **Sin login por ahora** — acceso abierto vía link, RLS con policy abierta.

8. **Nombre app:** "TO Alemana"

9. **Cuentas confirmadas:**
   - Supabase: cuenta de Criss, proyecto `to-alemana` creado
   - GitHub: usuario `criscross1150`
   - Vercel: ya usado antes, sin preferencia especial

10. **Tabla `pacientes` creada en Supabase** vía SQL Editor manual (no vía API, por bloqueo de red del entorno de Claude hacia dominios externos no listados).

11. **Primera prueba del script:** ejecutada con éxito (sin errores de código), no encontró correo porque aún no había llegado el de esa noche. Confirma que conexión Gmail funciona.

12. **Decisión sobre historial vs. sobrescritura (cambio importante):**
    - Primera versión: el script borraba pacientes de fechas anteriores cada corrida (no acumulaba historial)
    - Cambio 1: se decide acumular historial completo, app solo muestra "hoy" con filtro
    - Cambio 2 (ediciones manuales): se detecta riesgo de que correr el script dos veces el mismo día sobrescriba ediciones hechas en la app. Decisión final: **el script solo inserta pacientes nuevos** (que no existan aún para esa fecha_atencion + cuenta_id). Nunca sobrescribe, nunca borra. Las ediciones manuales en la app quedan siempre intactas.

13. **Decisión sobre eliminar paciente:** borrado real de la fila (no "marcar inactivo"). Al borrar en la app, el registro desaparece de Supabase completamente.

14. **Skills agregadas al entorno de Claude** (para uso en este y otros proyectos):
    - `web-design-guidelines` (Vercel) — para auditar la UI cuando la app esté lista
    - `remotion` — no aplica a este proyecto, guardada para uso futuro
    - `find-skills` — buscador de skills adicionales
    - `graphify` — mapeo de codebases a grafos de conocimiento, no instalada/activada (requiere pip install), guardada solo como referencia

## Pendiente de definir (preguntas abiertas)

(ninguna por ahora)

## Próximos pasos (no iniciados aún)

- Definir comportamiento de "eliminar" en la app
- Construir frontend React (mobile-first)
- Conectar frontend a Supabase (CRUD)
- Subir código a GitHub (`criscross1150/to-alemana`)
- Conectar repo a Vercel, dejar app online
- Revisar UI final con skill `web-design-guidelines`

## Estado actual de archivos

- `AppsScript_Code.gs` — completo, con anon key incluida, lógica de "solo insertar nuevos" implementada. Pendiente que el usuario lo actualice en script.google.com (reemplazar versión anterior).
- Tabla `pacientes` en Supabase — creada y activa.
- Frontend React — no iniciado.
- Repo GitHub — no creado aún.
