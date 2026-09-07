"""Regression checks for source-only generation boundaries (no network/model)."""
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


prepare = module('prepare', 'prepare-source-direct-context.py')
base = module('base', 'generate-source-direct-local.py')
structured = module('structured', 'generate-source-direct-structured.py')


class SourceBoundaries(unittest.TestCase):
    def test_reader_stops_before_body(self):
        class Guarded(io.StringIO):
            def __next__(self):
                if self.tell() >= len('---\ntop: []\n---\n'):
                    raise AssertionError('Chinese body was read')
                return super().__next__()
        with patch.object(Path, 'open', return_value=Guarded('---\ntop: []\n---\nDO NOT READ')):
            self.assertEqual(prepare.parse_frontmatter(Path('unused')), {'top': []})

    def test_only_whitelisted_context_is_exported(self):
        forbidden = 'CHINESE_PROSE_SENTINEL'
        daily = {'description': forbidden, 'top': [dict(title='t', source='s', topic='x', url='https://example.org', why=forbidden) for _ in range(5)]}
        lesson = {'description': forbidden, 'vocabulary': [{'term':'語', 'meaningZh':forbidden, 'noteZh':forbidden}], 'grammar':[{'pattern':'型', 'usageZh':forbidden}], 'technicalTerms':[{'term':'BM25', 'contextZh':forbidden}]}
        with patch.object(prepare, 'parse_frontmatter', side_effect=[daily, lesson]):
            context = prepare.make_context('2026-08-12')
        self.assertNotIn(forbidden, json.dumps(context))
        self.assertEqual(len(context['top']), 5)
        self.assertEqual(context['learning']['vocabulary'][0]['term'], '語')

    def test_missing_original_blocks_before_model_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder/'originals').mkdir()
            for index in range(1, 6):
                (folder/'originals'/f'{index:02}.txt').write_text('HTTP_STATUS: 200\n\n' + '原文内容。'*100)
            (folder/'originals'/'05.txt').write_text('FETCH_STATUS: failed\n')
            chat = Mock()
            with self.assertRaisesRegex(RuntimeError, 'unavailable'):
                structured.article_cards(base, chat, {'top':[{}]*5}, folder)
            chat.ask.assert_not_called()


if __name__ == '__main__':
    unittest.main()
