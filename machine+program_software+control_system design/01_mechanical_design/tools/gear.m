% gear.m - MATLAB mirror of the core of gear.py (guide M5, cylindrical involute gear pair)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of gear.py.
% Run it once and compare with the gear.py numbers below (default input: 15 kW, mn 2, z 19/60, beta 15, x 0.25/-0.10, b 28).
% Expected (python gear.py examples):
%   d 39.340 / 124.233, da 44.333 / 127.826, df 35.340 / 118.833 mm, a_w 82.083 mm, alpha_wt 21.189 deg
%   eps_alpha 1.520, eps_beta 1.153
%   T1 98.79 N m, Ft 5022 N, Fr 1947 N, Fa 1346 N, v 2.99 m/s
%   K_V 1.037, K_Fbeta 1.207, Z_H 2.391, Z_E 189.8, Z_eps 0.811, Z_beta 1.017
%   sigma_H0 917 MPa, sigma_H 1168 MPa -> S_H 1.28
%   pinion Y_F 1.277, Y_S 2.095, sigma_F 328 MPa -> S_F 3.05 ; wheel Y_F 1.401, Y_S 1.990, sigma_F 342 MPa -> S_F 2.92
%   W_k pinion k 3: 15.690 mm (nominal), wheel k 8: 46.000 mm; over balls D_M 3.25: 44.105 / 127.948 mm
% Requires base MATLAB (R2016b or newer: local functions in scripts).

clear; clc;
P = struct('mn',2.0,'z1',19,'z2',60,'an',20,'beta',15,'x1',0.25,'x2',-0.10,'b',28, ...
           'haP',1.0,'hfP',1.25,'rhofP',0.38,'P_kW',15,'n1',1450,'KA',1.25,'KHb',1.25,'KHa',1.0, ...
           'grade',6,'sHlim',1500,'sFlim',500,'E',206000,'nu',0.3,'ZLVR',1.0);

G = geom(P);
fprintf('d %.3f / %.3f, da %.3f / %.3f, a_w %.3f, alpha_wt %.3f deg, eps_a %.3f, eps_b %.3f\n', ...
        G.d1, G.d2, G.da1, G.da2, G.aw, rad2deg(G.awt), G.ea, G.eb);

% ---- forces
T1 = P.P_kW*1000/(P.n1*2*pi/60);
Ft = 2*T1*1000/G.d1;  Fr = Ft*tan(G.awt);  Fa = Ft*tand(P.beta);
v  = pi*G.d1/1000*P.n1/60;
fprintf('T1 %.2f N m, Ft %.0f, Fr %.0f, Fa %.0f N, v %.2f m/s\n', T1, Ft, Fr, Fa, v);

% ---- factors
K1tab = [5 6.7; 6 13.3; 7 23.9; 8 34.8; 9 47.0; 10 68.2];   % helical (spur: 7.5 14.9 26.8 39.1 52.8 76.6, K2 0.0193)
K1 = K1tab(K1tab(:,1)==P.grade, 2);  K2 = 0.0087;
w  = max(P.KA*Ft/P.b, 100);
KV = 1 + (K1/w + K2)*P.z1*v/100*sqrt(G.u^2/(1+G.u^2));
h  = (P.haP + P.hfP)*P.mn;  r = P.b/h;  NF = r^2/(1 + r + r^2);  KFb = P.KHb^NF;
ZH = sqrt(2*cos(G.bb)*cos(G.awt)/(cos(G.at)^2*sin(G.awt)));
ZE = sqrt(1/(pi*2*(1 - P.nu^2)/P.E));
if G.eb >= 1, Ze = sqrt(1/G.ea); else, Ze = sqrt((4 - G.ea)/3*(1 - G.eb) + G.eb/G.ea); end
Zb = 1/sqrt(cosd(P.beta));
sH0 = ZH*ZE*Ze*Zb*sqrt(Ft/(G.d1*P.b)*(G.u + 1)/G.u);
sH  = sH0*sqrt(P.KA*KV*P.KHb*P.KHa);
SH  = P.sHlim*P.ZLVR/sH;
Yb  = 1 - min(G.eb,1)*min(P.beta,30)/120;
fprintf('K_V %.3f, K_Fb %.3f, Z_H %.3f, Z_E %.1f, Z_eps %.3f -> sigma_H %.0f MPa, S_H %.2f\n', KV, KFb, ZH, ZE, Ze, sH, SH);
for i = 1:2
    [YF, YS] = formB(P, G, i);
    sF = Ft/(P.b*P.mn)*YF*YS*Yb*P.KA*KV*KFb*P.KHa;
    fprintf('gear %d: Y_F %.3f, Y_S %.3f, sigma_F %.0f MPa, S_F %.2f\n', i, YF, YS, sF, 2*P.sFlim/sF);
end

% ---- manufacturing data
for i = 1:2
    [k, W] = spanW(P, G, i);
    M = overBalls(P, G, i, 3.25, 0);
    fprintf('gear %d: W_k k %d = %.3f mm, M_d (D_M 3.25) = %.3f mm\n', i, k, W, M);
