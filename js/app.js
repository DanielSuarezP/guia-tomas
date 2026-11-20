// Guía de tomas: pantallas y navegación.
// 0.2: guía de hora pico y ajustes de la familia. 0.3: editar y añadir medicamentos en el teléfono,
// minutos para preparar por hora y descarga de los datos, jeringa de cada paso y aviso de rayas.
import {
  validar, tomasDelDia, materiales, alarmas, resumen, minutos, horaBonita, numero,
  fechaISO, fechaBonita, diasTexto, GRUPOS, COMIDA, PROTECCION, PREPARACIONES, DIAS_NOMBRE, diaSemana,
  ESTADOS, PRESENTACIONES, JERINGAS, DIAS, DIAS_CORTO, jeringaDelPaso,
} from './datos.js';
import { almacen } from './almacen.js';
import { icono, iconoPresentacion, iconoPaso, jeringa, gotaContador } from './dibujos.js';
import { hayVoz, leer, callar } from './voz.js';
import {
  guardarMed, deshacer, medVacio, ultimoCambio, fijarRuta, leerRuta, leerNumero, NOMBRES_CAMBIO, copiaParaDescargar,
} from './edicion.js';

export const VERSION_APP = '0.3.1';

const raiz = document.getElementById('app');

const estado = {
  fecha: hoy(),
  carga: null,          // { datos, resultado } recién leído, sin guardar
  filtros: { estado: 'todos', grupo: 'todos', guantes: false },
  gotas: {},            // clave de paso -> gotas contadas
  reloj: null,          // temporizador de espera
  voz: '',              // texto del botón Escuchar
  borrar: null,         // id de paciente esperando el segundo toque
  mensaje: null,        // { tipo, texto }
  borrador: null,       // { medId, m, fuente, error, errores } mientras se edita o se añade
  deshacer: null,       // id de medicamento esperando el segundo toque para deshacer
};

