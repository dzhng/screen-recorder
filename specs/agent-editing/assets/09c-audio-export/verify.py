import pathlib,json,tarfile,hashlib
root=pathlib.Path(__file__).resolve().parent.parent;summary={'passed':True,'packets':{}}
def check(base,archive,pins):
 expected=json.loads((base/pins).read_text());actual={}
 with tarfile.open(base/archive,'r:*') as t:
  for m in t:
   if m.isfile() or m.islnk():
    b=t.extractfile(m).read();actual[m.name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
 # External-runtime pins additionally identify original filesystem locations.
 mapped={v['member']:{'bytes':v['bytes'],'sha256':v['sha256']} for v in expected} if isinstance(expected,list) else {v.get('archiveMember',k):{'bytes':v['bytes'],'sha256':v['sha256']} for k,v in expected.items()}
 assert actual==mapped, (archive,len(actual),len(mapped),list(set(actual)^set(mapped))[:8])
 return {'members':len(actual),'bytes':(base/archive).stat().st_size,'sha256':hashlib.sha256((base/archive).read_bytes()).hexdigest()}
for folder,pairs in {'09c-audio-export':[('source-runtime.tar.gz','source-runtime-pins.json'),('external-runtime.tar.gz','external-runtime-pins.json'),('external-tools.tar.gz','external-tools-pins.json'),('evidence.tar.gz','evidence-pins.json')],'09c-native-audio-file':[('source-reference.tar.gz','source-reference-pins.json'),('source-final-delta.tar.gz','source-final-delta-pins.json'),('external-code.tar.gz','external-code-pins.json'),('runtime.tar.gz','runtime-pins.json'),('evidence.tar.xz','evidence-members.json'),('packet-count-candidate-source-delta.tar.gz','packet-count-candidate-source-delta-pins.json'),('final-reader-mutant-source-delta.tar.gz','final-reader-mutant-source-delta-pins.json'),('streaming-mutant-source-delta.tar.gz','streaming-mutant-source-delta-pins.json')]}.items():
 summary['packets'][folder]={}
 for a,p in pairs:summary['packets'][folder][a]=check(root/folder,a,p)
(root/'09c-audio-export/archive-verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