end

% ===================================================================== local functions
function y = invf(a), y = tan(a) - a; end
function a = invinv(y)
    a = (3*y)^(1/3);
    for it = 1:60, a = a - (tan(a) - a - y)/tan(a)^2; end
end
function G = geom(P)
    an = deg2rad(P.an); be = deg2rad(P.beta);
    G.at = atan(tan(an)/cos(be)); mt = P.mn/cos(be);
    G.d1 = mt*P.z1; G.d2 = mt*P.z2; G.db1 = G.d1*cos(G.at); G.db2 = G.d2*cos(G.at);
    G.bb = atan(tan(be)*cos(G.at));
    a0 = (G.d1 + G.d2)/2; xs = P.x1 + P.x2;
    G.awt = invinv(2*tan(an)*xs/(P.z1 + P.z2) + invf(G.at));
    G.aw  = a0*cos(G.at)/cos(G.awt);
    k = (a0 + xs*P.mn - G.aw)/P.mn;
    G.da1 = G.d1 + 2*P.mn*(P.haP + P.x1 - k); G.da2 = G.d2 + 2*P.mn*(P.haP + P.x2 - k);
    G.df1 = G.d1 - 2*P.mn*(P.hfP - P.x1);    G.df2 = G.d2 - 2*P.mn*(P.hfP - P.x2);
    ga = 0.5*(sqrt(G.da1^2 - G.db1^2) + sqrt(G.da2^2 - G.db2^2)) - G.aw*sin(G.awt);
    G.ea = ga/(pi*mt*cos(G.at)); G.eb = P.b*sin(be)/(pi*P.mn); G.u = P.z2/P.z1;
    G.zn1 = P.z1/(cos(G.bb)^2*cos(be)); G.zn2 = P.z2/(cos(G.bb)^2*cos(be));
end
function [YF, YS] = formB(P, G, i)
    mn = P.mn; an = deg2rad(P.an); be = deg2rad(P.beta);
    if i == 1, z = P.z1; x = P.x1; zn = G.zn1; d = G.d1; da = G.da1;
    else,      z = P.z2; x = P.x2; zn = G.zn2; d = G.d2; da = G.da2; end
    hfP = P.hfP*mn; rho = P.rhofP*mn;
    E = pi/4*mn - hfP*tan(an) - (1 - sin(an))*rho/cos(an);
    Gm = rho/mn - hfP/mn + x;
    H = 2/zn*(pi/2 - E/mn) - pi/3;
    th = pi/6;
    for it = 1:200, th = 2*Gm/zn*tan(th) - H; end
    sFn  = mn*(zn*sin(pi/3 - th) + sqrt(3)*(Gm/cos(th) - rho/mn));
    rhoF = mn*(rho/mn + 2*Gm^2/(cos(th)*(zn*cos(th)^2 - 2*Gm)));
    dn = mn*zn; dbn = dn*cos(an); dan = dn + da - d; ean = G.ea/cos(G.bb)^2;
    den = 2*sqrt((sqrt((dan/2)^2 - (dbn/2)^2) - pi*d*cos(be)*cos(an)/z*(ean - 1))^2 + (dbn/2)^2);
    aen = acos(dbn/den);
    ge  = (pi/2 + 2*x*tan(an))/zn + invf(an) - invf(aen);
    aFen = aen - ge;
    hFe = 0.5*mn*((cos(ge) - sin(ge)*tan(aFen))*den/mn - zn*cos(pi/3 - th) - Gm/cos(th) + rho/mn);
    YF = 6*(hFe/mn)*cos(aFen)/((sFn/mn)^2*cos(an));
    L = sFn/hFe; qs = sFn/(2*rhoF);
    YS = (1.2 + 0.13*L)*qs^(1/(1.21 + 2.3/L));
end
function [k, W] = spanW(P, G, i)
    mn = P.mn; an = deg2rad(P.an);
    if i == 1, z = P.z1; x = P.x1; d = G.d1; db = G.db1; else, z = P.z2; x = P.x2; d = G.d2; db = G.db2; end
    amt = acos(db/(d + 2*x*mn));
    k = max(2, round(z/pi*(tan(amt)/cos(G.bb)^2 - 2*x*tan(an)/z - invf(G.at)) + 0.5));
    W = mn*cos(an)*((k - 0.5)*pi + z*invf(G.at) + 2*x*tan(an));
end
function M = overBalls(P, G, i, DM, Asn)
    mn = P.mn; an = deg2rad(P.an);
    if i == 1, z = P.z1; x = P.x1; d = G.d1; else, z = P.z2; x = P.x2; d = G.d2; end
    y = invf(G.at) + DM/(mn*z*cos(an)) - pi/(2*z) + 2*x*tan(an)/z + Asn/1000/(mn*z);
    aMt = invinv(y);
    dM = d*cos(G.at)/cos(aMt);
    if mod(z,2) == 0, M = dM + DM; else, M = dM*cos(pi/(2*z)) + DM; end
end
