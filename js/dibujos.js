// Dibujos simples de la app: íconos y jeringa a escala.
// Todos son SVG hechos a mano, sin internet.

const gota = (x, y, s = 1) =>
  `<path d="M${x} ${y - 9 * s}c0 0-${6 * s} ${6.5 * s}-${6 * s} ${10.5 * s}a${6 * s} ${6 * s} 0 0 0 ${12 * s} 0c0-${4 * s}-${6 * s}-${10.5 * s}-${6 * s}-${10.5 * s}z"/>`;

const mano =
  'M17 26V12.5a2.5 2.5 0 0 1 5 0V23M22 22V9.5a2.5 2.5 0 0 1 5 0V22M27 22.5V11.5a2.5 2.5 0 0 1 5 0V25' +
  'M32 25v-6.5a2.5 2.5 0 0 1 5 0V30c0 7-5 11-11 11h-1c-5 0-8-2.5-10.5-7l-4.5-8a2.6 2.6 0 0 1 4.3-2.8L17 28';

const comidaBase =
  '<path d="M8 8v9a3 3 0 0 0 6 0V8M11 17v23"/><path d="M40 8c-3 2-4.5 7-4.5 12H40v20"/><circle cx="24" cy="25" r="8.5"/>';

const ICONOS = {
  manos: `<path d="${mano}"/>${gota(9, 12, 0.5)}${gota(42, 10, 0.5)}`,
  guantes: `<path d="${mano}"/><rect x="15" y="41" width="20" height="5" rx="1.5"/>`,
  tapabocas:
    '<path d="M11 17c5-3 8.5-4 13-4s8 1 13 4v11c-4 5-8.5 8-13 8s-9-3-13-8z"/><path d="M14 21.5h20M14 26.5h20"/>' +
    '<path d="M11 19c-5 0-6 9 0 10M37 19c5 0 6 9 0 10"/>',
  agua: gota(24, 22, 2),
  capsula: '<g transform="rotate(-35 24 24)"><rect x="9" y="17" width="30" height="14" rx="7"/><path d="M24 17v14"/></g>',
  abrir_capsula:
    '<path d="M21 13h-7a6 6 0 0 0 0 12h7z"/><path d="M27 9h7a6 6 0 0 1 0 12h-7z"/>' +
    '<circle cx="20" cy="35" r="1.6"/><circle cx="25" cy="38" r="1.6"/><circle cx="29" cy="33" r="1.6"/><circle cx="23" cy="41" r="1.6"/>',
  tableta: '<circle cx="24" cy="24" r="14"/><path d="M14 24h20"/>',
  triturar:
    '<path d="M10 15h28v25a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z"/><path d="M10 20h28"/>' +
    '<circle cx="18" cy="33" r="1.6"/><circle cx="24" cy="36" r="1.6"/><circle cx="30" cy="31" r="1.6"/><circle cx="21" cy="28" r="1.6"/><circle cx="28" cy="37" r="1.6"/>' +
    '<path d="M30 4l8 8M34 8l-6 6"/>',
  jarabe: '<path d="M19 5h10v6l4 5v24a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3V16l4-5z"/><path d="M15 23h18v10H15z"/>',
  gotas: `${gota(24, 14, 0.8)}${gota(15, 34, 0.8)}${gota(33, 34, 0.8)}`,
  cucharita: '<ellipse cx="17" cy="16" rx="7" ry="9" transform="rotate(-40 17 16)"/><path d="M22 22l17 18"/>',
  copita: '<path d="M13 13h22l-3 25a3 3 0 0 1-3 3h-10a3 3 0 0 1-3-3z"/><path d="M14.5 24h19"/>',
  jeringa:
    '<path d="M4 24h7"/><rect x="11" y="19" width="22" height="10" rx="1"/><path d="M33 24h8M41 18v12M16 19v4M21 19v4M26 19v4"/>',
  comida: comidaBase,
  sin_comida: `${comidaBase}<path class="tachon" d="M6 42L42 6"/>`,
  antes_de_comer: `${comidaBase}<path d="M24 21v4l3 2"/>`,
  esperar: '<circle cx="24" cy="24" r="16"/><path d="M24 14v10l7 4"/>',
  botar: '<path d="M11 14h26M19 14v-4h10v4M15 14l2 27h14l2-27M21 20v15M27 20v15"/>',
  tragar: '<circle cx="24" cy="24" r="16"/><circle cx="18" cy="20" r="1.6"/><circle cx="30" cy="20" r="1.6"/><path d="M17 29c3.5 4 10.5 4 14 0"/>',
  mezclar: '<path d="M35 17a13 13 0 1 0 2 12"/><path d="M36 9v8h-8"/>',
  examen: '<path d="M19 6h10M20.5 6v29a3.5 3.5 0 0 0 7 0V6"/><path d="M20.5 24h7"/>',
  pregunta: '<circle cx="24" cy="24" r="17"/><path d="M19 19a5 5 0 1 1 7 4.6c-1.3.6-2 1.6-2 3V29"/><circle cx="24" cy="34.5" r="1.3"/>',
  alarma: '<circle cx="24" cy="26" r="14"/><path d="M24 19v7l5 3M9 13l6-5M39 13l-6-5"/>',
  lista: '<path d="M14 10h20v32H14z"/><path d="M20 7h8v6h-8zM19 21h10M19 27h10M19 33h7"/>',
  datos: '<path d="M7 14h12l3 4h19v21H7z"/>',
  casa: '<path d="M8 23L24 9l16 14M12 20v20h24V20"/><path d="M21 40v-9h6v9"/>',
  dado: '<path d="M11 25l8.5 8.5L37 16"/>',
  altavoz: '<path d="M8 19h7l9-7v24l-9-7H8z"/><path d="M30 18a8 8 0 0 1 0 12M34.5 13.5a14 14 0 0 1 0 21"/>',
  atras: '<path d="M29 10L15 24l14 14"/>',
  siguiente: '<path d="M19 10l14 14-14 14"/>',
  persona: '<circle cx="24" cy="16" r="7"/><path d="M10 41c1-8 7-13 14-13s13 5 14 13"/>',
  aviso: '<path d="M24 7L4 41h40z"/><path d="M24 19v11"/><circle cx="24" cy="35" r="1.3"/>',
  subir: '<path d="M24 32V10M15 18l9-9 9 9M9 32v7h30v-7"/>',
  bajar: '<path d="M24 9v22M15 23l9 9 9-9M9 32v7h30v-7"/>',
  reloj_arena: '<path d="M14 7h20M14 41h20M16 7c0 9 16 9 16 17s-16 8-16 17M32 7c0 9-16 9-16 17s16 8 16 17"/>',
  basura: '<path d="M11 14h26M19 14v-4h10v4M15 14l2 27h14l2-27"/>',
};

