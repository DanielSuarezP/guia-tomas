# Formato del archivo de datos (versión 1)

Un archivo JSON por paciente. El ejemplo completo está en `datos/ejemplo-ficticio.json`.

## Archivo

| Campo | Obligatorio | Qué es |
|---|---|---|
| `formato` | Sí | Siempre `"guia-tomas"` |
| `version` | Sí | `1` |
| `paciente` | Sí | `{ "id": "ejemplo", "nombre": "Paciente de ejemplo" }`. El id va en minúsculas, sin espacios |
| `datos_al` | Sí | Fecha de los datos, `AAAA-MM-DD`. Se ve en la app |
| `aviso` | No | Texto que la app muestra arriba en todas las pantallas |
| `fuentes` | No | Lista de fuentes: `{ "id", "nombre", "fecha" }` |
| `reglas_generales` | No | `{ "texto", "iconos", "fuente" }`. Con `"iconos": ["manos"]` sale en "Antes de empezar"; con `"esperar_min"` sale entre medicamentos de la misma hora |
| `medicamentos` | Sí | Lista de medicamentos (abajo) |
| `ya_no_se_dan` | No | `{ "nombre", "nota", "fuente" }`. Se muestran aparte, nunca en la agenda |

## Medicamento

| Campo | Obligatorio | Valores |
|---|---|---|
| `id` | Sí | Minúsculas y guiones, único |
| `nombre` | Sí | Texto |
| `grupo` | Sí | `antirrechazo`, `antiinfeccioso`, `presion`, `otro` |
| `estado` | Sí | `vigente` o `por_confirmar` |
| `presentacion` | Sí | `{ "tipo": "capsula" \| "tableta" \| "jarabe" \| "gotas" \| "otro", "texto", "fuente" }` |
| `tomas` | Sí si vigente | `[{ "hora": "10:00", "dias": ["lun","mie","vie"] }]`. Sin `dias` = todos los días |
| `tomas_fuente` | Sí | Fuente de las horas (o `fuente` en cada toma) |
| `dosis` | Sí si vigente; prohibida si por confirmar | `{ "texto", "valor", "unidad", "cantidad", "medida", "fuente" }`. Ej.: 15 mg = 1,5 cc → `"valor": 15, "unidad": "mg", "cantidad": 1.5, "medida": "cc"` |
| `concentracion` | No | `{ "valor", "unidad", "ml", "fuente" }`. Si está, la app revisa: valor de la dosis = valor ÷ ml × cantidad |
| `medida` | Sí si vigente | `{ "instrumento": "jeringa", "capacidad": 3, "dibujo_verificado": false, "fuente" }`, o `"cucharita"` / `"gotas"`. Sin `capacidad`, la app muestra la cantidad sin dibujo |
| `proteccion` | No | `["guantes", "tapabocas"]` |
| `comida` | No | `{ "regla": "con_comida" \| "sin_comida" \| "antes_de_comer" \| "indiferente" \| "por_confirmar", "texto", "fuente" }` |
| `preparacion` | Sí si vigente | `{ "tipo", "pasos": [...] }`. Tipos: `abrir_capsula`, `triturar_diluir`, `diluir_tableta`, `medir_liquido`, `contar_gotas`, `perforar_capsula`, `otro` |
| `cuidados` | No | `[{ "texto", "fuente" }]` |
| `dia_examen` | No | `{ "texto", "fuente" }`. Sale cuando se marca "Día del examen" |
| `por_confirmar` | Sí si por confirmar | Lista de lo que falta confirmar con el equipo |
| `origen` | No | `"familia"` cuando la familia lo da distinto de la fórmula. Cualquier otro valor se rechaza |
| `ajuste` | Sí si `origen` es `"familia"` | `{ "texto", "fuente" }`: en qué se aparta de la fórmula. La app lo muestra marcado y como aviso al cargar |

## Paso de preparación

| Campo | Qué hace en la pantalla |
|---|---|
| `texto`, `fuente` | Obligatorios. El texto grande y su fuente |
| `icono` | Dibujo del paso: `abrir_capsula`, `tableta`, `triturar`, `jarabe`, `gotas`, `cucharita`, `copita`, `agua`, `mezclar`, `tragar`, `botar`, `esperar`, `jeringa`, `manos`, `guantes`, `tapabocas` |
| `medir` | `{ "cantidad": 1.5, "jeringa": 3 }`: número grande y jeringa dibujada con la raya |
| `gotas` | `10`: contador de gotas que se tocan |
| `esperar_min` | `3`: reloj de espera |
| `dar` | `true` en el paso de la dosis. Su cantidad debe ser igual a la de `dosis` |

## Rutina (opcional, desde la versión 0.3)

Minutos para empezar a preparar antes de cada hora. Es la rutina de quien cuida, no un dato médico. Al cargar el archivo, el teléfono los usa para las alarmas de "preparar".

```json
"rutina": { "fuente": "Rutina (Daniel, 15 nov)", "preparar_min": { "06:00": 20, "10:00": 30 } }
```

Cada hora va en `HH:MM` y los minutos, de 0 a 120. Con 0 no hay alarma de preparar a esa hora.

## Cambios hechos en el teléfono (`editado`, desde la versión 0.3)

La app los escribe sola al editar o añadir un medicamento; no hace falta escribirlos a mano.

| Campo | Qué es |
|---|---|
| `tipo` | `editado` o `agregado` |
| `fecha` | Día del cambio, `AAAA-MM-DD`. Obligatorio |
| `fuente` | De dónde sale el cambio, escrito por quien lo hizo. Obligatorio. También queda como `fuente` de cada dato que cambió |
| `cuidador` | Quién usa ese teléfono |
| `cambios` | Lista de los campos que cambiaron |
| `antes` | El medicamento como estaba antes del cambio. Con él se deshace |

En `medida`, `"instrumento": "capsula"` sirve para lo que se da como el contenido de una cápsula, sin medir cc.