function hoy() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Direcciones internas: solo letras, números y guiones (#hora-1000, #paso-id-1000-2).
const rHora = (h) => `#hora-${h.replace(':', '')}`;
const rPaso = (id, h, n) => `#paso-${id}-${h ? h.replace(':', '') : 'x'}-${n}`;
const rMed = (id) => `#med-${id}`;
const rEspera = (h) => `#espera-${h.replace(':', '')}`;
const horaDeRuta = (t) => `${t.slice(0, 2)}:${t.slice(2, 4)}`;

function datosActivos() {
  return almacen.datos(almacen.activo());
}

// Regla de espera entre medicamentos de la misma hora (viene de los datos).
function esperaRegla(d) {
  return (d.reglas_generales || []).find((r) => r.esperar_min) || null;
}

// Estado de una hora: vigentes, cuáles faltan y cuándo se marcó el último.
function estadoHora(d, iso, hora) {
  const h = tomasDelDia(d, estado.fecha).find((x) => x.hora === hora);
  if (!h) return null;
  const pid = d.paciente.id;
  const vig = h.meds.filter((m) => m.estado === 'vigente');
  const regs = vig.map((m) => almacen.dado(pid, m.id, iso, hora));
  const pendientes = vig.filter((m, i) => !regs[i]);
  const ultimo = regs.filter(Boolean).map((r) => new Date(r.marcado)).sort((a, b) => b - a)[0] || null;
  return { h, vig, regs, pendientes, dados: vig.length - pendientes.length, ultimo };
}

function insigniaAjuste(m) {
  return (m.origen === 'familia' ? '<span class="insignia azul">Ajuste de la familia</span> ' : '') + insigniaEditado(m);
}

function insigniaEditado(m, chica = false) {
  if (!m.editado) return '';
  const txt = m.editado.tipo === 'agregado' ? 'Agregado en este teléfono' : 'Editado en este teléfono';
  return `<span class="insignia ambar${chica ? ' chica' : ''}">${chica ? (m.editado.tipo === 'agregado' ? 'Agregado' : 'Editado') : txt}</span>`;
}

// Qué cambió, cuándo, quién y con qué fuente.
function notaEditado(m, detalle = false) {
  const e = m.editado;
  if (!e) return '';
  const que = (e.cambios || []).map((c) => NOMBRES_CAMBIO[c] || c).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  const titulo = e.tipo === 'agregado' ? 'Agregado en este teléfono' : 'Cambiado en este teléfono';
  return `<div class="nota ambar">${icono('aviso')}<div><strong>${titulo}</strong>
    <p>${esc(fechaBonita(e.fecha))}${e.cuidador ? ' · ' + esc(e.cuidador) : ''}${que && e.tipo !== 'agregado' ? ' · ' + esc(que) : ''}</p>
    <p class="fuente">Fuente: ${esc(e.fuente)}</p>
    ${detalle && e.antes ? valoresAnteriores(e) : ''}</div></div>`;
}

function valoresAnteriores(e) {
  const a = e.antes;
  const filas = [];
  const c = new Set(e.cambios || []);
  if (c.has('nombre')) filas.push(['Nombre', a.nombre]);
  if (c.has('estado')) filas.push(['Estado', ESTADOS[a.estado] || a.estado]);
  if (c.has('presentacion')) filas.push(['Presentación', a.presentacion && a.presentacion.texto]);
  if (c.has('tomas')) filas.push(['Horas', (a.tomas || []).map((t) => `${horaBonita(t.hora)} (${diasTexto(t.dias)})`).join(', ')]);
  if (c.has('dosis')) filas.push(['Dosis', a.dosis ? a.dosis.texto : 'Por confirmar']);
  if (c.has('concentracion')) filas.push(['Concentración', a.concentracion ? `${numero(a.concentracion.valor)} ${a.concentracion.unidad} en ${a.concentracion.gotas ? numero(a.concentracion.gotas) + ' gota(s)' : numero(a.concentracion.ml) + ' cc'}` : 'Sin dato']);
  if (c.has('medida')) filas.push(['Se mide con', a.medida ? `${a.medida.instrumento}${a.medida.capacidad ? ' de ' + numero(a.medida.capacidad) : ''}` : 'Sin dato']);
  if (c.has('comida')) filas.push(['Comida', a.comida ? `${COMIDA[a.comida.regla] || ''}${a.comida.texto ? ': ' + a.comida.texto : ''}` : 'Sin dato']);
  if (c.has('preparacion')) filas.push(['Pasos', ((a.preparacion && a.preparacion.pasos) || []).map((p, i) => `${i + 1}. ${p.texto}`).join(' ')]);
  if (!filas.length) return '';
  return `<p class="etiqueta">Antes del cambio</p><ul class="antes">${filas.map(([t, v]) => `<li><b>${esc(t)}:</b> ${esc(v || '')}</li>`).join('')}</ul>`;
}

function notaAjuste(m) {
  if (m.origen !== 'familia') return '';
  return `<div class="nota azul">${icono('persona')}<div><strong>Ajuste de la familia</strong><p>${esc((m.ajuste && m.ajuste.texto) || 'Se da distinto de la fórmula.')}</p>${m.ajuste && m.ajuste.fuente ? `<p class="fuente">${esc(m.ajuste.fuente)}</p>` : ''}</div></div>`;
}

function barraHora(eh) {
  return `<div class="barra-pasos" aria-hidden="true">${eh.vig.map((m, i) => `<span class="${eh.regs[i] ? 'hecho' : ''}"></span>`).join('')}</div>`;
}

function ahoraMin() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function relativo(hora, esHoy) {
  if (!esHoy) return '';
  const dif = minutos(hora) - ahoraMin();
  const abs = Math.abs(dif);
  const txt = abs >= 60 ? `${Math.floor(abs / 60)} h ${abs % 60 ? (abs % 60) + ' min' : ''}`.trim() : `${abs} min`;
  if (dif > 0) return `en ${txt}`;
  if (dif > -5) return 'ahora';
  return `hace ${txt}`;
}

function diaBonito(fecha) {
  const iso = fechaISO(fecha);
  const nombre = DIAS_NOMBRE[diaSemana(fecha)];
  const base = fechaBonita(iso).replace(/ \d{4}$/, '');
  const h = fechaISO(hoy());
  const manana = new Date(hoy()); manana.setDate(manana.getDate() + 1);
  const ayer = new Date(hoy()); ayer.setDate(ayer.getDate() - 1);
  if (iso === h) return `Hoy, ${nombre} ${base}`;
  if (iso === fechaISO(manana)) return `Mañana, ${nombre} ${base}`;
  if (iso === fechaISO(ayer)) return `Ayer, ${nombre} ${base}`;
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${base}`;
}

// ---------- Piezas ----------

function chip(nombreIcono, texto, tipo = '') {
  return `<span class="chip ${tipo}">${icono(nombreIcono)}<span>${esc(texto)}</span></span>`;
}

function iconoComida(regla) {
  return { con_comida: 'comida', sin_comida: 'sin_comida', antes_de_comer: 'antes_de_comer', indiferente: 'comida', por_confirmar: 'pregunta' }[regla] || 'comida';
}

function chipComida(m) {
  if (!m.comida) return '';
  const tipo = m.comida.regla === 'sin_comida' || m.comida.regla === 'antes_de_comer' ? 'rojo' : m.comida.regla === 'por_confirmar' ? 'ambar' : 'neutro';
  return chip(iconoComida(m.comida.regla), COMIDA[m.comida.regla] || 'Comida', tipo);
}

function chipsProteccion(lista) {
  return (lista || []).map((p) => chip(p, PROTECCION[p] || p, 'ambar')).join('');
}

function chipMedida(m) {
  if (!m.medida) return '';
  if (m.medida.instrumento === 'jeringa') {
    return m.medida.capacidad ? chip('jeringa', `Jeringa de ${numero(m.medida.capacidad)}`, 'neutro') : chip('jeringa', 'Jeringa: por confirmar', 'ambar');
  }
  if (m.medida.instrumento === 'gotas') return chip('gotas', 'Gotas', 'neutro');
  if (m.medida.instrumento === 'cucharita') return chip('cucharita', 'Cucharita', 'neutro');
  if (m.medida.instrumento === 'capsula') return chip('capsula', 'Cápsula', 'neutro');
  return '';
}

function chipsMateriales(meds) {
  const mat = materiales(meds);
  return [
    ...mat.proteccion.map((p) => chip(p, PROTECCION[p] || p, 'ambar')),
    ...mat.jeringas.map((j) => chip('jeringa', `Jeringa de ${numero(j)}`, 'neutro')),
    mat.gotas ? chip('gotas', 'Gotas', 'neutro') : '',
    mat.cucharita ? chip('cucharita', 'Cucharita', 'neutro') : '',
  ].join('');
}

function dosisCorta(m) {
  if (m.estado !== 'vigente' || !m.dosis) return '<span class="insignia ambar">Por confirmar</span>';
  const d = m.dosis;
  if (d.cantidad !== undefined && d.medida) return `<span class="dosis">${numero(d.cantidad)} ${esc(d.medida)}</span>`;
  return `<span class="dosis">${esc(d.texto)}</span>`;
}

function filaMed(m, pid, iso, hora) {
  const reg = m.estado === 'vigente' ? almacen.dado(pid, m.id, iso, hora) : null;
  const ico = m.estado === 'vigente' ? iconoPresentacion(m.presentacion && m.presentacion.tipo) : 'pregunta';
  return `<li class="fila-med${reg ? ' hecho' : ''}${m.estado !== 'vigente' ? ' confirmar' : ''}">
    ${icono(ico, 'ico-med')}
    <span class="nombre">${esc(m.nombre)}${m.origen === 'familia' ? ' <span class="insignia azul chica">Familia</span>' : ''}${m.editado ? ' ' + insigniaEditado(m, true) : ''}</span>
    ${dosisCorta(m)}
    ${reg ? `<span class="marca-dado" aria-label="Dado">${icono('dado')}</span>` : ''}
  </li>`;
}

function avisoExamen(d, meds, iso) {
  if (!almacen.esDiaExamen(d.paciente.id, iso)) return '';
  const con = meds.filter((m) => m.dia_examen);
  if (!con.length) return '';
  return con.map((m) => `<div class="nota ambar">${icono('examen')}<div><strong>Día del examen · ${esc(m.nombre)}</strong><p>${esc(m.dia_examen.texto)}</p><p class="fuente">${esc(m.dia_examen.fuente)}</p></div></div>`).join('');
}

// ---------- Pantallas ----------

function bienvenida() {
  return `<section class="tarjeta centro">
    <div class="ico-grande">${icono('lista')}</div>
    <h1>Guía de tomas</h1>
    <p>Para empezar, cargue el archivo con los medicamentos del paciente.</p>
    <label class="boton principal">${icono('subir')}<span>Cargar archivo</span>
      <input type="file" accept=".json,application/json" data-campo="archivo" hidden></label>
    <button class="boton" data-accion="ejemplo">${icono('lista')}<span>Probar con datos de ejemplo</span></button>
  </section>
  ${tarjetaCuidador()}`;
}

function pantallaAhora() {
  const d = datosActivos();
  if (!d) return bienvenida();
  const pid = d.paciente.id;
  const iso = fechaISO(estado.fecha);
  const esHoy = iso === fechaISO(hoy());
  const horas = tomasDelDia(d, estado.fecha).map((h) => {
    const vig = h.meds.filter((m) => m.estado === 'vigente');
    const dados = vig.filter((m) => almacen.dado(pid, m.id, iso, h.hora)).length;
    return { ...h, vig, dados, completa: dados === vig.length };
  });
  const ahora = ahoraMin();
  let proxima = null;
  let atrasadas = [];
  if (esHoy) {
    proxima = horas.find((h) => !h.completa && minutos(h.hora) >= ahora - 90) || null;
    atrasadas = horas.filter((h) => !h.completa && minutos(h.hora) < ahora - 90);
  } else {
    proxima = horas.find((h) => !h.completa) || null;
  }
  const hayExamen = d.medicamentos.some((m) => m.dia_examen);
  const examenHoy = almacen.esDiaExamen(pid, iso);

  let principal = '';
  if (proxima) {
    principal = tarjetaHora(d, proxima, iso, esHoy, true);
  } else if (horas.length) {
    principal = `<section class="tarjeta centro listo">${icono('dado', 'ico-grande verde')}<h2>Listo por ${esHoy ? 'hoy' : 'este día'}</h2><p>Todas las tomas están marcadas.</p></section>`;
  }

  return `
  <div class="dia">
    <button class="boton-icono" data-accion="dia-anterior" aria-label="Día anterior">${icono('atras')}</button>
    <button class="dia-nombre" data-accion="dia-hoy">${esc(diaBonito(estado.fecha))}</button>
    <button class="boton-icono" data-accion="dia-siguiente" aria-label="Día siguiente">${icono('siguiente')}</button>
  </div>
  ${hayExamen ? `<button class="interruptor${examenHoy ? ' activo' : ''}" data-accion="examen" aria-pressed="${examenHoy}">${icono('examen')}<span>Día del examen de sangre</span><b>${examenHoy ? 'Sí' : 'No'}</b></button>` : ''}
  ${atrasadas.length ? `<div class="nota rojo">${icono('aviso')}<div><strong>Sin marcar</strong><p>${atrasadas.map((h) => `<a href="${rHora(h.hora)}">${horaBonita(h.hora)} (${h.vig.length - h.dados})</a>`).join(' · ')}</p></div></div>` : ''}
  ${principal}
  <h2 class="titulo-seccion">Agenda del día</h2>
  <ul class="agenda">
    ${horas.map((h) => `<li><a class="fila-hora${h.completa ? ' hecho' : ''}${proxima && proxima.hora === h.hora ? ' siguiente' : ''}" href="${rHora(h.hora)}">
      <span class="hora">${horaBonita(h.hora)}</span>
      <span class="mini-iconos">${h.meds.slice(0, 6).map((m) => icono(m.estado === 'vigente' ? iconoPresentacion(m.presentacion && m.presentacion.tipo) : 'pregunta')).join('')}</span>
      <span class="progreso">${h.completa ? icono('dado') : `${h.dados} de ${h.vig.length}`}</span>
    </a></li>`).join('')}
  </ul>`;
}

function tarjetaHora(d, h, iso, esHoy, conBoton) {
  const pid = d.paciente.id;
  const pendiente = h.vig.find((m) => !almacen.dado(pid, m.id, iso, h.hora));
  return `<section class="tarjeta hora-tarjeta">
    <div class="hora-cabeza">
      <div class="circulo">${icono('alarma')}</div>
      <div><p class="hora-grande">${horaBonita(h.hora)}</p>
      <p class="sub">${[relativo(h.hora, esHoy), `${h.meds.length} medicamento${h.meds.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</p></div>
    </div>
    <div class="chips">${chipsMateriales(h.meds)}</div>
    ${avisoExamen(d, h.meds, iso)}
    <ul class="meds">${h.meds.map((m) => filaMed(m, pid, iso, h.hora)).join('')}</ul>
    ${conBoton ? `<div class="botones">
      <a class="boton" href="${rHora(h.hora)}">${icono('lista')}<span>Ver todo</span></a>
      ${pendiente ? `<a class="boton principal" href="${rPaso(pendiente.id, h.hora, 0)}">${icono('siguiente')}<span>${h.dados ? 'Seguir' : 'Empezar'}</span></a>` : ''}
    </div>` : ''}
  </section>`;
}

function pantallaHora(hora) {
  const d = datosActivos();
  if (!d) return bienvenida();
  const pid = d.paciente.id;
  const iso = fechaISO(estado.fecha);
  const esHoy = iso === fechaISO(hoy());
  const h = tomasDelDia(d, estado.fecha).find((x) => x.hora === hora);
  if (!h) return `<p class="vacio">No hay medicamentos a las ${esc(horaBonita(hora))} este día.</p>`;
  const vig = h.meds.filter((m) => m.estado === 'vigente');
  const espera = esperaRegla(d);
  const eh = estadoHora(d, iso, hora);
  const sig = eh.pendientes[0];
  let notaEspera = '';
  if (esHoy && espera && eh.ultimo && sig) {
    const hasta = new Date(eh.ultimo.getTime() + espera.esperar_min * 60000);
    const falta = Math.ceil((hasta - new Date()) / 60000);
    if (falta > 0) notaEspera = `<div class="nota ambar">${icono('esperar')}<div><strong>Siguiente desde las ${esc(horaBonita(hasta.toTimeString().slice(0, 5)))}</strong><p>Faltan ${falta} min de espera.</p></div></div>`;
  }
  const guia = vig.length ? `<p class="progreso-hora"><strong>${eh.dados} de ${eh.vig.length}</strong> dados</p>${barraHora(eh)}
    ${notaEspera}
    ${sig ? `<div class="botones"><a class="boton principal" href="${rPaso(sig.id, hora, 0)}">${icono('siguiente')}<span>${eh.dados ? 'Seguir con' : 'Empezar con'} ${esc(sig.nombre)}</span></a></div>` : `<p class="dado-texto">${icono('dado')}<span>Todos dados</span></p>`}` : '';
  return `
  <a class="volver" href="#ahora">${icono('atras')}<span>Ahora</span></a>
  <section class="tarjeta hora-tarjeta">
    <div class="hora-cabeza"><div class="circulo">${icono('alarma')}</div>
      <div><p class="hora-grande">${horaBonita(h.hora)}</p><p class="sub">${esc(diaBonito(estado.fecha))}${esHoy ? ' · ' + relativo(h.hora, true) : ''}</p></div></div>
    <p class="etiqueta">Alistar</p>
    <div class="chips">${chipsMateriales(h.meds)}</div>
    ${vig.length > 1 && espera ? `<div class="nota neutro">${icono('esperar')}<div><p>${esc(espera.texto)}</p><p class="fuente">${esc(espera.fuente)}</p></div></div>` : ''}
    ${avisoExamen(d, h.meds, iso)}
    ${guia}
  </section>
  ${h.meds.map((m) => tarjetaMed(m, pid, iso, h.hora)).join('')}`;
}

function tarjetaMed(m, pid, iso, hora) {
  if (m.estado !== 'vigente') {
    return `<section class="tarjeta med confirmar">
      <div class="med-cabeza">${icono('pregunta', 'ico-med grande ambar-ico')}<div><h3>${esc(m.nombre)}</h3><span class="insignia ambar">Por confirmar</span></div></div>
      <p>No se prepara hasta que el equipo confirme:</p>
      <ul class="pendientes">${(m.por_confirmar || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </section>`;
  }
  const reg = almacen.dado(pid, m.id, iso, hora);
  const horaDado = reg ? new Date(reg.marcado).toTimeString().slice(0, 5) : '';
  return `<section class="tarjeta med${reg ? ' hecho' : ''}">
    <div class="med-cabeza">${icono(iconoPresentacion(m.presentacion && m.presentacion.tipo), 'ico-med grande')}
      <div><h3>${esc(m.nombre)}</h3>${insigniaAjuste(m)}<p class="dosis-grande">${m.dosis.cantidad !== undefined ? `${numero(m.dosis.cantidad)} ${esc(m.dosis.medida || '')}` : esc(m.dosis.texto)}</p>
      <p class="sub">${esc(m.dosis.texto)}</p></div></div>
    <div class="chips">${chipsProteccion(m.proteccion)}${chipComida(m)}${chipMedida(m)}</div>
    ${reg ? `<p class="dado-texto">${icono('dado')}<span>Dado a las ${esc(horaBonita(horaDado))}${reg.cuidador ? ' · ' + esc(reg.cuidador) : ''}</span></p>` : ''}
    <div class="botones">
      <a class="boton" href="${rPaso(m.id, hora, 0)}">${icono('lista')}<span>Ver pasos</span></a>
      ${reg
        ? `<button class="boton" data-accion="dado" data-med="${m.id}" data-hora="${hora}">${icono('atras')}<span>Quitar marca</span></button>`
        : `<button class="boton verde" data-accion="dado" data-med="${m.id}" data-hora="${hora}">${icono('dado')}<span>Dado</span></button>`}
    </div>
  </section>`;
}

function pasosDe(m) {
  return [{ inicial: true }, ...((m.preparacion && m.preparacion.pasos) || [])];
}

function pantallaPaso(medId, hora, n) {
  const d = datosActivos();
  if (!d) return bienvenida();
  const m = d.medicamentos.find((x) => x.id === medId);
  if (!m) return '<p class="vacio">No se encontró el medicamento.</p>';
  const volver = hora ? rHora(hora) : rMed(m.id);
  if (m.estado !== 'vigente') {
    estado.voz = `${m.nombre}. Por confirmar con el equipo. No se prepara todavía.`;
    return `<a class="volver" href="${volver}">${icono('atras')}<span>Volver</span></a>
      <section class="tarjeta centro confirmar">${icono('pregunta', 'ico-grande ambar-ico')}<h2>${esc(m.nombre)}</h2>
      <p><strong>Por confirmar con el equipo.</strong> No se prepara todavía.</p>
      <ul class="pendientes izquierda">${(m.por_confirmar || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>`;
  }
  const pasos = pasosDe(m);
  const i = Math.max(0, Math.min(pasos.length - 1, n));
  const p = pasos[i];
  const ultimo = i === pasos.length - 1;
  const iso = fechaISO(estado.fecha);
  const pid = d.paciente.id;
  const reg = hora ? almacen.dado(pid, m.id, iso, hora) : null;

  let cuerpo = '';
  if (p.inicial) {
    cuerpo = pasoInicial(d, m, iso);
  } else {
    cuerpo = pasoNormal(m, p, `${m.id}:${i}`);
  }

  const atras = i > 0 ? rPaso(m.id, hora, i - 1) : volver;
  const eh = hora ? estadoHora(d, iso, hora) : null;
  const pos = eh ? eh.vig.findIndex((x) => x.id === m.id) + 1 : 0;
  const orden = eh && eh.vig.length > 1 && pos ? `<p class="orden-hora">${esc(horaBonita(hora))} · medicamento ${pos} de ${eh.vig.length}</p>` : '';
  const siguiente = rPaso(m.id, hora, i + 1);
  return `${orden}
  <div class="paso-cabeza">
    <a class="volver" href="${volver}">${icono('atras')}<span>${esc(m.nombre)}</span></a>
    <span class="contador-pasos">Paso ${i + 1} de ${pasos.length}</span>
  </div>
  <div class="barra-pasos" aria-hidden="true">${pasos.map((_, j) => `<span class="${j <= i ? 'hecho' : ''}"></span>`).join('')}</div>
  <section class="tarjeta paso">${cuerpo}</section>
  <div class="botones-paso">
    <a class="boton" href="${atras}" aria-label="Atrás">${icono('atras')}<span>Atrás</span></a>
    <button class="boton" data-accion="escuchar" ${hayVoz() ? '' : 'disabled title="Este teléfono no tiene voz"'}>${icono('altavoz')}<span>Escuchar</span></button>
    ${ultimo
      ? (hora && !reg
        ? `<button class="boton verde" data-accion="dado-y-volver" data-med="${m.id}" data-hora="${hora}">${icono('dado')}<span>Dado</span></button>`
        : `<a class="boton principal" href="${volver}">${icono('dado')}<span>${reg ? 'Ya dado' : 'Terminar'}</span></a>`)
      : `<a class="boton principal" href="${siguiente}">${icono('siguiente')}<span>Listo</span></a>`}
  </div>`;
}

function pasoInicial(d, m, iso) {
  const fichas = [];
  const manos = (d.reglas_generales || []).find((r) => (r.iconos || []).includes('manos'));
  if (manos) fichas.push(['manos', 'Manos limpias']);
  (m.proteccion || []).forEach((p) => fichas.push([p, PROTECCION[p]]));
  if (m.medida && m.medida.instrumento === 'jeringa') {
    fichas.push(['jeringa', m.medida.capacidad ? `Jeringa de ${numero(m.medida.capacidad)}` : 'Jeringa: por confirmar']);
  }
  const vistos = new Set();
  for (const p of (m.preparacion && m.preparacion.pasos) || []) {
    if (p.medir && p.medir.jeringa && !(m.medida && m.medida.capacidad === p.medir.jeringa) && !vistos.has('j' + p.medir.jeringa)) {
      vistos.add('j' + p.medir.jeringa);
      fichas.push(['jeringa', `Jeringa de ${numero(p.medir.jeringa)}`]);
    }
    for (const [ic, txt] of [['copita', 'Copita'], ['triturar', 'Bolsa'], ['cucharita', 'Cucharita'], ['agua', 'Agua']]) {
      if (p.icono === ic && !vistos.has(ic)) { vistos.add(ic); fichas.push([ic, txt]); }
    }
  }
  if (m.comida) fichas.push([iconoComida(m.comida.regla), COMIDA[m.comida.regla]]);
  estado.voz = `${m.nombre}. Antes de empezar, aliste: ${fichas.map((f) => f[1]).join(', ')}.` +
    (m.comida && m.comida.texto ? ` ${m.comida.texto}` : '');
  return `<h2>Antes de empezar</h2>
    ${notaAjuste(m)}
    ${notaEditado(m)}
    <div class="fichas">${fichas.map(([ic, txt]) => `<div class="ficha ${ic === 'guantes' || ic === 'tapabocas' ? 'ambar' : ''}${ic === 'sin_comida' || ic === 'antes_de_comer' ? ' rojo' : ''}">${icono(ic)}<span>${esc(txt)}</span></div>`).join('')}</div>
    ${m.comida && m.comida.texto ? `<p class="texto-paso chico">${esc(m.comida.texto)}</p><p class="fuente">${esc(m.comida.fuente || '')}</p>` : ''}
    ${almacen.esDiaExamen(d.paciente.id, iso) && m.dia_examen ? `<div class="nota ambar">${icono('examen')}<div><strong>Hoy es día del examen</strong><p>${esc(m.dia_examen.texto)}</p></div></div>` : ''}
    ${manos ? `<p class="fuente">${esc(manos.texto)} (${esc(manos.fuente)})</p>` : ''}`;
}

function pasoNormal(m, p, clave) {
  let ilustracion = '';
  let vozExtra = '';
  if (p.medir) {
    const cap = jeringaDelPaso(m, p);
    const verificado = p.medir.jeringa && !p.dar ? !!p.medir.dibujo_verificado : !!(m.medida && m.medida.dibujo_verificado);
    ilustracion = `<p class="cantidad-grande">${numero(p.medir.cantidad)} cc</p>
      ${cap ? jeringa({ capacidad: cap, cantidad: p.medir.cantidad }) : `<div class="ico-paso">${icono('jeringa')}</div><p class="nota-chica">Jeringa: por confirmar</p>`}
      ${cap ? `<p class="nota-chica">Jeringa de ${numero(cap)}${verificado ? '' : ' · dibujo aproximado: compárelo con su jeringa'}</p>` : ''}`;
    vozExtra = ` Llene la jeringa hasta ${numero(p.medir.cantidad)} centímetros cúbicos.`;
  } else if (p.gotas) {
    const cuenta = estado.gotas[clave] || 0;
    ilustracion = `<p class="cantidad-grande" aria-live="polite"><span data-cuenta>${cuenta}</span> de ${p.gotas} gotas</p>
      <div class="gotas" data-clave="${esc(clave)}" data-total="${p.gotas}">${Array.from({ length: p.gotas }, (_, k) => gotaContador(k < cuenta, k)).join('')}</div>
      <button class="boton chico" data-accion="gotas-reiniciar" data-clave="${esc(clave)}">${icono('atras')}<span>Empezar de nuevo</span></button>`;
    vozExtra = ` Cuente ${p.gotas} gotas. Toque una gota en la pantalla por cada gota que caiga.`;
  } else if (p.esperar_min) {
    const r = estado.reloj && estado.reloj.clave === clave ? estado.reloj : null;
    const restante = r ? r.restante : p.esperar_min * 60;
    ilustracion = `<div class="reloj${r && r.corriendo ? ' corriendo' : ''}${restante === 0 ? ' terminado' : ''}">
        ${icono(restante === 0 ? 'dado' : 'esperar')}<span data-reloj>${mmss(restante)}</span></div>
      <button class="boton" data-accion="reloj" data-clave="${esc(clave)}" data-segundos="${p.esperar_min * 60}">${icono(r && r.corriendo ? 'esperar' : 'siguiente')}<span>${r && r.corriendo ? 'Pausar' : restante === 0 ? 'Otra vez' : 'Empezar a contar'}</span></button>`;
    vozExtra = ` Espere ${numero(p.esperar_min)} minutos.`;
  } else {
    ilustracion = `<div class="ico-paso">${icono(iconoPaso(p, m))}</div>`;
  }
  estado.voz = p.texto + vozExtra;
  return `${ilustracion}
    <p class="texto-paso">${esc(p.texto)}</p>
    <p class="fuente">${esc(p.fuente)}</p>`;
}

// Entre un medicamento y otro de la misma hora: reloj de espera y el siguiente.
function pantallaEspera(hora) {
  const d = datosActivos();
  if (!d) return bienvenida();
  const iso = fechaISO(estado.fecha);
  const eh = estadoHora(d, iso, hora);
  if (!eh) return `<p class="vacio">No hay medicamentos a las ${esc(horaBonita(hora))} este día.</p>`;
  const volver = `<a class="volver" href="${rHora(hora)}">${icono('atras')}<span>${esc(horaBonita(hora))}</span></a>`;
  const progreso = `<p class="progreso-hora"><strong>${eh.dados} de ${eh.vig.length}</strong> dados a las ${esc(horaBonita(hora))}</p>${barraHora(eh)}`;
  const sig = eh.pendientes[0];
  if (!sig) {
    estado.voz = `Listo. Todos los medicamentos de las ${horaBonita(hora)} están dados.`;
    return `${volver}${progreso}
    <section class="tarjeta centro listo">${icono('dado', 'ico-grande verde')}<h2>Listo</h2>
      <p>Todos los de las ${esc(horaBonita(hora))} están dados.</p>
      <div class="botones"><a class="boton principal" href="#ahora">${icono('casa')}<span>Volver a Ahora</span></a></div></section>`;
  }
  const regla = esperaRegla(d);
  const r = estado.reloj && estado.reloj.clave.startsWith(`espera-${hora}`) ? estado.reloj : null;
  const total = regla ? regla.esperar_min * 60 : 0;
  const restante = r ? r.restante : total;
  const libre = !regla || restante === 0;
  const clave = r ? r.clave : `espera-${hora}`;
  const reloj = regla ? `<section class="tarjeta centro">
      <h2>${libre ? 'Ya puede seguir' : `Espere ${numero(regla.esperar_min)} minutos`}</h2>
      <div class="reloj${r && r.corriendo ? ' corriendo' : ''}${restante === 0 ? ' terminado' : ''}">
        ${icono(restante === 0 ? 'dado' : 'esperar')}<span data-reloj>${mmss(restante)}</span></div>
      ${restante > 0 ? `<button class="boton" data-accion="reloj" data-clave="${esc(clave)}" data-segundos="${total}">${icono(r && r.corriendo ? 'esperar' : 'siguiente')}<span>${r && r.corriendo ? 'Pausar' : 'Empezar a contar'}</span></button>` : ''}
      <p class="fuente">${esc(regla.texto)} (${esc(regla.fuente)})</p>
    </section>` : '';
  const dosis = sig.dosis.cantidad !== undefined ? `${numero(sig.dosis.cantidad)} ${esc(sig.dosis.medida || '')}` : esc(sig.dosis.texto);
  estado.voz = (libre ? 'Ya puede seguir.' : `Espere ${numero(regla.esperar_min)} minutos.`) + ` El siguiente es ${sig.nombre}, ${dosis}.`;
  return `${volver}${progreso}${reloj}
  <section class="tarjeta med siguiente-med">
    <p class="etiqueta">Siguiente</p>
    <div class="med-cabeza">${icono(iconoPresentacion(sig.presentacion && sig.presentacion.tipo), 'ico-med grande')}
      <div><h3>${esc(sig.nombre)}</h3>${insigniaAjuste(sig)}<p class="dosis-grande">${dosis}</p><p class="sub">${esc(sig.dosis.texto)}</p></div></div>
    <div class="chips">${chipsProteccion(sig.proteccion)}${chipComida(sig)}${chipMedida(sig)}</div>
    ${eh.pendientes.length > 1 ? `<p class="sub">Después: ${eh.pendientes.slice(1).map((m) => esc(m.nombre)).join(' · ')}</p>` : ''}
    <div class="botones columna">
      <a class="boton${libre ? ' principal' : ''}" href="${rPaso(sig.id, hora, 0)}">${icono('siguiente')}<span>${libre ? 'Empezar' : 'Empezar sin esperar'}</span></a>
      <button class="boton" data-accion="escuchar" ${hayVoz() ? '' : 'disabled title="Este teléfono no tiene voz"'}>${icono('altavoz')}<span>Escuchar</span></button>
    </div>
  </section>`;
}

function mmss(seg) {
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

function pantallaLista() {
  const d = datosActivos();
  if (!d) return bienvenida();
  const f = estado.filtros;
  const meds = d.medicamentos.filter((m) =>
    (f.estado === 'todos' || m.estado === f.estado) &&
    (f.grupo === 'todos' || m.grupo === f.grupo) &&
    (!f.guantes || (m.proteccion || []).includes('guantes')));
  const boton = (tipo, valor, texto) => `<button class="filtro${String(f[tipo]) === String(valor) ? ' activo' : ''}" data-accion="filtro" data-tipo="${tipo}" data-valor="${valor}">${esc(texto)}</button>`;
  const grupos = Object.keys(GRUPOS).filter((g) => d.medicamentos.some((m) => m.grupo === g));
  return `
  <h1>Medicamentos</h1>
  ${mensajeUnaVez()}
  <a class="boton" href="#nuevo">${icono('lista')}<span>Añadir medicamento</span></a>
  <div class="filtros">${boton('estado', 'todos', 'Todos')}${boton('estado', 'vigente', 'Vigentes')}${boton('estado', 'por_confirmar', 'Por confirmar')}</div>
  <div class="filtros">${boton('grupo', 'todos', 'Todos los grupos')}${grupos.map((g) => boton('grupo', g, GRUPOS[g])).join('')}</div>
  <div class="filtros">${boton('guantes', !f.guantes, f.guantes ? 'Con guantes ✓' : 'Con guantes')}</div>
  <p class="sub">${meds.length} de ${d.medicamentos.length}</p>
  <ul class="lista-meds">${meds.map((m) => `<li><a href="${rMed(m.id)}">
      ${icono(m.estado === 'vigente' ? iconoPresentacion(m.presentacion && m.presentacion.tipo) : 'pregunta', 'ico-med')}
      <span class="nombre">${esc(m.nombre)}<small>${esc(GRUPOS[m.grupo] || '')} · ${(m.tomas || []).map((t) => horaBonita(t.hora)).join(', ')}</small></span>
      ${dosisCorta(m)}</a></li>`).join('') || '<li class="vacio">Ningún medicamento con estos filtros.</li>'}</ul>
  ${(d.ya_no_se_dan || []).length ? `<h2 class="titulo-seccion">Ya no se dan · no preparar</h2>
  <ul class="lista-suspendidos">${d.ya_no_se_dan.map((s) => `<li>${icono('basura')}<div><strong>${esc(s.nombre)}</strong><p>${esc(s.nota || '')}</p><p class="fuente">${esc(s.fuente)}</p></div></li>`).join('')}</ul>` : ''}`;
}

function pantallaMed(id) {
  const d = datosActivos();
  if (!d) return bienvenida();
  const m = d.medicamentos.find((x) => x.id === id);
  if (!m) return '<p class="vacio">No se encontró el medicamento.</p>';
  const fila = (titulo, contenido, fuente) => contenido ? `<div class="dato"><p class="etiqueta">${titulo}</p><div>${contenido}</div>${fuente ? `<p class="fuente">${esc(fuente)}</p>` : ''}</div>` : '';
  const primeraHora = (m.tomas || [])[0];
  const pideDeshacer = estado.deshacer === m.id;
  return `
  <a class="volver" href="#lista">${icono('atras')}<span>Medicamentos</span></a>
  ${mensajeUnaVez()}
  <section class="tarjeta med${m.estado !== 'vigente' ? ' confirmar' : ''}">
    <div class="med-cabeza">${icono(m.estado === 'vigente' ? iconoPresentacion(m.presentacion && m.presentacion.tipo) : 'pregunta', 'ico-med grande')}
      <div><h2>${esc(m.nombre)}</h2><p class="sub">${esc(GRUPOS[m.grupo] || '')}</p>
      ${m.estado !== 'vigente' ? '<span class="insignia ambar">Por confirmar</span>' : ''}${insigniaAjuste(m)}</div></div>
    ${notaAjuste(m)}
    ${notaEditado(m, true)}
    ${fila('Presentación', esc(m.presentacion && m.presentacion.texto), m.presentacion && m.presentacion.fuente)}
    ${fila('Dosis', m.dosis ? `<strong>${esc(m.dosis.texto)}</strong>` : '<span class="insignia ambar">Por confirmar</span>', m.dosis && m.dosis.fuente)}
    ${fila('Horas', (m.tomas || []).map((t) => `${horaBonita(t.hora)} · ${esc(diasTexto(t.dias))}`).join('<br>'), m.tomas_fuente)}
    ${fila('Comida', m.comida ? `${chipComida(m)}${m.comida.texto ? `<p>${esc(m.comida.texto)}</p>` : ''}` : '', m.comida && m.comida.fuente)}
    ${fila('Protección', chipsProteccion(m.proteccion), '')}
    ${fila('Con qué se mide', chipMedida(m), m.medida && m.medida.fuente)}
    ${fila('Preparación', m.preparacion ? `<p>${esc(PREPARACIONES[m.preparacion.tipo] || '')}</p><ol class="pasos-lista">${(m.preparacion.pasos || []).map((p) => `<li>${esc(p.texto)} <span class="fuente">${esc(p.fuente)}</span></li>`).join('')}</ol>` : '', '')}
    ${fila('Cuidados', (m.cuidados || []).map((c) => `<p>${esc(c.texto)} <span class="fuente">${esc(c.fuente)}</span></p>`).join(''), '')}
    ${fila('Día del examen', m.dia_examen ? esc(m.dia_examen.texto) : '', m.dia_examen && m.dia_examen.fuente)}
    ${fila('Por confirmar con el equipo', (m.por_confirmar || []).length ? `<ul class="pendientes">${m.por_confirmar.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '', '')}
    ${m.estado === 'vigente' && primeraHora ? `<div class="botones"><a class="boton principal" href="${rPaso(m.id, null, 0)}">${icono('lista')}<span>Ver pasos con dibujos</span></a></div>` : ''}
    <div class="botones columna">
      <a class="boton" href="#editar-${m.id}">${icono('lista')}<span>Editar este medicamento</span></a>
      ${m.editado ? `<button class="boton${pideDeshacer ? ' rojo' : ''}" data-accion="deshacer-med" data-med="${m.id}">${icono('atras')}<span>${pideDeshacer
        ? (m.editado.tipo === 'agregado' ? '¿Quitarlo? Toque otra vez' : '¿Volver al anterior? Toque otra vez')
        : (m.editado.tipo === 'agregado' ? 'Quitar este medicamento agregado' : 'Deshacer el último cambio')}</span></button>` : ''}
    </div>
  </section>`;
}

function mensajeUnaVez() {
  if (!estado.mensaje) return '';
  const m = estado.mensaje;
  estado.mensaje = null;
  return `<div class="nota ${m.tipo}">${icono(m.tipo === 'verde' ? 'dado' : 'aviso')}<p>${esc(m.texto)}</p></div>`;
}

// ---------- Editar o añadir un medicamento ----------

const ICONOS_PASO = {
  '': 'Sin dibujo', abrir_capsula: 'Abrir cápsula', tableta: 'Tableta', triturar: 'Triturar en bolsa', jarabe: 'Frasco',
  gotas: 'Gotas', cucharita: 'Cucharita', copita: 'Copita', agua: 'Agua', mezclar: 'Mezclar', tragar: 'Dárselo',
  botar: 'Botar', esperar: 'Esperar', jeringa: 'Jeringa', manos: 'Manos', guantes: 'Guantes', tapabocas: 'Tapabocas',
};
const INSTRUMENTOS = { jeringa: 'Jeringa', cucharita: 'Cucharita', gotas: 'Gotero', capsula: 'Cápsula entera', otro: 'Otro' };
const ORDEN_DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

function nuevoBorrador(medId) {
  const d = datosActivos();
  if (medId) {
    const m = d.medicamentos.find((x) => x.id === medId);
    if (!m) return null;
    const { editado, ...resto } = JSON.parse(JSON.stringify(m));
    return { medId, m: resto, fuente: '', error: null, errores: null };
  }
  return { medId: null, m: medVacio(), fuente: '', error: null, errores: null };
}

function pantallaEditar() {
  const d = datosActivos();
  if (!d) return bienvenida();
  const b = estado.borrador;
  if (!b) return '<p class="vacio">No se encontró el medicamento.</p>';
  const m = b.m;
  const v = (ruta) => leerRuta(m, ruta);
  const opciones = (obj, actual) => Object.entries(obj).map(([k, t]) => `<option value="${esc(k)}"${String(actual ?? '') === k ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const texto = (etq, ruta, { area = false, ph = '', ayuda = '' } = {}) => `<label class="campo"><span>${etq}</span>${area
    ? `<textarea rows="2" data-b="${ruta}" placeholder="${esc(ph)}">${esc(v(ruta) ?? '')}</textarea>`
    : `<input type="text" data-b="${ruta}" value="${esc(v(ruta) ?? '')}" placeholder="${esc(ph)}">`}${ayuda ? `<small>${esc(ayuda)}</small>` : ''}</label>`;
  const num = (etq, ruta, ph = '') => `<label class="campo"><span>${etq}</span><input type="text" inputmode="decimal" data-b="${ruta}" data-t="num" value="${esc(numero(v(ruta)))}" placeholder="${esc(ph)}"></label>`;
  const sel = (etq, ruta, obj, { re = false, t = '' } = {}) => `<label class="campo"><span>${etq}</span><select data-b="${ruta}"${t ? ` data-t="${t}"` : ''}${re ? ' data-re="1"' : ''}>${opciones(obj, v(ruta))}</select></label>`;
  const jeringas = { '': 'Sin dato', ...Object.fromEntries(JERINGAS.map((j) => [String(j), `Jeringa de ${j}`])) };
  const confirmar = m.estado === 'por_confirmar';
  const pasos = (m.preparacion && m.preparacion.pasos) || [];
  const tomas = m.tomas || [];

  const errores = b.error || (b.errores && b.errores.length) ? `<section class="tarjeta nota-grande rojo" id="errores">
      <h2>${icono('aviso')} No se guardó</h2>
      ${b.error ? `<p>${esc(b.error)}</p>` : ''}
      ${b.errores && b.errores.length ? `<ul class="problemas">${b.errores.map((e) => `<li><b>${esc(e.donde)}:</b> ${esc(e.msg)}</li>`).join('')}</ul>` : ''}
    </section>` : '';

  return `
  <a class="volver" href="${b.medId ? rMed(b.medId) : '#lista'}">${icono('atras')}<span>Cancelar</span></a>
  <h1>${b.medId ? 'Editar' : 'Añadir medicamento'}</h1>
  <p class="sub">Escriba los datos tal como los indica el equipo tratante. La app no calcula nada: al guardar revisa que la dosis cuadre con la concentración, y cada dato que cambie queda con la fuente que usted escriba abajo.</p>
  ${errores}
  <section class="tarjeta formulario">
    ${texto('Nombre', 'nombre', { ph: 'Ej.: Fluconazol' })}
    ${sel('Grupo', 'grupo', GRUPOS)}
    ${sel('Estado', 'estado', ESTADOS, { re: true })}
    ${confirmar ? '<p class="nota-chica ambar-texto">Por confirmar: se guarda sin dosis ni cantidades, y no se prepara hasta que el equipo confirme.</p>' : ''}
  </section>

  <section class="tarjeta formulario">
    <h2>Presentación</h2>
    ${sel('Tipo', 'presentacion.tipo', PRESENTACIONES)}
    ${texto('Cómo viene', 'presentacion.texto', { ph: 'Ej.: Jarabe de 50 mg por 5 mL' })}
  </section>

  <section class="tarjeta formulario">
    <h2>Horas</h2>
    ${tomas.map((t, i) => {
      const dias = t.dias || DIAS;
      return `<div class="fila-toma">
        <label class="campo"><span>Hora ${i + 1}</span><input type="time" data-b="tomas.${i}.hora" value="${esc(t.hora || '')}"></label>
        <div class="dias" role="group" aria-label="Días">${ORDEN_DIAS.map((x) => `<button type="button" class="dia-boton${dias.includes(x) ? ' activo' : ''}" data-accion="toggle-dia" data-i="${i}" data-dia="${x}" aria-pressed="${dias.includes(x)}" aria-label="${DIAS_NOMBRE[x]}">${DIAS_CORTO[x]}</button>`).join('')}</div>
        ${t.dias && !t.dias.length ? '<p class="nota-chica rojo-texto">Marque al menos un día.</p>' : ''}
        ${tomas.length > 1 ? `<button type="button" class="boton chico" data-accion="hora-quitar" data-i="${i}">Quitar esta hora</button>` : ''}
      </div>`;
    }).join('')}
    <button type="button" class="boton chico" data-accion="hora-nueva">+ Añadir hora</button>
  </section>

  ${confirmar ? '' : `<section class="tarjeta formulario">
    <h2>Dosis</h2>
    ${texto('Cómo se lee la dosis', 'dosis.texto', { ph: 'Ej.: 15 mg (1,5 cc)' })}
    <div class="dos">${num('Cantidad que se da', 'dosis.cantidad', 'Ej.: 1,5')}${sel('Medida', 'dosis.medida', { cc: 'cc', gotas: 'gotas', '': 'Otra' })}</div>
    <div class="dos">${num('Dosis (número)', 'dosis.valor', 'Ej.: 15')}${texto('Unidad', 'dosis.unidad', { ph: 'mg, mcg, UI' })}</div>
    <p class="etiqueta">Concentración (para revisar la cuenta)</p>
    <div class="tres">${num('Valor', 'concentracion.valor', '50')}${texto('Unidad', 'concentracion.unidad', { ph: 'mg' })}${num('En cc', 'concentracion.ml', '5')}</div>
    <small>Si llena la dosis y la concentración, la app revisa que dosis = valor ÷ cc × cantidad. Si no cuadra, no se guarda.</small>
  </section>`}

  <section class="tarjeta formulario">
    <h2>Con qué se mide y protección</h2>
    ${sel('Se mide con', 'medida.instrumento', { '': 'Sin dato', ...INSTRUMENTOS }, { re: true })}
    ${(m.medida && m.medida.instrumento) === 'jeringa' ? sel('Jeringa', 'medida.capacidad', jeringas, { t: 'num' }) : ''}
    <div class="checks">${Object.entries(PROTECCION).map(([k, t]) => `<label class="check"><input type="checkbox" data-t="prot" data-p="${k}"${(m.proteccion || []).includes(k) ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</div>
  </section>

  <section class="tarjeta formulario">
    <h2>Comida</h2>
    ${sel('Regla', 'comida.regla', { '': 'Sin dato', ...COMIDA })}
    ${texto('Qué dice la indicación', 'comida.texto', { ph: 'Ej.: Lejos de las comidas' })}
  </section>

  <section class="tarjeta formulario">
    <h2>Preparación paso a paso</h2>
    ${sel('Tipo', 'preparacion.tipo', PREPARACIONES)}
    ${pasos.map((p, j) => `<div class="paso-form">
      <p class="etiqueta">Paso ${j + 1}</p>
      ${texto('Qué hacer', `preparacion.pasos.${j}.texto`, { area: true, ph: 'Ej.: Diluya 1 tableta en 5 cc de agua.' })}
      ${sel('Dibujo', `preparacion.pasos.${j}.icono`, ICONOS_PASO)}
      ${confirmar ? '' : `<div class="dos">${num('cc a medir', `preparacion.pasos.${j}.medir.cantidad`)}${sel('Jeringa', `preparacion.pasos.${j}.medir.jeringa`, jeringas, { t: 'num' })}</div>
      <div class="dos">${num('Gotas a contar', `preparacion.pasos.${j}.gotas`)}${num('Minutos de espera', `preparacion.pasos.${j}.esperar_min`)}</div>
      <label class="check"><input type="radio" name="paso-dar" data-t="dar" data-i="${j}"${p.dar ? ' checked' : ''}> Este es el paso de dar la dosis</label>`}
      <div class="mover">
        ${j > 0 ? `<button type="button" class="boton chico" data-accion="paso-subir" data-i="${j}">↑ Subir</button>` : ''}
        ${j < pasos.length - 1 ? `<button type="button" class="boton chico" data-accion="paso-bajar" data-i="${j}">↓ Bajar</button>` : ''}
        <button type="button" class="boton chico" data-accion="paso-quitar" data-i="${j}">Quitar</button>
      </div>
    </div>`).join('')}
    <button type="button" class="boton chico" data-accion="paso-nuevo">+ Añadir paso</button>
  </section>

  <section class="tarjeta formulario">
    <h2>Cuidados y pendientes</h2>
    <label class="campo"><span>Cuidados (uno por línea)</span><textarea rows="3" data-b="cuidados" data-t="cuidados">${esc((m.cuidados || []).map((c) => c.texto).join('\n'))}</textarea></label>
    <label class="campo"><span>Por confirmar con el equipo (uno por línea)</span><textarea rows="3" data-b="por_confirmar" data-t="lineas">${esc((m.por_confirmar || []).join('\n'))}</textarea></label>
    <label class="check"><input type="checkbox" data-t="familia"${m.origen === 'familia' ? ' checked' : ''}> La familia lo da distinto de la fórmula</label>
    ${m.origen === 'familia' ? texto('En qué se aparta de la fórmula', 'ajuste.texto', { area: true }) : ''}
  </section>

  <section class="tarjeta formulario fuente-cambio">
    <label class="campo"><span>${icono('aviso')} ¿De dónde sale este cambio?</span>
      <input type="text" data-campo="fuente-cambio" value="${esc(b.fuente)}" placeholder="Ej.: Hoja del equipo, 20 nov · Enfermera por teléfono"></label>
    <small>Obligatorio. Queda como fuente de cada dato que cambie, con la fecha y el nombre de quien usa este teléfono.</small>
  </section>
  <div class="botones">
    <a class="boton" href="${b.medId ? rMed(b.medId) : '#lista'}">${icono('atras')}<span>Cancelar</span></a>
    <button class="boton principal" data-accion="guardar-med">${icono('dado')}<span>Guardar</span></button>
  </div>`;
}

// Pasa lo escrito en un campo al borrador.
function tomarCampo(el) {
  const b = estado.borrador;
  if (!b) return;
  const t = el.dataset.t || '';
  const m = b.m;
  if (t === 'prot') {
    const lista = new Set(m.proteccion || []);
    if (el.checked) lista.add(el.dataset.p); else lista.delete(el.dataset.p);
    m.proteccion = Object.keys(PROTECCION).filter((k) => lista.has(k));
    return;
  }
  if (t === 'dar') {
    (m.preparacion.pasos || []).forEach((p, j) => { if (j === Number(el.dataset.i)) p.dar = true; else delete p.dar; });
    return;
  }
  if (t === 'familia') {
    if (el.checked) { m.origen = 'familia'; m.ajuste = m.ajuste || { texto: '' }; } else { delete m.origen; }
    refrescar();
    return;
  }
  if (t === 'lineas') { m.por_confirmar = el.value.split('\n'); return; }
  if (t === 'cuidados') {
    const antes = m.cuidados || [];
    m.cuidados = el.value.split('\n').map((linea) => antes.find((c) => c.texto === linea.trim()) || { texto: linea });
    return;
  }
  let valor = el.value;
  if (t === 'num') valor = leerNumero(valor);
  fijarRuta(m, el.dataset.b, valor === '' ? undefined : valor);
  if (el.dataset.re) refrescar();
}

function irAErrores() {
  render();
  const caja = document.getElementById('errores');
  if (caja) caja.scrollIntoView();
}

function pantallaAlarmas() {
  const d = datosActivos();
  if (!d) return bienvenida();
  const pid = d.paciente.id;
  const rutina = almacen.rutina(pid);
  const porHora = rutina.por_hora || {};
  const lista = alarmas(d, rutina);
  const direccion = location.href.split('#')[0];
  const horas = [...new Set(d.medicamentos.flatMap((m) => (m.tomas || []).map((t) => t.hora)))].sort((a, b) => minutos(a) - minutos(b));
  return `
  <h1>Alarmas</h1>
  <p>Cree estas alarmas en el Reloj del teléfono. Las alarmas del Reloj suenan aunque el teléfono esté en silencio.</p>
  <details class="tarjeta ayuda"${Object.keys(porHora).length ? '' : ' open'}><summary>Minutos para preparar antes de cada hora</summary>
    <ul class="lista-prep">${horas.map((h) => `<li><span>${esc(horaBonita(h))}</span>
      <input type="number" inputmode="numeric" min="0" max="120" step="5" value="${Number.isFinite(porHora[h]) ? porHora[h] : ''}" placeholder="${rutina.preparar_min}" data-campo="preparar-hora" data-hora="${h}" aria-label="Minutos para preparar las de ${esc(horaBonita(h))}"><span class="sub">min</span></li>`).join('')}</ul>
    <label class="campo"><span>Para las horas sin minutos propios</span>
      <input type="number" inputmode="numeric" min="0" max="120" step="5" value="${rutina.preparar_min}" data-campo="preparar"></label>
    <p class="nota-chica">Es la rutina de quien cuida, no un dato médico. Use 0 si no quiere alarma de preparar a esa hora.</p>
  </details>
  <ul class="lista-alarmas">${lista.map((a) => `<li class="${a.tipo}">
    ${icono(a.tipo === 'preparar' ? 'reloj_arena' : 'alarma')}
    <div><p class="hora">${horaBonita(a.hora)}</p><p>${esc(a.etiqueta)}</p><p class="sub">${esc(diasTexto(a.dias))}</p></div></li>`).join('')}</ul>
  <button class="boton" data-accion="copiar-alarmas">${icono('lista')}<span>Copiar la lista</span></button>
  <details class="tarjeta ayuda"><summary>Cómo crearlas en iPhone</summary>
    <ol><li>Abra <b>Reloj</b> → <b>Alarmas</b> → <b>+</b>.</li>
    <li>Ponga la hora, en <b>Repetir</b> marque los días y en <b>Etiqueta</b> copie el texto.</li>
    <li>Para que al apagar la alarma se abra esta app: <b>Atajos</b> → <b>Automatización</b> → <b>Alarma</b> → <b>Se detiene</b> → elija la alarma → acción <b>Abrir URL</b> con esta dirección:</li></ol>
    <p class="direccion">${esc(direccion)}</p>
  </details>
  <details class="tarjeta ayuda"><summary>Cómo crearlas en Android</summary>
    <ol><li>Abra <b>Reloj</b> → <b>Alarma</b> → <b>+</b>.</li><li>Ponga la hora, los días y la etiqueta.</li></ol>
  </details>`;
}

function tarjetaCuidador() {
  return `<section class="tarjeta">
    <label class="campo"><span>${icono('persona')} ¿Quién usa este teléfono?</span>
      <input type="text" autocomplete="name" placeholder="Nombre" value="${esc(almacen.cuidador())}" data-campo="cuidador"></label>
    <p class="nota-chica">Se anota junto a cada toma marcada como dada.</p>
  </section>`;
}

function pantallaDatos() {
  const pacientes = almacen.pacientes();
  const activo = almacen.activo();
  let carga = '';
  if (estado.carga) {
    const { datos, resultado } = estado.carga;
    if (resultado.errores.length) {
      carga = `<section class="tarjeta nota-grande rojo">
        <h2>${icono('aviso')} El archivo tiene ${resultado.errores.length} problema${resultado.errores.length === 1 ? '' : 's'} y no se usó</h2>
        <ul class="problemas">${resultado.errores.map((e) => `<li><b>${esc(e.donde)}:</b> ${esc(e.msg)}</li>`).join('')}</ul>
        <button class="boton" data-accion="cancelar-carga">${icono('atras')}<span>Cerrar</span></button></section>`;
    } else {
      const r = resumen(datos);
      carga = `<section class="tarjeta nota-grande verde">
        <h2>${icono('dado')} Archivo revisado</h2>
        <p><b>${esc(r.paciente)}</b> · datos al ${esc(fechaBonita(r.datos_al))}</p>
        <p>${r.vigentes} vigentes · ${r.por_confirmar} por confirmar · ${r.ya_no_se_dan} que ya no se dan</p>
        ${resultado.avisos.length ? `<p class="etiqueta">Para revisar (${resultado.avisos.length})</p><ul class="problemas ambar">${resultado.avisos.map((e) => `<li><b>${esc(e.donde)}:</b> ${esc(e.msg)}</li>`).join('')}</ul>` : ''}
        ${datos.rutina && datos.rutina.preparar_min ? `<p>Trae los minutos para preparar de ${Object.keys(datos.rutina.preparar_min).length} horas.</p>` : ''}
        ${pacientes.some((p) => p.id === datos.paciente.id) ? '<p class="nota-chica">Ya hay datos de este paciente: se reemplazan. El registro de dados se conserva.</p>' : ''}
        ${(() => {
          const actual = almacen.datos(datos.paciente.id);
          const uc = actual && ultimoCambio(actual);
          return uc ? `<p class="nota-chica rojo-texto">Ojo: se pierden los cambios hechos en este teléfono (el último, del ${esc(fechaBonita(uc))}). Si los necesita, cancele y antes toque "Descargar mis datos".</p>` : '';
        })()}
        <div class="botones"><button class="boton" data-accion="cancelar-carga">${icono('atras')}<span>Cancelar</span></button>
        <button class="boton principal" data-accion="usar-carga">${icono('dado')}<span>Usar estos datos</span></button></div></section>`;
    }
  }
  const msg = estado.mensaje ? `<div class="nota ${estado.mensaje.tipo}">${icono(estado.mensaje.tipo === 'verde' ? 'dado' : 'aviso')}<p>${esc(estado.mensaje.texto)}</p></div>` : '';
  estado.mensaje = null;
  return `
  <h1>Datos</h1>
  ${msg}${carga}
  <h2 class="titulo-seccion">Pacientes en este teléfono</h2>
  <ul class="lista-pacientes">${pacientes.map((p) => `<li class="${p.id === activo ? 'activo' : ''}">
      ${icono('persona')}<div><strong>${esc(p.nombre)}</strong><p class="sub">Datos al ${esc(fechaBonita(p.datos_al))}</p></div>
      ${p.id === activo ? '<span class="insignia verde">En uso</span>' : `<button class="boton chico" data-accion="usar-paciente" data-id="${esc(p.id)}">Usar</button>`}
      <button class="boton chico${estado.borrar === p.id ? ' rojo' : ''}" data-accion="borrar-paciente" data-id="${esc(p.id)}">${estado.borrar === p.id ? '¿Borrar? Toque otra vez' : 'Borrar'}</button>
    </li>`).join('') || '<li class="vacio">Todavía no hay pacientes.</li>'}</ul>
  <div class="botones columna">
    <label class="boton principal">${icono('subir')}<span>Cargar archivo de datos</span>
      <input type="file" accept=".json,application/json" data-campo="archivo" hidden></label>
    <button class="boton" data-accion="ejemplo">${icono('lista')}<span>Probar con datos de ejemplo</span></button>
    ${activo ? `<button class="boton" data-accion="exportar">${icono('bajar')}<span>Descargar mis datos</span></button>` : ''}
  </div>
  ${activo ? '<p class="nota-chica">"Descargar mis datos" guarda un archivo con los medicamentos, los cambios hechos aquí, los minutos para preparar y el registro de dados. Sirve de respaldo, para revisarlo en el computador y para cargarlo en otro teléfono.</p>' : ''}
  <p class="nota-chica">Para editar o añadir un medicamento: Lista → toque el medicamento → "Editar", o "Añadir medicamento".</p>
  ${tarjetaCuidador()}
  <p class="version">Guía de tomas ${VERSION_APP}</p>`;
}

// ---------- Marco y navegación ----------

function marco(contenido, ruta) {
  const d = datosActivos();
  const nav = [['#ahora', 'casa', 'Ahora'], ['#lista', 'lista', 'Lista'], ['#alarmas', 'alarma', 'Alarmas'], ['#datos', 'datos', 'Datos']];
  const base = ruta.split('-')[0];
  const actual = base === 'hora' || base === 'paso' || base === 'espera' || base === 'ahora' ? '#ahora'
    : base === 'med' || base === 'editar' || base === 'nuevo' ? '#lista' : '#' + base;
  const uc = d ? ultimoCambio(d) : null;
  return `
  ${d ? `<header class="barra">
    <a class="paciente" href="#datos">${icono('persona')}<span>${esc(d.paciente.nombre)}</span></a>
    <span class="chip-fecha">Datos al ${esc(fechaBonita(d.datos_al))}${uc ? `<br><b>cambios del ${esc(fechaBonita(uc).replace(/ \d{4}$/, ''))}</b>` : ''}</span>
  </header>
  ${d.aviso ? `<div class="aviso-datos">${icono('aviso')}<span>${esc(d.aviso)}</span></div>` : ''}` : ''}
  ${d ? '' : '<div class="margen-arriba"></div>'}
  <main id="contenido">${contenido}</main>
  <nav class="nav-abajo" aria-label="Secciones">${nav.map(([h, ic, t]) => `<a href="${h}"${h === actual ? ' aria-current="page"' : ''}>${icono(ic)}<span>${t}</span></a>`).join('')}</nav>`;
}

function rutaActual() {
  return location.hash.replace(/^#/, '') || 'ahora';
}

export function render() {
  callar();
  const ruta = rutaActual();
  let html;
  // El borrador vive solo mientras se está en la pantalla de edición.
  if (ruta.startsWith('editar-') || ruta === 'nuevo') {
    const medId = ruta === 'nuevo' ? null : ruta.slice(7);
    if (!estado.borrador || estado.borrador.medId !== medId) estado.borrador = datosActivos() ? nuevoBorrador(medId) : null;
  } else {
    estado.borrador = null;
  }
  if (!ruta.startsWith('med-')) estado.deshacer = null;
  if (ruta.startsWith('editar-') || ruta === 'nuevo') html = pantallaEditar();
  else if (ruta.startsWith('hora-')) html = pantallaHora(horaDeRuta(ruta.slice(5)));
  else if (ruta.startsWith('paso-')) {
    const partes = ruta.slice(5).split('-');
    const n = Number(partes.pop()) || 0;
    const h = partes.pop();
    html = pantallaPaso(partes.join('-'), h === 'x' ? null : horaDeRuta(h), n);
  } else if (ruta.startsWith('espera-')) html = pantallaEspera(horaDeRuta(ruta.slice(7)));
  else if (ruta.startsWith('med-')) html = pantallaMed(ruta.slice(4));
  else if (ruta === 'lista') html = pantallaLista();
  else if (ruta === 'alarmas') html = pantallaAlarmas();
  else if (ruta === 'datos') html = pantallaDatos();
  else html = pantallaAhora();
  raiz.innerHTML = marco(html, ruta);
  window.scrollTo(0, 0);
}

function refrescar() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

// ---------- Acciones ----------

async function leerArchivo(archivo) {
  let datos = null;
  try {
    datos = JSON.parse(await archivo.text());
  } catch {
    estado.carga = { datos: null, resultado: { errores: [{ donde: 'Archivo', msg: 'No se pudo leer: no es un archivo JSON.' }], avisos: [] } };
    location.hash = '#datos';
    refrescar();
    return;
  }
  estado.carga = { datos, resultado: validar(datos) };
  if (location.hash !== '#datos') location.hash = '#datos';
  else refrescar();
}

async function cargarEjemplo() {
  try {
    const r = await fetch('datos/ejemplo-ficticio.json', { cache: 'no-cache' });
    const datos = await r.json();
    estado.carga = { datos, resultado: validar(datos) };
  } catch {
    estado.mensaje = { tipo: 'rojo', texto: 'No se pudo abrir el ejemplo.' };
  }
  if (location.hash !== '#datos') location.hash = '#datos';
  else refrescar();
}

async function exportar() {
  const d = datosActivos();
  if (!d) return;
  const pid = d.paciente.id;
  const copia = copiaParaDescargar(d, almacen.rutina(pid), almacen.registro(pid));
  const nombre = `guia-tomas-${pid}-${fechaISO(new Date())}.json`;
  const texto = JSON.stringify(copia, null, 2);
  // En el iPhone, Compartir deja guardarlo en Archivos, mandarlo por AirDrop o por correo.
  try {
    const archivo = new File([texto], nombre, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: nombre });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const blob = new Blob([texto], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function moverDia(delta) {
  const f = new Date(estado.fecha);
  f.setDate(f.getDate() + delta);
  estado.fecha = f;
  refrescar();
}

function iniciarReloj(clave, segundos) {
  const r = estado.reloj;
  if (r && r.clave === clave && r.corriendo) {
    clearInterval(r.id);
    r.corriendo = false;
    refrescar();
    return;
  }
  if (r) clearInterval(r.id);
  const nuevo = { clave, restante: r && r.clave === clave && r.restante > 0 ? r.restante : segundos, corriendo: true, id: null };
  nuevo.id = setInterval(() => {
    nuevo.restante = Math.max(0, nuevo.restante - 1);
    const el = document.querySelector('[data-reloj]');
    if (el) el.textContent = mmss(nuevo.restante);
    if (nuevo.restante === 0) {
      clearInterval(nuevo.id);
      nuevo.corriendo = false;
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
      const ruta = rutaActual();
      if (ruta.startsWith('paso-') || ruta.startsWith('espera-')) refrescar();
    }
  }, 1000);
  estado.reloj = nuevo;
  refrescar();
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-accion]');
  if (!el) return;
  const a = el.dataset.accion;
  const d = datosActivos();
  const iso = fechaISO(estado.fecha);
  switch (a) {
    case 'dia-anterior': moverDia(-1); break;
    case 'dia-siguiente': moverDia(1); break;
    case 'dia-hoy': estado.fecha = hoy(); refrescar(); break;
    case 'examen': almacen.alternarExamen(d.paciente.id, iso); refrescar(); break;
    case 'dado': {
      const { med, hora } = el.dataset;
      if (almacen.dado(d.paciente.id, med, iso, hora)) almacen.desmarcar(d.paciente.id, med, iso, hora);
      else almacen.marcarDado(d.paciente.id, med, iso, hora);
      refrescar();
      break;
    }
    case 'dado-y-volver': {
      const { med, hora } = el.dataset;
      almacen.marcarDado(d.paciente.id, med, iso, hora);
      const eh = estadoHora(d, iso, hora);
      const regla = esperaRegla(d);
      if (eh && eh.pendientes.length && regla) iniciarReloj(`espera-${hora}-${med}`, regla.esperar_min * 60);
      location.hash = rEspera(hora);
      break;
    }
    case 'escuchar': leer(estado.voz); break;
    case 'gota': {
      const caja = el.closest('.gotas');
      const clave = caja.dataset.clave;
      const total = Number(caja.dataset.total);
      const i = Number(el.dataset.i);
      const cuenta = estado.gotas[clave] || 0;
      estado.gotas[clave] = i >= cuenta ? Math.min(total, cuenta + 1) : i;
      const nueva = estado.gotas[clave];
      caja.querySelectorAll('.gota').forEach((g, k) => {
        g.classList.toggle('llena', k < nueva);
        g.setAttribute('aria-pressed', String(k < nueva));
      });
      const c = document.querySelector('[data-cuenta]');
      if (c) c.textContent = String(nueva);
      if (nueva === total && navigator.vibrate) navigator.vibrate(200);
      break;
    }
    case 'gotas-reiniciar': estado.gotas[el.dataset.clave] = 0; refrescar(); break;
    case 'reloj': iniciarReloj(el.dataset.clave, Number(el.dataset.segundos)); break;
    case 'filtro': {
      const { tipo, valor } = el.dataset;
      estado.filtros[tipo] = tipo === 'guantes' ? valor === 'true' : valor;
      refrescar();
      break;
    }
    case 'ejemplo': await cargarEjemplo(); break;
    case 'usar-carga': {
      const prev = estado.carga.datos;
      almacen.guardarDatos(prev);
      almacen.fijarActivo(prev.paciente.id);
      if (prev.rutina && prev.rutina.preparar_min) {
        const r = almacen.rutina(prev.paciente.id);
        almacen.fijarRutina(prev.paciente.id, { ...r, por_hora: { ...prev.rutina.preparar_min } });
      }
      estado.carga = null;
      estado.mensaje = { tipo: 'verde', texto: `Datos de ${prev.paciente.nombre} guardados en este teléfono.` };
      location.hash = '#ahora';
      break;
    }
    case 'cancelar-carga': estado.carga = null; refrescar(); break;
    case 'usar-paciente': almacen.fijarActivo(el.dataset.id); estado.borrar = null; refrescar(); break;
    case 'borrar-paciente': {
      const id = el.dataset.id;
      if (estado.borrar === id) { almacen.borrarPaciente(id); estado.borrar = null; }
      else estado.borrar = id;
      refrescar();
      break;
    }
    case 'exportar': await exportar(); break;
    // Edición
    case 'toggle-dia': {
      const t = estado.borrador.m.tomas[Number(el.dataset.i)];
      const dias = new Set(t.dias || DIAS);
      if (dias.has(el.dataset.dia)) dias.delete(el.dataset.dia); else dias.add(el.dataset.dia);
      t.dias = DIAS.filter((x) => dias.has(x));
      if (t.dias.length === 7) delete t.dias;
      refrescar();
      break;
    }
    case 'hora-nueva': estado.borrador.m.tomas = [...(estado.borrador.m.tomas || []), { hora: '' }]; refrescar(); break;
    case 'hora-quitar': estado.borrador.m.tomas.splice(Number(el.dataset.i), 1); refrescar(); break;
    case 'paso-nuevo': {
      const m = estado.borrador.m;
      m.preparacion = m.preparacion || { tipo: 'otro', pasos: [] };
      m.preparacion.tipo = m.preparacion.tipo || 'otro';
      m.preparacion.pasos = [...(m.preparacion.pasos || []), { texto: '' }];
      refrescar();
      break;
    }
    case 'paso-quitar': estado.borrador.m.preparacion.pasos.splice(Number(el.dataset.i), 1); refrescar(); break;
    case 'paso-subir':
    case 'paso-bajar': {
      const pasos = estado.borrador.m.preparacion.pasos;
      const i = Number(el.dataset.i);
      const j = a === 'paso-subir' ? i - 1 : i + 1;
      [pasos[i], pasos[j]] = [pasos[j], pasos[i]];
      refrescar();
      break;
    }
    case 'guardar-med': {
      const b = estado.borrador;
      const r = guardarMed(d, b.medId, b.m, { fuente: b.fuente, cuidador: almacen.cuidador(), fecha: fechaISO(new Date()) });
      if (r.error) { b.error = r.error; b.errores = null; irAErrores(); break; }
      if (r.resultado.errores.length) { b.error = null; b.errores = r.resultado.errores; irAErrores(); break; }
      almacen.guardarDatos(r.datos);
      const que = r.cambios.map((c) => NOMBRES_CAMBIO[c] || c).filter((v, i, l) => l.indexOf(v) === i).join(', ');
      estado.borrador = null;
      estado.mensaje = {
        tipo: 'verde',
        texto: `${b.medId ? 'Guardado' : 'Añadido'}: ${r.med.nombre}.${b.medId ? ` Cambió: ${que}.` : ''}`,
      };
      location.hash = rMed(r.med.id);
      break;
    }
    case 'deshacer-med': {
      const id = el.dataset.med;
      if (estado.deshacer !== id) { estado.deshacer = id; refrescar(); break; }
      const r = deshacer(d, id);
      estado.deshacer = null;
      if (!r || r.resultado.errores.length) {
        estado.mensaje = { tipo: 'rojo', texto: 'No se pudo deshacer: el valor anterior no pasa la revisión.' };
        refrescar();
        break;
      }
      almacen.guardarDatos(r.datos);
      const sigue = r.datos.medicamentos.some((m) => m.id === id);
      estado.mensaje = { tipo: 'verde', texto: sigue ? 'Listo: volvió al valor anterior.' : 'Listo: se quitó el medicamento agregado.' };
      if (sigue) refrescar(); else location.hash = '#lista';
      break;
    }
    case 'copiar-alarmas': {
      const lista = alarmas(d, almacen.rutina(d.paciente.id));
      const texto = lista.map((x) => `${horaBonita(x.hora)} · ${x.etiqueta} · ${diasTexto(x.dias)}`).join('\n');
      try {
        await navigator.clipboard.writeText(texto);
        el.querySelector('span').textContent = 'Copiada';
      } catch {
        el.querySelector('span').textContent = 'No se pudo copiar';
      }
      break;
    }
    default: break;
  }
});

// Lo que se escribe en el formulario de edición pasa al borrador al momento.
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.dataset || !estado.borrador) return;
  if (el.dataset.campo === 'fuente-cambio') { estado.borrador.fuente = el.value; return; }
  if (el.dataset.b && el.tagName !== 'SELECT' && el.type !== 'checkbox' && el.type !== 'radio') tomarCampo(el);
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (!el.dataset) return;
  if (estado.borrador && (el.dataset.b || el.dataset.t) && (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio' || el.type === 'time')) {
    tomarCampo(el);
    return;
  }
  if (!el.dataset.campo) return;
  if (el.dataset.campo === 'archivo' && el.files && el.files[0]) leerArchivo(el.files[0]);
  if (el.dataset.campo === 'preparar-hora') {
    const d = datosActivos();
    const r = almacen.rutina(d.paciente.id);
    const porHora = { ...(r.por_hora || {}) };
    if (String(el.value).trim() === '') delete porHora[el.dataset.hora];
    else porHora[el.dataset.hora] = Math.max(0, Math.min(120, Math.round(Number(el.value) || 0)));
    almacen.fijarRutina(d.paciente.id, { ...r, por_hora: porHora });
    refrescar();
  }
  if (el.dataset.campo === 'cuidador') almacen.fijarCuidador(el.value);
  if (el.dataset.campo === 'preparar') {
    const d = datosActivos();
    const r = almacen.rutina(d.paciente.id);
    const v = Math.max(0, Math.min(120, Math.round(Number(el.value) || 0)));
    almacen.fijarRutina(d.paciente.id, { ...r, preparar_min: v });
    refrescar();
  }
});

window.addEventListener('hashchange', render);

// Mantener al día "en 20 min" en la pantalla Ahora.
setInterval(() => {
  const r = rutaActual();
  const escribiendo = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if ((r === 'ahora' || r.startsWith('hora-')) && !escribiendo) refrescar();
}, 60000);

if (hayVoz()) window.speechSynthesis.onvoiceschanged = () => {};

render();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
