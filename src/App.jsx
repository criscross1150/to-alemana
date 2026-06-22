import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

// SIMULACION TEMPORAL: forzar fecha para pruebas. Quitar antes de produccion real.
const FECHA_SIMULADA = '2026-03-12'

function fechaHoy() {
  return FECHA_SIMULADA
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
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [pacienteEditando, setPacienteEditando] = useState(null)
  const [formulario, setFormulario] = useState(PACIENTE_VACIO)

  useEffect(() => {
    cargarPacientes()
  }, [])

  async function cargarPacientes() {
    setCargando(true)
    setError(null)
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('fecha_atencion', fechaHoy())
      .order('habitacion', { ascending: true })

    if (error) {
      setError('No se pudo cargar la lista. Intenta de nuevo.')
      console.error(error)
    } else {
      setPacientes(data)
    }
    setCargando(false)
  }

  function abrirFormularioNuevo() {
    setPacienteEditando(null)
    setFormulario(PACIENTE_VACIO)
    setMostrarFormulario(true)
  }

  function abrirFormularioEditar(paciente) {
    setPacienteEditando(paciente)
    setFormulario(paciente)
    setMostrarFormulario(true)
  }

  function cerrarFormulario() {
    setMostrarFormulario(false)
    setPacienteEditando(null)
    setFormulario(PACIENTE_VACIO)
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
      fecha_atencion: formulario.fecha_atencion || fechaHoy(),
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
        <p className="fecha">{fechaHoy()}</p>
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
        <div className="lista-pacientes">
          {pacientesFiltrados.map(paciente => (
            <div key={paciente.id} className="tarjeta-paciente">
              <div className="tarjeta-fila-superior">
                <span className="habitacion">Hab. {paciente.habitacion || '-'}</span>
                <span className="cuenta-id">ID: {paciente.cuenta_id || '-'}</span>
              </div>
              <h2 className="nombre-paciente">
                {paciente.nombre} {paciente.apellido} {paciente.apellido_materno}
              </h2>
              <div className="detalle-grid">
                <div className="detalle-item">
                  <span className="etiqueta">Edad</span>
                  <span className="valor">{paciente.edad ?? '-'}</span>
                </div>
                <div className="detalle-item">
                  <span className="etiqueta">Atenciones/día</span>
                  <span className="valor">{paciente.atenciones_dia ?? '-'}</span>
                </div>
                <div className="detalle-item detalle-ancho">
                  <span className="etiqueta">Diagnóstico</span>
                  <span className="valor">{paciente.diagnostico || '-'}</span>
                </div>
              </div>
              <div className="tarjeta-acciones">
                <button className="boton-editar" onClick={() => abrirFormularioEditar(paciente)}>
                  Editar
                </button>
                <button className="boton-eliminar" onClick={() => eliminarPaciente(paciente)}>
                  Eliminar
                </button>
              </div>
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
