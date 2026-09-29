"""Unmasked ICC-normalized differences and complete review artifacts, not an acceptance threshold."""
import io, json, os, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageCms, ImageDraw
root=Path(sys.argv[1]); report=json.loads((root/'report.json').read_text()); assert report['passed']
review=root/'review';review.mkdir(exist_ok=True)
srgb=ImageCms.createProfile('sRGB')
srgb_bytes=ImageCms.ImageCmsProfile(srgb).tobytes()
def display_image(path):
    source=Image.open(path); im=source.convert('RGB'); icc=source.info.get('icc_profile')
    if icc:
        im=ImageCms.profileToProfile(im,ImageCms.ImageCmsProfile(io.BytesIO(icc)),srgb,outputMode='RGB')
    else:
        assert 'srgb' in source.info, f'Missing explicit color interpretation: {path}'
    return im
def normalized(path):
    return np.asarray(display_image(path),dtype=np.int16)
def stats(a,b):
    d=np.abs(a-b); return dict(maxRGB=int(d.max()),meanRGB=float(d.mean()),rmsRGB=float(np.sqrt(np.mean(d.astype(np.float64)**2))),shareAbove4=float(np.mean(d>4)),originalFourCodePass=bool(d.max()<=4))
def png(c,m,f):return root/c['name']/m['label']/'decoded'/f['file']
measurements={'normalization':'Embedded ICC to sRGB using Pillow ImageCms, or explicit PNG sRGB chunk; no masks','rangePairs':[],'references':[]}
for c in report['cohorts']:
    full=c['full']
    if 'clipped' in c:
        clipped=c['clipped']
        for rf,rd in zip(clipped['frames'],clipped['decoded']['frames']):
            i=next(i for i,f in enumerate(full['frames']) if f['sampleAtUs']==rf['sampleAtUs']);fd=full['decoded']['frames'][i]
            measurements['rangePairs'].append(dict(cohort=c['name'],sampleAtUs=rf['sampleAtUs'],fullIndex=i,rangeIndex=rd['index'],fullPTS=fd['pts'],rangePTS=rd['pts'],**stats(normalized(png(c,full,fd)),normalized(png(c,clipped,rd)))))
    for p in c['pictures']:
        i=next(i for i,f in enumerate(full['frames']) if f['sampleAtUs']==p['atUs']);fd=full['decoded']['frames'][i]
        measurements['references'].append(dict(cohort=c['name'],sampleAtUs=p['atUs'],**stats(normalized(Path(p['path'])),normalized(png(c,full,fd)))))
(root/'appearance-measurements.json').write_text(json.dumps(measurements,indent=2))
cohorts={c['name']:c for c in report['cohorts']}
frozen=cohorts['frozen']; rows=[]
for i,p in enumerate(frozen['pictures']):
    variants=[('R',Path(p['path'])),('A',png(frozen,frozen['full'],frozen['full']['decoded']['frames'][i]))]
    if i<len(frozen['clipped']['decoded']['frames']):variants.append(('B',png(frozen,frozen['clipped'],frozen['clipped']['decoded']['frames'][i])))
    variants.extend((label,png(cohorts[name],cohorts[name]['full'],cohorts[name]['full']['decoded']['frames'][i])) for label,name in [('C','shifted-control'),('D','missing-control')])
    rows.append(variants)
    for label,path in variants:shutil.copyfile(path,review/f'{label}-{i}.png')
for crop,name,scale in [(None,'small-full-context.png',1),((120,60,225,120),'small-pointer-crops.png',3)]:
    w,h=(256,160) if crop is None else ((crop[2]-crop[0])*scale,(crop[3]-crop[1])*scale)
    sheet=Image.new('RGB',(w*5,(h+25)*4),'#ddd');d=ImageDraw.Draw(sheet)
    for y,row in enumerate(rows):
        for label,path in row:
            x=['R','A','B','C','D'].index(label);im=display_image(path)
            if crop:im=im.crop(crop).resize((w,h),Image.Resampling.NEAREST)
            d.text((x*w+4,y*(h+25)+4),f'{label} frame {y}',fill='black');sheet.paste(im,(x*w,y*(h+25)+25))
    sheet.save(review/name,icc_profile=srgb_bytes)
