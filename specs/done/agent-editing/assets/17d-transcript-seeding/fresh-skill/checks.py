from run import *
from fractions import Fraction
def f(x):
 return Fraction(x['numerator'],x['denominator']) if isinstance(x,dict) else Fraction(x)
seed=read('seed')['data']; corr=read('correct')['data']; rev=corr['revision']
assert seed==read('seed-replay')['data']==read('seed-replay-after-correction')['data']
assert (D/'seed.request.json').read_bytes()==(D/'seed-replay.request.json').read_bytes()==(D/'seed-replay-after-correction.request.json').read_bytes()
assert read('before-invalid')['data']==read('after-invalid')['data']
assert not read('invalid-generation')['ok']
assert read('head-after-replay')['data']['currentRevisionId']==rev['id']
before=read('source-before-15')['data']; after=read('source-after')['data']
assert before==after
assert before['page']['nextCursor'] is None
labels=seed['edit']['labels']; old={c['id']:c for c in seed['revision']['document']['clips']}; new={c['id']:c for c in rev['document']['clips']}
c1=labels['caption1']; c2=labels['caption2']
assert new[c1]['seed']==old[c1]['seed'] and new[c1]['placement']==old[c1]['placement']
assert {**new[c1],'source':old[c1]['source']}==old[c1]
assert all(new[k]==v for k,v in old.items() if k!=c1)
rows=read('project-words-2')['data']['page']['rows']
assert len(rows)==32 and read('project-words-2')['data']['page']['nextCursor'] is None
for name in [c1,c2]:
 c=old[name]; rs=[w for w in rows if w['clipId']==c['seed']['occurrenceClipId'] and w['ordinal']<=6]
 assert c['placement']['range']=={'startUs':rs[0]['fragments'][0]['project']['startUs'],'endUs':rs[-1]['fragments'][0]['project']['endUs']}
assert f(old[c2]['placement']['range']['startUs'])==12000000+Fraction(1120000*6666667,10000000)
assert f(old[c2]['placement']['range']['endUs'])==12000000+Fraction(5600000*6666667,10000000)
summary={'allChecksPassed':True,'projectId':rev['projectId'],'finalRevisionId':rev['id'],'finalOrdinal':rev['ordinal'],'sourceWordsCompared':len(before['page']['rows']),'sourceGeneration':before['generation'],'sourceRawSHA256':before['page']['transcript']['raw']['sha256'],'projectWordRows':len(rows),'captions':[{ 'id':k,'text':new[k]['source']['text'],'placement':new[k]['placement']} for k in [c1,c2]],'invalidGenerationError':read('invalid-generation')['error'],'replayRequestBytesIdentical':True,'replayDataIdentical':True,'headUnchangedAfterInvalidAndReplay':True,'sourceTranscriptDataIdentical':True}
(D/'checks.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
