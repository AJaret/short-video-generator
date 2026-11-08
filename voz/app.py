"""Interfaz web local para probar la voz del canal.

    docker compose up -d voz     →  http://localhost:7860

- "Probar frase": genera solo una frase con los ajustes elegidos (rápido, para afinar el tono).
- "Generar episodio": produce voz.wav + tiempos.json del episodio, igual que generar.py.
  Para respetar la VRAM, la voz se descarga de la GPU antes de cargar Whisper.
  Si el episodio tiene voz externa (voz_externa.*, p. ej. ElevenLabs), no se usa Chatterbox: como en
  generar.py, ese audio se alinea con el guion. Para volver a Chatterbox, borra voz_externa.*.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import gradio as gr
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from nucleo import (  # noqa: E402
    RAIZ,
    REFERENCIA,
    Ajustes,
    Voz,
    ajustes_de_episodio,
    buscar_voz_externa,
    guardar,
    huella,
    huella_externa,
    importar_voz,
    liberar_gpu,
    producir_voz,
)

EPISODIOS = RAIZ / "episodios"
_voz: Voz | None = None


def _cargar_voz() -> Voz:
    global _voz
    if _voz is None:
        _voz = Voz(REFERENCIA)
    return _voz


def _soltar_voz() -> None:
    """Descarga Chatterbox de la GPU y olvida el objeto.

    producir_voz() cierra la voz que recibe (Voz.cerrar borra el modelo), aunque falle a medias: si
    _voz siguiera apuntando a ese objeto, la siguiente frase fallaría con un modelo que ya no existe.
    """
    global _voz
    if _voz is not None and hasattr(_voz, "modelo"):
        _voz.cerrar()
    _voz = None
    liberar_gpu()


def _episodios() -> list[str]:
    return sorted(p.name for p in EPISODIOS.iterdir() if (p / "guion.md").exists())


def _ajustes(exageracion, cfg, temperatura, semilla) -> Ajustes:
    return Ajustes(exageracion=float(exageracion), cfg=float(cfg), temperatura=float(temperatura), semilla=int(semilla))


def elegir_episodio(nombre: str):
    carpeta = EPISODIOS / nombre
    a = ajustes_de_episodio(carpeta)
    guion = (carpeta / "guion.md").read_text(encoding="utf-8")
    return guion, a.exageracion, a.cfg, a.temperatura, a.semilla


def probar_frase(frase, exageracion, cfg, temperatura, semilla):
    if not frase.strip():
        raise gr.Error("Escribe una frase.")
    voz = _cargar_voz()
    audio = voz.decir(frase.strip(), _ajustes(exageracion, cfg, temperatura, semilla))
    return voz.sr, (np.clip(audio, -1, 1) * 32767).astype(np.int16)


def generar_episodio(nombre, guion, exageracion, cfg, temperatura, semilla, progreso=gr.Progress()):
    if not nombre:
        raise gr.Error("Elige un episodio.")
    carpeta = EPISODIOS / nombre
    ajustes = ajustes_de_episodio(carpeta)
    for k, v in vars(_ajustes(exageracion, cfg, temperatura, semilla)).items():
        if k in ("exageracion", "cfg", "temperatura", "semilla"):
            setattr(ajustes, k, v)
    # Guardamos el guion editado en la interfaz: es la fuente de verdad del episodio
    (carpeta / "guion.md").write_text(guion, encoding="utf-8")
    avisar = lambda m: progreso(None, desc=m)  # noqa: E731
    externa = buscar_voz_externa(carpeta)
    if externa:
        # Mismo camino que generar.py: la voz externa manda y Chatterbox no se usa. Generar aquí con
        # Chatterbox pisaría la voz de ElevenLabs, y un `producir.py --solo-video` la renderizaría.
        gr.Info(f"{nombre} usa voz externa ({externa.name}): se alinea con el guion, sin Chatterbox.")
        _soltar_voz()  # Whisper no debe compartir la GPU con Chatterbox (6 GB)
        progreso(0, desc=f"Alineando {externa.name}…")
        try:
            resultado = importar_voz(guion, externa, ajustes, avisar=avisar)
        finally:
            liberar_gpu()
        guardar(resultado, carpeta, huella_externa(guion, externa, ajustes))
    else:
        progreso(0, desc="Generando voz…")
        try:
            resultado = producir_voz(guion, ajustes, REFERENCIA, voz=_cargar_voz(), avisar=avisar)
        finally:
            _soltar_voz()  # producir_voz ya la liberó de la GPU (o falló a medias): siempre se olvida
        guardar(resultado, carpeta, huella(guion, ajustes, REFERENCIA))
    audio = (np.clip(resultado["audio"], -1, 1) * 32767).astype(np.int16)
    return (resultado["sr"], audio), json.dumps(resultado["resumen"], ensure_ascii=False, indent=2)


with gr.Blocks(title="Estudio de voz") as app:
    gr.Markdown("## Estudio de voz del canal\nChatterbox Multilingual · referencia `assets/voz_canal.wav`")
    with gr.Row():
        episodio = gr.Dropdown(_episodios(), label="Episodio")
    with gr.Row():
        exageracion = gr.Slider(0.25, 1.0, value=Ajustes().exageracion, step=0.05, label="Exageración (emoción)")
        cfg = gr.Slider(0.1, 1.0, value=Ajustes().cfg, step=0.05, label="CFG (más bajo = más pausado)")
        temperatura = gr.Slider(0.3, 1.2, value=Ajustes().temperatura, step=0.05, label="Temperatura")
        semilla = gr.Number(value=0, precision=0, label="Semilla")
    with gr.Tab("Probar frase"):
        frase = gr.Textbox(label="Frase", value="Fíjate en este círculo. Parece quieto, pero gira cinco veces.")
        boton_frase = gr.Button("Probar frase", variant="primary")
        audio_frase = gr.Audio(label="Resultado", type="numpy")
    with gr.Tab("Episodio completo"):
        guion = gr.Textbox(label="guion.md", lines=14)
        boton_ep = gr.Button("Generar episodio (voz.wav + tiempos.json)", variant="primary")
        audio_ep = gr.Audio(label="voz.wav", type="numpy")
        resumen = gr.Code(label="Resumen", language="json")

    episodio.change(elegir_episodio, episodio, [guion, exageracion, cfg, temperatura, semilla])
    boton_frase.click(probar_frase, [frase, exageracion, cfg, temperatura, semilla], audio_frase)
    boton_ep.click(generar_episodio, [episodio, guion, exageracion, cfg, temperatura, semilla], [audio_ep, resumen])

if __name__ == "__main__":
    app.queue(default_concurrency_limit=1).launch(server_name="0.0.0.0", server_port=7860)
