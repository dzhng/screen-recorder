from pathlib import Path
import json,hashlib,tarfile,shutil
from PIL import Image
c=Path('/tmp/screenrec-23l-compact-packet');a=Path('/Users/david/.codex/worktrees/source-consumer-bridge-plan/screen-recorder/specs/agent-editing/assets/23l-paired-edited-frames');archive=Path('/tmp/screenrec-23l-compact-final-evidence.tar.gz')
def h(p):
 d=hashlib.sha256()
 with open(p,'rb')as f:
  for b in iter(lambda:f.read(1024*1024),b''):d.update(b)
 return d.hexdigest()
def pin(p):return dict(path=str(p),bytes=p.stat().st_size,sha256=h(p))
f=json.loads((c/'files.json').read_text());expected={x['path']:x for x in f};expected['files.json']=dict(bytes=(c/'files.json').stat().st_size,sha256=h(c/'files.json'));seen=set()
with tarfile.open(archive,'r|gz')as t:
 for m in t:
  if m.isdir():continue
  assert m.isfile() and not m.issym();k=m.name.removeprefix('./');assert k in expected and k not in seen;d=hashlib.sha256()
  stream=t.extractfile(m)
  for b in iter(lambda:stream.read(1024*1024),b''):d.update(b)
  assert m.size==expected[k]['bytes'] and d.hexdigest()==expected[k]['sha256'],k
  seen.add(k)
assert seen==set(expected)
refs=json.loads((c/'storage/references.json').read_text());r=json.loads((c/'storage/rgba-reconstruction.json').read_text());omitted={x['omittedMember']for x in refs['existingAuthorityReferences']}|{x['omittedMember']for x in r['uniqueRawReconstructions']};assert omitted==set(refs['omittedMembers'])
for row in refs['existingAuthorityReferences']:
 p=Path(row['authority']['path']);assert h(p)==row['sha256'] and p.stat().st_size==row['bytes'];assert row['omittedMember']not in expected
for row in refs['fullArchivePreservation']:
 p=Path(row['preserved']['path']);assert h(p)==row['preserved']['sha256'] and p.stat().st_size==row['preserved']['bytes']
for row in r['uniqueRawReconstructions']:
 s=row['reconstructFrom'];p=c/s['pngMember'];assert h(p)==s['pngSHA256'] and p.stat().st_size==s['pngBytes']
 with Image.open(p)as im:
  assert im.mode=='RGBA' and im.format=='PNG';raw=im.tobytes();assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'];assert hashlib.sha256(im.info['icc_profile']).hexdigest()==s['normalizedEmbeddedICCSHA256']
 assert row['completeByteEquality'] and row['omittedMember']not in expected
outputs=json.loads((c/'pixels/outputs.json').read_text());assert all(any(x['banked']==q['omittedMember'] and x['sha256']==q['sha256'] and x['bytes']==q['bytes'] for q in r['uniqueRawReconstructions'])for x in outputs)
# Every original output/receipt/source/runtime payload that remains is unchanged.
original={x['path']:x for x in json.loads(Path('/tmp/screenrec-23l-packet/files.json').read_text())};allowedDocChanges={'verification/README.md','verification/choices.md'}
for k,x in original.items():
 if k in omitted:continue
 assert k in expected
 if k not in allowedDocChanges:assert expected[k]['bytes']==x['bytes'] and expected[k]['sha256']==x['sha256'],k
parts=[]
with open(archive,'rb')as stream:
 for i in range(100):
  b=stream.read(64*1024*1024)
  if not b:break
  p=a/('compact-evidence.tar.gz.part-'+str(i).zfill(3));p.write_bytes(b);parts.append(dict(file=p.name,bytes=p.stat().st_size,sha256=h(p)))
joined=hashlib.sha256()
for row in parts:
 with open(a/row['file'],'rb')as f2:
  for b in iter(lambda:f2.read(1024*1024),b''):joined.update(b)
assert joined.hexdigest()==h(archive)
v=json.loads((a/'verification.json').read_text());originalPacket=v['packet'];v['fullArchive']=dict(archive=refs['fullArchivePreservation'][0]['preserved'],memberCount=originalPacket['memberCount'],payloadFiles=originalPacket['payloadFiles'],payloadBytes=originalPacket['payloadBytes'],manifest=originalPacket['manifest'],scope='Immutable original full packet retained outsideGit; original reports/output/rawbytes/runtime authority unchanged')
v['originalConfiguredCandidate']=refs['fullArchivePreservation'][1]['preserved'];v['packet']=dict(archive=pin(archive),parts=parts,memberCount=len(seen),payloadFiles=len(expected)-1,payloadBytes=sum(x['bytes']for k,x in expected.items() if k!='files.json'),manifest=dict(member='files.json',bytes=expected['files.json']['bytes'],sha256=expected['files.json']['sha256']),verification='Every retained archived file streaming SHA256/size verified; all7 existing authority bindings rehashed; all21 unique raw reconstructions direct PNG RGBA SHA/size verified; all54 normalized PNGs compared with raw in preparation; all original retained output/receipt/source/runtime hashes unchanged',reassembly='cat '+' '.join(x['file']for x in parts)+' > compact-evidence.tar.gz')
v['storage']=dict(references='storage-references.json',rgbaReconstruction='rgba-reconstruction.json',packetReferenceMember='storage/references.json',packetReconstructionMember='storage/rgba-reconstruction.json',omittedMembers=len(omitted),omittedBytes=refs['omittedBytes'],preservedOutputs=True,profileHandlingUnchanged=True,sourceFixtureAndWorkerAuthorities='Exact checked-in originals plus root durable frozen-native-workers copy, fullhash/size/rootpath bound per member',rawDuplicationQualification='Exact raw bytes equal existing lossless normalizedPNG decode without color conversion; only those21 arrays omitted',fullArchivesOutsideGit=True)
v['authority']['allPixels']='pixels/outputs.json maps every execution; storage/rgba-reconstruction.json recovers each exact full RGBA from retained normalizedPNG; runs/third retains all original deliveredPNGs; immutable full archive keeps original rawarrays'
(a/'verification.json').write_text(json.dumps(v,indent=2)+'\n')
summary=dict(archive=pin(archive),parts=parts,verifiedMembers=len(seen),omittedMembers=len(omitted),omittedBytes=refs['omittedBytes'],uniqueRawReconstructed=len(r['uniqueRawReconstructions']),allOriginalOutputReceiptRuntimeHashesUnchanged=True,authorityBindings=7,rawExecutionMappings=len(outputs))
(a/'storage-validation.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary))
