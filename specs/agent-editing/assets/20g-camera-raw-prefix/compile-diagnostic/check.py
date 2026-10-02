"""Inspect frozen compile-only evidence; never invoke its retained binary."""
import hashlib, json, pathlib, sys, tarfile

def packet(root):
    manifest=json.loads((root/'manifest.json').read_text()); raw=(root/'evidence.tar.gz').read_bytes()
    assert len(raw)==manifest['archive']['bytes'] and hashlib.sha256(raw).hexdigest()==manifest['archive']['sha256']
    contents={}
    with tarfile.open(root/'evidence.tar.gz','r:gz') as archive:
        assert set(archive.getnames())==set(manifest['members'])
        for member in archive:
            assert member.isfile(); data=archive.extractfile(member).read(); pin=manifest['members'][member.name]
            assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
            contents[member.name]=data
    return contents

def verify(contents, original):
    j=lambda name:json.loads(contents[name])
    report=j('report.json');process=j('process.json');plan=j('plan.json');authority=j('authority.json')
    assert report['status']=='compile-only-pass' and report['physicalQuestionAnswered'] is False
    assert report['mediaDispatched'] is False and report['binaryInvoked'] is False
    assert process['label']=='compile-only-diagnostic' and process['terminal'] is True and process['exitCode']==0
    assert process['argv']==plan['compile'] and process['boundSeconds']==150
    assert 0<process['elapsedSeconds']<150 and process['totalPhaseElapsedSeconds']<150
    assert max(process['stdioBytes'].values())<=process['stdioCapBytes']==1048576
    binary=contents['prefix-probe'];assert len(binary)==process['binary']['bytes']
    assert hashlib.sha256(binary).hexdigest()==process['binary']['sha256']
    before=j('cache-before.json');after=j('cache-after.json');assert before==after
    assert report['cache']['added']==report['cache']['removed']==report['cache']['contentChanged']==[]
    assert before['root']==plan['moduleCache']=='/tmp/screenrec-23l2-png-publication/module-cache'
    frozen=original['Prefix.swift'];pin=next(p for p in authority['pins'] if p['path'].endswith('/screenrec-20g-raw-prefix/Prefix.swift'))
    assert len(frozen)==pin['bytes'] and hashlib.sha256(frozen).hexdigest()==pin['sha256']
    old=json.loads(original['plan.json'])['compile']; actual=process['argv'].copy()
    diagnostics=['-driver-time-compilation','-Xfrontend','-debug-time-expression-type-checking','-Xfrontend','-debug-time-function-bodies']
    assert actual[-len(diagnostics):]==diagnostics;actual=actual[:-len(diagnostics)]
    actual[actual.index('-module-cache-path')+1]=old[old.index('-module-cache-path')+1]
    actual[actual.index('-o')+1]=old[old.index('-o')+1]
    assert actual==old
    assert process['stdioBytes']['stderr']==len(contents['compile.stderr'])>0
    assert b'70.72ms' in contents['compile.stderr'] and b'PrefixProbe.main()' in contents['compile.stderr']
    end=j('termination.json');assert end['exitCode']==1 and end['stdout']==end['stderr']==''
    assert j('tool-session.json')['terminal']['exit_code']==0

def main(root):
    contents=packet(root); original=packet(root.parent);verify(contents,original)
    report=json.loads(contents['report.json']);report['binaryInvoked']=True
    rejected=contents.copy();rejected['report.json']=json.dumps(report).encode()
    try:verify(rejected,original)
    except AssertionError:pass
    else:raise AssertionError('accepted an unauthorized binary invocation')
    print('PASS frozen compile-only readiness, exact common recipe/source, unchanged cache and terminal evidence; no media claim')

if __name__=='__main__':main(pathlib.Path(sys.argv[1]))
