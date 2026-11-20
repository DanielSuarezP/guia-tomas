// Modelo de datos de Guía de tomas: categorías, revisión de archivos y agenda.
// Este módulo no cambia ningún dato médico: solo lee, ordena y revisa.

export const FORMATO = 'guia-tomas';
export const VERSION = 1;

export const GRUPOS = {
  antirrechazo: 'Antirrechazo',
  antiinfeccioso: 'Antiinfecciosos',
  presion: 'Presión arterial',
  otro: 'Otros y suplementos',
};

export const ESTADOS = {
  vigente: 'Vigente',
  por_confirmar: 'Por confirmar',
};

export const PRESENTACIONES = {
  capsula: 'Cápsula',
  tableta: 'Tableta',
  jarabe: 'Jarabe o suspensión',
  gotas: 'Gotas',
  otro: 'Otra',
};

export const PREPARACIONES = {
  abrir_capsula: 'Abrir cápsula y mezclar',
  triturar_diluir: 'Triturar en bolsa y diluir',
  diluir_tableta: 'Diluir tableta y dar una parte o toda',
  medir_liquido: 'Medir el líquido directo',
  contar_gotas: 'Contar gotas en cucharita',
  perforar_capsula: 'Perforar cápsula líquida',
  otro: 'Otra',
};

export const COMIDA = {
  con_comida: 'Con comida',
  sin_comida: 'Lejos de las comidas',
  antes_de_comer: 'Antes de comer',
  indiferente: 'Con o sin comida',
  por_confirmar: 'Comida: por confirmar',
};

export const PROTECCION = {
  guantes: 'Guantes',
  tapabocas: 'Tapabocas',
};

export const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
export const DIAS_NOMBRE = {
  dom: 'domingo', lun: 'lunes', mar: 'martes', mie: 'miércoles',
  jue: 'jueves', vie: 'viernes', sab: 'sábado',
};
export const DIAS_CORTO = {
  dom: 'D', lun: 'L', mar: 'M', mie: 'X', jue: 'J', vie: 'V', sab: 'S',
};

export const JERINGAS = [1, 3, 5, 10, 20];

// Raya más pequeña de cada jeringa de la casa (AlfaSafe), contada en las
// fotos del 19 nov 2026. La de 20 no está en casa: no se revisan sus rayas.
export const RAYAS = { 1: 0.02, 3: 0.1, 5: 0.2, 10: 0.2 };

// ¿La cantidad cae justo en una raya? null si no se conocen las rayas.
export function caeEnRaya(cantidad, jeringa) {
  const r = RAYAS[jeringa];
  if (!r || !(cantidad > 0)) return null;
  const k = cantidad / r;
  return Math.abs(k - Math.round(k)) < 1e-6;
}

// Las dos rayas entre las que cae una cantidad: [abajo, arriba].
export function rayasVecinas(cantidad, jeringa) {
  const r = RAYAS[jeringa];
  const abajo = Math.floor(cantidad / r + 1e-9) * r;
  return [Math.round(abajo * 1000) / 1000, Math.round((abajo + r) * 1000) / 1000];
}

// Jeringa con que se mide un paso: la del paso, o la del medicamento.
export function jeringaDelPaso(m, p) {
  if (p && p.medir && p.medir.jeringa) return p.medir.jeringa;
  if (m && m.medida && m.medida.instrumento === 'jeringa' && m.medida.capacidad) return m.medida.capacidad;
  return null;
}

const ID_VALIDO = /^[a-z0-9-]+$/;

// ---------- Formatos ----------

export function esFecha(t) {
  return typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(t + 'T12:00:00'));
}

