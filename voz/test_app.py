"""Interfaz sin modelos: docker compose run --rm analisis python -m unittest discover -s voz -p test_app.py."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

import numpy as np
import app as estudio


class InterfazVoz(unittest.TestCase):
    def test_voz_externa_no_carga_chatterbox(self):
        with tempfile.TemporaryDirectory() as tmp:
            ep = Path(tmp) / 'prueba'
            ep.mkdir()
            audio = ep / 'voz_externa.mp3'
            audio.write_bytes(b'fuente de prueba')
            resultado = {'audio': np.zeros(10), 'sr': 24000, 'resumen': {}}
            with patch.object(estudio, 'EPISODIOS', Path(tmp)), \
                    patch.object(estudio, 'ajustes_de_episodio', return_value=estudio.Ajustes()), \
                    patch.object(estudio, '_soltar_voz') as soltar, \
                    patch.object(estudio, 'liberar_gpu'), patch.object(estudio.gr, 'Info'), \
                    patch.object(estudio, '_cargar_voz') as cargar, \
                    patch.object(estudio, 'producir_voz') as producir, \
                    patch.object(estudio, 'importar_voz', return_value=resultado) as importar, \
                    patch.object(estudio, 'huella_externa', return_value='externa'), \
                    patch.object(estudio, 'guardar') as guardar:
                estudio.generar_episodio('prueba', 'Hola.', 0.8, 0.5, 0.8, 0, progreso=Mock())
                soltar.assert_called_once()
                cargar.assert_not_called()
                producir.assert_not_called()
                self.assertEqual(importar.call_args.args[1], audio)
                self.assertEqual(guardar.call_args.args[2], 'externa')
            self.assertEqual(audio.read_bytes(), b'fuente de prueba')

    def test_modelo_se_olvida_si_falla_generacion(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / 'prueba').mkdir()
            modelo = Mock()
            estudio._voz = modelo
            try:
                with patch.object(estudio, 'EPISODIOS', Path(tmp)), \
                        patch.object(estudio, 'ajustes_de_episodio', return_value=estudio.Ajustes()), \
                        patch.object(estudio, '_cargar_voz', return_value=modelo), \
                        patch.object(estudio, 'liberar_gpu'), \
                        patch.object(estudio, 'producir_voz', side_effect=RuntimeError('fallo simulado')):
                    with self.assertRaisesRegex(RuntimeError, 'fallo simulado'):
                        estudio.generar_episodio('prueba', 'Hola.', 0.8, 0.5, 0.8, 0, progreso=Mock())
                self.assertIsNone(estudio._voz)
                modelo.cerrar.assert_called_once()
            finally:
                estudio._voz = None


if __name__ == '__main__':
    unittest.main()
