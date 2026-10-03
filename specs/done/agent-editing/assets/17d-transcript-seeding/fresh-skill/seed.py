from run import *
r=read('retime')['data']['revision']; labels=read('occurrences')['data']['edit']['labels']; f=read('asset-font')['data']
style={'font':{'assetId':f['id'],'postScriptName':f['fontFaces'][0]['postScriptName']},'width':960,'height':540,'size':42,'color':'#ffffffff','alignment':'center','wrap':True}
rows=read('project-words-2')['data']['page']['rows']
cues=[]
for i in [1,2]:
 words=[w for w in rows if w['clipId']==labels['occ'+str(i)] and w['ordinal']<=6]
 w=words[0]
 cues.append({'source':{'assetId':w['assetId'],'streamId':w['streamId']},'generation':w['generation'],'occurrenceClipId':w['clipId'],'words':[{'ordinal':x['ordinal'],'sourceRange':x['sourceRange']} for x in words],'trackId':labels['captions'],'label':'caption'+str(i),'separator':' ','anchor':'project','style':style})
p={'projectId':r['projectId'],'requestId':'fresh-seed-captions','expectedRevisionId':r['id'],'cues':cues}
call('seed','text.seed',p)
call('seed-replay','text.seed',p)
assert read('seed')['data']==read('seed-replay')['data']
print('EXACT DATA REPLAY PASS')
