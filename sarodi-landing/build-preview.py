"""Build a standalone preview (index.html) from the WordPress template. Run: python3 build-preview.py"""
from pathlib import Path
here = Path(__file__).parent
body = (here / 'templates/landing.html').read_text(encoding='utf-8')
body = body.replace('{{A}}', 'assets').replace('{{CTA}}', '#slp-contact').replace('{{TEL}}', 'tel:03133120')
html = f"""<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>کلید هوشمند سارودی | Sarodi Smart Switch</title>
<meta name="description" content="کلید هوشمند لمسی وای‌فای سارودی با پنل شیشه‌ای ۸۶×۸۶، تا ۲۲۰۰ وات برای هر پل؛ مدل‌های یک تا چهار پل، پرده برقی و کولر آبی. کنترل از موبایل و سناریوهای هوشمند.">
<meta name="theme-color" content="#05090b">
<link rel="preload" href="assets/fonts/Vazirmatn-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/landing.css">
<style>html,body{{margin:0;background:#05090b}}</style>
</head>
<body>
{body}
</body>
</html>
"""
(here / 'index.html').write_text(html, encoding='utf-8')
print('index.html written')
