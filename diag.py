import re
js = open(r'd:\carbon footprints\Carbon-footprint-\app.js', encoding='utf-8').read()
matches = list(re.finditer(r'document\.querySelector', js))
print(f'Total querySelector calls: {len(matches)}')
for i,m in enumerate(matches):
    ctx = js[max(0,m.start()-20):m.start()+70].replace('\n',' ').strip()
    print(f'  {i+1:2}. {ctx}')

print()
print(f'innerHTML count: {js.count(".innerHTML")}')
for m in re.finditer(r'\.innerHTML', js):
    ctx = js[max(0,m.start()-50):m.start()+80].replace('\n',' ').strip()
    print(f'  {ctx}')

print()
click_count = js.count('addEventListener("click"')
print(f'addEventListener("click") count: {click_count}')
