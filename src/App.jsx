import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function fechaHoy() {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = String(hoy.getMonth() + 1).padStart(2, '0')
  const d = String(hoy.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatearFechaLegible(fechaStr) {
  if (!fechaStr) return ''
  const [y, m, d] = fechaStr.split('-')
  return `${d}-${m}-${y}`
}

const PACIENTE_VACIO = {
  cuenta_id: '',
  nombre: '',
  apellido: '',
  apellido_materno: '',
  edad: '',
  diagnostico: '',
  habitacion: '',
  atenciones_dia: '',
  fecha_atencion: fechaHoy()
}

function App() {
  const [pacientes, setPacientes] = useState([])
  const [atenciones, setAtenciones] = useState({})
  const [fechaDatos, setFechaDatos] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [pacienteEditando, setPacienteEditando] = useState(null)
  const [formulario, setFormulario] = useState(PACIENTE_VACIO)
  const [revisandoCorreo, setRevisandoCorreo] = useState(false)
  const [promptInstalacion, setPromptInstalacion] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)

  useEffect(() => {
    cargarPacientes()
  }, [])

  useEffect(() => {
    const manejarPromptInstalacion = (e) => {
      e.preventDefault()
      setPromptInstalacion(e)
    }
    window.addEventListener('beforeinstallprompt', manejarPromptInstalacion)
    return () => window.removeEventListener('beforeinstallprompt', manejarPromptInstalacion)
  }, [])

  async function instalarApp() {
    if (!promptInstalacion) return
    promptInstalacion.prompt()
    await promptInstalacion.userChoice
    setPromptInstalacion(null)
  }

  const pacientesRef = useRef(pacientes)
  useEffect(() => {
    pacientesRef.current = pacientes
  }, [pacientes])

  useEffect(() => {
    const canalPacientes = supabase
      .channel('cambios-pacientes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacientes' }, () => {
        cargarPacientes()
      })
      .subscribe()

    const canalAtenciones = supabase
      .channel('cambios-atenciones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atenciones' }, () => {
        cargarAtenciones(pacientesRef.current.map(p => p.id))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canalPacientes)
      supabase.removeChannel(canalAtenciones)
    }
  }, [])

  useEffect(() => {
    if (mostrarFormulario) {
      window.history.pushState({ formularioAbierto: true }, '')
      const manejarAtras = () => {
        setMostrarFormulario(false)
        setPacienteEditando(null)
        setFormulario(PACIENTE_VACIO)
      }
      window.addEventListener('popstate', manejarAtras)
      return () => window.removeEventListener('popstate', manejarAtras)
    }
  }, [mostrarFormulario])

  async function cargarPacientes() {
    setCargando(true)
    setError(null)

    // Paso 1: buscar la fecha mas reciente que tenga pacientes registrados
    const { data: ultimaFechaData, error: errorFecha } = await supabase
      .from('pacientes')
      .select('fecha_atencion')
      .order('fecha_atencion', { ascending: false })
      .limit(1)

    if (errorFecha) {
      setError('Error buscando fecha: ' + errorFecha.message)
      setCargando(false)
      return
    }

    if (!ultimaFechaData || ultimaFechaData.length === 0) {
      setFechaDatos(null)
      setPacientes([])
      setCargando(false)
      return
    }

    const fechaUltima = ultimaFechaData[0].fecha_atencion
    setFechaDatos(fechaUltima)

    // Paso 2: cargar todos los pacientes de esa fecha
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('fecha_atencion', fechaUltima)
      .order('habitacion', { ascending: true })

    if (error) {
      setError('Error: ' + error.message)
      console.error(error)
      setCargando(false)
      return
    }

    setPacientes(data)
    await cargarAtenciones(data.map(p => p.id))
    setCargando(false)
  }

  async function cargarAtenciones(idsPacientes) {
    if (!idsPacientes || idsPacientes.length === 0) {
      setAtenciones({})
      return
    }
    const { data, error } = await supabase
      .from('atenciones')
      .select('*')
      .in('paciente_id', idsPacientes)

    if (error) {
      console.error('Error cargando atenciones:', error)
      return
    }

    const mapa = {}
    data.forEach(a => {
      if (!mapa[a.paciente_id]) mapa[a.paciente_id] = {}
      mapa[a.paciente_id][a.numero_atencion] = a.hora_marcaje
    })
    setAtenciones(mapa)
  }

  async function marcarAtencion(pacienteId, numeroAtencion) {
    const { error } = await supabase
      .from('atenciones')
      .insert([{ paciente_id: pacienteId, numero_atencion: numeroAtencion }])

    if (error) {
      setError('No se pudo marcar la atención. Intenta de nuevo.')
      console.error(error)
      return
    }

    await cargarAtenciones(pacientes.map(p => p.id))
  }

  function desmarcarAtencion(pacienteId, numeroAtencion) {
    setConfirmacion({
      mensaje: '¿Deshacer marcaje de esta atención?',
      accion: async () => {
        const { error } = await supabase
          .from('atenciones')
          .delete()
          .eq('paciente_id', pacienteId)
          .eq('numero_atencion', numeroAtencion)

        if (error) {
          setError('No se pudo deshacer el marcaje. Intenta de nuevo.')
          console.error(error)
          return
        }
        await cargarAtenciones(pacientes.map(p => p.id))
      }
    })
  }

  function formatearHora(horaIso) {
    if (!horaIso) return ''
    // Postgres/Supabase devuelve el timestamp sin sufijo de zona (ej: "2026-06-26T22:43:00").
    // Sin sufijo, JS lo interpretaria como hora LOCAL del dispositivo, no UTC.
    // Se fuerza interpretacion como UTC agregando 'Z' si no la tiene, luego se convierte a Chile.
    let horaConZ = horaIso
    if (!horaConZ.endsWith('Z') && !horaConZ.includes('+')) {
      horaConZ = horaConZ.replace(' ', 'T') + 'Z'
    }
    const fecha = new Date(horaConZ)
    return fecha.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Santiago'
    })
  }

  async function revisarCorreoNuevo() {
    setRevisandoCorreo(true)
    setError(null)
    try {
      const respuesta = await fetch(import.meta.env.VITE_APPS_SCRIPT_URL)
      const resultado = await respuesta.json()
      if (!resultado.ok) {
        setError('No se pudo revisar el correo: ' + resultado.mensaje)
      }
    } catch (e) {
      setError('No se pudo conectar con el revisor de correo. Intenta de nuevo.')
      console.error(e)
    }
    await cargarPacientes()
    setRevisandoCorreo(false)
  }

  function abrirFormularioNuevo() {
    setPacienteEditando(null)
    setFormulario({ ...PACIENTE_VACIO, fecha_atencion: fechaDatos || fechaHoy() })
    setMostrarFormulario(true)
  }

  function abrirFormularioEditar(paciente) {
    setPacienteEditando(paciente)
    setFormulario(paciente)
    setMostrarFormulario(true)
  }

  function cerrarFormulario() {
    if (window.history.state?.formularioAbierto) {
      window.history.back()
    } else {
      setMostrarFormulario(false)
      setPacienteEditando(null)
      setFormulario(PACIENTE_VACIO)
    }
  }

  function actualizarCampo(campo, valor) {
    setFormulario(prev => ({ ...prev, [campo]: valor }))
  }

  async function guardarPaciente(e) {
    e.preventDefault()
    setError(null)

    const datos = {
      cuenta_id: formulario.cuenta_id,
      nombre: formulario.nombre,
      apellido: formulario.apellido,
      apellido_materno: formulario.apellido_materno,
      edad: formulario.edad ? parseInt(formulario.edad) : null,
      diagnostico: formulario.diagnostico,
      habitacion: formulario.habitacion,
      atenciones_dia: formulario.atenciones_dia ? parseInt(formulario.atenciones_dia) : null,
      fecha_atencion: formulario.fecha_atencion || fechaDatos || fechaHoy(),
      updated_at: new Date().toISOString()
    }

    let resultado
    if (pacienteEditando) {
      resultado = await supabase
        .from('pacientes')
        .update(datos)
        .eq('id', pacienteEditando.id)
    } else {
      resultado = await supabase
        .from('pacientes')
        .insert([datos])
    }

    if (resultado.error) {
      setError('No se pudo guardar. Intenta de nuevo.')
      console.error(resultado.error)
      return
    }

    cerrarFormulario()
    cargarPacientes()
  }

  function eliminarPaciente(paciente) {
    setConfirmacion({
      mensaje: `¿Eliminar a ${paciente.nombre} ${paciente.apellido}? Esta acción no se puede deshacer.`,
      accion: async () => {
        const { error } = await supabase
          .from('pacientes')
          .delete()
          .eq('id', paciente.id)

        if (error) {
          setError('No se pudo eliminar. Intenta de nuevo.')
          console.error(error)
          return
        }
        cargarPacientes()
      }
    })
  }

  const pacientesFiltrados = pacientes.filter(p => {
    const texto = busqueda.toLowerCase()
    return (
      p.nombre?.toLowerCase().includes(texto) ||
      p.apellido?.toLowerCase().includes(texto) ||
      p.apellido_materno?.toLowerCase().includes(texto) ||
      p.habitacion?.toLowerCase().includes(texto)
    )
  })

  return (
    <div className="contenedor">
      <header className="encabezado">
        <h1>TO CAT</h1>
        <div className="fechas">
          <p className="fecha-dato">
            {fechaDatos ? `Pacientes del ${formatearFechaLegible(fechaDatos)}` : 'Sin datos cargados'}
          </p>
          <p className="fecha-actual">Hoy: {formatearFechaLegible(fechaHoy())}</p>
        </div>
      </header>

      <div className="barra-acciones">
        <input
          type="text"
          placeholder="Buscar por nombre o habitación..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="buscador"
        />
        <button className="boton-agregar" onClick={abrirFormularioNuevo}>
          + Agregar paciente
        </button>
        <button className="boton-revisar" onClick={revisarCorreoNuevo} disabled={revisandoCorreo}>
          {revisandoCorreo ? 'Revisando correo...' : '🔄 Revisar correo nuevo'}
        </button>
      </div>

      {error && <div className="mensaje-error">{error}</div>}

      {cargando ? (
        <p className="estado-vacio">Cargando...</p>
      ) : pacientesFiltrados.length === 0 ? (
        <p className="estado-vacio">
          {busqueda ? 'No hay pacientes que coincidan.' : 'No hay pacientes registrados hoy.'}
        </p>
      ) : (
        <div className="tabla-pacientes">
          <div className="fila-encabezado">
            <span className="col-hab">Hab</span>
            <span className="col-nombre">Nombre / Cta</span>
            <span className="col-edad">Edad</span>
            <span className="col-dg">Diag.</span>
            <span className="col-tickets">Atención</span>
            <span className="col-acciones"></span>
          </div>
          {pacientesFiltrados.map(paciente => {
            const totalAtenciones = paciente.atenciones_dia || 1
            const marcadasPaciente = atenciones[paciente.id] || {}
            const numerosAtencion = Array.from({ length: totalAtenciones }, (_, i) => i + 1)
            const cantidadMarcadas = numerosAtencion.filter(n => marcadasPaciente[n]).length
            const todasMarcadas = cantidadMarcadas === totalAtenciones
            const algunasMarcadas = cantidadMarcadas > 0 && !todasMarcadas
            const claseFila = todasMarcadas ? 'fila-completa' : algunasMarcadas ? 'fila-parcial' : ''
            return (
              <div key={paciente.id} className={`fila-paciente ${claseFila}`}>
                <span className="col-hab">{paciente.habitacion || '-'}</span>
                <span className="col-nombre">
                  <span className="nombre-texto">
                    {paciente.nombre} {paciente.apellido} {paciente.apellido_materno}
                  </span>
                  <span className="id-texto">Cta {paciente.cuenta_id || '-'}</span>
                </span>
                <span className="col-edad">{paciente.edad ?? '-'}</span>
                <span className="col-dg">{paciente.diagnostico || '-'}</span>
                <span className="col-tickets">
                  {numerosAtencion.map(numero => {
                    const horaMarcada = marcadasPaciente[numero]
                    return (
                      <button
                        key={numero}
                        className={`ticket ${horaMarcada ? 'ticket-hecho' : 'ticket-pendiente'}`}
                        onClick={() =>
                          horaMarcada
                            ? desmarcarAtencion(paciente.id, numero)
                            : marcarAtencion(paciente.id, numero)
                        }
                      >
                        {horaMarcada ? `✓ ${formatearHora(horaMarcada)}` : `${numero}ª`}
                      </button>
                    )
                  })}
                </span>
                <span className="col-acciones">
                  <button className="boton-icono editar" onClick={() => abrirFormularioEditar(paciente)} aria-label="Editar">
                    ✎
                  </button>
                  <button className="boton-icono eliminar" onClick={() => eliminarPaciente(paciente)} aria-label="Eliminar">
                    ✕
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {promptInstalacion && (
        <div className="pie-instalar">
          <button className="boton-instalar" onClick={instalarApp}>
            ⬇ Instalar app
          </button>
        </div>
      )}

      {mostrarFormulario && (
        <div className="superposicion" onClick={cerrarFormulario}>
          <form className="formulario" onClick={e => e.stopPropagation()} onSubmit={guardarPaciente}>
            <h2>{pacienteEditando ? 'Editar paciente' : 'Agregar paciente'}</h2>

            <label>
              Habitación
              <input
                type="text"
                value={formulario.habitacion}
                onChange={e => actualizarCampo('habitacion', e.target.value)}
              />
            </label>

            <label>
              Nombre
              <input
                type="text"
                value={formulario.nombre}
                onChange={e => actualizarCampo('nombre', e.target.value)}
                required
              />
            </label>

            <label>
              Apellido paterno
              <input
                type="text"
                value={formulario.apellido}
                onChange={e => actualizarCampo('apellido', e.target.value)}
                required
              />
            </label>

            <label>
              Apellido materno
              <input
                type="text"
                value={formulario.apellido_materno}
                onChange={e => actualizarCampo('apellido_materno', e.target.value)}
              />
            </label>

            <label>
              Edad
              <input
                type="number"
                value={formulario.edad}
                onChange={e => actualizarCampo('edad', e.target.value)}
              />
            </label>

            <label>
              Diagnóstico
              <input
                type="text"
                value={formulario.diagnostico}
                onChange={e => actualizarCampo('diagnostico', e.target.value)}
              />
            </label>

            <label>
              Atenciones indicadas por día
              <input
                type="number"
                min="1"
                value={formulario.atenciones_dia}
                onChange={e => actualizarCampo('atenciones_dia', e.target.value)}
              />
            </label>

            <label>
              ID / Cuenta
              <input
                type="text"
                value={formulario.cuenta_id}
                onChange={e => actualizarCampo('cuenta_id', e.target.value)}
              />
            </label>

            <div className="formulario-acciones">
              <button type="button" className="boton-cancelar" onClick={cerrarFormulario}>
                Cancelar
              </button>
              <button type="submit" className="boton-guardar">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
      {confirmacion && (
        <div className="superposicion" onClick={() => setConfirmacion(null)}>
          <div className="modal-confirmacion" onClick={e => e.stopPropagation()}>
            <p>{confirmacion.mensaje}</p>
            <div className="formulario-acciones">
              <button className="boton-cancelar" onClick={() => setConfirmacion(null)}>
                Cancelar
              </button>
              <button
                className="boton-guardar"
                onClick={async () => {
                  await confirmacion.accion()
                  setConfirmacion(null)
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