recorded=cohorts['recorded']
for label,movie in [('E',recorded['full']),('F',recorded['clipped'])]:
    for offset in range(0,len(movie['decoded']['frames']),60):
        subset=movie['decoded']['frames'][offset:offset+60]
        sheet=Image.new('RGB',(1600,6*112),'#ddd');d=ImageDraw.Draw(sheet)
        for j,f in enumerate(subset):
            im=display_image(png(recorded,movie,f));im.thumbnail((160,90));x=j%10*160;y=j//10*112
            d.text((x+3,y+2),f'{label} {f["index"]}',fill='black');sheet.paste(im,(x,y+20))
        sheet.save(review/f'{label}-all-frames-{offset:04d}.png',icc_profile=srgb_bytes)
for j,p in enumerate(recorded['pictures']):
    fi=next(i for i,f in enumerate(recorded['full']['frames']) if f['sampleAtUs']==p['atUs'])
    ri=next((i for i,f in enumerate(recorded['clipped']['frames']) if f['sampleAtUs']==p['atUs']),None)
    paths=[('R',Path(p['path'])),('E',png(recorded,recorded['full'],recorded['full']['decoded']['frames'][fi]))]
    if ri is not None:paths.append(('F',png(recorded,recorded['clipped'],recorded['clipped']['decoded']['frames'][ri])))
    sheet=Image.new('RGB',(960*len(paths),565),'#ddd');d=ImageDraw.Draw(sheet)
    for k,(label,path) in enumerate(paths):
        shutil.copyfile(path,review/f'{label}-recorded-{fi:04d}.png')
        im=display_image(path);im.thumbnail((960,540));sheet.paste(im,(k*960,25));d.text((k*960+4,4),f'{label} global frame {fi}',fill='black')
    sheet.save(review/f'recorded-context-{fi:04d}.png',icc_profile=srgb_bytes)
    # Fixed native-pixel crop covers text/colored token or paragraph after scrolling.
    bounds=(380,200,1120,760)
    cropSheet=Image.new('RGB',(740*len(paths),580),'#ddd');d=ImageDraw.Draw(cropSheet)
    for k,(label,path) in enumerate(paths):
        cropSheet.paste(display_image(path).crop(bounds),(k*740,20));d.text((k*740+3,3),f'{label} crop frame {fi}',fill='black')
    cropSheet.save(review/f'recorded-crop-{fi:04d}.png',icc_profile=srgb_bytes)
media=[('A',frozen['full']),('B',frozen['clipped']),('C',cohorts['shifted-control']['full']),('D',cohorts['missing-control']['full']),('E',recorded['full']),('F',recorded['clipped'])]
for label,movie in media:
    shutil.copyfile(movie['path'],review/f'{label}.mp4')
    neutral=review/f'{label}-frames';neutral.mkdir(exist_ok=True)
    for source in (Path(movie['path']).parent/'decoded').iterdir():
        if source.suffix not in ('.png','.icc','.json'):continue
        target=neutral/source.name
        if target.exists():assert os.path.samefile(source,target)
        else:os.link(source,target)
(review/'playback.html').write_text('<!doctype html><meta charset="utf-8"><title>Matched encoded appearance review</title><style>body{font:16px system-ui;background:#eee}video{max-width:95vw;width:960px}section{margin:2em}img{max-width:95vw}</style><h1>Complete media for playback assessment</h1><p>Playback is not yet assessed. Use the original full and clipped media below; still-frame contact sheets are separate evidence.</p>'+''.join(f'<section><h2>{label}</h2><video controls loop preload="metadata" src="{label}.mp4"></video></section>' for label,_ in media))
(review/'brief.txt').write_text('Fresh visual critique. All contact sheets and crops interpret explicit PNG sRGB tags or convert embedded ICC profiles to sRGB before compositing and embed sRGB; individual native PNGs retain original profiles. Inspect small-full-context.png then small-pointer-crops.png. R is the pre-encode reference; A-D are encoded variants at matched source instants (B is shorter). Describe visible position, shape, thin-line/color and edge differences without assuming any variant is correct. Inspect every E/F all-frame sheet and all recorded-context/crop sheets; R is pre-encode, E/F encoded views at matched source instants. Every decoded native-resolution PNG is available in A-frames through F-frames, with ICC and clock metadata; complete MP4s are included. Report concrete findings and confidence, distinguish native-size from enlarged-crop effects. Do not read parent report/measurements. Do not claim continuous playback assessment from PNGs; state whether actual playback occurred. No implementation review or preset recommendation.\n')
summary={name:dict(frames=len([p for p in measurements['rangePairs'] if p['cohort']==name]),maximumRGB=max(p['maxRGB'] for p in measurements['rangePairs'] if p['cohort']==name),maxMeanRGB=max(p['meanRGB'] for p in measurements['rangePairs'] if p['cohort']==name)) for name in ['frozen','recorded']}
(root/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary))
