// Pruebas de la lógica de datos. Correr con:  node --test pruebas/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validar, tomasDelDia, alarmas, materiales, horaBonita, numero } from '../js/datos.js';

const ejemplo = () => JSON.parse(readFileSync(new URL('../datos/ejemplo-ficticio.json', import.meta.url)));

test('el ejemplo pasa la revisión sin errores', () => {
  const r = validar(ejemplo());
  assert.deepEqual(r.errores, []);
});

test('detecta un descuadre entre dosis y concentración', () => {
  const d = ejemplo();
  d.medicamentos.find((m) => m.id === 'jarabe-ejemplo').dosis.cantidad = 2;
  const r = validar(d);
  assert.ok(r.errores.some((e) => e.msg.startsWith('Descuadre')), JSON.stringify(r.errores));
});

test('un medicamento por confirmar no puede tener dosis', () => {
  const d = ejemplo();
  d.medicamentos.find((m) => m.estado === 'por_confirmar').dosis = { texto: '1 cc', fuente: 'x' };
  assert.ok(validar(d).errores.some((e) => e.msg.includes('por confirmar y tiene dosis')));
});

test('cada dato necesita fuente', () => {
  const d = ejemplo();
  delete d.medicamentos[0].dosis.fuente;
  assert.ok(validar(d).errores.some((e) => e.msg.includes('fuente de la dosis')));
});

test('lo que ya no se da no puede estar entre los vigentes', () => {
  const d = ejemplo();
  d.ya_no_se_dan.push({ nombre: 'Jarabe de ejemplo', fuente: 'x' });
  assert.ok(validar(d).errores.some((e) => e.msg.includes('Ya no se dan')));
});

test('el paso de dar debe coincidir con la dosis', () => {
  const d = ejemplo();
  const m = d.medicamentos.find((x) => x.id === 'gotas-ejemplo');
  m.preparacion.pasos[1].gotas = 12;
  assert.ok(validar(d).errores.some((e) => e.msg.includes('gotas')));
});

test('la cantidad tiene que caber en la jeringa', () => {
  const d = ejemplo();
  d.medicamentos.find((x) => x.id === 'suspension-lmv').preparacion.pasos[1].medir.jeringa = 5;
  assert.ok(validar(d).errores.some((e) => e.msg.includes('no cabe')));
});

test('la suspensión solo aparece lunes, miércoles y viernes', () => {
  const d = ejemplo();
  const lunes = new Date('2026-11-16T12:00:00');
  const martes = new Date('2026-11-17T12:00:00');
  const enHora = (f) => tomasDelDia(d, f).find((h) => h.hora === '10:00').meds.map((m) => m.id);
  assert.ok(enHora(lunes).includes('suspension-lmv'));
  assert.ok(!enHora(martes).includes('suspension-lmv'));
});

test('la agenda sale ordenada por hora', () => {
  const horas = tomasDelDia(ejemplo(), new Date('2026-11-16T12:00:00')).map((h) => h.hora);
  assert.deepEqual(horas, ['08:00', '10:00', '10:30', '19:00', '20:00', '22:00']);
});

test('un ajuste de la familia sale como aviso', () => {
  const r = validar(ejemplo());
  assert.ok(r.avisos.some((a) => a.msg.startsWith('Ajuste de la familia')), JSON.stringify(r.avisos));
});

test('un ajuste de la familia tiene que decir en qué se aparta', () => {
  const d = ejemplo();
  delete d.medicamentos.find((m) => m.origen === 'familia').ajuste.texto;
  assert.ok(validar(d).errores.some((e) => e.msg.includes('ajuste de la familia')));
});

test('un origen distinto de "familia" se rechaza', () => {
  const d = ejemplo();
  d.medicamentos.find((m) => m.origen === 'familia').origen = 'otro';
  assert.ok(validar(d).errores.some((e) => e.msg.startsWith('Origen no reconocido')));
});

test('materiales de una hora sin repetir', () => {
  const d = ejemplo();
  const h = tomasDelDia(d, new Date('2026-11-16T12:00:00')).find((x) => x.hora === '08:00');
  const m = materiales(h.meds);
  assert.deepEqual(m.proteccion.sort(), ['guantes', 'tapabocas']);
  assert.deepEqual(m.jeringas, [3, 5]);
});

test('alarmas: una de preparar y una de dar por hora', () => {
  const lista = alarmas(ejemplo(), { preparar_min: 20 });
  const de10 = lista.filter((a) => a.para === '10:00');
  assert.equal(de10.length, 2);
  assert.equal(de10[0].hora, '09:40');
  assert.equal(de10[0].tipo, 'preparar');
  assert.equal(de10[1].dias.length, 7);
});

test('formatos de hora y número', () => {
  assert.equal(horaBonita('12:00'), '12:00 m');
  assert.equal(horaBonita('14:00'), '2:00 pm');
  assert.equal(horaBonita('06:00'), '6:00 am');
  assert.equal(numero(1.5), '1,5');
});
