// Pruebas del aviso de rayas y de la cuenta en gotas. Correr con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validar, caeEnRaya, rayasVecinas, jeringaDelPaso, materiales } from '../js/datos.js';

const ejemplo = () => JSON.parse(readFileSync(new URL('../datos/ejemplo-ficticio.json', import.meta.url)));
const med = (d, id) => d.medicamentos.find((m) => m.id === id);
const avisos = (d) => validar(d).avisos.map((a) => `${a.donde}: ${a.msg}`);

test('rayas de las jeringas de la casa', () => {
  assert.equal(caeEnRaya(0.3, 3), true);
  assert.equal(caeEnRaya(7, 10), true);
  assert.equal(caeEnRaya(6, 10), true);
  assert.equal(caeEnRaya(0.3, 1), true);
  assert.equal(caeEnRaya(6.5, 10), false);
  assert.equal(caeEnRaya(2.5, 5), false);
  assert.equal(caeEnRaya(1.5, 5), false);
  assert.equal(caeEnRaya(1.5, 3), true);
  assert.equal(caeEnRaya(5, 20), null); // la de 20 no está en casa
  assert.deepEqual(rayasVecinas(6.5, 10), [6.4, 6.6]);
  assert.deepEqual(rayasVecinas(1.5, 5), [1.4, 1.6]);
});

test('avisa cuando lo que se mide cae entre dos rayas', () => {
  const r = avisos(ejemplo());
  assert.ok(r.some((a) => a.includes('2,5 cc no cae en una raya de la jeringa de 5') && a.includes('entre 2,4 y 2,6')), r.join('\n'));
  assert.ok(r.some((a) => a.includes('7,5 cc no cae en una raya de la jeringa de 10')), r.join('\n'));
  assert.ok(!r.some((a) => a.includes('1,5 cc no cae en una raya de la jeringa de 3')));
});

test('un paso sin jeringa usa la del medicamento', () => {
  const d = ejemplo();
  const m = med(d, 'tableta-ejemplo');
  m.preparacion.pasos.forEach((p) => { if (p.medir) delete p.medir.jeringa; });
  assert.equal(jeringaDelPaso(m, m.preparacion.pasos.find((p) => p.medir)), 5);
  assert.ok(avisos(d).some((a) => a.includes('2,5 cc no cae en una raya de la jeringa de 5')));
});

test('avisa cuando lo que se mide no cabe en la jeringa del medicamento', () => {
  const d = ejemplo();
  const m = med(d, 'jarabe-ejemplo');
  m.preparacion.pasos.unshift({ texto: 'Agregue 5 cc de agua.', medir: { cantidad: 5 }, fuente: 'Ejemplo' });
  const r = validar(d);
  assert.deepEqual(r.errores, []);
  assert.ok(r.avisos.some((a) => a.msg === '5 cc no caben en la jeringa de 3.'), JSON.stringify(r.avisos));
});

test('dosis en gotas: la cuenta se revisa con las UI por gota', () => {
  const d = ejemplo();
  const m = med(d, 'gotas-d-ejemplo');
  Object.assign(m.dosis, { valor: 4000, unidad: 'UI' });
  m.concentracion = { valor: 200, unidad: 'UI', gotas: 1, fuente: 'Ejemplo' };
  assert.deepEqual(validar(d).errores, []);
  m.concentracion.valor = 100;
  assert.ok(validar(d).errores.some((e) => e.msg.startsWith('Descuadre: 100 UI por 1 gota(s) × 20 gotas = 2000 UI')));
  delete m.concentracion.gotas;
  assert.ok(validar(d).errores.some((e) => e.msg.includes('cuántas gotas')));
});

test('una dosis en gotas no se compara con los cc de la jeringa', () => {
  const d = ejemplo();
  const m = med(d, 'gotas-d-ejemplo');
  m.medida = { instrumento: 'jeringa', capacidad: 3, fuente: 'Ejemplo' };
  assert.ok(!validar(d).errores.some((e) => e.msg.includes('no cabe')));
});

test('un paso puede nombrar la jeringa que se usa sin medir', () => {
  const d = ejemplo();
  const m = med(d, 'gotas-ejemplo');
  m.preparacion.pasos[0].jeringa = 3;
  assert.deepEqual(validar(d).errores, []);
  assert.deepEqual(materiales([m]).jeringas, [3]);
  m.preparacion.pasos[0].jeringa = 7;
  assert.ok(validar(d).errores.some((e) => e.msg.includes('Jeringa de 7 cc no reconocida')));
});
