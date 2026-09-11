"""校验内联 favicon：从 index.html 提取 data URI，解码并确认是合法 SVG 图（非空、尺寸正确）。"""
import re, base64, sys, urllib.parse
from xml.etree import ElementTree
sys.stdout.reconfigure(encoding='utf-8')

html = open('index.html', encoding='utf-8').read()
links = re.findall(r'<link rel="(icon|apple-touch-icon)" href="([^"]+)"', html)
assert links, '未找到 favicon link'

for rel, href in links:
    assert href.startswith('data:image/svg+xml') or href.startswith('data:image/png'), href[:40]
    payload = href.split(',', 1)[1]
    if ';base64' in href:
        svg = base64.b64decode(payload).decode('utf-8')
    else:
        svg = urllib.parse.unquote(payload)
    root = ElementTree.fromstring(svg)          # 解析失败会抛异常
    tag = root.tag.split('}')[-1]
    assert tag == 'svg', tag
    vb = root.get('viewBox')
    rects = [e for e in root.iter() if e.tag.split('}')[-1] == 'rect']
    print(f'{rel}: {tag} viewBox={vb} rects={len(rects)} bytes={len(svg)}')
    assert vb and rects, '缺少 viewBox 或图形元素'
    # 图形必须都在画布内
    for r in rects:
        x, y = float(r.get('x', 0)), float(r.get('y', 0))
        w, h = float(r.get('width')), float(r.get('height'))
        assert x >= 0 and y >= 0 and x + w <= 32 and y + h <= 32, (x, y, w, h)

print('\nOK  favicon 校验通过：data URI 合法 SVG，图形均在 32x32 画布内')
