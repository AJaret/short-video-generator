"""Interfaz web local para probar la voz del canal.

    docker compose up -d voz     →  http://localhost:7860

- "Probar frase": genera solo una frase con los ajustes elegidos (rápido, para afinar el tono).
- "Generar episodio": produce voz.wav + tiempos.json del episodio, igual que generar.py.
  Para respetar la VRAM, la voz se descarga de la GPU antes de cargar Whisper.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import gradio as gr
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from nucleo import RAIZ, REFERENCIA, Ajustes, Voz, ajustes_de_episodio, guardar, huella, producir_voz  # noqa: E402

EPISODIOS = RAIZ / "episodios"
_voz: Voz | None = None


def _cargar_voz() -> Voz:
    global _voz
    if _voz is None:
        _voz = Voz(REFERENCIA)
    return _voz


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
    global _voz
    if not nombre:
        raise gr.Error("Elige un episodio.")
    carpeta = EPISODIOS / nombre
    ajustes = ajustes_de_episodio(carpeta)
    for k, v in vars(_ajustes(exageracion, cfg, temperatura, semilla)).items():
        if k in ("exageracion", "cfg", "temperatura", "semilla"):
            setattr(ajustes, k, v)
    # Guardamos el guion editado en la interfaz: es la fuente de verdad del episodio
    (carpeta / "guion.md").write_text(guion, encoding="utf-8")
    progreso(0, desc="Generando voz…")
    resultado = producir_voz(guion, ajustes, REFERENCIA, voz=_cargar_voz(), avisar=lambda m: progreso(None, desc=m))
    _voz = None  # producir_voz ya la liberó de la GPU
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
