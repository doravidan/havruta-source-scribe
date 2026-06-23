#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
import re

BASE = 'http://127.0.0.1:4173'
OUT = Path('artifacts/playwright-qa')
OUT.mkdir(parents=True, exist_ok=True)

report = []

def record(name, ok=True, note='', **extra):
    row = {'name': name, 'ok': ok, 'note': note, **extra}
    report.append(row)
    print(('PASS' if ok else 'FAIL'), name, note)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1280, 'height': 1000})
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    page.goto(BASE + '/', wait_until='networkidle', timeout=20000)
    expect(page.locator('h1').first).to_be_visible()
    page.screenshot(path=str(OUT / 'home.png'), full_page=True)
    record('home loads', text=page.locator('body').inner_text()[:120])

    # Search flow: type a real query; result count may depend on live Supabase data.
    search_input = page.get_by_placeholder('חפש לפי כותרת, נושא או תוכן…')
    expect(search_input).to_be_visible()
    search_input.fill('תניא')
    page.get_by_role('button', name='חפש').last.click()
    page.wait_for_timeout(2500)
    page.screenshot(path=str(OUT / 'search-after-query.png'), full_page=True)
    body = page.locator('body').inner_text()
    record('search interaction runs', ok=('אין תוצאות' in body or 'תניא' in body or 'מקורות' in body), note='query submitted')

    # Language toggle should switch copy/dir without layout overflow.
    page.get_by_label(re.compile('Toggle language|החלפת שפה')).click()
    page.wait_for_timeout(500)
    lang = page.evaluate('document.documentElement.lang')
    direction = page.evaluate('document.documentElement.dir')
    overflow = page.evaluate('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth')
    page.screenshot(path=str(OUT / 'home-english.png'), full_page=True)
    record('language toggle works', ok=(lang == 'en' and direction == 'ltr' and overflow <= 1), note=f'lang={lang} dir={direction} overflow={overflow}')

    # Library browse flow.
    page.goto(BASE + '/library', wait_until='networkidle', timeout=20000)
    expect(page.locator('h1').first).to_be_visible()
    page.screenshot(path=str(OUT / 'library.png'), full_page=True)
    cards = page.locator('button').filter(has_text='source').count() + page.locator('button').filter(has_text='מקורות').count()
    record('library loads', ok=cards >= 1, note=f'cards={cards}')

    # Auth page visible.
    page.goto(BASE + '/auth', wait_until='networkidle', timeout=20000)
    expect(page.locator('input[type="email"]')).to_be_visible()
    expect(page.locator('input[type="password"]')).to_be_visible()
    page.screenshot(path=str(OUT / 'auth.png'), full_page=True)
    record('auth form visible')

    # Mobile smoke pass.
    page.set_viewport_size({'width': 390, 'height': 1000})
    page.goto(BASE + '/', wait_until='networkidle', timeout=20000)
    overflow = page.evaluate('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth')
    page.screenshot(path=str(OUT / 'mobile-home.png'), full_page=True)
    record('mobile home no horizontal overflow', ok=overflow <= 1, note=f'overflow={overflow}')

    record('runtime page errors', ok=len(errors) == 0, note='; '.join(errors[:2]))
    browser.close()

(OUT / 'qa-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
if not all(r['ok'] for r in report):
    raise SystemExit(1)
