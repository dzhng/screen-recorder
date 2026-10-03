"""Verify the frozen failed preparation without compiling or opening media."""
import hashlib, json, pathlib, sys, tarfile

def validate(records):
    report=records['report.json']; phase=records['processes.json']
    assert report['status']=='unmeasured-preparation-deadline'
    assert report['physicalQuestionAnswered'] is False
    assert report['mediaProcessesStarted']==0 and report['noExecutableProduced'] is True
    assert report['correctedControllerExitCode']==1
    assert records['controller-verdict.json']['status']=='fail'
    assert records['controller-verdict.json']['error']=='process deadline'
    assert len(phase['processes'])==1
    compiler=phase['processes'][0]
    assert compiler['label']=='compile' and compiler['terminal'] is True
    assert compiler['exitCode']==-9 and compiler['controllerFailure']=='process deadline'
    assert compiler['boundSeconds']==150 and 150<=compiler['elapsedSeconds']<155
    assert compiler['stdioBytes']=={'stdout':0,'stderr':0}
    assert compiler['stdioCapBytes']==1048576
    assert phase['phaseBoundSeconds']==180
    original=records['setup-interrupted/processes.json']['processes']
    assert len(original)==1 and original[0]['label']=='compile'
    assert original[0]['terminal'] is True and original[0]['exitCode']==-9
    assert records['setup-interrupted/reason.json']['controllerExitCode']==1
    termination=records['termination.json']
    assert termination['exitCode']==1 and termination['stdout']==termination['stderr']==''
    plan=records['plan.json']
    assert (plan['feedSeconds'],plan['offeredFrames'],plan['fps'])==(7,210,30)
    assert (plan['initialFragmentSeconds'],plan['laterFragmentSeconds'])==(1,5)
    assert plan['writerObservationSeconds']==15 and plan['phaseBoundSeconds']==180
    assert compiler['argv']==plan['compile']
    assert records['authority.json']['currentSourceClosureMatchesRetained20fMergedSourceCorrespondence']==45
    assert records['authority.json']['reusedModulesMatchRetainedRuntimePins'] is True
    assert report['all105AuthorityPinsUnchangedAfterExecution'] is True

def main(root):
    manifest=json.loads((root/'manifest.json').read_text())
    archive=root/'evidence.tar.gz'; data=archive.read_bytes()
    assert len(data)==manifest['archive']['bytes']
    assert hashlib.sha256(data).hexdigest()==manifest['archive']['sha256']
    records={}
    with tarfile.open(archive,'r:gz') as source:
        assert set(source.getnames())==set(manifest['members'])
        for member in source:
            assert member.isfile()
            raw=source.extractfile(member).read(); pin=manifest['members'][member.name]
            assert len(raw)==pin['bytes'] and hashlib.sha256(raw).hexdigest()==pin['sha256']
            if member.name.endswith('.json'): records[member.name]=json.loads(raw)
    validate(records)
    # A result incorrectly upgraded to physical success must be rejected.
    records['report.json']['physicalQuestionAnswered']=True
    try: validate(records)
    except AssertionError: pass
    else: raise AssertionError('checker accepted invented physical evidence')
    print('PASS frozen preparation failure, original interruption, fixed bounds, all terminal processes; no physical claim')

if __name__=='__main__': main(pathlib.Path(sys.argv[1]))
