-- Habilita actualizaciones en tiempo real para que varios usuarios vean cambios al instante
alter publication supabase_realtime add table pacientes;
alter publication supabase_realtime add table atenciones;
