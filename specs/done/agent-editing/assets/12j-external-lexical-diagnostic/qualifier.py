import io,json,hashlib,re,wave
from pathlib import Path
import duckdb
root=Path('/tmp/screenrec-12-external-corpus-qualification')
source=root/'original/data/test-00000-of-00001.parquet'
data=source.read_bytes()
assert len(data)==70868626
assert hashlib.sha256(data).hexdigest()=='e78837be393206fc0ae6a0cefb4ec8c942c3e26401640eb8af67cf0dac21b4b0'
rows=duckdb.connect().execute('SELECT audio, transcript_annotated, transcript_a, transcript_b, transcript_c FROM read_parquet(?)',[str(source)]).fetchall()
assert len(rows)==250
qualified=[]
for index,(audio,annotated,a,b,c) in enumerate(rows):
 wav=audio['bytes']
 with wave.open(io.BytesIO(wav)) as f:
  assert f.getnchannels()==1 and f.getsampwidth()==2 and f.getframerate()==22050
  samples=f.getnframes();pcm=f.readframes(samples)
  assert len(pcm)==samples*2 and not f.readframes(1)
 filler_labels=re.findall(r'\{F\s+([^}]*)\}',annotated)
 counts={word:sum(len(re.findall(r'\b'+word+r'\b',label,re.I)) for label in filler_labels) for word in ('uh','um')}
 qualified.append({'rowIndex':index,'originalPath':audio['path'],'wavBytes':len(wav),'wavSHA256':hashlib.sha256(wav).hexdigest(),'pcmSHA256':hashlib.sha256(pcm).hexdigest(),'samples':samples,'sampleRate':22050,'durationSeconds':samples/22050,'fillers':counts,'annotated':annotated,'transcriptA':a,'transcriptB':b,'transcriptC':c})
# Diagnostic selection fixed from gold only; never based on engine outcomes.
# Choose the first source-order utterances containing at least two explicit uh/um
# labels until40labels; keep first8zero-uh/um utterances as negative neighbors.
positives=[];count=0
for row in qualified:
 n=sum(row['fillers'].values())
 if n<2:continue
 positives.append(row);count+=n
 if count>=40:break
negatives=[r for r in qualified if sum(r['fillers'].values())==0][:8]
selected=sorted(positives+negatives,key=lambda r:r['rowIndex'])
assert count>=40 and len(negatives)==8
out=root/'cohort';out.mkdir(exist_ok=True)
for row in selected:
 (out/f"{row['rowIndex']:03d}.wav").write_bytes(rows[row['rowIndex']][0]['bytes'])
manifest={'source':{'repo':'amaai-lab/DisfluencySpeech','revision':'b7da294fe3a70dd96df6640893f2a5dfc2c87638','file':str(source),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'licenseDeclaration':'Apache-2.0; pinned publisher README','split':'test','rows':250},'reader':{'duckdb':duckdb.__version__},'selection':'Source-order rows with>=2 explicit F uh/um tokens until>=40, plus first8 rows with no such label; fixed before any inference. This is a density-enriched diagnostic, not natural prevalence or full lexical/timing acceptance.','positiveRows':len(positives),'negativeRows':len(negatives),'explicitFillers':count,'durationSeconds':sum(r['durationSeconds'] for r in selected),'selectedRows':selected,'allRows':qualified,'limits':['One human speaker acting SwDA scripts, not spontaneous or multiplevoice coverage','Publisher manual transcript checking; no manually verified acoustic word edges supplied','No model-unseen/pretraining exclusion established','Annotated transcript and transcriptA differences retained; none repaired from predictions','No recognition, alignment, edit or listening occurred']}
(root/'qualification.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:manifest[k] for k in ('positiveRows','negativeRows','explicitFillers','durationSeconds','reader')},indent=2))
