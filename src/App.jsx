import { useState, useEffect, useRef } from 'react'
import { useDrag } from '@use-gesture/react'
import { supabase } from './supabaseClient'
import { BedDouble, Pencil, X, Plus, RefreshCw, Download, Clock, CheckCircle2, Search } from 'lucide-react'
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

function FilaSwipeable({ children, onSwipeRight, onSwipeLeft, deshabilitado, claseExtra }) {
  const [offset, setOffset] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const UMBRAL = 90

  const bind = useDrag(({ down, movement: [mx], direction: [dx], velocity: [vx] }) => {
    if (deshabilitado) return
    setArrastrando(down)
    if (down) {
      setOffset(mx)
    } else {
      const distancia = Math.abs(mx)
      const rapido = vx > 0.5 && distancia > 40
      if ((distancia > UMBRAL || rapido) && dx > 0) {
        setOffset(500)
        setTimeout(() => onSwipeRight(), 150)
      } else if ((distancia > UMBRAL || rapido) && dx < 0) {
        setOffset(-500)
        setTimeout(() => onSwipeLeft(), 150)
      } else {
        setOffset(0)
      }
    }
  })

  const fondoColor = offset > 20 ? 'fondo-swipe-verde' : offset < -20 ? 'fondo-swipe-rojo' : ''

  return (
    <div className={`swipe-contenedor ${fondoColor}`}>
      <div className="swipe-fondo-icono swipe-fondo-izq">
        <X size={20} strokeWidth={2.5} />
        <span>Refuerzo</span>
      </div>
      <div className="swipe-fondo-icono swipe-fondo-der">
        <CheckCircle2 size={20} strokeWidth={2.5} />
        <span>Atendido</span>
      </div>
      <div
        {...(deshabilitado ? {} : bind())}
        className={`fila-paciente ${claseExtra} ${arrastrando ? 'arrastrando' : ''}`}
        style={{
          transform: `translateX(${offset}px)`,
          touchAction: deshabilitado ? 'auto' : 'pan-y'
        }}
      >
        {children}
      </div>
    </div>
  )
}

