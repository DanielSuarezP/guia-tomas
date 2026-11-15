"""Revisa un archivo de datos de Guía de tomas con las mismas reglas que la app.

Uso en la terminal:
    python3 herramientas/validar.py datos/ejemplo-ficticio.json

Uso en Jupyter:
    from herramientas.validar import validar_archivo
    errores, avisos = validar_archivo("datos/ejemplo.json")
"""
import json
import re
import sys
import unicodedata
from datetime import date

FORMATO = "guia-tomas"
VERSION = 1
GRUPOS = {"antirrechazo", "antiinfeccioso", "presion", "otro"}
ESTADOS = {"vigente", "por_confirmar"}
PRESENTACIONES = {"capsula", "tableta", "jarabe", "gotas", "otro"}
PREPARACIONES = {"abrir_capsula", "triturar_diluir", "diluir_tableta", "medir_liquido",
                 "contar_gotas", "perforar_capsula", "otro"}
COMIDA = {"con_comida", "sin_comida", "antes_de_comer", "indiferente", "por_confirmar"}
PROTECCION = {"guantes", "tapabocas"}
DIAS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"]
JERINGAS = [1, 3, 5, 10, 20]
ID_VALIDO = re.compile(r"^[a-z0-9-]+$")
HORA = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _num(n):
    return f"{round(n, 3):g}".replace(".", ",")


