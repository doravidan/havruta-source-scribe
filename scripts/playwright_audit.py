#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, time

BASE = 'http://127.0.0.1:4173'
OUT = Path('artifacts/design-audit')
OUT.mkdir(parents=True, exist_ok=True)

VIEWPORTS = {
    'desktop': {'width': 1440, 'height': 1200},
    'tablet': {'width': 820, 'height': 1180},
    'mobile': {'width': 390, 'height': 1200},
}
PAGES = ['/', '/library', '/auth', '/admin']

def analyze(page):
    return page.evaluate("""
    () => {
      const doc = document.documentElement;
      const body = document.body;
      const vw = window.innerWidth;
      const offenders = [...document.querySelectorAll('*')].map((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return null;
        const over = r.left < -2 || r.right > vw + 2;
        if (!over) return null;
        return { tag: el.tagName, cls: String(el.className || '').slice(0,120), text: (el.textContent || '').trim().slice(0,80), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
      }).filter(Boolean).slice(0, 20);
      const visibleText = body.innerText.trim();
      return {
        title: document.title,
        lang: doc.lang,
        dir: doc.dir,
        width: vw,
        scrollWidth: doc.scrollWidth,
        bodyScrollWidth: body.scrollWidth,
        overflowX: Math.max(doc.scrollWidth, body.scrollWidth) - vw,
        offenders,
        textLen: visibleText.length,
        h1: [...document.querySelectorAll('h1')].map(h => h.innerText.trim()).slice(0,3),
        buttons: [...document.querySelectorAll('button,a')].filter(el => {
          const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
        }).length
      };
    }
    """)

results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for vp_name, vp in VIEWPORTS.items():
        context = browser.new_context(viewport=vp, device_scale_factor=1)
        page = context.new_page()
        console = []
        page.on('console', lambda msg: console.append({'type': msg.type, 'text': msg.text[:300]}))
        page.on('pageerror', lambda err: console.append({'type': 'pageerror', 'text': str(err)[:300]}))
        for path in PAGES:
            url = BASE + path
            safe = path.strip('/').replace('/','-') or 'home'
            try:
                page.goto(url, wait_until='networkidle', timeout=20000)
                page.screenshot(path=str(OUT / f'{vp_name}-{safe}.png'), full_page=True)
                data = analyze(page)
                data.update({'viewport': vp_name, 'path': path, 'url': url, 'console': list(console)})
                results.append(data)
                console.clear()
            except Exception as e:
                results.append({'viewport': vp_name, 'path': path, 'error': str(e)})
        context.close()
    browser.close()

(OUT / 'audit.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
for r in results:
    print(r.get('viewport'), r.get('path'), 'overflow', r.get('overflowX'), 'text', r.get('textLen'), 'offenders', len(r.get('offenders', [])), 'err', r.get('error'))
print('wrote', OUT)
