% gearmfg.m - MATLAB mirror of the core of gearmfg.py (guide M5d, cylindrical gear manufacturing)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of gearmfg.py.
% Run it once and compare with these gearmfg.py numbers (default input, python gearmfg.py examples):
%   d 124.233, da 127.833, df 118.833, h 4.500 mm, blank mass 2.49 kg
%   hob d0 65.00, lead angle 3.528 deg, swivel 11.472 deg; n0 682 rpm, table 22.74 rpm; approach 17.8, path 48.8 mm, 0.86 min cut
%   feed marks 7.63 um, enveloping flats 0.44 um, Hoffmeister h_max 0.130 mm, hob cost 1.273 EUR/part
%   shaping 588 double strokes/min, 5.31 min; skiving tool helix -5 deg, work 1119 rpm, tool 1815 rpm, 1.88 min
%   CHD final 0.350, green 0.450 mm; carburising 930 C 1.33 h; generating grinding 4375 rpm, 2.13 min; profile grinding 11.62 min
%   induction reference depth 10 kHz 5.51 mm
% Requires base MATLAB (R2016b or newer: local functions in scripts).

clear; clc;
P = struct('mn',2,'z',60,'an',20,'beta',15,'x',-0.10,'b',28,'haP',1.0,'hfP',1.25, ...
           'da0',70,'z0',2,'i0',16,'same_hand',true,'vc',150,'fa',2.5,'cuts',1,'overrun',3,'t_aux',0.5, ...
           'shp_vc',40,'shp_fc',0.30,'shp_cuts',2,'shp_over',3,'shp_fr',0.02, ...
           'Sigma',20,'skv_z0',37,'skv_vc',150,'skv_fa',0.20,'skv_passes',10, ...
           'T_carb',930,'case_ratio',0.6,'stock',0.10, ...
           'ds',275,'vs',63,'gz0',3,'fa_r',0.40,'fa_f',0.15,'La_g',10, ...
           'vf',3000,'passes',4,'index_s',2.0,'ae',0.05,'pg_over',5,'rho',7.85e-6);

% workpiece
be = deg2rad(P.beta); an = deg2rad(P.an);
d  = P.mn*P.z/cos(be);
da = d + 2*P.mn*(P.haP + P.x);
df = d - 2*P.mn*(P.hfP - P.x);
h  = (da - df)/2;
m  = P.rho*pi/4*(da^2 - (0.35*d)^2)*P.b;
fprintf('d %.3f, da %.3f, df %.3f, h %.3f mm, mass %.2f kg\n', d, da, df, h, m);

% hobbing
d0 = P.da0 - 2*P.hfP*P.mn;
g0 = asin(P.z0*P.mn/d0);
if P.same_hand, eta = be - g0; else, eta = be + g0; end
n0 = 1000*P.vc/(pi*P.da0);  nt = n0*P.z0/P.z;
La = sqrt(h*(P.da0 - h))/cos(be);
L  = P.b + La + P.overrun;
th = P.cuts*P.z*L/(P.z0*n0*P.fa);
fprintf('hob d0 %.2f, gamma0 %.3f, swivel %.3f deg, n0 %.0f, table %.2f rpm, La %.1f, L %.1f, t %.2f min\n', ...
        d0, rad2deg(g0), rad2deg(eta), n0, nt, La, L, th);
dfm = P.fa^2*sind(P.an)/(4*P.da0);
dy  = pi^2*P.z0^2*P.mn*sind(P.an)/(4*P.z*P.i0^2);
hmax = 4.9*P.mn*P.z^(9.25e-3*P.beta-0.542)*exp(-0.015*P.beta)*exp(-0.015*P.x)*(P.da0/2/P.mn)^(-8.25e-3*P.beta-0.225) ...
       *(P.i0/P.z0)^(-0.877)*(P.fa/P.mn)^0.511*(h/P.mn)^0.319;
fprintf('feed marks %.2f um, enveloping flats %.2f um, h_max %.3f mm\n', 1000*dfm, 1000*dy, hmax);

% shaping
H = P.b + 2*P.shp_over;  nDH = 1000*P.shp_vc/(2*H);
ts = P.shp_cuts*pi*d/(P.shp_fc*nDH) + h/(P.shp_fr*nDH) + P.t_aux;
fprintf('shaping %.0f strokes/min, %.2f min total\n', nDH, ts);

% power skiving (velocity triangle)
S = deg2rad(P.Sigma);  b0 = be - S;
vw = P.skv_vc*cos(b0)/sin(S);  nw = 1000*vw/(pi*d);  n0s = nw*P.z/P.skv_z0;
tsk = P.skv_passes*(P.b/cos(be) + 2)/(P.skv_fa*nw) + P.t_aux;
fprintf('skiving tool helix %.2f deg, work %.0f rpm, tool %.0f rpm, %.2f min total\n', rad2deg(b0), nw, n0s, tsk);

% heat treatment
chd = 0.5*(0.15 + 0.20)*P.mn;  chd_g = chd + P.stock;
k = 802.6/10^(3720/(P.T_carb + 273.15));
tc = (chd_g/P.case_ratio/k)^2;
fprintf('CHD final %.3f, green %.3f mm, carburising %.2f h\n', chd, chd_g, tc);
fprintf('induction reference depth 10 kHz: %.2f mm\n', 503*sqrt(1.2e-6/1e4)*1000);

% hard finishing
ns = P.vs*60000/(pi*P.ds);  Lg = P.b/cos(be) + P.La_g;
tg = P.z*Lg/(P.gz0*ns*P.fa_r) + P.z*Lg/(P.gz0*ns*P.fa_f) + P.t_aux;
Lp = P.b/cos(be) + 2*P.pg_over;
tp = P.z*P.passes*(Lp/P.vf*60 + P.index_s)/60 + P.t_aux;
fprintf('generating grinding %.0f rpm, %.2f min; profile grinding %.2f min, Qw %.2f mm3/(mm s)\n', ns, tg, tp, P.ae*P.vf/60);
