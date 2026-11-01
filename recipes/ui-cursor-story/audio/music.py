import numpy as np, soundfile as sf, json, glob, os, librosa, sys
SR=48000; BPM=120; B=60/BPM; DUR=32.5
N=int(SR*(DUR+0.6)); L=np.zeros((N,2))
t_all=np.arange(N)/SR
def add(sig,t0,g=1.0,pan=0.0):
  i=int(round(t0*SR)); 
  if i>=N: return
  s=sig[:N-i] if i>=0 else sig[-i:]; i=max(i,0)
  if s.ndim==1: s=np.stack([s*(1-pan)**.5*np.sqrt(1) ,s*(1+pan)**.5],1)/np.sqrt(2)*np.sqrt(2)/1.0
  L[i:i+len(s)]+=s*g
def env(n,a,d,s=0.0,r=None):
  e=np.ones(n); A=int(a*SR); 
  if A>0: e[:A]=np.linspace(0,1,A)
  e[A:]=np.exp(-np.arange(n-A)/(d*SR))*(1-s)+s
  return e
rng=np.random.default_rng(3)
def kick(g=1):
  n=int(.45*SR);tt=np.arange(n)/SR;f=48+90*np.exp(-tt*28);ph=2*np.pi*np.cumsum(f)/SR
  return np.sin(ph)*np.exp(-tt*7.5)*g + 0.3*rng.standard_normal(n)*np.exp(-tt*300)
def clap():
  n=int(.3*SR);tt=np.arange(n)/SR;x=rng.standard_normal(n)
  e=sum(np.exp(-np.clip(tt-d,0,None)*60)*(tt>=d) for d in (0,.011,.022))*np.exp(-tt*14)
  b=librosa.effects.preemphasis(x*e,coef=.9);return b*.5
def hat(open_=False):
  n=int((.25 if open_ else .06)*SR);tt=np.arange(n)/SR;x=rng.standard_normal(n);x=np.diff(np.concatenate([[0],x]))
  return x*np.exp(-tt*(18 if open_ else 90))*.25
def note(f,dur,kind='pluck',g=.2):
  n=int(dur*SR);tt=np.arange(n)/SR
  if kind=='pluck':
    s=(np.sin(2*np.pi*f*tt)+.35*np.sin(2*np.pi*2*f*tt)+.12*np.sin(2*np.pi*3*f*tt))*np.exp(-tt*6)
  elif kind=='pad':
    s=sum(np.sin(2*np.pi*f*(1+dt)*tt+p) for dt,p in ((0,0),(.004,1),(-.0035,2)))/3
    s=s+.25*sum(np.sin(2*np.pi*2*f*(1+dt)*tt) for dt in (.003,-.003))/2
    a=min(.6,dur/3);s*=np.minimum(1,tt/a)*np.minimum(1,(dur-tt)/.4)
  elif kind=='bass':
    s=np.tanh(1.6*(np.sin(2*np.pi*f*tt)+.3*np.sin(2*np.pi*2*f*tt)))*np.minimum(1,(dur-tt)/.03)*np.exp(-tt*1.5)
  return s*g
m2f=lambda m:440*2**((m-69)/12)
# progression (2 s per bar): Fmaj7, G6, Em7, Am7, voiced warm and low
CH=[[53,57,60,64],[55,59,62,64],[52,55,59,62],[57,60,64,67]]
BASS=[41,43,40,45]
def bar(t): return int(t//2)%4
def piano(f,dur,g):
  n=int(dur*SR);tt=np.arange(n)/SR
  s=sum(a*np.sin(2*np.pi*f*h*tt)*np.exp(-tt*(1.6+h*1.2)) for h,a in ((1,1),(2,.35),(3,.12),(4,.05)))
  s*=np.minimum(1,tt/.012)*np.minimum(1,(dur-tt)/.25)
  return s*g
def shaker():
  n=int(.09*SR);tt=np.arange(n)/SR;x=rng.standard_normal(n)
  y=np.convolve(x,np.ones(6)/6,'same')-np.convolve(x,np.ones(40)/40,'same')
  return y*np.sin(np.pi*tt/.09)**2*.12
def thump():
  n=int(.35*SR);tt=np.arange(n)/SR;f=55+25*np.exp(-tt*20)
  return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*9)*np.minimum(1,tt/.004)*.5
for k in range(int(DUR/2)+1):
  t0=k*2.0; c=CH[k%4]
  if t0>=DUR or t0>=30.0: break
  for m in c: add(note(m2f(m),2.1,'pad',.035),t0)
  # felt piano chord on the bar, a softer echo on beat 3
  for j,m in enumerate(c): add(piano(m2f(m+12),1.9,.05),t0+j*.012)
  if 6.0<=t0<22.0 or t0>=28.0:
    for j,m in enumerate(c[1:]): add(piano(m2f(m+12),.9,.03),t0+1.0+j*.012)
for i in range(int(DUR/B*2)):
  t=i*B/2; c=CH[bar(t)]
  inbreak=22.0<=t<27.5
  if i%2==0 or (6.0<=t<22.0):
    m=c[[0,2,1,3,2,1,3,2][i%8]]+24
    g=.022 if t<6 else (.016 if inbreak else .026)
    if t<29.0: add(note(m2f(m),.6,'pluck',g),t,1,(-.3 if i%2 else .3))
for i in range(int(DUR/B)):
  t=i*B; groove=(6.0<=t<22.0) or (28.0<=t<28.7)
  if groove:
    if i%2==0: add(thump(),t,.55)
    if i%4==0: add(note(m2f(BASS[bar(t)]),B*3.6,'bass',.16),t)
add(thump(),27.5,.6)
for j,m in enumerate([53,57,60,64,67]): add(note(m2f(m),3.4,'pad',.04),29.3); add(piano(m2f(m+12),3.3,.045),29.6+j*.03)
fo=np.clip((32.5-t_all)/1.2,0,1); L*=fo[:,None]
music=L.copy()
# sfx
cues=json.load(open('cues.json')); FX=np.zeros_like(L)
for t,i,anchor,db in cues:
  x,sr=sf.read('sfx/'+i.replace('/','__')+'.wav',always_2d=True)
  if sr!=SR: x=librosa.resample(x.T,orig_sr=sr,target_sr=SR).T
  e=np.abs(x).max(1); pk=int(np.argmax(e)); on=int(np.argmax(e>e.max()*10**(-30/20)))
  off=(pk if anchor=='peak' else on)/SR
  st=int(round((t-off)*SR)); 
  if st<0: x=x[-st:]; st=0
  n=min(len(x),N-st); FX[st:st+n]+=x[:n]*10**(db/20)*1.0
# duck music 6 dB for 0.35 s before big hits, back on the hit
for th in ():
  for i in range(int((th-.35)*SR),int(th*SR)): music[i]*=10**(-6/20)
mix=music*0.9+FX
mix=mix[:int(DUR*SR)]
sf.write('film_mix_raw.wav',mix,SR,subtype='FLOAT')
print('ok',mix.shape, np.abs(mix).max())
