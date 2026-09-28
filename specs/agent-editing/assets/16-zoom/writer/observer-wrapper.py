#!/usr/bin/python3
import sys,os,json,tempfile,pathlib
line=sys.stdin.buffer.readline();request=json.loads(line)
worker='/tmp/screenrec-opacity-integrated-native'
if request['operation']=='media.renderCompositionMovie':
    root=pathlib.Path('/tmp/screenrec-zoom-writer-traces');root.mkdir(exist_ok=True)
    trace=pathlib.Path(tempfile.mkdtemp(prefix='movie-',dir=root));os.environ['SCREENREC_WRITER_TRACE']=str(trace)
    (trace/'request.json').write_bytes(line)
    (trace/'frames.jsonl').write_bytes(pathlib.Path(request['params']['frames']).read_bytes())
    worker='/tmp/screenrec-zoom-observer-build/debug/screenrec-native'
with tempfile.TemporaryFile() as source:
    source.write(line);source.seek(0);os.dup2(source.fileno(),0)
    os.execv(worker,[worker])
