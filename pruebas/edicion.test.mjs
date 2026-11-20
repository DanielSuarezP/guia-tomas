// Pruebas de la edición en el teléfono (versión 0.3). Correr con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validar } from '../js/datos.js';
import {
  guardarMed, deshacer, medVacio, nuevoId, leerNumero, limpiar, ultimoCambio, copiaParaDescargar, fijarRuta,
} from '../js/edicion.js';

const ejemplo = () => JSON.parse(readFileSync(new URL('../datos/ejemplo-ficticio.json', import.meta.url)));
const sinEditado = (m) => { const { editado, ...r } = JSON.parse(JSON.stringify(m)); return r; };
const opciones = { fuente: 'Hoja del equipo, 20 nov', cuidador: 'Daniel', fecha: '2026-11-20' };

test('números con coma y vacíos', () => {
  assert.equal(leerNumero('1,5'), 1.5);
  assert.equal(leerNumero(' 7 '), 7);
  assert.equal(leerNumero(''), undefined);
  assert.equal(leerNumero('abc'), undefined);
});

test('id nuevo a partir del nombre, sin repetir', () => {
  assert.equal(nuevoId('Ácido Fólico', new Set()), 'acido-folico');
  assert.equal(nuevoId('Ácido fólico', new Set(['acido-folico'])), 'acido-folico-2');
  assert.equal(nuevoId('', new Set()), 'medicamento');
});

test('sin fuente no se guarda', () => {
  const d = ejemplo();
  const b = sinEditado(d.medicamentos[2]);
  b.dosis.texto = 'otro';
  assert.match(guardarMed(d, b.id, b, { fuente: '  ' }).error, /de dónde sale/);
});

test('sin cambios no se guarda', () => {
  const d = ejemplo();
  const b = sinEditado(d.medicamentos[2]);
  assert.match(guardarMed(d, b.id, b, opciones).error, /No hay cambios/);
});

test('editar la dosis: solo la dosis toma la fuente nueva y queda el valor anterior', () => {
  const d = ejemplo();
  const id = 'jarabe-ejemplo';
  const b = sinEditado(d.medicamentos.find((m) => m.id === id));
  b.dosis = { ...b.dosis, texto: '20 mg (2 cc)', valor: 20, cantidad: 2 };
  b.preparacion.pasos[1].medir.cantidad = 2;
  b.preparacion.pasos[1].texto = 'Mida 2 cc con la jeringa de 3.';
  const r = guardarMed(d, id, b, opciones);
  assert.deepEqual(r.resultado.errores, []);
  const m = r.datos.medicamentos.find((x) => x.id === id);
  assert.equal(m.dosis.fuente, opciones.fuente);
  assert.equal(m.presentacion.fuente, 'Ejemplo');
  assert.equal(m.tomas_fuente, 'Ejemplo');
  assert.equal(m.preparacion.pasos[0].fuente, 'Ejemplo');
  assert.equal(m.preparacion.pasos[1].fuente, opciones.fuente);
  assert.deepEqual(m.editado.cambios.sort(), ['dosis', 'preparacion']);
  assert.equal(m.editado.antes.dosis.valor, 15);
  assert.equal(m.editado.cuidador, 'Daniel');
  // Los datos originales no se tocan.
  assert.equal(d.medicamentos.find((x) => x.id === id).dosis.valor, 15);
});

test('una dosis que no cuadra con la concentración no pasa la revisión', () => {
  const d = ejemplo();
  const id = 'jarabe-ejemplo';
  const b = sinEditado(d.medicamentos.find((m) => m.id === id));
  b.dosis.valor = 20; // 50 mg / 5 cc × 1,5 cc = 15 mg
  const r = guardarMed(d, id, b, opciones);
  assert.ok(r.resultado.errores.some((e) => e.msg.startsWith('Descuadre')), JSON.stringify(r.resultado.errores));
});

test('pasar a "por confirmar" quita la dosis y las cantidades', () => {
  const d = ejemplo();
  const id = 'jarabe-ejemplo';
  const b = sinEditado(d.medicamentos.find((m) => m.id === id));
  b.estado = 'por_confirmar';
  b.por_confirmar = ['Concentración del frasco nuevo'];
  const r = guardarMed(d, id, b, opciones);
  assert.deepEqual(r.resultado.errores, []);
  const m = r.datos.medicamentos.find((x) => x.id === id);
  assert.equal(m.dosis, undefined);
  assert.equal(m.concentracion, undefined);
  assert.ok(m.preparacion.pasos.every((p) => !p.medir && !p.gotas && !p.dar));
});