function App() {
  const [perfil, setPerfil] = useState(null)
  const [pacientes, setPacientes] = useState([])
  const [atenciones, setAtenciones] = useState({})
  const [asignaciones, setAsignaciones] = useState({})
  const [fechaDatos, setFechaDatos] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAbierta, setBusquedaAbierta] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [pacienteEditando, setPacienteEditando] = useState(null)
  const [formulario, setFormulario] = useState(PACIENTE_VACIO)
  const [revisandoCorreo, setRevisandoCorreo] = useState(false)
  const [revisandoAlAbrir, setRevisandoAlAbrir] = useState(false)
  const [promptInstalacion, setPromptInstalacion] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)
  const [mostrarResueltos, setMostrarResueltos] = useState(false)

  useEffect(() => {
    cargarPacientes()
    revisarCorreoAlAbrir()
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

    const canalAsignaciones = supabase
      .channel('cambios-asignaciones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asignaciones' }, () => {
        cargarAsignaciones(pacientesRef.current.map(p => p.id))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canalPacientes)
      supabase.removeChannel(canalAtenciones)
      supabase.removeChannel(canalAsignaciones)
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
    await cargarAsignaciones(data.map(p => p.id))
    setCargando(false)
  }

  async function cargarAsignaciones(idsPacientes) {
    if (!idsPacientes || idsPacientes.length === 0) {
      setAsignaciones({})
      return
    }
    const { data, error } = await supabase
      .from('asignaciones')
      .select('*')
      .in('paciente_id', idsPacientes)

    if (error) {
      console.error('Error cargando asignaciones:', error)
      return
    }

    const mapa = {}
    data.forEach(a => {
      if (!mapa[a.paciente_id]) mapa[a.paciente_id] = {}
      mapa[a.paciente_id][a.numero_atencion] = a.asignado_a
    })
    setAsignaciones(mapa)
  }

  function obtenerAsignacion(pacienteId, numeroAtencion) {
    return asignaciones[pacienteId]?.[numeroAtencion] || 'titular'
  }

  async function asignarA(pacienteId, numeroAtencion, valor) {
    const { error } = await supabase
      .from('asignaciones')
      .upsert(
        { paciente_id: pacienteId, numero_atencion: numeroAtencion, asignado_a: valor, updated_at: new Date().toISOString() },
        { onConflict: 'paciente_id,numero_atencion' }
      )

    if (error) {
      setError('No se pudo cambiar la asignación. Intenta de nuevo.')
      console.error(error)
      return
    }

    await cargarAsignaciones(pacientes.map(p => p.id))
  }

  async function cambiarAsignacion(pacienteId, numeroAtencion) {
    const actual = obtenerAsignacion(pacienteId, numeroAtencion)
    const nueva = actual === 'titular' ? 'refuerzo' : 'titular'
    await asignarA(pacienteId, numeroAtencion, nueva)
  }

  async function cambiarAsignacionForzada(pacienteId, numeroAtencion, valor) {
    await asignarA(pacienteId, numeroAtencion, valor)
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

  async function revisarCorreoAlAbrir() {
    setRevisandoAlAbrir(true)
    try {
      const respuesta = await fetch(import.meta.env.VITE_APPS_SCRIPT_URL)
      const resultado = await respuesta.json()
      if (resultado.ok) {
        await cargarPacientes()
      }
    } catch (e) {
      console.error('Revision automatica al abrir fallo (silenciosa):', e)
    }
    setRevisandoAlAbrir(false)
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

  const timerToqueLargo = useRef(null)
  const toqueLargoActivado = useRef(false)

  function iniciarToqueLargo(pacienteId, numeroAtencion) {
    if (perfil !== 'titular') return
    toqueLargoActivado.current = false
    timerToqueLargo.current = setTimeout(() => {
      toqueLargoActivado.current = true
      cambiarAsignacion(pacienteId, numeroAtencion)
      if (navigator.vibrate) navigator.vibrate(40)
    }, 550)
  }

  function cancelarToqueLargo() {
    clearTimeout(timerToqueLargo.current)
  }

  function manejarClicTicket(pacienteId, numero, horaMarcada) {
    if (toqueLargoActivado.current) {
      toqueLargoActivado.current = false
      return
    }
    const asignacion = obtenerAsignacion(pacienteId, numero)
    if (asignacion !== perfil) {
      setError(`Esta atención está asignada a ${asignacion === 'titular' ? 'Titular' : 'Refuerzo'}. No puedes marcarla desde el perfil ${perfil === 'titular' ? 'Titular' : 'Refuerzo'}.`)
      return
    }
    if (horaMarcada) {
      desmarcarAtencion(pacienteId, numero)
    } else {
      marcarAtencion(pacienteId, numero)
    }
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

  function calcularContadores(rol) {
    let total = 0
    let marcadas = 0
    pacientes.forEach(p => {
      const totalPac = p.atenciones_dia || 1
      const marcadasPac = atenciones[p.id] || {}
      for (let n = 1; n <= totalPac; n++) {
        const asignacion = obtenerAsignacion(p.id, n)
        if (asignacion === rol) {
          total++
          if (marcadasPac[n]) marcadas++
        }
      }
    })
    return { total, marcadas }
  }

  const contadorTitular = calcularContadores('titular')
  const contadorRefuerzo = calcularContadores('refuerzo')

  function pacienteEstaResuelto(paciente) {
    const totalAtenciones = paciente.atenciones_dia || 1
    const marcadasPaciente = atenciones[paciente.id] || {}
    const numerosAtencion = Array.from({ length: totalAtenciones }, (_, i) => i + 1)
    // Resuelto para mi vista si: todas sus atenciones de MI perfil estan marcadas,
    // y no tiene atenciones pendientes asignadas a mi perfil
    const atencionesDeMiPerfil = numerosAtencion.filter(n => obtenerAsignacion(paciente.id, n) === perfil)
    if (atencionesDeMiPerfil.length === 0) {
      // Si nada le corresponde a mi perfil (todo fue derivado al otro), no aparece como pendiente para mi
      return true
    }
    return atencionesDeMiPerfil.every(n => marcadasPaciente[n])
  }

  const pacientesActivosLista = pacientesFiltrados.filter(p => !pacienteEstaResuelto(p))
  const pacientesResueltos = pacientesFiltrados.filter(p => pacienteEstaResuelto(p))

  function renderizarFilaPaciente(paciente, esResuelto = false) {
    const totalAtenciones = paciente.atenciones_dia || 1
    const marcadasPaciente = atenciones[paciente.id] || {}
    const numerosAtencion = Array.from({ length: totalAtenciones }, (_, i) => i + 1)
    const cantidadMarcadas = numerosAtencion.filter(n => marcadasPaciente[n]).length
    const todasMarcadas = cantidadMarcadas === totalAtenciones
    const algunasMarcadas = cantidadMarcadas > 0 && !todasMarcadas
    const claseFila = todasMarcadas ? 'fila-completa' : algunasMarcadas ? 'fila-parcial' : ''

    const esSwipeable = totalAtenciones === 1 && !esResuelto && obtenerAsignacion(paciente.id, 1) === perfil

    const contenidoFila = (
      <>
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
            const asignacion = obtenerAsignacion(paciente.id, numero)
            const esRefuerzo = asignacion === 'refuerzo'
            const noEsMio = asignacion !== perfil
            const puedeRecuperar = esResuelto && perfil === 'titular' && esRefuerzo && !horaMarcada
            return (
              <div key={numero} className="ticket-grupo">
                <button
                  className={`ticket ${horaMarcada ? 'ticket-hecho' : 'ticket-pendiente'} ${esRefuerzo ? 'ticket-refuerzo' : ''} ${noEsMio ? 'ticket-no-mio' : ''}`}
                  onClick={() => manejarClicTicket(paciente.id, numero, horaMarcada)}
                  onTouchStart={() => iniciarToqueLargo(paciente.id, numero)}
                  onTouchEnd={cancelarToqueLargo}
                  onMouseDown={() => iniciarToqueLargo(paciente.id, numero)}
                  onMouseUp={cancelarToqueLargo}
                  onMouseLeave={cancelarToqueLargo}
                >
                  {horaMarcada ? (
                    <>
                      <CheckCircle2 size={12} strokeWidth={2.3} /> {formatearHora(horaMarcada)}
                    </>
                  ) : (
                    <>
                      <Clock size={12} strokeWidth={2.3} /> {numero}ª
                    </>
                  )}
                  {esRefuerzo && <span className="etiqueta-refuerzo">R</span>}
                </button>
                {puedeRecuperar && (
                  <button
                    className="boton-recuperar"
                    onClick={() => cambiarAsignacionForzada(paciente.id, numero, 'titular')}
                  >
                    ↩ Recuperar
                  </button>
                )}
              </div>
            )
          })}
        </span>
        <span className="col-acciones">
          <button className="boton-icono editar" onClick={() => abrirFormularioEditar(paciente)} aria-label="Editar">
            <Pencil size={13} strokeWidth={2.3} />
          </button>
          <button className="boton-icono eliminar" onClick={() => eliminarPaciente(paciente)} aria-label="Eliminar">
            <X size={14} strokeWidth={2.5} />
          </button>
        </span>
      </>
    )

    if (esSwipeable) {
      return (
        <FilaSwipeable
          key={paciente.id}
          claseExtra={claseFila}
          deshabilitado={false}
          onSwipeRight={() => marcarAtencion(paciente.id, 1)}
          onSwipeLeft={() => cambiarAsignacionForzada(paciente.id, 1, 'refuerzo')}
        >
          {contenidoFila}
        </FilaSwipeable>
      )
    }

    return (
      <div key={paciente.id} className={`fila-paciente ${claseFila}`}>
        {contenidoFila}
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="contenedor pantalla-perfil">
        <h1 className="titulo-perfil">TO CAT</h1>
        <p className="subtitulo-perfil">¿Con qué perfil vas a trabajar hoy?</p>
        <button className="boton-perfil titular" onClick={() => setPerfil('titular')}>
          Titular
        </button>
        <button className="boton-perfil refuerzo" onClick={() => setPerfil('refuerzo')}>
          Refuerzo
        </button>
      </div>
    )
  }

  return (
    <div className="contenedor">
      <header className="encabezado">
        <h1>TO CAT</h1>
        <div className="fechas">
          <button className={`chip-perfil ${perfil}`} onClick={() => setPerfil(null)}>
            {perfil === 'titular' ? 'Titular' : 'Refuerzo'} · cambiar
          </button>
          <p className="fecha-dato">
            {fechaDatos ? `Pacientes del ${formatearFechaLegible(fechaDatos)}` : 'Sin datos cargados'}
          </p>
          <p className="fecha-actual">Hoy: {formatearFechaLegible(fechaHoy())}</p>
          {revisandoAlAbrir && <p className="indicador-sync">Buscando actualizaciones...</p>}
        </div>
      </header>

      {(contadorTitular.total > 0 || contadorRefuerzo.total > 0) && (
        <div className="progreso-container">
          <div className="progreso-fila">
            <div className="progreso-texto">
              <span>Titular {contadorTitular.total > 10 ? '⚠️' : ''}</span>
              <span className="progreso-numero">{contadorTitular.marcadas} / {contadorTitular.total}</span>
            </div>
            <div className="progreso-barra-fondo">
              <div
                className="progreso-barra-relleno"
                style={{ width: `${contadorTitular.total ? (contadorTitular.marcadas / contadorTitular.total) * 100 : 0}%` }}
              />
            </div>
          </div>
          <p className="ayuda-toque-largo">Mantén presionado un ticket para asignarlo a Refuerzo</p>
          {contadorRefuerzo.total > 0 && (
            <div className="progreso-fila">
              <div className="progreso-texto">
                <span>Refuerzo</span>
                <span className="progreso-numero progreso-numero-refuerzo">{contadorRefuerzo.marcadas} / {contadorRefuerzo.total}</span>
              </div>
              <div className="progreso-barra-fondo">
                <div
                  className="progreso-barra-relleno progreso-barra-refuerzo"
                  style={{ width: `${contadorRefuerzo.total ? (contadorRefuerzo.marcadas / contadorRefuerzo.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="barra-acciones">
        <div className={`buscador-contenedor ${busquedaAbierta ? 'abierto' : ''}`}>
          {busquedaAbierta && (
            <input
              type="text"
              placeholder="Buscar por nombre o habitación..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="buscador"
              autoFocus
            />
          )}
          <button
            className="boton-cuadrado buscar"
            onClick={() => {
              if (busquedaAbierta) setBusqueda('')
              setBusquedaAbierta(!busquedaAbierta)
            }}
            aria-label="Buscar"
          >
            {busquedaAbierta ? <X size={18} strokeWidth={2.3} /> : <Search size={18} strokeWidth={2.3} />}
          </button>
        </div>
        <button className="boton-cuadrado agregar" onClick={abrirFormularioNuevo} aria-label="Agregar paciente">
          <Plus size={20} strokeWidth={2.5} />
        </button>
        <button
          className="boton-cuadrado revisar"
          onClick={revisarCorreoNuevo}
          disabled={revisandoCorreo}
          aria-label="Revisar correo nuevo"
        >
          <RefreshCw size={18} strokeWidth={2.3} className={revisandoCorreo ? 'icono-girando' : ''} />
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
        <>
          <div className="tabla-pacientes">
            <div className="fila-encabezado">
              <span className="col-hab"><BedDouble size={13} strokeWidth={2.2} /></span>
              <span className="col-nombre">Nombre / Cta</span>
              <span className="col-edad">Edad</span>
              <span className="col-dg">Diag.</span>
              <span className="col-tickets">Atención</span>
              <span className="col-acciones"></span>
            </div>
            {pacientesActivosLista.map(paciente => renderizarFilaPaciente(paciente))}
          </div>

          {pacientesResueltos.length > 0 && (
            <div className="seccion-resueltos">
              <button
                className="boton-toggle-resueltos"
                onClick={() => setMostrarResueltos(!mostrarResueltos)}
              >
                {mostrarResueltos ? '▲' : '▼'} Resueltos / derivados ({pacientesResueltos.length})
              </button>
              {mostrarResueltos && (
                <div className="tabla-pacientes tabla-resueltos">
                  {pacientesResueltos.map(paciente => renderizarFilaPaciente(paciente, true))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {promptInstalacion && (
        <div className="pie-instalar">
          <button className="boton-instalar" onClick={instalarApp}>
            <Download size={14} strokeWidth={2.3} /> Instalar app
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
