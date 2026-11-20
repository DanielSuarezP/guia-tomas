"""Pruebas de la revisión en Python (herramientas/validar.py).

Correr, dentro de la carpeta de la app:
    python3 -m unittest discover pruebas
Deben dar los mismos resultados que la revisión de la app (pruebas/datos.test.mjs).
"""
import copy
import json
import sys
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
from herramientas.validar import validar  # noqa: E402

EJEMPLO = json.loads((RAIZ / "datos" / "ejemplo-ficticio.json").read_text(encoding="utf-8"))


def ejemplo():
    return copy.deepcopy(EJEMPLO)


def mensajes(lista):
    return [msg for _, msg in lista]


def med(d, **filtro):
    return next(m for m in d["medicamentos"] if all(m.get(k) == v for k, v in filtro.items()))


class Revision(unittest.TestCase):
    def test_el_ejemplo_pasa_sin_errores(self):
        errores, _ = validar(ejemplo())
        self.assertEqual(errores, [])

    def test_detecta_descuadre(self):
        d = ejemplo()
        med(d, id="jarabe-ejemplo")["dosis"]["cantidad"] = 2
        errores, _ = validar(d)
        self.assertTrue(any(m.startswith("Descuadre") for m in mensajes(errores)), errores)

    def test_por_confirmar_sin_dosis(self):
        d = ejemplo()
        med(d, estado="por_confirmar")["dosis"] = {"texto": "1 cc", "fuente": "x"}
        errores, _ = validar(d)
        self.assertTrue(any("por confirmar y tiene dosis" in m for m in mensajes(errores)))

    def test_ajuste_de_la_familia_sale_como_aviso(self):
        _, avisos = validar(ejemplo())
        self.assertTrue(any(m.startswith("Ajuste de la familia") for m in mensajes(avisos)), avisos)

    def test_ajuste_de_la_familia_necesita_texto(self):
        d = ejemplo()
        del med(d, origen="familia")["ajuste"]["texto"]
        errores, _ = validar(d)
        self.assertTrue(any("ajuste de la familia" in m for m in mensajes(errores)))

    def test_origen_desconocido(self):
        d = ejemplo()
        med(d, origen="familia")["origen"] = "otro"
        errores, _ = validar(d)
        self.assertTrue(any(m.startswith("Origen no reconocido") for m in mensajes(errores)))

    def test_cambio_del_telefono_necesita_fuente_y_fecha(self):
        d = ejemplo()
        d["medicamentos"][0]["editado"] = {"tipo": "editado", "fecha": "2026-11-20", "fuente": "Hoja"}
        errores, _ = validar(d)
        self.assertEqual(errores, [])
        del d["medicamentos"][0]["editado"]["fuente"]
        errores, _ = validar(d)
        self.assertTrue(any("no tiene fuente o fecha" in m for m in mensajes(errores)))

    def test_rutina_se_revisa(self):
        d = ejemplo()
        d["rutina"] = {"preparar_min": {"06:00": 20}}
        self.assertEqual(validar(d)[0], [])
        d["rutina"]["preparar_min"]["25:00"] = 10
        d["rutina"]["preparar_min"]["07:00"] = 500
        msgs = " | ".join(mensajes(validar(d)[0]))
        self.assertIn('Hora no válida: "25:00"', msgs)
        self.assertIn("Minutos no válidos para las 07:00", msgs)


if __name__ == "__main__":
    unittest.main()
