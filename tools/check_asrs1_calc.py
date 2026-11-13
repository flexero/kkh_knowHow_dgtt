# Hand check of the AS/RS item 1 calculations (guide 31 §17) - Python stdlib only
import math
g = 9.81
def tt(d,v,a):
    d=abs(d)
    if d<1e-9: return 0
    return d/v+v/a if d>=v*v/a else 2*math.sqrt(d/a)
vx,ax,vz,az,vf,af=3,.5,1,.5,1,1.2
L=1.2+14*1.925+0.1; H=0.45+6*1.25-0.75; zio=0.75
P1=(L/5,zio+2*H/3);P2=(2*L/3,zio+H/5)
mt=lambda x0,z0,x1,z1:max(tt(x1-x0,vx,ax),tt(z1-z0,vz,az))
t1=mt(0,zio,*P1);t2=mt(0,zio,*P2);t12=mt(*P1,*P2)
ff=tt(1.35,vf,af);lhd=2*ff+0.5;st=3+lhd
sc=(2*t1+2*t2)/2+2*st; dc=t1+t12+t2+4*lhd+3*3
# ---- rack beam
slot=300; span=1825; a=0.075*1000+400  # crate centre from upright face, mm
h,b,t=120,50,2.0
I=(b*h**3-(b-2*t)*(h-2*t)**3)/12; W=I/(h/2)
P=slot/2*g/2*2/2  # per beam per crate: crate 300 kg -> front/rear beam 150 kg each
P=slot*g/2
M=P*a/1000  # N*m two symmetric point loads
sig=M*1000/W; sigd=1.4*sig
E=210000
d=P*a*(3*span**2-4*a**2)/(24*E*I)
print("beam I",I,"W",W,"P",P,"M",M,"sig",sig,"sigd",sigd,"util",sigd/355,"defl",d,"lim",span/200)
Wuni=2*P; Mu=Wuni*span/1000/8; print("udl M",Mu)
# ---- upright
lev=7
Nk=slot*g*lev/1000  # kN inner upright (1 crate per level)
self_=120*g/1000
Ned=1.4*Nk+1.3*self_
Aeff=520; i=30; Lcr=1250; fy=355
eps=math.sqrt(235/fy); lam1=93.9*eps; lb=(Lcr/i)/lam1
al=0.34; ph=0.5*(1+al*(lb-0.2)+lb**2); chi=1/(ph+math.sqrt(ph**2-lb**2))
Nb=chi*Aeff*fy/1.0/1000
print("upright Nk",Nk,"Ned",Ned,"lam",Lcr/i,"lb",lb,"chi",chi,"Nb",Nb,"util",Ned/Nb)
# base plate / floor
Nfloor=Nk+self_; A=150*120; p=Nfloor*1000/A
print("floor",Nfloor,"p",p)
tot=392*slot/1000; print("stored t",tot)
# rack self weight est
# ---- crane wheel loads
parts=[("bottom frame + drives",1600,0.20,0.4),("mast",1000,-0.65,5.0),("carriage + fork",600,0.0,8.3),("cabinet, platform, misc",800,1.0,1.0),("top frame",200,-0.65,9.4)]
xw1,xw2=-1.05,1.35; wb=xw2-xw1
def wl(load):
    ms=parts+[("load",load,0.0,8.3)] if load else parts
    m=sum(p[1] for p in ms); mom=sum(p[1]*(p[2]-xw1) for p in ms)
    R2=mom/wb; R1=m-R2; sh=sum(p[1]*p[3] for p in ms)
    return m,R1*g/1000,R2*g/1000,sh
m,R1,R2,sh=wl(300); _,R1e,R2e,_=wl(0)
dR=0.5*sh/wb/1000; phi=1.15
Rmax=phi*max(R1,R2)+dR
Pmean=(R1e+2*Rmax)/3
D=400; n=3.0/(math.pi*D/1000)*60
def c1f(n):
    tb=[(50,1.03),(100,0.94),(125,0.91),(160,0.87),(200,0.82)]
    for (n0,c0),(n1,c1) in zip(tb,tb[1:]):
        if n0<=n<=n1: return c0+(c1-c0)*(n-n0)/(n1-n0)
