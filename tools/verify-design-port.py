#!/usr/bin/env python3
"""
Design-freeze check.

Compares every CSS declaration in the original NoHunger-Organic.html against the
ported stylesheets, after resolving the tokens back to their literal values. It
answers one question: did anything get dropped, re-scaled or re-tuned?

    python3 tools/verify-design-port.py [path/to/NoHunger-Organic.html]

Expected output: zero declarations absent from the port, and exactly two extras,
both from porting the inline onmouseover/onmouseout handlers on the feature
cards to a :hover rule carrying the identical values.
"""

import collections
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_HTML = ROOT / 'design' / 'NoHunger-Organic.html'


def load(path: pathlib.Path) -> str:
    if not path.exists():
        sys.exit(f'Not found: {path}')
    return path.read_text(encoding='utf-8')


def main() -> int:
    html_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_HTML
    html = load(html_path)
    tokens_src = load(ROOT / 'src' / 'styles' / 'tokens.css')
    globals_src = load(ROOT / 'src' / 'styles' / 'globals.css')
    module_src = load(ROOT / 'src' / 'components' / 'landing' / 'Landing.module.css')

    tokens = dict(re.findall(r'(--nh-[\w-]+):\s*([^;]+);', tokens_src))

    def resolve(value: str) -> str:
        for _ in range(4):
            match = re.search(r'var\((--nh-[\w-]+)\)', value)
            if not match:
                break
            value = value.replace(match.group(0), tokens.get(match.group(1), match.group(0)).strip())
        return value

    def norm(prop: str, value: str) -> str:
        value = resolve(value)
        value = re.sub(r'\s+', ' ', value).strip().rstrip(';')
        value = value.replace(', ', ',')
        value = re.sub(r'(?<![\w#])0\.(\d)', r'.\1', value)
        return f'{prop.strip().lower()}:{value.lower()}'

    def declarations(block: str) -> list:
        out = []
        for part in block.split(';'):
            if ':' not in part:
                continue
            prop, value = part.split(':', 1)
            if prop.strip():
                out.append(norm(prop, value))
        return out

    original = collections.Counter()
    for match in re.finditer(r'style="([^"]*)"', html):
        original.update(declarations(match.group(1)))
    style_block = re.search(r'<style>(.*?)</style>', html, re.S)
    if style_block:
        body = re.sub(r'/\*.*?\*/', '', style_block.group(1), flags=re.S)
        for _, rule in re.findall(r'([^{}]+)\{([^{}]*)\}', body):
            original.update(declarations(rule))

    port = collections.Counter()
    part1 = globals_src.split('PART 2')[0]
    for source in (part1, module_src):
        source = re.sub(r'/\*.*?\*/', '', source, flags=re.S)
        for selector, rule in re.findall(r'([^{}]+)\{([^{}]*)\}', source):
            stripped = selector.strip()
            if stripped.startswith('@media') or stripped.startswith('@keyframes'):
                continue
            port.update(declarations(rule))

    absent = sorted(set(original) - set(port))
    extra = sorted(set(port) - set(original))

    print(f'declarations in original : {sum(original.values())}')
    print(f'declarations in port     : {sum(port.values())} '
          f'(repeated elements share one class, so the total is lower by design)')
    print(f'\npresent in original, absent from the port: {len(absent)}')
    for item in absent:
        print(f'    {item}')
    print(f'\nin the port, not in the original: {len(extra)}')
    for item in extra:
        print(f'    {item}')

    return 1 if absent else 0


if __name__ == '__main__':
    raise SystemExit(main())
