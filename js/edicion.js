// Edición y alta de medicamentos en el teléfono.
// No calcula ni decide nada médico: guarda lo que la persona escribe, le pone
// la fuente que ella indica a cada dato que cambió, deja el valor anterior
// para deshacer, y pasa todo por la misma revisión que un archivo cargado.
import { validar, fechaISO } from './datos.js';

// Datos que llevan su propia fuente en el formato.
const BLOQUES = ['presentacion', 'dosis', 'concentracion', 'medida', 'comida', 'ajuste', 'dia_examen'];

export const NOMBRES_CAMBIO = {
  nombre: 'nombre', grupo: 'grupo', estado: 'estado', presentacion: 'presentación', tomas: 'horas',
  dosis: 'dosis', concentracion: 'concentración', medida: 'con qué se mide', proteccion: 'protección',
  comida: 'comida', preparacion: 'preparación', cuidados: 'cuidados', por_confirmar: 'por confirmar',
  origen: 'ajuste de la familia', ajuste: 'ajuste de la familia', dia_examen: 'día del examen',
};

const copia = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

export function slug(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export function nuevoId(nombre, ids) {
  const base = slug(nombre) || 'medicamento';
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
  return id;
}

// "1,5" -> 1.5; vacío o inválido -> undefined
export function leerNumero(v) {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

// Borrador vacío para un medicamento nuevo.
export function medVacio() {
  return {
    nombre: '',
    grupo: 'otro',
    estado: 'vigente',
    presentacion: { tipo: 'tableta', texto: '' },
    tomas: [{ hora: '08:00' }],
    dosis: { texto: '', medida: 'cc' },
    medida: { instrumento: 'jeringa' },
    comida: { regla: '', texto: '' },
    preparacion: { tipo: 'diluir_tableta', pasos: [{ texto: '' }] },
  };
}

const vacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && !Number.isFinite(v));

function sinVacios(o) {
  if (!o || typeof o !== 'object') return o;
  for (const k of Object.keys(o)) {
    if (typeof o[k] === 'string') o[k] = o[k].trim();
    if (vacio(o[k])) delete o[k];
  }
  return o;
}

// Deja el borrador en el formato del archivo: quita lo vacío y aplica la regla
// de "por confirmar": sin dosis ni cantidades.
export function limpiar(borrador) {
  const m = sinVacios(copia(borrador));
  ['presentacion', 'dosis', 'concentracion', 'medida', 'comida', 'ajuste'].forEach((b) => { if (m[b]) sinVacios(m[b]); });

  m.tomas = (m.tomas || []).map((t) => sinVacios(t)).filter((t) => t.hora);
  m.tomas.forEach((t) => { if (Array.isArray(t.dias) && t.dias.length === 7) delete t.dias; });
  if (!m.tomas.length) delete m.tomas;

  if (m.dosis && !m.dosis.texto && m.dosis.cantidad === undefined && m.dosis.valor === undefined) delete m.dosis;
  if (m.dosis && m.dosis.valor === undefined) delete m.dosis.unidad;
  if (m.concentracion && (m.concentracion.valor === undefined || (m.concentracion.ml === undefined && m.concentracion.gotas === undefined))) delete m.concentracion;
  if (m.medida) {
    if (m.medida.capacidad === undefined) delete m.medida.dibujo_verificado;
    else if (m.medida.dibujo_verificado === undefined) m.medida.dibujo_verificado = false;
    if (!m.medida.instrumento) delete m.medida;
  }
  if (m.comida && !m.comida.regla) delete m.comida;
  if (m.presentacion && !m.presentacion.texto) delete m.presentacion.texto;

  if (m.preparacion) {
    const pasos = (m.preparacion.pasos || []).map((p) => {
      sinVacios(p);
      if (p.medir) {
        sinVacios(p.medir);
        if (p.medir.cantidad === undefined) delete p.medir;
      }
      if (!p.dar) delete p.dar;
      return p;
    }).filter((p) => p.texto);
    m.preparacion.pasos = pasos;
    if (!pasos.length && !m.preparacion.tipo) delete m.preparacion;
  }

  m.cuidados = (m.cuidados || []).map((c) => sinVacios(c)).filter((c) => c.texto);
  if (!m.cuidados.length) delete m.cuidados;
  m.por_confirmar = (m.por_confirmar || []).map((t) => String(t).trim()).filter(Boolean);
  if (!m.por_confirmar.length) delete m.por_confirmar;
  if (!m.proteccion || !m.proteccion.length) delete m.proteccion;

  if (m.origen !== 'familia') { delete m.origen; delete m.ajuste; }

  if (m.estado === 'por_confirmar') {
    delete m.dosis;
    delete m.concentracion;
    (m.preparacion ? m.preparacion.pasos : []).forEach((p) => { delete p.medir; delete p.gotas; delete p.dar; });
  }
  return m;
}

const sinFuente = (o) => {
  if (!o || typeof o !== 'object') return o;
  const { fuente, ...resto } = o;
  return resto;
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Pone la fuente del cambio en cada dato que cambió y conserva la de los demás.
// Devuelve la lista de campos que cambiaron.
export function aplicarFuente(antes, despues, fuente) {
  const cambios = new Set();
  const a = antes || {};

  for (const k of ['nombre', 'grupo', 'estado', 'proteccion', 'por_confirmar', 'origen']) {
    if (!igual(a[k], despues[k])) cambios.add(k === 'origen' ? 'ajuste' : k);
  }
  for (const b of BLOQUES) {
    if (!despues[b]) { if (a[b]) cambios.add(b); continue; }
    if (a[b] && igual(sinFuente(a[b]), sinFuente(despues[b]))) {
      if (a[b].fuente) despues[b].fuente = a[b].fuente;
      else delete despues[b].fuente;
    } else {
      despues[b].fuente = fuente;
      cambios.add(b);
    }
  }
  const tomasA = (a.tomas || []).map(sinFuente);
  const tomasD = (despues.tomas || []).map(sinFuente);
  if (despues.tomas && igual(tomasA, tomasD)) {
    if (a.tomas_fuente) despues.tomas_fuente = a.tomas_fuente;
    despues.tomas = copia(a.tomas);
  } else if (despues.tomas) {
    despues.tomas = tomasD;
    despues.tomas_fuente = fuente;
    cambios.add('tomas');
  } else if (a.tomas) {
    cambios.add('tomas');
  }
  if (!despues.tomas) delete despues.tomas_fuente;

  // Pasos y cuidados: el que no cambió conserva su fuente, aunque cambie de lugar.
  const conservar = (listaA, listaD) => {
    const libres = (listaA || []).map((x) => ({ x, usado: false }));
    let cambio = (listaA || []).length !== (listaD || []).length;
    (listaD || []).forEach((item, i) => {
      const hallado = libres.find((l) => !l.usado && igual(sinFuente(l.x), sinFuente(item)));
      if (hallado) {
        hallado.usado = true;
        if (hallado.x.fuente) item.fuente = hallado.x.fuente;
        if ((listaA || [])[i] !== hallado.x) cambio = true;
      } else {
        item.fuente = fuente;
        cambio = true;
      }
    });
    return cambio;
  };
  const pasosA = a.preparacion ? a.preparacion.pasos : [];
  const pasosD = despues.preparacion ? despues.preparacion.pasos : [];
  if (conservar(pasosA, pasosD) || !igual(a.preparacion && a.preparacion.tipo, despues.preparacion && despues.preparacion.tipo)) {
    cambios.add('preparacion');
  }
  if (conservar(a.cuidados, despues.cuidados)) cambios.add('cuidados');

  return [...cambios];
}

// Guarda un medicamento editado (medId) o nuevo (medId null) en una copia de los datos.
// Devuelve { error } o { datos, med, resultado, cambios }. Si resultado.errores
// no está vacío, la app no debe guardar.
export function guardarMed(d, medId, borrador, { fuente, cuidador = '', fecha = fechaISO(new Date()) } = {}) {
  const f = String(fuente || '').trim();
  if (f.length < 3) return { error: 'Escriba de dónde sale este cambio (por ejemplo: "Hoja del equipo, 20 nov").' };
  const antes = medId ? d.medicamentos.find((m) => m.id === medId) : null;
  if (medId && !antes) return { error: 'No se encontró el medicamento.' };

  const nuevo = limpiar(borrador);
  delete nuevo.editado;
  if (antes) {
    nuevo.id = antes.id;
  } else {
    nuevo.id = nuevoId(nuevo.nombre, new Set(d.medicamentos.map((m) => m.id)));
  }
  const cambios = aplicarFuente(antes ? sinEditado(antes) : null, nuevo, f);
  if (antes && !cambios.length) return { error: 'No hay cambios para guardar.' };

  nuevo.editado = {
    tipo: antes ? 'editado' : 'agregado',
    fecha,
    fuente: f,
    cuidador,
    cambios,
    ...(antes ? { antes: copia(antes) } : {}),
  };
  const orden = ['id', 'nombre', 'grupo', 'estado', 'origen', 'ajuste', 'presentacion', 'tomas', 'tomas_fuente', 'dosis',
    'concentracion', 'medida', 'proteccion', 'comida', 'preparacion', 'cuidados', 'dia_examen', 'por_confirmar', 'editado'];
  const med = {};
  for (const k of orden) if (nuevo[k] !== undefined) med[k] = nuevo[k];
  for (const k of Object.keys(nuevo)) if (med[k] === undefined) med[k] = nuevo[k];

  const datos = copia(d);
  if (antes) datos.medicamentos = datos.medicamentos.map((m) => (m.id === antes.id ? med : m));
  else datos.medicamentos.push(med);
  return { datos, med, resultado: validar(datos), cambios };
}

function sinEditado(m) {
  const { editado, ...resto } = m;
  return resto;
}

// Vuelve al valor anterior del último cambio hecho en el teléfono.
// Un medicamento agregado en el teléfono se quita.
export function deshacer(d, medId) {
  const m = d.medicamentos.find((x) => x.id === medId);
  if (!m || !m.editado) return null;
  const datos = copia(d);
  if (m.editado.tipo === 'agregado') datos.medicamentos = datos.medicamentos.filter((x) => x.id !== medId);
  else datos.medicamentos = datos.medicamentos.map((x) => (x.id === medId ? copia(m.editado.antes) : x));
  return { datos, resultado: validar(datos) };
}

// Fecha del último cambio hecho en el teléfono, o null.
export function ultimoCambio(d) {
  const fechas = (d.medicamentos || []).map((m) => m.editado && m.editado.fecha).filter(Boolean).sort();
  return fechas.length ? fechas[fechas.length - 1] : null;
}

// El archivo descargado se puede volver a cargar: es un archivo de datos normal,
// con los cambios del teléfono, los minutos para preparar y el registro de dados.
export function copiaParaDescargar(d, rutinaTel, registro, ahora = new Date()) {
  const salida = { ...d };
  const porHora = Object.fromEntries(Object.entries((rutinaTel && rutinaTel.por_hora) || {})
    .filter(([h, v]) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h) && Number.isInteger(v) && v >= 0 && v <= 120));
  if (Object.keys(porHora).length) {
    salida.rutina = { fuente: (d.rutina && d.rutina.fuente) || 'Rutina de este teléfono', preparar_min: porHora };
  }
  salida.registro_dados = registro || [];
  salida.copia_hecha = ahora.toISOString();
  return salida;
}

// Pone un valor en el borrador siguiendo una ruta "preparacion.pasos.2.texto".
export function fijarRuta(obj, ruta, valor) {
  const partes = ruta.split('.');
  let o = obj;
  partes.slice(0, -1).forEach((p, i) => {
    const sig = partes[i + 1];
    if (o[p] === undefined || o[p] === null) o[p] = /^\d+$/.test(sig) ? [] : {};
    o = o[p];
  });
  const ult = partes[partes.length - 1];
  if (valor === undefined) delete o[ult];
  else o[ult] = valor;
}

export function leerRuta(obj, ruta) {
  return ruta.split('.').reduce((o, p) => (o === undefined || o === null ? undefined : o[p]), obj);
}