c1=c1f(n); beff=50-2*4; Pal=5.0*beff*D*c1*1.0/1000
print("wheel m",m,"R1",R1,"R2",R2,"R1e",R1e,"R2e",R2e,"sum mh",sh,"dR",dR,"Rmax",Rmax,"Pmean",Pmean,"n",n,"c1",c1,"Pal",Pal,"util",Pmean/Pal)
# top guide
Ht=(300*g*1.35+150*g*1.35/2)/9.3; print("top guide",Ht)
# ---- mast deflection
B,Dm,tm=350,500,6
Im=(B*Dm**3-(B-2*tm)*(Dm-2*tm)**3)/12; Am=B*Dm-(B-2*tm)*(Dm-2*tm)
Hm=9300; am=0.5; mM=1000; q=mM*am/Hm
dq=q*Hm**4/(8*E*Im); Pc=(600+300)*am; hc=8000
dP=Pc*hc**2*(3*Hm-hc)/(6*E*Im); dc_=Pc*hc**3/(3*E*Im)+q*hc**2*(6*Hm**2-4*Hm*hc+hc**2)/(24*E*Im)
k=3*E*Im/Hm**3*1000; meq=0.24*mM+900; f=1/(2*math.pi)*math.sqrt(k/meq)
print("mast I",Im,"A",Am,"kg/m",Am*7.85e-3,"q",q,"dq",dq,"dP",dP,"top",dq+dP,"at carriage",dc_,"k N/m",k,"f",f,"dyn x2",2*(dq+dP))
# ---- travel drive
mt_=4500; rot=1.05; w=0.01; v=3.0; at=0.5; eta=0.9
Fa=mt_*at*rot; Fr=w*mt_*g; F=Fa+Fr; Pp=F*v/eta/1000; Ps=Fr*v/eta/1000
ser=[0.75,1.1,1.5,2.2,3,4,5.5,7.5,11,15,18.5,22,30,37]
sel=lambda p:next(s for s in ser if s>=p)
PN=sel(max(Pp/1.5,Ps)); nw=n; i_=1450/nw; Tw=F*D/2/1000
print("travel Fa",Fa,"Fr",Fr,"F",F,"Ppeak",Pp,"Psteady",Ps,"PN",PN,"wheel rpm",nw,"i",i_,"Twheel",Tw)
# hoist
mh=900; vh=1.0; ah=0.5; etah=0.85
Phs=mh*g*vh/etah/1000; Php=mh*(g+ah)*vh/etah/1000; PNh=sel(max(Php/1.5,Phs)*1.0)
PNh2=sel(Phs)
rope=mh*(g+ah); mbf=40.0; Zp=2*mbf*1000/rope
Dd=250; nd=vh/(math.pi*Dd/1000)*60; ih=1450/nd
print("hoist Ps",Phs,"Pp",Php,"PN(s1 >= steady)",PN2:=PNh2,"rope F",rope,"Zp",Zp,"drum rpm",nd,"i",ih)
# fork
mf=450; Ff=mf*1.2+0.05*mf*g; Pf=Ff*1.0/0.8/1000; print("fork F",Ff,"P",Pf,sel(Pf))
# throughput
req=18+22; p=0.5
tj=(1-p)*sc+p*dc/2; cap=3600/tj; print("cap",cap,"util",req/cap, "sc",sc,"dc",dc)
# positioning budget x
bx=[3,2,5,3,2,5]; print("budget x rss",math.sqrt(sum(v*v for v in bx)),"sum",sum(bx))
bz=[2,1,5,3,2,5]; print("budget z rss",math.sqrt(sum(v*v for v in bz)),"sum",sum(bz))
# energy per SC cycle
def vpk(d,v,a): d=abs(d); return min(v,math.sqrt(d*a))
eb=0.65; aux=0.5
def move(d,dz,loaded):
    mT=(4200+(300 if loaded else 0))*rot; mH=600+(300 if loaded else 0)
    vp=vpk(d,3,0.5); Ek=0.5*mT*vp**2; Er=w*mT/rot*g*abs(d); Ep=mH*g*dz
    vin=(Ek+Er)/0.9+max(0,Ep)/0.85
    back=eb*(Ek+max(0,-Ep))
    return vin,back
tot=0;back=0
for (Px,Pz) in (P1,P2):
    dz=Pz-zio
    for loaded_out in (True,False):
        a1=move(Px,dz,loaded_out); a2=move(Px,-dz,not loaded_out)
        tot+=a1[0]+a2[0]; back+=a1[1]+a2[1]
tot/=4; back/=4
Eaux=aux*1000*sc
noR=(tot+Eaux)/3600; wR=(tot-back+Eaux)/3600
print("energy SC Wh no regen",noR,"with",wR,"motion only",tot/3600,"back",back/3600,"aux",Eaux/3600)
