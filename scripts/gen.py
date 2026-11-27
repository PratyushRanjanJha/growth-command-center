import pandas as pd, json, sys
x=pd.read_excel(sys.argv[1],sheet_name=None)
dm=x['Daily Marketing'].drop_duplicates('activity_id')
P=x['People']; ext=set(P[P.person_type=='external'].person_id)
R=x['Registrations'].drop_duplicates('registration_id'); R=R[R.person_id.isin(ext)].copy()
H=x['Registration History'].drop_duplicates('history_id').sort_values('effective_at')
last=H.groupby('registration_id').tail(1).set_index('registration_id').status
R['final']=R.registration_id.map(last)
C=x['Check-ins'].drop_duplicates('event_id')
V=C[(C.result=='admitted')&(C.verification=='verified')&(C.person_id.isin(ext))].copy()
att=set(V.person_id); R['att']=R.person_id.isin(att)
V['day']=pd.to_datetime(V.occurred_at).dt.strftime('%Y-%m-%d')
I=x['Interest and Engagement'].drop_duplicates('interaction_id')
Pe=P[P.person_type=='external']
camp=x['Campaigns']
ch=[]
for _,c in camp.iterrows():
  cid=c.campaign_id; d=dm[dm.campaign_id==cid]; r=R[R.campaign_id==cid]; ii=I[I.campaign_id==cid]
  ch.append(dict(id=cid,name=c.campaign_name,channel=c.channel,owner=c.owner_name,
    spend=int(d.marketing_spend_inr.sum()),impressions=int(d.impressions.sum()),clicks=int(d.clicks.sum()),
    reach=int(d.reported_reach.sum()),sessions=int(d.landing_page_sessions.sum()),regStarts=int(d.registration_starts.sum()),
    identified=int((Pe.first_campaign_id==cid).sum()),regs=int(len(r)),
    confirmed=int((r.final=='confirmed').sum()),cancelled=int((r.final=='cancelled').sum()),
    waitlisted=int((r.final=='waitlisted').sum()),interested=int((r.final=='interested').sum()),
    attendees=int(r.att.sum()),optOuts=int(ii[ii.event_type=='opted_out'].person_id.nunique()),
    brochure=int(ii[ii.event_type=='brochure_download'].person_id.nunique())))
R['wk']=pd.to_datetime(R.registered_at).dt.to_period('W').dt.start_time.dt.strftime('%Y-%m-%d')
weekly=[dict(week=k,regs=int(g.shape[0]),attended=int(g.att.sum())) for k,g in R.groupby('wk')]
dm['wk']=pd.to_datetime(dm.activity_date).dt.to_period('W').dt.start_time.dt.strftime('%Y-%m-%d')
ws=dm.groupby('wk').marketing_spend_inr.sum().to_dict()
for w in weekly: w['spend']=int(ws.get(w['week'],0))
T=x['Targets']
out=dict(event=dict(name='CampusFest 2025',start='2025-04-12',end='2025-04-13'),
 targets=[dict(effective=str(t.effective_at)[:10],identified=int(t.identified_external_people_goal),regs=int(t.registration_goal),visitors=int(t.unique_external_visitors_goal),budget=int(t.marketing_budget_inr),label=t.target_version) for _,t in T.iterrows()],
 channels=ch, walkIns=int(V[V.registration_id.isna()].person_id.nunique()),
 uniqueAttendees=len(att), day1=int(V[V.day=='2025-04-12'].person_id.nunique()), day2=int(V[V.day=='2025-04-13'].person_id.nunique()),
 bothDays=int((V.groupby('person_id').day.nunique()==2).sum()),
 dedup=dict(marketingRows=len(x['Daily Marketing'])-len(dm),checkins=len(x['Check-ins'])-len(C)),
 checkinMix=dict(denied=int((C.result=='denied').sum()),pending=int((C.result=='pending').sum()),manual=int(((C.source=='manual')&(C.result=='admitted')).sum())),
 nonExternal=int((P.person_type!='external').sum()), weekly=weekly)
open(sys.argv[2],'w').write('// Generated from Attendee_Dataset.xlsx (deduplicated; external, admitted+verified attendance)\nexport const HIST = '+json.dumps(out,indent=1)+';\n')
print(json.dumps({k:v for k,v in out.items() if k not in('channels','weekly')}))
print(sum(c['spend'] for c in ch), sum(c['attendees'] for c in ch), sum(c['optOuts'] for c in ch))
