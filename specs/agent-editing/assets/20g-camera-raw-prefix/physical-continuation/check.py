"""Check complete saved ordinary tuples and the distinct failed pre-kill gate."""
import base64, json, pathlib, runpy, sys

def validate(contents, compile_packet, original):
    j=lambda name:json.loads(contents[name])
    report=j('report.json');plan=j('plan.json');authority=j('authority.json');proc=j('processes.json')['processes']
    assert report['status']=='ordinary-scoped-pass-interruption-prerequisite-failed'
    assert report['generalRawPrefixStabilityQualified'] is False and report['canonicalQualified'] is False
    assert [p['label'] for p in proc]==['ordinary','interrupt']
    assert all(p['terminal'] for p in proc) and [p['exitCode'] for p in proc]==[0,1]
    assert all(p['elapsedSeconds']<15 and max(p['stdioBytes'].values())<=1048576 for p in proc)
    assert 'signal' not in proc[1] and proc[1]['controllerFailure']=='interrupt prerequisite not reached'
    assert j('controller-verdict.json')['status']=='fail'
    assert j('tool-session.json')['terminal']['exit_code']==1
    qualified=json.loads(compile_packet['process.json'])['binary']
    assert authority['exactQualifiedBinary']==qualified==plan['qualifiedBinary']
    for process,mode,key in zip(proc,['ordinary','interrupt'],['ordinary','interrupt']):
        assert process['argv']==plan[key] and process['argv'][0]==qualified['path'] and process['argv'][1]==mode
    old=json.loads(original['plan.json'])
    assert (plan['feedSeconds'],plan['offeredFrames'],plan['fps'])==(old['feedSeconds'],old['offeredFrames'],old['fps'])==(7,210,30)
    assert (plan['initialFragmentSeconds'],plan['laterFragmentSeconds'],plan['writerObservationSeconds'],plan['phaseBoundSeconds'])==(1,5,15,180)
    first=j('ordinary/first.json');extension=j('ordinary/extension-2.json');closed=j('ordinary/closed.json')
    prefix=first['pictures'][:-1];assert len(first['pictures'])==30 and len(prefix)==29
    assert first['completedFragments']==1 and extension['completedFragments']==2
    assert first['canContainFragments'] is True and extension['containsFragments'] is True
    for sample in prefix:
        assert sample['end'] is not None and len(base64.b64decode(sample['bgra'],validate=True))==2048
    for snapshot in [extension,closed]:
        assert snapshot['nativeScale']==1000000 and snapshot['readerStatus']==2
        assert snapshot['pictures'][:len(prefix)]==prefix
    mappings=j('ordinary/accepted-mappings.json');verdict=j('ordinary/verdict.json')
    assert verdict['status']=='pass' and verdict['offered']==210 and verdict['accepted']==len(mappings)==len(closed['pictures'])==197
    for index,(mapping,picture) in enumerate(zip(mappings,closed['pictures'])):
        assert mapping['ordinal']==picture['ordinal']==index
        start=mapping['start'];scaled=(2*start['value']*1000000+start['timescale'])//(2*start['timescale'])
        assert picture['digestPTS']['value']==scaled and picture['digestPTS']['scale']==1000000
        assert picture['width']==32 and picture['height']==16
        assert len(base64.b64decode(picture['bgra'],validate=True))==2048
    assert j('interrupted/failure.json')['error']=='ProbeFailure(message: "committed tuple differs at ordinal 24")'
    assert len(j('interrupted/first.json')['pictures'])==27
    assert 'interrupted/ready.json' not in contents and 'interrupted/recovered.json' not in contents
    assert 'interrupted/camera/camera.raw.mov' not in contents and 'interrupted/extension-2.json' not in contents
    assert report['interrupted']['SIGKILLSent'] is False and report['interrupted']['recoveryDispatched'] is False
    end=j('termination.json');assert end['exitCode']==1 and end['stdout']==end['stderr']==''
    assert report['all114PinsUnchangedAfterPhysicalExecution'] is True

def main(root):
    packet=runpy.run_path(str(root.parent/'compile-diagnostic/check.py'))['packet']
    contents=packet(root);compile_packet=packet(root.parent/'compile-diagnostic');original=packet(root.parent)
    validate(contents,compile_packet,original)
    report=json.loads(contents['report.json']);report['generalRawPrefixStabilityQualified']=True
    bad=contents.copy();bad['report.json']=json.dumps(report).encode()
    try:validate(bad,compile_packet,original)
    except AssertionError:pass
    else:raise AssertionError('accepted an unsupported general stability claim')
    print('PASS saved29-picture extension/closure equality, full197 admitted ordinals and truthful distinct pre-kill failure')

if __name__=='__main__':main(pathlib.Path(sys.argv[1]))
