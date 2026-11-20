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
from herramientas.validar import validar, cae_en_raya, rayas_vecinas  # noqa: E402

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



class Jeringas(unittest.TestCase):
    """Las mismas reglas que pruebas/jeringas.test.mjs."""

    def test_rayas(self):
        self.assertTrue(cae_en_raya(0.3, 3))
        self.assertTrue(cae_en_raya(7, 10))
        self.assertFalse(cae_en_raya(6.5, 10))
        self.assertFalse(cae_en_raya(2.5, 5))
        self.assertIsNone(cae_en_raya(5, 20))
        self.assertEqual(rayas_vecinas(6.5, 10), (6.4, 6.6))

    def test_aviso_entre_rayas(self):
        avisos = mensajes(validar(ejemplo())[1])
        self.assertTrue(any("2,5 cc no cae en una raya de la jeringa de 5" in a and "entre 2,4 y 2,6" in a
                            for a in avisos), avisos)
        self.assertFalse(any("1,5 cc no cae en una raya de la jeringa de 3" in a for a in avisos))

    def test_paso_sin_jeringa_usa_la_del_medicamento(self):
        d = ejemplo()
        m = med(d, id="jarabe-ejemplo")
        m["preparacion"]["pasos"].insert(0, {"texto": "Agregue 5 cc de agua.", "medir": {"cantidad": 5},
                                             "fuente": "Ejemplo"})
        errores, avisos = validar(d)
        self.assertEqual(errores, [])
        self.assertIn("5 cc no caben en la jeringa de 3.", mensajes(avisos))

    def test_dosis_en_gotas(self):
        d = ejemplo()
        m = med(d, id="gotas-d-ejemplo")
        m["dosis"].update(valor=4000, unidad="UI")
        m["concentracion"] = {"valor": 200, "unidad": "UI", "gotas": 1, "fuente": "Ejemplo"}
        self.assertEqual(validar(d)[0], [])
        m["concentracion"]["valor"] = 100
        self.assertTrue(any(x.startswith("Descuadre: 100 UI por 1 gota(s) × 20 gotas = 2000 UI")
                            for x in mensajes(validar(d)[0])))
        m["medida"] = {"instrumento": "jeringa", "capacidad": 3, "fuente": "Ejemplo"}
        m["concentracion"]["valor"] = 200
        self.assertEqual(validar(d)[0], [])

    def test_jeringa_de_un_paso(self):
        d = ejemplo()
        med(d, id="gotas-ejemplo")["preparacion"]["pasos"][0]["jeringa"] = 7
        self.assertIn("Jeringa de 7 cc no reconocida.", mensajes(validar(d)[0]))


if __name__ == "__main__":
    unittest.main()