export function esHora(t) {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function minutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function horaDesdeMinutos(total) {
  const t = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// 14:00 -> "2:00 pm"; 12:00 -> "12:00 m"
export function horaBonita(hora) {
  const [h, m] = hora.split(':').map(Number);
  const mm = String(m).padStart(2, '0');
  if (h === 12 && m === 0) return '12:00 m';
  if (h === 0) return `12:${mm} am`;
  if (h < 12) return `${h}:${mm} am`;
  if (h === 12) return `12:${mm} pm`;
  return `${h - 12}:${mm} pm`;
}

// 1.5 -> "1,5"
export function numero(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  const r = Math.round(n * 1000) / 1000;
  return String(r).replace('.', ',');
}

export function fechaISO(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fechaBonita(iso) {
  if (!esFecha(iso)) return iso || '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

function normal(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// ---------- Revisión de un archivo de datos ----------
// Devuelve { errores: [{donde, msg}], avisos: [{donde, msg}] }.
// Con errores, la app no usa el archivo.

export function validar(d) {
  const errores = [];
  const avisos = [];
  const err = (donde, msg) => errores.push({ donde, msg });
  const av = (donde, msg) => avisos.push({ donde, msg });
  const conFuente = (obj, donde, que) => {
    if (!obj || !obj.fuente) err(donde, `Falta la fuente de ${que}.`);
  };

  if (!d || typeof d !== 'object' || Array.isArray(d)) {
    err('Archivo', 'No es un archivo de datos de Guía de tomas.');
    return { errores, avisos };
  }
  if (d.formato !== FORMATO) err('Archivo', 'El archivo no es de Guía de tomas (falta "formato": "guia-tomas").');
  if (d.version !== VERSION) err('Archivo', `Versión ${d.version} no reconocida; esta app lee la versión ${VERSION}.`);
  if (!d.paciente || !d.paciente.id || !d.paciente.nombre) {
    err('Paciente', 'Falta el id o el nombre del paciente.');
  } else if (!ID_VALIDO.test(d.paciente.id)) {
    err('Paciente', 'El id del paciente solo puede tener minúsculas, números y guiones.');
  }
  if (!esFecha(d.datos_al)) err('Archivo', 'Falta la fecha de los datos ("datos_al", AAAA-MM-DD).');
  if (!Array.isArray(d.medicamentos) || d.medicamentos.length === 0) {
    err('Medicamentos', 'No hay medicamentos.');
  }

  const ids = new Set();
  const nombres = new Set();

  (d.medicamentos || []).forEach((m, i) => {
    const donde = (m && m.nombre) || `Medicamento ${i + 1}`;
    if (!m || typeof m !== 'object') { err(donde, 'No es un medicamento válido.'); return; }

    if (!m.id || !ID_VALIDO.test(m.id)) err(donde, 'Falta el id (minúsculas, números y guiones).');
    else if (ids.has(m.id)) err(donde, `El id "${m.id}" está repetido.`);
    else ids.add(m.id);

    if (!m.nombre) err(donde, 'Falta el nombre.');
    else nombres.add(normal(m.nombre));

    if (!(m.estado in ESTADOS)) err(donde, 'El estado debe ser "vigente" o "por_confirmar".');
    if (!(m.grupo in GRUPOS)) err(donde, 'Grupo no reconocido.');

    if (!m.presentacion || !(m.presentacion.tipo in PRESENTACIONES)) err(donde, 'Falta la presentación.');
    else conFuente(m.presentacion, donde, 'la presentación');

    // Horas
    const tomas = Array.isArray(m.tomas) ? m.tomas : [];
    if (m.estado === 'vigente' && tomas.length === 0) err(donde, 'Falta al menos una hora de toma.');
    tomas.forEach((t) => {
      if (!esHora(t.hora)) err(donde, `Hora no válida: "${t.hora}" (use HH:MM, de 00:00 a 23:59).`);
      if (t.dias !== undefined) {
        if (!Array.isArray(t.dias) || t.dias.length === 0 || t.dias.some((x) => !DIAS.includes(x))) {
          err(donde, 'Días no válidos (use dom, lun, mar, mie, jue, vie, sab).');
        }
      }
    });
    if (tomas.length && !m.tomas_fuente && tomas.some((t) => !t.fuente)) err(donde, 'Falta la fuente de las horas.');

    // Comida, protección, cuidados
    if (m.comida) {
      if (!(m.comida.regla in COMIDA)) err(donde, 'Regla de comida no reconocida.');
      else if (m.comida.regla !== 'por_confirmar') conFuente(m.comida, donde, 'la regla de comida');
    }
    (m.proteccion || []).forEach((p) => {
      if (!(p in PROTECCION)) err(donde, `Protección no reconocida: "${p}".`);
    });
    (m.cuidados || []).forEach((c) => conFuente(c, donde, 'un cuidado'));
    if (m.dia_examen) conFuente(m.dia_examen, donde, 'la indicación del día del examen');

    // Preparación
    const pasos = (m.preparacion && Array.isArray(m.preparacion.pasos)) ? m.preparacion.pasos : [];
    if (m.preparacion && !(m.preparacion.tipo in PREPARACIONES)) err(donde, 'Tipo de preparación no reconocido.');

    pasos.forEach((p, j) => {
      const dp = `${donde}, paso ${j + 1}`;
      if (!p.texto) err(dp, 'Falta el texto.');
      if (!p.fuente) err(dp, 'Falta la fuente.');
      if (p.medir) {
        if (!(p.medir.cantidad > 0)) err(dp, 'Cantidad no válida.');
        // Si el texto del paso nombra cc, alguno debe ser la cantidad que se mide.
        const enTexto = [...String(p.texto || '').matchAll(/(\d+(?:[.,]\d+)?)\s*(?:cc|ml)\b/gi)].map((x) => Number(x[1].replace(',', '.')));
        if (p.medir.cantidad > 0 && enTexto.length && !enTexto.some((n) => Math.abs(n - p.medir.cantidad) < 1e-9)) {
          err(dp, `El texto dice ${enTexto.map(numero).join(' y ')} cc, pero la cantidad para medir es ${numero(p.medir.cantidad)} cc.`);
        }
        if (p.medir.jeringa !== undefined && p.medir.jeringa !== null) {
          if (!JERINGAS.includes(p.medir.jeringa)) err(dp, `Jeringa de ${p.medir.jeringa} cc no reconocida.`);
          else if (p.medir.cantidad > p.medir.jeringa) err(dp, 'La cantidad no cabe en la jeringa.');
        }
      }
      if (p.gotas !== undefined && !(Number.isInteger(p.gotas) && p.gotas > 0)) err(dp, 'Número de gotas no válido.');
      if (p.jeringa !== undefined && !JERINGAS.includes(p.jeringa)) err(dp, `Jeringa de ${p.jeringa} cc no reconocida.`);
      if (p.esperar_min !== undefined && !(p.esperar_min > 0)) err(dp, 'Minutos de espera no válidos.');
    });

    // Cambio hecho en el teléfono: debe decir de dónde sale y cuándo.
    if (m.editado !== undefined) {
      if (!m.editado || !m.editado.fuente || !esFecha(m.editado.fecha)) {
        err(donde, 'El cambio hecho en el teléfono no tiene fuente o fecha.');
      }
    }

    if (m.origen !== undefined && m.origen !== 'familia') err(donde, 'Origen no reconocido (use "familia" o quítelo).');
    if (m.origen === 'familia') {
      if (!m.ajuste || !m.ajuste.texto) err(donde, 'Es un ajuste de la familia: anote en qué se aparta de la fórmula.');
      else av(donde, `Ajuste de la familia, distinto de la fórmula: ${m.ajuste.texto}`);
    }

    if (m.estado === 'por_confirmar') {
      if (m.dosis) err(donde, 'Está por confirmar y tiene dosis: quite la dosis hasta que el equipo la confirme.');
      if (pasos.some((p) => p.medir || p.gotas)) err(donde, 'Está por confirmar y un paso tiene cantidades: quítelas.');
      if (!Array.isArray(m.por_confirmar) || m.por_confirmar.length === 0) {
        err(donde, 'Está por confirmar: anote qué falta confirmar con el equipo.');
      }
    }

    if (m.estado === 'vigente') {
      if (!m.dosis) {
        err(donde, 'Falta la dosis.');
      } else {
        conFuente(m.dosis, donde, 'la dosis');
        if (!m.dosis.texto) err(donde, 'Falta el texto de la dosis.');
        revisarAritmetica(m, donde, err, conFuente);
      }
      if (pasos.length === 0) err(donde, 'Faltan los pasos de preparación.');

      if (!m.medida || !m.medida.instrumento) {
        err(donde, 'Falta con qué se mide la dosis.');
      } else if (m.medida.instrumento === 'jeringa') {
        if (m.medida.capacidad === undefined || m.medida.capacidad === null) {
          av(donde, 'Falta confirmar qué jeringa se usa: la app muestra la cantidad sin dibujo.');
        } else {
          if (!JERINGAS.includes(m.medida.capacidad)) err(donde, `Jeringa de ${m.medida.capacidad} cc no reconocida.`);
          conFuente(m.medida, donde, 'la jeringa');
          const enCc = m.dosis && (m.dosis.medida === undefined || m.dosis.medida === 'cc');
          if (enCc && m.dosis.cantidad > m.medida.capacidad) err(donde, 'La dosis no cabe en la jeringa.');
          if (!m.medida.dibujo_verificado) av(donde, 'Dibujo de la jeringa aproximado: falta compararlo con la jeringa real.');
        }
      }

      // Cada cantidad que se mide debe caber en su jeringa y caer en una raya.
      pasos.forEach((p, j) => {
        if (!p.medir || !(p.medir.cantidad > 0)) return;
        const jer = jeringaDelPaso(m, p);
        if (!jer) return;
        const dp = `${donde}, paso ${j + 1}`;
        const c = p.medir.cantidad;
        if (c > jer) {
          if (!p.medir.jeringa) av(dp, `${numero(c)} cc no caben en la jeringa de ${numero(jer)}.`);
          return;
        }
        if (caeEnRaya(c, jer) === false) {
          const [a, b] = rayasVecinas(c, jer);
          av(dp, `${numero(c)} cc no cae en una raya de la jeringa de ${numero(jer)} (rayas de ${numero(RAYAS[jer])} cc): queda entre ${numero(a)} y ${numero(b)}.`);
        }
      });

      const dar = pasos.find((p) => p.dar);
      if (!dar && pasos.length) av(donde, 'Ningún paso está marcado como el de dar la dosis.');
      if (dar && m.dosis && m.dosis.cantidad !== undefined) {
        if (dar.medir && Math.abs(dar.medir.cantidad - m.dosis.cantidad) > 1e-9) {
          err(donde, `El paso de dar dice ${numero(dar.medir.cantidad)} cc y la dosis ${numero(m.dosis.cantidad)} cc.`);
        }
        if (dar.gotas && dar.gotas !== m.dosis.cantidad) {
          err(donde, `El paso de dar dice ${dar.gotas} gotas y la dosis ${numero(m.dosis.cantidad)}.`);
        }
      }
    }
  });

  (d.ya_no_se_dan || []).forEach((s) => {
    const donde = (s && s.nombre) || 'Ya no se dan';
    if (!s || !s.nombre) { err('Ya no se dan', 'Falta un nombre.'); return; }
    if (nombres.has(normal(s.nombre))) err(donde, 'Está a la vez entre los vigentes y en "Ya no se dan".');
    if (!s.fuente) err(donde, 'Falta la fuente.');
  });

  (d.reglas_generales || []).forEach((r, i) => {
    if (!r.texto) err('Reglas generales', `La regla ${i + 1} no tiene texto.`);
    if (!r.fuente) err('Reglas generales', `La regla ${i + 1} no tiene fuente.`);
  });

  // Rutina de quien cuida: minutos para empezar a preparar antes de cada hora.
  if (d.rutina !== undefined) {
    const prep = d.rutina && d.rutina.preparar_min;
    if (!prep || typeof prep !== 'object' || Array.isArray(prep)) {
      err('Rutina', 'Faltan los minutos para preparar ("preparar_min").');
    } else {
      Object.entries(prep).forEach(([hora, min]) => {
        if (!esHora(hora)) err('Rutina', `Hora no válida: "${hora}" (use HH:MM).`);
        if (!(Number.isInteger(min) && min >= 0 && min <= 120)) err('Rutina', `Minutos no válidos para las ${hora}: use de 0 a 120.`);
      });
    }
  }

  return { errores, avisos };
}

// mg de la dosis = (mg de la concentración / cc de la concentración) × cc que se dan
function revisarAritmetica(m, donde, err, conFuente) {
  const ds = m.dosis;
  const c = m.concentracion;
  if (!c) return;
  conFuente(c, donde, 'la concentración');
  if (ds.valor === undefined || ds.cantidad === undefined) {
    err(donde, 'Para revisar la cuenta faltan el valor o los cc de la dosis.');
    return;
  }
  if (c.unidad !== ds.unidad) {
    err(donde, `La dosis está en ${ds.unidad} y la concentración en ${c.unidad}.`);
    return;
  }
  // En gotas: valor de la dosis = (valor ÷ gotas de la concentración) × gotas que se dan.
  if (ds.medida === 'gotas') {
    if (!(c.gotas > 0)) {
      err(donde, 'La dosis va en gotas: la concentración debe decir cuántas gotas ("gotas").');
      return;
    }
    const calculo = (c.valor / c.gotas) * ds.cantidad;
    if (Math.abs(calculo - ds.valor) > Math.max(0.005 * Math.abs(ds.valor), 1e-6)) {
      err(donde,
        `Descuadre: ${numero(c.valor)} ${c.unidad} por ${numero(c.gotas)} gota(s) × ${numero(ds.cantidad)} gotas = ` +
        `${numero(calculo)} ${c.unidad}, pero la dosis dice ${numero(ds.valor)} ${ds.unidad}.`);
    }
    return;
  }
  if (!(c.ml > 0)) {
    err(donde, 'Faltan los cc de la concentración.');
    return;
  }
  const calculo = (c.valor / c.ml) * ds.cantidad;
  const tolerancia = Math.max(0.005 * Math.abs(ds.valor), 1e-6);
  if (Math.abs(calculo - ds.valor) > tolerancia) {
    err(donde,
      `Descuadre: ${numero(c.valor)} ${c.unidad} en ${numero(c.ml)} cc × ${numero(ds.cantidad)} cc = ` +
      `${numero(calculo)} ${c.unidad}, pero la dosis dice ${numero(ds.valor)} ${ds.unidad}.`);
  }
}

// ---------- Agenda ----------

export function diaSemana(fecha) {
  return DIAS[fecha.getDay()];
}

// Horas del día con sus medicamentos, en orden.
export function tomasDelDia(d, fecha) {
  const dia = diaSemana(fecha);
  const porHora = new Map();
  for (const m of d.medicamentos || []) {
    for (const t of m.tomas || []) {
      if (t.dias && !t.dias.includes(dia)) continue;
      if (!porHora.has(t.hora)) porHora.set(t.hora, []);
      porHora.get(t.hora).push(m);
    }
  }
  return [...porHora.entries()]
    .sort(([a], [b]) => minutos(a) - minutos(b))
    .map(([hora, meds]) => ({ hora, meds }));
}

// Qué alistar para una hora: protección y medidas, sin repetir.
export function materiales(meds) {
  const proteccion = new Set();
  const jeringas = new Set();
  let gotas = false;
  let cucharita = false;
  for (const m of meds) {
    if (m.estado !== 'vigente') continue;
    (m.proteccion || []).forEach((p) => proteccion.add(p));
    if (m.medida && m.medida.instrumento === 'jeringa' && m.medida.capacidad) jeringas.add(m.medida.capacidad);
    if (m.medida && m.medida.instrumento === 'cucharita') cucharita = true;
    for (const p of (m.preparacion && m.preparacion.pasos) || []) {
      if (p.medir && p.medir.jeringa) jeringas.add(p.medir.jeringa);
      if (p.jeringa) jeringas.add(p.jeringa);
      if (p.gotas) gotas = true;
    }
  }
  return {
    proteccion: [...proteccion],
    jeringas: [...jeringas].sort((a, b) => a - b),
    gotas,
    cucharita,
  };
}

// Alarmas para crear en el Reloj del teléfono: una para empezar a preparar
// y otra para dar, por cada hora de la semana. Los minutos de preparación
// son de la rutina de quien cuida, no un dato médico.
export function alarmas(d, rutina = {}) {
  const prepDefecto = Number.isFinite(rutina.preparar_min) ? rutina.preparar_min : 20;
  const porHoraPrep = rutina.por_hora || {};
  const horas = new Map();
  for (const m of d.medicamentos || []) {
    for (const t of m.tomas || []) {
      if (!horas.has(t.hora)) horas.set(t.hora, { dias: new Set(), meds: new Set() });
      const h = horas.get(t.hora);
      (t.dias || DIAS).forEach((x) => h.dias.add(x));
      h.meds.add(m.nombre);
    }
  }
  const nombre = (d.paciente && d.paciente.nombre) || 'Paciente';
  const lista = [];
  for (const [hora, info] of horas) {
    const dias = DIAS.filter((x) => info.dias.has(x));
    const prep = Number.isFinite(porHoraPrep[hora]) ? porHoraPrep[hora] : prepDefecto;
    if (prep > 0) {
      lista.push({
        hora: horaDesdeMinutos(minutos(hora) - prep),
        tipo: 'preparar',
        para: hora,
        dias,
        etiqueta: `${nombre} · preparar las de ${horaBonita(hora)}`,
      });
    }
    lista.push({
      hora,
      tipo: 'dar',
      para: hora,
      dias,
      etiqueta: `${nombre} · dar las de ${horaBonita(hora)}`,
      cuantos: info.meds.size,
    });
  }
  return lista.sort((a, b) => minutos(a.hora) - minutos(b.hora) || (a.tipo === 'preparar' ? -1 : 1));
}

export function diasTexto(dias) {
  if (!dias || dias.length === 7) return 'Todos los días';
  return dias.map((x) => DIAS_NOMBRE[x]).join(', ');
}

// Resumen para mostrar después de cargar un archivo.
export function resumen(d) {
  const meds = d.medicamentos || [];
  return {
    paciente: d.paciente ? d.paciente.nombre : '',
    datos_al: d.datos_al,
    total: meds.length,
    vigentes: meds.filter((m) => m.estado === 'vigente').length,
    por_confirmar: meds.filter((m) => m.estado === 'por_confirmar').length,
    ya_no_se_dan: (d.ya_no_se_dan || []).length,
  };
}