test('mover un paso de lugar conserva su fuente', () => {
  const d = ejemplo();
  const id = 'tableta-ejemplo';
  const b = sinEditado(d.medicamentos.find((m) => m.id === id));
  const pasos = b.preparacion.pasos;
  [pasos[3], pasos[4]] = [pasos[4], pasos[3]];
  const r = guardarMed(d, id, b, opciones);
  const m = r.datos.medicamentos.find((x) => x.id === id);
  assert.ok(m.preparacion.pasos.every((p) => p.fuente === 'Ejemplo'));
  assert.deepEqual(m.editado.cambios, ['preparacion']);
});

test('cambiar las horas pone la fuente nueva en las horas', () => {
  const d = ejemplo();
  const id = 'jarabe-ejemplo';
  const b = sinEditado(d.medicamentos.find((m) => m.id === id));
  b.tomas = [{ hora: '09:00', dias: ['lun', 'mie', 'vie'] }];
  const r = guardarMed(d, id, b, opciones);
  assert.deepEqual(r.resultado.errores, []);
  const m = r.datos.medicamentos.find((x) => x.id === id);
  assert.equal(m.tomas_fuente, opciones.fuente);
  assert.deepEqual(m.editado.cambios, ['tomas']);
});

test('un día sin marcar no pasa la revisión', () => {
  const d = ejemplo();
  const id = 'jarabe-ejemplo';
  const b = sinEditado(d.medicamentos.find((m) => m.id === id));
  b.tomas = [{ hora: '09:00', dias: [] }];
  const r = guardarMed(d, id, b, opciones);
  assert.ok(r.resultado.errores.some((e) => e.msg.includes('Días no válidos')));
});

test('añadir un medicamento nuevo con todos sus datos', () => {
  const d = ejemplo();
  const b = medVacio();
  b.nombre = 'Jarabe nuevo';
  b.presentacion = { tipo: 'jarabe', texto: 'Jarabe de 10 mg por mL' };
  b.tomas = [{ hora: '09:00' }];
  b.dosis = { texto: '5 mg (0,5 cc)', valor: 5, unidad: 'mg', cantidad: 0.5, medida: 'cc' };
  b.concentracion = { valor: 10, unidad: 'mg', ml: 1 };
  b.medida = { instrumento: 'jeringa', capacidad: 1 };
  fijarRuta(b, 'preparacion.tipo', 'medir_liquido');
  b.preparacion.pasos = [{ texto: 'Mida 0,5 cc.', medir: { cantidad: 0.5, jeringa: 1 }, dar: true }, { texto: '', icono: '' }];
  const r = guardarMed(d, null, b, opciones);
  assert.deepEqual(r.resultado.errores, []);
  assert.equal(r.med.id, 'jarabe-nuevo');
  assert.equal(r.med.editado.tipo, 'agregado');
  assert.equal(r.med.preparacion.pasos.length, 1, 'el paso vacío se quita');
  for (const bloque of ['presentacion', 'dosis', 'concentracion', 'medida']) assert.equal(r.med[bloque].fuente, opciones.fuente);
  assert.equal(r.med.tomas_fuente, opciones.fuente);
  assert.equal(r.med.medida.dibujo_verificado, false);
  assert.equal(r.datos.medicamentos.length, d.medicamentos.length + 1);
  assert.equal(ultimoCambio(r.datos), '2026-11-20');
});

test('un medicamento nuevo sin dosis no pasa la revisión', () => {
  const d = ejemplo();
  const b = medVacio();
  b.nombre = 'Incompleto';
  b.presentacion.texto = 'Tableta';
  b.preparacion.pasos = [{ texto: 'Dárselo.' }];
  const r = guardarMed(d, null, b, opciones);
  assert.ok(r.resultado.errores.some((e) => e.msg === 'Falta la dosis.'));
});

