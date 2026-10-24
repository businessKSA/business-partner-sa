# NDA (3 pages) and company profile in the owner-approved QMOVE design; client name stays a placeholder.
import glob, os, re
LOGO = '/_blob/3e3c443e48f3d61a03ccc1d0b1bf30fb'
for f in glob.glob('out/project/NDA*'): os.remove(f)
os.makedirs('out/project', exist_ok=True); os.makedirs('outp/project', exist_ok=True)
for f in sorted(glob.glob('tpl_qm/*.dc.html')):
    t = open(f, encoding='utf8').read()
    t = re.sub(r'/_blob/[0-9a-f]+', LOGO, t)
    t = t.replace('QMOVE', '[CLIENT NAME]').replace('كيو موف', '[اسم الشركة]').replace('23 OCT 2026', '24 OCT 2026').replace('23 أكتوبر 2026', '24 أكتوبر 2026')
    name = os.path.basename(f)
    open(('outp/project/' if name.startswith('PROF') else 'out/project/') + name, 'w', encoding='utf8').write(t)
print('qm templates ok')