def _normal(t):
    t = unicodedata.normalize("NFD", str(t or "").lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn").strip()


def _es_fecha(t):
    try:
        date.fromisoformat(t)
        return bool(re.match(r"^\d{4}-\d{2}-\d{2}$", t))
    except (TypeError, ValueError):
        return False


def validar(d):
    """Devuelve (errores, avisos): listas de (donde, mensaje)."""
    errores, avisos = [], []

    def err(donde, msg):
        errores.append((donde, msg))

    def av(donde, msg):
        avisos.append((donde, msg))

    def con_fuente(obj, donde, que):
        if not obj or not obj.get("fuente"):
            err(donde, f"Falta la fuente de {que}.")

    if not isinstance(d, dict):
        err("Archivo", "No es un archivo de datos de Guía de tomas.")
        return errores, avisos
    if d.get("formato") != FORMATO:
        err("Archivo", 'El archivo no es de Guía de tomas (falta "formato": "guia-tomas").')
    if d.get("version") != VERSION:
        err("Archivo", f"Versión {d.get('version')} no reconocida; se espera {VERSION}.")
    pac = d.get("paciente") or {}
    if not pac.get("id") or not pac.get("nombre"):
        err("Paciente", "Falta el id o el nombre del paciente.")
    elif not ID_VALIDO.match(pac["id"]):
        err("Paciente", "El id del paciente solo puede tener minúsculas, números y guiones.")
    if not _es_fecha(d.get("datos_al")):
        err("Archivo", 'Falta la fecha de los datos ("datos_al", AAAA-MM-DD).')
    meds = d.get("medicamentos") or []
    if not meds:
        err("Medicamentos", "No hay medicamentos.")

    ids, nombres = set(), set()
    for i, m in enumerate(meds):
        donde = m.get("nombre") or f"Medicamento {i + 1}"
        mid = m.get("id")
        if not mid or not ID_VALIDO.match(mid):
            err(donde, "Falta el id (minúsculas, números y guiones).")
        elif mid in ids:
            err(donde, f'El id "{mid}" está repetido.')
        else:
            ids.add(mid)
        if m.get("nombre"):
            nombres.add(_normal(m["nombre"]))
        else:
            err(donde, "Falta el nombre.")
        if m.get("estado") not in ESTADOS:
            err(donde, 'El estado debe ser "vigente" o "por_confirmar".')
        if m.get("grupo") not in GRUPOS:
            err(donde, "Grupo no reconocido.")
        pres = m.get("presentacion")
        if not pres or pres.get("tipo") not in PRESENTACIONES:
            err(donde, "Falta la presentación.")
        else:
            con_fuente(pres, donde, "la presentación")

        tomas = m.get("tomas") or []
        if m.get("estado") == "vigente" and not tomas:
            err(donde, "Falta al menos una hora de toma.")
        for t in tomas:
            if not HORA.match(str(t.get("hora", ""))):
                err(donde, f'Hora no válida: "{t.get("hora")}" (use HH:MM).')
            if "dias" in t and (not t["dias"] or any(x not in DIAS for x in t["dias"])):
                err(donde, "Días no válidos (use dom, lun, mar, mie, jue, vie, sab).")
        if tomas and not m.get("tomas_fuente") and any(not t.get("fuente") for t in tomas):
            err(donde, "Falta la fuente de las horas.")

        comida = m.get("comida")
        if comida:
            if comida.get("regla") not in COMIDA:
                err(donde, "Regla de comida no reconocida.")
            elif comida["regla"] != "por_confirmar":
                con_fuente(comida, donde, "la regla de comida")
        for p in m.get("proteccion") or []:
            if p not in PROTECCION:
                err(donde, f'Protección no reconocida: "{p}".')
        for c in m.get("cuidados") or []:
            con_fuente(c, donde, "un cuidado")
        if m.get("dia_examen"):
            con_fuente(m["dia_examen"], donde, "la indicación del día del examen")

        prep = m.get("preparacion")
        pasos = (prep or {}).get("pasos") or []
        if prep and prep.get("tipo") not in PREPARACIONES:
            err(donde, "Tipo de preparación no reconocido.")
        for j, p in enumerate(pasos, 1):
            dp = f"{donde}, paso {j}"
            if not p.get("texto"):
                err(dp, "Falta el texto.")
            if not p.get("fuente"):
                err(dp, "Falta la fuente.")
            medir = p.get("medir")
            if medir:
                if not (medir.get("cantidad") or 0) > 0:
                    err(dp, "Cantidad no válida.")
                jer = medir.get("jeringa")
                if jer is not None:
                    if jer not in JERINGAS:
                        err(dp, f"Jeringa de {jer} cc no reconocida.")
                    elif medir.get("cantidad", 0) > jer:
                        err(dp, "La cantidad no cabe en la jeringa.")
            if "gotas" in p and not (isinstance(p["gotas"], int) and p["gotas"] > 0):
                err(dp, "Número de gotas no válido.")
            if "esperar_min" in p and not p["esperar_min"] > 0:
                err(dp, "Minutos de espera no válidos.")

        if "origen" in m and m["origen"] != "familia":
            err(donde, 'Origen no reconocido (use "familia" o quítelo).')
        if m.get("origen") == "familia":
            ajuste = m.get("ajuste")
            texto = ajuste.get("texto") if isinstance(ajuste, dict) else None
            if not texto:
                err(donde, "Es un ajuste de la familia: anote en qué se aparta de la fórmula.")
            else:
                av(donde, f"Ajuste de la familia, distinto de la fórmula: {texto}")

        if m.get("estado") == "por_confirmar":
            if m.get("dosis"):
                err(donde, "Está por confirmar y tiene dosis: quite la dosis hasta que el equipo la confirme.")
            if any(p.get("medir") or p.get("gotas") for p in pasos):
                err(donde, "Está por confirmar y un paso tiene cantidades: quítelas.")
            if not m.get("por_confirmar"):
                err(donde, "Está por confirmar: anote qué falta confirmar con el equipo.")

        if m.get("estado") == "vigente":
            ds = m.get("dosis")
            if not ds:
                err(donde, "Falta la dosis.")
            else:
                con_fuente(ds, donde, "la dosis")
                if not ds.get("texto"):
                    err(donde, "Falta el texto de la dosis.")
                c = m.get("concentracion")
                if c:
                    con_fuente(c, donde, "la concentración")
                    if ds.get("valor") is None or ds.get("cantidad") is None:
                        err(donde, "Para revisar la cuenta faltan el valor o los cc de la dosis.")
                    elif c.get("unidad") != ds.get("unidad"):
                        err(donde, f"La dosis está en {ds.get('unidad')} y la concentración en {c.get('unidad')}.")
                    elif not (c.get("ml") or 0) > 0:
                        err(donde, "Faltan los cc de la concentración.")
                    else:
                        calculo = c["valor"] / c["ml"] * ds["cantidad"]
                        if abs(calculo - ds["valor"]) > max(0.005 * abs(ds["valor"]), 1e-6):
                            err(donde, f"Descuadre: {_num(c['valor'])} {c['unidad']} en {_num(c['ml'])} cc × "
                                       f"{_num(ds['cantidad'])} cc = {_num(calculo)} {c['unidad']}, "
                                       f"pero la dosis dice {_num(ds['valor'])} {ds['unidad']}.")
            if not pasos:
                err(donde, "Faltan los pasos de preparación.")
            medida = m.get("medida") or {}
            if not medida.get("instrumento"):
                err(donde, "Falta con qué se mide la dosis.")
            elif medida["instrumento"] == "jeringa":
                cap = medida.get("capacidad")
                if cap is None:
                    av(donde, "Falta confirmar qué jeringa se usa: la app muestra la cantidad sin dibujo.")
                else:
                    if cap not in JERINGAS:
                        err(donde, f"Jeringa de {cap} cc no reconocida.")
                    con_fuente(medida, donde, "la jeringa")
                    if ds and (ds.get("cantidad") or 0) > cap:
                        err(donde, "La dosis no cabe en la jeringa.")
                    if not medida.get("dibujo_verificado"):
                        av(donde, "Dibujo de la jeringa aproximado: falta compararlo con la jeringa real.")
            dar = next((p for p in pasos if p.get("dar")), None)
            if not dar and pasos:
                av(donde, "Ningún paso está marcado como el de dar la dosis.")
            if dar and ds and ds.get("cantidad") is not None:
                if dar.get("medir") and abs(dar["medir"]["cantidad"] - ds["cantidad"]) > 1e-9:
                    err(donde, f"El paso de dar dice {_num(dar['medir']['cantidad'])} cc y la dosis {_num(ds['cantidad'])} cc.")
                if dar.get("gotas") and dar["gotas"] != ds["cantidad"]:
                    err(donde, f"El paso de dar dice {dar['gotas']} gotas y la dosis {_num(ds['cantidad'])}.")

    for s in d.get("ya_no_se_dan") or []:
        nombre = s.get("nombre")
        if not nombre:
            err("Ya no se dan", "Falta un nombre.")
            continue
        if _normal(nombre) in nombres:
            err(nombre, 'Está a la vez entre los vigentes y en "Ya no se dan".')
        if not s.get("fuente"):
            err(nombre, "Falta la fuente.")

    for i, r in enumerate(d.get("reglas_generales") or [], 1):
        if not r.get("texto"):
            err("Reglas generales", f"La regla {i} no tiene texto.")
        if not r.get("fuente"):
            err("Reglas generales", f"La regla {i} no tiene fuente.")

    return errores, avisos


def validar_archivo(ruta):
    with open(ruta, encoding="utf-8") as f:
        return validar(json.load(f))


def main(argv):
    if len(argv) != 2:
        print("Uso: python3 herramientas/validar.py ARCHIVO.json")
        return 2
    errores, avisos = validar_archivo(argv[1])
    for donde, msg in errores:
        print(f"ERROR  {donde}: {msg}")
    for donde, msg in avisos:
        print(f"AVISO  {donde}: {msg}")
    if errores:
        print(f"\n{len(errores)} error(es): la app no aceptaría este archivo.")
        return 1
    print(f"\nSin errores ({len(avisos)} aviso(s)). La app aceptaría este archivo.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