export function icono(nombre, clase = '') {
  const cuerpo = ICONOS[nombre] || ICONOS.pregunta;
  return `<svg class="ico ${clase}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${cuerpo}</svg>`;
}

export function existeIcono(nombre) {
  return Object.prototype.hasOwnProperty.call(ICONOS, nombre);
}

// Ícono según la presentación del medicamento.
export function iconoPresentacion(tipo) {
  return { capsula: 'capsula', tableta: 'tableta', jarabe: 'jarabe', gotas: 'gotas' }[tipo] || 'jarabe';
}

// Ícono por defecto para un paso, si el dato no trae uno.
export function iconoPaso(paso, med) {
  if (paso.icono && existeIcono(paso.icono)) return paso.icono;
  if (paso.esperar_min) return 'esperar';
  if (paso.gotas) return 'gotas';
  if (paso.medir) return 'jeringa';
  const tipo = med && med.preparacion && med.preparacion.tipo;
  return {
    abrir_capsula: 'abrir_capsula',
    triturar_diluir: 'triturar',
    diluir_tableta: 'tableta',
    medir_liquido: 'jarabe',
    contar_gotas: 'gotas',
    perforar_capsula: 'capsula',
  }[tipo] || 'lista';
}

// ---------- Jeringa a escala ----------
// Las rayas siguen el patrón común de cada tamaño. Hasta compararlo con
// la jeringa real (dibujo_verificado), la app avisa que es aproximado.

