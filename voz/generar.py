"""CLI del estudio de voz (la usa producir.py).

    python voz/generar.py --guion episodios/<ep>/guion.md --salida episodios/<ep>/

Genera voz.wav y tiempos.json. Si el guion, la referencia y los ajustes no cambiaron desde la
última vez (hash en .hash_voz), no hace nada salvo que se pase --forzar.
Los ajustes salen del config.json del episodio (semilla y bloque opcional "voz").

Si en la carpeta del episodio hay un voz_externa.* (p. ej. un MP3 de ElevenLabs), no se usa
Chatterbox: ese audio pasa a ser voz.wav y Whisper lo alinea con el guion para sacar tiempos.json.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import fields
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from nucleo import (  # noqa: E402
    REFERENCIA,
    Ajustes,
    ajustes_de_episodio,
    buscar_voz_externa,
    guardar,
    huella,
    huella_externa,
    importar_voz,
    producir_voz,
)


def main() -> int:
    p = argparse.ArgumentParser(description="Voz del canal: guion.md → voz.wav + tiempos.json")
    p.add_argument("--guion", required=True, type=Path)
    p.add_argument("--salida", required=True, type=Path)
    p.add_argument("--referencia", type=Path, default=REFERENCIA, help="audio de referencia de la voz")
    p.add_argument("--forzar", action="store_true", help="regenerar aunque nada haya cambiado")
    # Cualquier ajuste se puede sobrescribir: --cfg 0.35 --exageracion 0.6 …
    for campo in fields(Ajustes):
        p.add_argument(f"--{campo.name.replace('_', '-')}", type=type(campo.default), default=None)
    args = p.parse_args()

    if not args.guion.exists():
        print(f"No existe el guion: {args.guion}", file=sys.stderr)
        return 1
    ajustes = ajustes_de_episodio(args.guion.parent)
    for campo in fields(Ajustes):
        valor = getattr(args, campo.name)
        if valor is not None:
            setattr(ajustes, campo.name, valor)

    texto = args.guion.read_text(encoding="utf-8")
    # Si el episodio trae una voz externa (voz_externa.*), se usa esa y no se genera con Chatterbox
    externa = buscar_voz_externa(args.salida)
    huella_actual = huella_externa(texto, externa, ajustes) if externa else huella(texto, ajustes, args.referencia)
    archivo_huella = args.salida / ".hash_voz"
    salidas = [args.salida / "voz.wav", args.salida / "tiempos.json"]
    if (
        not args.forzar
        and archivo_huella.exists()
        and archivo_huella.read_text(encoding="utf-8").strip() == huella_actual
        and all(s.exists() for s in salidas)
    ):
        print("Voz sin cambios: se reutilizan voz.wav y tiempos.json (usa --forzar para regenerar).")
        return 0

    inicio = time.time()
    if externa:
        print(f"Voz externa: {externa} (no se usa Chatterbox; solo se alinea con el guion) …")
        resultado = importar_voz(texto, externa, ajustes)
    else:
        print(f"Generando voz de {args.guion} …")
        resultado = producir_voz(texto, ajustes, args.referencia)
    guardar(resultado, args.salida, huella_actual)
    resumen = {**resultado["resumen"], "tiempo_total_s": round(time.time() - inicio, 1)}
    print(json.dumps(resumen, ensure_ascii=False, indent=2))
    print(f"Listo: {salidas[0]} y {salidas[1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