test('deshacer vuelve al valor anterior, y quita lo agregado', () => {
  const d = ejemplo();
  const id = 'jarabe-ejemplo';
  const b = sinEditado(d.medicamentos.find((m) => m.id === id));
  b.nombre = 'Jarabe renombrado';
  const r1 = guardarMed(d, id, b, opciones);
  const r2 = deshacer(r1.datos, id);
  assert.deepEqual(r2.resultado.errores, []);
  assert.deepEqual(r2.datos.medicamentos.find((m) => m.id === id), d.medicamentos.find((m) => m.id === id));

  const n = medVacio();
  Object.assign(n, { nombre: 'Gotas nuevas', presentacion: { tipo: 'gotas', texto: 'Gotas' }, dosis: { texto: '3 gotas', cantidad: 3, medida: 'gotas' }, medida: { instrumento: 'cucharita' } });
  n.preparacion = { tipo: 'contar_gotas', pasos: [{ texto: 'Cuente 3 gotas.', gotas: 3, dar: true }] };
  const r3 = guardarMed(d, null, n, opciones);
  assert.deepEqual(r3.resultado.errores, []);
  const r4 = deshacer(r3.datos, r3.med.id);
  assert.equal(r4.datos.medicamentos.length, d.medicamentos.length);
  assert.equal(deshacer(d, id), null, 'sin cambios no hay nada que deshacer');
});

test('dos cambios seguidos se deshacen uno por uno', () => {
  const d = ejemplo();
  const id = 'jarabe-ejemplo';
  const b1 = sinEditado(d.medicamentos.find((m) => m.id === id));
  b1.nombre = 'Primero';
  const r1 = guardarMed(d, id, b1, opciones);
  const b2 = sinEditado(r1.datos.medicamentos.find((m) => m.id === id));
  b2.nombre = 'Segundo';
  const r2 = guardarMed(r1.datos, id, b2, { ...opciones, fecha: '2026-11-21' });
  assert.equal(deshacer(r2.datos, id).datos.medicamentos.find((m) => m.id === id).nombre, 'Primero');
});

test('la revisión pide fuente y fecha en un cambio del teléfono', () => {
  const d = ejemplo();
  d.medicamentos[0].editado = { tipo: 'editado', fecha: '2026-11-20' };
  assert.ok(validar(d).errores.some((e) => e.msg.includes('no tiene fuente o fecha')));
});

test('la rutina del archivo se revisa', () => {
  const d = ejemplo();
  d.rutina = { preparar_min: { '06:00': 20, '10:00': 30 } };
  assert.deepEqual(validar(d).errores, []);
  d.rutina.preparar_min['25:00'] = 10;
  d.rutina.preparar_min['07:00'] = 500;
  const msgs = validar(d).errores.map((e) => e.msg).join(' | ');
  assert.match(msgs, /Hora no válida: "25:00"/);
  assert.match(msgs, /Minutos no válidos para las 07:00/);
});

test('la copia descargada se puede volver a cargar', () => {
  const d = ejemplo();
  const copia = copiaParaDescargar(d, { preparar_min: 20, por_hora: { '10:00': 30, '08:00': 'x' } }, [{ med: 'a' }], new Date('2026-11-20T12:00:00Z'));
  assert.deepEqual(copia.rutina.preparar_min, { '10:00': 30 });
  assert.equal(copia.registro_dados.length, 1);
  assert.deepEqual(validar(JSON.parse(JSON.stringify(copia))).errores, []);
});

test('limpiar quita lo vacío y deja todos los días sin lista', () => {
  const m = limpiar({ nombre: ' X ', tomas: [{ hora: '08:00', dias: ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'] }, { hora: '' }], comida: { regla: '', texto: '' }, medida: { instrumento: 'jeringa', capacidad: undefined } });
  assert.equal(m.nombre, 'X');
  assert.deepEqual(m.tomas, [{ hora: '08:00' }]);
  assert.equal(m.comida, undefined);
  assert.deepEqual(m.medida, { instrumento: 'jeringa' });
});

test('el texto del paso debe nombrar la misma cantidad que se mide', () => {
  const d = ejemplo();
  const id = 'jarabe-ejemplo';
  const b = sinEditado(d.medicamentos.find((m) => m.id === id));
  b.dosis = { ...b.dosis, texto: '20 mg (2 cc)', valor: 20, cantidad: 2 };
  b.preparacion.pasos[1].medir.cantidad = 2; // el texto sigue diciendo 1,5 cc
  const r = guardarMed(d, id, b, opciones);
  assert.ok(r.resultado.errores.some((e) => e.msg.startsWith('El texto dice 1,5 cc')), JSON.stringify(r.resultado.errores));
});