const ESCALAS = {
  1: { menor: 0.05, mayor: 0.1, etiqueta: 0.2 },
  3: { menor: 0.1, mayor: 0.5, etiqueta: 0.5 },
  5: { menor: 0.2, mayor: 1, etiqueta: 1 },
  10: { menor: 0.5, mayor: 1, etiqueta: 2 },
  20: { menor: 1, mayor: 5, etiqueta: 5 },
};

const multiplo = (v, paso) => Math.abs(v / paso - Math.round(v / paso)) < 1e-6;
const coma = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',');

export function jeringa({ capacidad, cantidad }) {
  const esc = ESCALAS[capacidad];
  if (!esc) return '';
  const x0 = 46;
  const largo = 266;
  const x1 = x0 + largo;
  const yArriba = 44;
  const yAbajo = 84;
  const frac = Math.max(0, Math.min(1, cantidad / capacidad));
  const xf = x0 + frac * largo;

  let rayas = '';
  let etiquetas = '';
  const n = Math.round(capacidad / esc.menor);
  for (let i = 0; i <= n; i++) {
    const v = i * esc.menor;
    const x = x0 + (v / capacidad) * largo;
    const mayor = multiplo(v, esc.mayor);
    rayas += `<line x1="${x.toFixed(1)}" y1="${yArriba}" x2="${x.toFixed(1)}" y2="${yArriba + (mayor ? 16 : 9)}"/>`;
    if (multiplo(v, esc.etiqueta)) {
      etiquetas += `<text x="${x.toFixed(1)}" y="${yAbajo + 20}" text-anchor="middle">${coma(v)}</text>`;
    }
  }

  return `<svg class="jeringa" viewBox="0 0 360 124" role="img" aria-label="Jeringa de ${coma(capacidad)} cc llena hasta ${coma(cantidad)} cc">
  <line class="j-aguja" x1="6" y1="64" x2="32" y2="64"/>
  <rect class="j-cono" x="32" y="56" width="14" height="16" rx="2"/>
  <rect class="j-liquido" x="${x0}" y="${yArriba + 1}" width="${(xf - x0).toFixed(1)}" height="${yAbajo - yArriba - 2}"/>
  <rect class="j-cuerpo" x="${x0}" y="${yArriba}" width="${largo}" height="${yAbajo - yArriba}" rx="3"/>
  <g class="j-rayas">${rayas}</g>
  <rect class="j-tope" x="${xf.toFixed(1)}" y="${yArriba + 1}" width="7" height="${yAbajo - yArriba - 2}"/>
  <line class="j-vastago" x1="${(xf + 7).toFixed(1)}" y1="64" x2="350" y2="64"/>
  <rect class="j-pulsador" x="346" y="44" width="8" height="40" rx="2"/>
  <rect class="j-aleta" x="${x1}" y="34" width="7" height="60" rx="2"/>
  <g class="j-etiquetas">${etiquetas}</g>
  <path class="j-flecha" d="M${xf.toFixed(1)} 6v28M${(xf - 7).toFixed(1)} 26l7 9 7-9"/>
</svg>`;
}

// Una gota para el contador.
export function gotaContador(llena, indice) {
  return `<button class="gota${llena ? ' llena' : ''}" data-accion="gota" data-i="${indice}" aria-pressed="${llena}" aria-label="Gota ${indice + 1}">
  <svg viewBox="0 0 48 48" aria-hidden="true">${gota(24, 22, 2)}</svg></button>`;
}
