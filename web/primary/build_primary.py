import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
SUBJECT_KEYS = ['chinese', 'math', 'english']


def load(key):
    p = HERE / 'subjects' / f'{key}.json'
    return json.loads(p.read_text(encoding='utf-8'))


def dump(obj):
    return json.dumps(obj, ensure_ascii=False).replace('</', '<\\/')


def main():
    tpl = (HERE / 'template.html').read_text(encoding='utf-8')
    if '/*__SUBJECTS__*/' not in tpl:
        raise SystemExit('placeholder /*__SUBJECTS__*/ missing in template')
    data = {k: load(k) for k in SUBJECT_KEYS}
    out = tpl.replace('/*__SUBJECTS__*/', dump(data))
    (HERE / 'index.html').write_text(out, encoding='utf-8')
    stats = {k: (len(v), sum(len(c['items']) for c in v), sum(len(i['ex']) for c in v for i in c['items'])) for k, v in data.items()}
    print(stats, '->', HERE / 'index.html')


if __name__ == '__main__':
    main()
