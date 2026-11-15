// Guarda todo en este teléfono (localStorage). Nada sale del teléfono.
// Si el navegador no deja guardar, usa la memoria mientras la página está abierta.

const P = 'guia-tomas:';
const memoria = new Map();

function leer(clave, porDefecto) {
  try {
    const v = localStorage.getItem(P + clave);
    return v === null ? porDefecto : JSON.parse(v);
  } catch {
    return memoria.has(clave) ? memoria.get(clave) : porDefecto;
  }
}

function escribir(clave, valor) {
  try {
    localStorage.setItem(P + clave, JSON.stringify(valor));
    return true;
  } catch {
    memoria.set(clave, valor);
    return false;
  }
}

function borrar(clave) {
  try { localStorage.removeItem(P + clave); } catch { /* sin almacenamiento */ }
  memoria.delete(clave);
}

export const almacen = {
  // Pacientes
  pacientes() {
    return leer('pacientes', []);
  },
  datos(id) {
    return id ? leer('datos:' + id, null) : null;
  },
  guardarDatos(datos) {
    const id = datos.paciente.id;
    escribir('datos:' + id, datos);
    const lista = this.pacientes().filter((p) => p.id !== id);
    lista.push({ id, nombre: datos.paciente.nombre, datos_al: datos.datos_al, cargado: new Date().toISOString() });
    escribir('pacientes', lista);
    if (!this.activo()) this.fijarActivo(id);
    return id;
  },
  borrarPaciente(id) {
    borrar('datos:' + id);
    borrar('registro:' + id);
    borrar('examen:' + id);
    borrar('rutina:' + id);
    escribir('pacientes', this.pacientes().filter((p) => p.id !== id));
    if (this.activo() === id) {
      const otro = this.pacientes()[0];
      this.fijarActivo(otro ? otro.id : null);
    }
  },
  activo() {
    return leer('activo', null);
  },
  fijarActivo(id) {
    escribir('activo', id);
  },

  // Quién usa este teléfono
  cuidador() {
    return leer('cuidador', '');
  },
  fijarCuidador(nombre) {
    escribir('cuidador', String(nombre || '').trim());
  },

  // Registro de "dado"
  registro(id) {
    return leer('registro:' + id, []);
  },
  dado(id, med, fecha, hora) {
    return this.registro(id).find((r) => r.med === med && r.fecha === fecha && r.hora === hora) || null;
  },
  marcarDado(id, med, fecha, hora) {
    const reg = this.registro(id).filter((r) => !(r.med === med && r.fecha === fecha && r.hora === hora));
    const entrada = { med, fecha, hora, marcado: new Date().toISOString(), cuidador: this.cuidador() };
    reg.push(entrada);
    escribir('registro:' + id, reg);
    return entrada;
  },
  desmarcar(id, med, fecha, hora) {
    escribir('registro:' + id, this.registro(id).filter((r) => !(r.med === med && r.fecha === fecha && r.hora === hora)));
  },

  // Días de examen de sangre
  diasExamen(id) {
    return leer('examen:' + id, []);
  },
  esDiaExamen(id, fecha) {
    return this.diasExamen(id).includes(fecha);
  },
  alternarExamen(id, fecha) {
    const dias = this.diasExamen(id);
    escribir('examen:' + id, dias.includes(fecha) ? dias.filter((x) => x !== fecha) : [...dias, fecha]);
  },

  // Rutina de quien cuida: minutos para empezar a preparar
  rutina(id) {
    return leer('rutina:' + id, { preparar_min: 20, por_hora: {} });
  },
  fijarRutina(id, rutina) {
    escribir('rutina:' + id, rutina);
  },
};
