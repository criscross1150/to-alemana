import { useState, useEffect } from 'react'
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
  const [fechaDatos, setFechaDatos] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [pacienteEditando, setPacienteEditando] = useState(null)
  const [formulario, setFormulario] = useState(PACIENTE_VACIO)

  useEffect(() => {
    cargarPacientes()
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
    } else {
      setPacientes(data)
    }
    setCargando(false)
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

  async function eliminarPaciente(paciente) {
    const confirmar = window.confirm(
      `Eliminar a ${paciente.nombre} ${paciente.apellido}? Esta acción no se puede deshacer.`
    )
    if (!confirmar) return

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
        <h1>TO Alemana</h1>
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
            <span className="col-nombre">Nombre</span>
            <span className="col-edad">Edad</span>
            <span className="col-dg">Diagnóstico</span>
            <span className="col-aten">At/día</span>
            <span className="col-id">ID</span>
            <span className="col-acciones"></span>
          </div>
          {pacientesFiltrados.map(paciente => (
            <div key={paciente.id} className="fila-paciente">
              <span className="col-hab">{paciente.habitacion || '-'}</span>
              <span className="col-nombre">
                {paciente.nombre} {paciente.apellido} {paciente.apellido_materno}
              </span>
              <span className="col-edad">{paciente.edad ?? '-'}</span>
              <span className="col-dg">{paciente.diagnostico || '-'}</span>
              <span className="col-aten">{paciente.atenciones_dia ?? '-'}</span>
              <span className="col-id">{paciente.cuenta_id || '-'}</span>
              <span className="col-acciones">
                <button className="boton-icono editar" onClick={() => abrirFormularioEditar(paciente)} aria-label="Editar">
                  ✎
                </button>
                <button className="boton-icono eliminar" onClick={() => eliminarPaciente(paciente)} aria-label="Eliminar">
                  ✕
                </button>
              </span>
            </div>
          ))}
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
              Atenciones por día
              <input
                type="number"
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
    </div>
  )
}

export default App
