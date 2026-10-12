import sys
PAGES = len(sys.argv) > 1 and sys.argv[1] == 'pages'
PAGES_URL = 'https://shaimaa-alaa.github.io/Online-Game/'
import re, json, sys
P='/home/claude/online-game/public/'
S=open('/home/claude/online-game/server.js').read()
# pure helpers from the real server, so scoring/judging is identical
h1=S[S.index("const clamp ="):S.index("function shuffle")]
h1=h1[:h1.index("const rooms")] if False else h1
helpers=["var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};",
 "var cleanText="+re.search(r"const cleanText = (.*?);\n",S).group(1)+";",
 "var cleanName="+re.search(r"const cleanName = (.*?);\n",S).group(1)+";",
 S[S.index("function shuffle"):S.index("function newCode")],
 S[S.index("function sanitizeGame"):S.index("function board(")]]
helpers="\n".join(helpers)
helpers=re.sub(r"\bconst ","var ",helpers)
loc=open('/home/claude/online-game/artifact/local-socket.tpl.js').read().replace('/*__HELPERS__*/',helpers).replace('__BASE__',(PAGES_URL if PAGES else 'https://claude.ai/artifact/Jxt8ijdbrugeFGGdQavXEo'))
app=open(P+'app.js').read()
seed=re.search(r"const SEED = (\[.*?\n\]);",app,re.S).group(1)
default="window.__DEFAULT_GAME={title:'سباق المعرفة',settings:{shuffleQuestions:false,shuffleChoices:true},questions:("+seed+").map(function(s){return {type:'mcq',q:s[0],code:s[1],choices:s[2],answer:s[3],secs:20,points:100,category:'بايثون',difficulty:'medium'}})};"
html=open(P+'index.html').read()
body=html[html.index('<body>')+6:html.index('<script src="vendor/three')]
body=body.replace('</body>','')
css=open(P+'style.css').read()
three=open(P+'vendor/three.min.js').read()
out=("<title>سباق المعرفة</title>\n<script>document.documentElement.lang='ar';document.documentElement.dir='rtl';</script>\n"
 '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;800;900&family=IBM+Plex+Mono:wght@500;700&display=swap">\n'
 "<style>\n"+css+"\n</style>\n"+body+"\n"
 "<script>"+three+"</script>\n<script>"+open(P+'vendor/qrcode.js').read()+"</script>\n<script src=\"https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js\"></script>\n<script src=\"https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js\"></script>\n<script>"+open(P+'race3d.js').read()+"</script>\n<script>"+open(P+'scenes.js').read()+"</script>\n"
 "<script>"+default+"\n"+loc+"</script>\n<script>"+app+"</script>\n")
for s in ['</script']:
    pass
assert out.count('</script>')==9, out.count('</script>')
if PAGES:
    import os
    os.makedirs('/home/claude/online-game/docs', exist_ok=True)
    open('/home/claude/online-game/docs/index.html','w',encoding='utf8').write('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+out+'</body></html>')
else:
    open('/home/claude/online-game/artifact/game.html','w').write(out)
print(len(out))
