import sys
import json,statistics,bisect
from pathlib import Path
p=Path(sys.argv[1]);v=json.loads((p/'visual-events.json').read_text());a=json.loads((p/'audio-analysis.json').read_text());s={e['number']:e for e in v['screen']};c=[e for e in v['cameraCandidates'] if 2<=e['number']<=16]
def stats(rows):
 initial=rows[0]['offsetSeconds'];ib=rows[0]['offsetBracket']
 for r in rows:
  r['residualSeconds']=r['offsetSeconds']-initial
  r['residualBracket']=[0, 0] if r is rows[0] else [r['offsetBracket'][0]-ib[1],r['offsetBracket'][1]-ib[0]]
 return {'calibrationEvent':rows[0]['number'],'initialOffsetSeconds':initial,'initialOffsetBracket':ib,'matches':rows,'maxAbsMeasuredResidualSeconds':max(abs(r['residualSeconds']) for r in rows),'endpointResidualSeconds':rows[-1]['residualSeconds'],'worstResidualBracket':[min(r['residualBracket'][0] for r in rows),max(r['residualBracket'][1] for r in rows)],'screenIntervalSeconds':[s[rows[0]['number']]['pts'],s[rows[-1]['number']]['pts']]}
cr=[]
for e in c:
 se=s[e['number']];cr.append({'number':e['number'],'cameraPts':e['pts'],'screenPts':se['pts'],'offsetSeconds':e['pts']-se['pts'],'offsetBracket':[e['prevPts']-se['pts'],e['pts']-se['prevPts']]})
ar=[]
for e in a['events']:
 number=round((e['sourceTime']-3.64)/5)+1
 if number not in s:continue
 se=s[number];ar.append({'number':number,'microphoneJournalTime':e['sourceTime'],'screenPts':se['pts'],'offsetSeconds':e['sourceTime']-se['pts'],'offsetBracket':[e['sourceTime']-.01-se['pts'],e['sourceTime']+.01-se['prevPts']]})
controls={}
for freq in ['700','1300']:
 selected=[r for r in a['rows'] if r['packedTime']<251 and r['rms']>.0001 and r['ratios'][freq]>.5]
 controls[freq]={'aboveThreshold10msWindows':len(selected)}
controls['audioOffCadenceEvents']=[e for e in a['events'] if abs((e['sourceTime']-3.64+2.5)%5-2.5)>.3]
summary={'method':'Screen160x90 grayscale grid fixed cells28,29,36,37 >150; groups <=0.3s. Camera160x90 lower-half48cell grid rises>60 against preceding local baseline; peak>90, strong clear-window flashes2–16 only. Mic float32 physical payload, 10ms windows every sixth48k sample, 1kHz energy fraction>.5 RMS>.0001 for>=30ms;700/1300Hz controls. Journal maps physical sample to declared sample plus142041us phase; zero gaps.', 'calibration':'Exactly first matching event per comparison; no slope/time warp/median refit.', 'coordinateCaveat':'Visual times are ffmpeg -copyts showinfo PTS. Camera first decoded PTS4.470163 differs from native origin4.147523; screen firstdecoded0.025 differs from native0. Absolute offsets include decoder timeline interpretation and are not product playback latency.', 'cameraVisibility':'Strong repeatable patch2–16 (~8.66–78.66s screen), marker increasingly clips;17–25 and38–40 are sliver-only supplementary candidates, not included in calibration/drift summary. Remaining camera interval lacks validated visible marker. Candidate30/46 rejected as movement/white-page ambiguity.', 'cameraVsScreen':stats(cr),'microphoneVsScreen':stats(ar),'controls':controls,'audioJournal':{'phaseSeconds':a['phase'],'appendCount':a['journalRunCount'],'gaps':len(a['gaps']),'rawPayloadFrames':12197376,'rawPayloadSeconds':254.112,'nativeAdmittedSeconds':251.008,'excludedBeyondAdmittedEvent':51},'conclusion':'Physical flashes and beeps correspond; this resolution does not prove <=33ms residual bound. Camera evidence covers only70s strong-visibility span, not whole take.'}
(p/'recalculated-summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps({k:v for k,v in summary.items() if k not in ['cameraVsScreen','microphoneVsScreen']},indent=2))
for name in ['cameraVsScreen','microphoneVsScreen']:print(name,json.dumps({k:v for k,v in summary[name].items() if k!='matches'},indent=2))
