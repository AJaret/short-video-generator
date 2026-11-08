"""Regresiones del orquestador, sin Docker ni modelos: python -m unittest discover -s herramientas."""
import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import producir as p


class Produccion(unittest.TestCase):
    def test_tramo_limites_y_redondeo(self):
        self.assertEqual(p.fotogramas_de_tramo((4.1, 5), 450), (123, 149))
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(p.fotogramas_de_tramo((14, 20), 450), (420, 449))
        for tramo in [(15, 20), (0, 0.001)]:
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                p.fotogramas_de_tramo(tramo, 450)

    def test_nombres_del_informe_en_tramo_cero(self):
        ep = p.EPISODIOS / 'nº02-juego-del-caos'
        with patch.object(p, 'docker', return_value=subprocess.CompletedProcess([], 0)) as docker:
            with contextlib.redirect_stdout(io.StringIO()):
                p.informe(ep, {}, ep / 'prueba.tramo.mp4', False, True, 0.0)
            orden = docker.call_args.args
        self.assertIn('analisis', orden)
        self.assertIn('informe_tramo.txt', orden)
        self.assertIn('hoja_tramo.png', orden)
        self.assertIn('--sin-loop', orden)
        self.assertIn('--pulso', orden)

    def test_informe_fallido_no_anuncia_stills(self):
        ep = p.EPISODIOS / 'nº02-juego-del-caos'
        with patch.object(p, 'docker', return_value=subprocess.CompletedProcess([], 1)):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertIsNone(p.informe(ep, {}, ep / 'prueba.mp4', False, False))

    def test_anclas_y_duracion_de_letras(self):
        t = {'duracion': 10, 'palabras': [{'texto': '¡Triángulo!', 'inicio': 3, 'fin': 4}]}
        self.assertEqual(p.tiempo_de_ancla(t, 'triangulo'), 3)
        self.assertIsNone(p.tiempo_de_ancla(t, ''))
        c = {'impactos': [{'ancla': 'inexistente'}], 'audio': {'remate': 'triangulo'}}
        self.assertEqual(len(p.anclas_perdidas(c, t)), 1)
        imp = {'texto': 'Cero en el hueco', 'entrada': 'letras', 'duracion': 1.6}
        self.assertAlmostEqual(p.fin_impacto(imp, 0, 60 / 92), 12 * 60 / 92 / 4 + 0.9)

    def test_still_impacto_ya_completo(self):
        with tempfile.TemporaryDirectory() as tmp:
            ep = Path(tmp)
            t = {'duracion': 10, 'palabras': []}
            (ep / 'tiempos.json').write_text(json.dumps(t), encoding='utf-8')
            imp = {'texto': 'Cero en el hueco', 'entrada': 'letras', 'desde': 3}
            c = {'impactos': [imp]}
            f = p.momentos_de_verificacion(ep, c)['impacto']
            inicio = p.cuantizar(3, 60 / 92)
            self.assertGreater(f / 30, inicio + 12 * 60 / 92 / 4 + 0.1)
            self.assertLess(f / 30, p.fin_impacto(imp, inicio, 60 / 92) - 0.2)

    def test_solo_voz_reconstruye_mezcla(self):
        ep = p.EPISODIOS / 'nº00-prueba'
        with patch.object(sys, 'argv', ['producir.py', ep.name, '--solo-voz']), \
                patch.object(p, 'comprobar_docker'), patch.object(p, 'liberar_gpu'), \
                patch.object(p, 'generar_voz'), patch.object(p, 'generar_sonido') as sonido, \
                patch.object(p, 'renderizar') as render:
            with contextlib.redirect_stdout(io.StringIO()):
                p.main()
            sonido.assert_called_once_with(ep)
            render.assert_not_called()


if __name__ == '__main__':
    unittest.main()
