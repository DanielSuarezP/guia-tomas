# Guía de tomas

Guía visual para quien prepara y da medicamentos: qué toca ahora, cómo prepararlo paso a paso con dibujos, y registro de lo que se dio. Funciona en cualquier celular o computador con navegador, sin internet una vez instalada. Las alarmas suenan desde el Reloj del teléfono.

Versión 0.3.1 · 19 nov 2026. Permite editar y añadir medicamentos en el teléfono (cada cambio pide su fuente, pasa la misma revisión y se puede deshacer), fijar los minutos para preparar de cada hora y descargar los datos. Usa la jeringa de cada medicamento en todos sus pasos y avisa cuando lo que se mide cae entre dos rayas. Trae también la guía de hora pico y la marca de ajuste de la familia de la 0.2.

## Reglas que el código respeta

- La app no calcula ni decide nada médico. Muestra los datos del archivo tal cual, con su fuente y su fecha.
- Al cargar un archivo, lo revisa: mg de la dosis = concentración × cc, cada dato con fuente, nada "por confirmar" con dosis, nada de "Ya no se dan" entre los vigentes. Si algo falla, no lo usa.
- Lo "por confirmar" aparece con un signo de pregunta y sin dosis.
- Lo que se edita o se añade en el teléfono pide la fuente, queda marcado "Editado en este teléfono" con fecha y quién, guarda el valor anterior y pasa la misma revisión. Si no la pasa, no se guarda.
- La página publicada no lleva datos de pacientes. Cada teléfono carga su archivo, y todo se guarda solo en ese teléfono.

## Probarla en el computador

En la terminal, dentro de esta carpeta:

```
python3 -m http.server 8000
```

Abra http://localhost:8000 en el navegador y toque "Probar con datos de ejemplo".

Para verla en el celular, conectado al mismo wifi: `http://IP-DEL-COMPUTADOR:8000`. Así abre, pero no se instala para usar sin internet: eso necesita HTTPS, y se hace al publicarla en GitHub Pages.

## Revisar un archivo de datos

```
python3 herramientas/validar.py datos/ejemplo-ficticio.json
```

En Jupyter:

```python
from herramientas.validar import validar_archivo
errores, avisos = validar_archivo("datos/ejemplo-ficticio.json")
```

## Pruebas

```
npm test
```

(o `node --test pruebas/`). Necesita Node.js 20 o más nuevo.

La revisión en Python tiene sus propias pruebas:

```
python3 -m unittest discover pruebas
```

## Carpetas

| Carpeta o archivo | Qué hay |
|---|---|
| `index.html`, `css/`, `js/` | La app. Sin herramientas de compilación: se edita y se recarga. |
| `js/datos.js` | Categorías, revisión de archivos, agenda y alarmas. |
| `js/edicion.js` | Editar y añadir medicamentos: fuente de cada cambio, valor anterior y revisión. |
| `js/dibujos.js` | Íconos y jeringa a escala, en SVG. |
| `js/almacen.js` | Lo que se guarda en el teléfono: pacientes, dados, días de examen, rutina. |
| `sw.js`, `manifest.webmanifest` | Instalación y uso sin internet. Al cambiar un archivo, suba la VERSION de `sw.js`. |
| `datos/ejemplo-ficticio.json` | Datos inventados para probar. Los datos reales no van aquí. |
| `docs/formato-datos.md` | Cómo se escribe un archivo de datos. |
| `herramientas/validar.py` | La misma revisión de la app, en Python. |
| `pruebas/` | Pruebas de la lógica, en JavaScript y en Python. |
