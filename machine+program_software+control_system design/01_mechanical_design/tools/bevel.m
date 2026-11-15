% bevel.m - MATLAB mirror of the core of bevel.py (guide M5b, spiral / straight bevel gears)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of bevel.py.
% Run it once and compare with these bevel.py numbers (default input, python bevel.py examples):
%   pitch angles 21.5713 / 68.4287 deg, Re 69.358, Rm 60.358, m_mt 2.6107, m_mn 2.1386, x 0.3290 / -0.3290
%   face angles 24.774 / 70.298 deg, dae 57.223 / 130.271, crown to apex 63.270 / 23.892 mm
%   zv 18.28 / 116.96, eps_va 1.225, eps_vb 1.537
%   Ft 2226 N, pinion Fa 1813 N, Fr 347 N (left hand, cw, s = +1)
%   K_V 1.085, K_Fbeta 1.560, sigma_H 1028 MPa -> S_H 1.39, S_F 3.80 / 3.46 (form factors need the M5 method-B code,
%   here Y_F, Y_S are taken from the bevel.py report: 1.033 / 2.361 and 1.229 / 2.176)
%   outer chordal thickness 5.382 / 3.954 at height 3.478 / 1.740 mm; cutter r_c 63.5 mm, spiral angle heel 39.17, toe 31.33 deg
% Requires base MATLAB (R2016b or newer: local functions in scripts).

clear; clc;
P = struct('z1',17,'z2',43,'Sigma',90,'met',3.0,'b',18,'bm',35,'an',20,'hand','left','rot','cw', ...
           'P_kW',7.5,'n1',1450,'KA',1.25,'KHbbe',1.25,'ZK',0.85,'ZLVR',0.95,'sHlim',1500,'sFlim',500, ...
           'E',206000,'nu',0.3,'haP',1.0,'hfP',1.25,'allow_um',-40,'grade',7);
G = cone(P);
F = forces(P, G);
fprintf('pitch angles %.4f / %.4f deg, Re %.3f, Rm %.3f, m_mn %.4f, x %.4f\n', G.d1, G.d2, G.Re, G.Rm, G.mmn, G.x1);
fprintf('face angles %.3f / %.3f deg, dae %.3f / %.3f, crown-apex %.3f / %.3f\n', G.fa1, G.fa2, G.dae1, G.dae2, G.xa1, G.xa2);
fprintf('zv %.2f / %.2f, eps_va %.3f, eps_vb %.3f\n', G.zv1, G.zv2, G.eva, G.evb);
fprintf('Ft %.0f N, Fa1 %.0f N, Fr1 %.0f N (s %+d)\n', F.Ft, F.Fa1, F.Fr1, F.s);

% simplified capacity via the virtual gears (Y_F, Y_S from bevel.py / M5 method B)
YF = [1.033 1.229]; YS = [2.361 2.176];
beff = 0.85*P.b;  KHb = 1.5*P.KHbbe;
h = (P.haP+P.hfP)*G.mmn;  r = beff/h;  NF = r^2/(1+r+r^2);  KFb = KHb^NF;
v = pi*G.dm1/1000*P.n1/60;
K1 = [7.5 13.3 23.9 34.8 47.0 68.2];  K1 = K1(P.grade-4);            % helical K1, grades 5..10
w = max(P.KA*F.Ft/beff, 100);
KV = 1 + (K1/w + 0.0087)*G.zv1*v/100*sqrt(G.uv^2/(1+G.uv^2));
ZH = sqrt(2*cosd(G.bb)/(cosd(G.at)^2*tand(G.at)));
ZE = sqrt(1/(pi*2*(1-P.nu^2)/P.E));
if G.evb >= 1, Zeps = sqrt(1/G.eva); else, Zeps = sqrt((4-G.eva)/3*(1-G.evb)+G.evb/G.eva); end
Zb = 1/sqrt(cosd(P.bm));
sH = ZH*ZE*Zeps*Zb*P.ZK*sqrt(F.Ft/(G.dv1*beff)*(G.uv+1)/G.uv)*sqrt(P.KA*KV*KHb);
Yb = 1 - min(G.evb,1)*min(P.bm,30)/120;
SH = P.sHlim*P.ZLVR/sH;
for i = 1:2
    sF = F.Ft/(beff*G.mmn)*YF(i)*YS(i)*Yb*P.KA*KV*KFb;
    fprintf('gear %d: sigma_F %.0f MPa, S_F %.2f, S_H %.2f\n', i, sF, 2*P.sFlim/sF, SH);
end
fprintf('sigma_H %.0f MPa (K_V %.3f, K_Fbeta %.3f)\n', sH, KV, KFb);

% chordal thickness (outer, back cone)
for i = 1:2
    if i == 1, x = G.x1; d = G.d1; de = G.de1; hae = G.hae1; else, x = G.x2; d = G.d2; de = G.de2; hae = G.hae2; end
    s = P.met*(pi/2 + 2*x*tand(P.an)) + P.allow_um/1000;
    rve = de/(2*cosd(d));
    fprintf('gear %d: outer chordal thickness %.3f at height %.3f mm\n', i, 2*rve*sin(s/(2*rve)), hae + rve*(1-cos(s/(2*rve))));
end

% cutter: nearest standard radius to Rm, spiral angle along the face
std_in = [1.1 1.5 2.0 3.5 5.0 6.0 7.5 9.0 12.0];  rcs = std_in*25.4/2;
[~, k] = min(abs(rcs - G.Rm));  rc = rcs(k);
E2 = G.Rm^2 + rc^2 - 2*G.Rm*rc*sind(P.bm);
beta = @(R) asind(max(-1,min(1,(R.^2 + rc^2 - E2)./(2*R*rc))));
fprintf('cutter r_c %.2f mm: spiral angle heel %.2f, mean %.2f, toe %.2f deg\n', rc, beta(G.Re), beta(G.Rm), beta(G.Re-P.b));

% ---------------------------------------------------------------- local functions
function G = cone(P)
    u = P.z2/P.z1;
    G.u = u;
    G.d1 = atand(sind(P.Sigma)/(cosd(P.Sigma)+u));  G.d2 = P.Sigma - G.d1;
    G.de1 = P.met*P.z1;  G.de2 = P.met*P.z2;
    G.Re = G.de1/(2*sind(G.d1));  G.Rm = G.Re - P.b/2;
    G.mmt = P.met*G.Rm/G.Re;  G.mmn = G.mmt*cosd(P.bm);
    G.dm1 = G.mmt*P.z1;  G.dm2 = G.mmt*P.z2;
    G.x1 = 0.39*(1 - 1/u^2);  G.x2 = -G.x1;                      % spiral (0.46 for straight)
    ham1 = (P.haP+G.x1)*G.mmn;  ham2 = (P.haP+G.x2)*G.mmn;
    hfm1 = (P.hfP-G.x1)*G.mmn;  hfm2 = (P.hfP-G.x2)*G.mmn;
    thf1 = atand(hfm1/G.Rm);  thf2 = atand(hfm2/G.Rm);  tha1 = thf2;  tha2 = thf1;   % constant clearance
    G.hae1 = ham1 + P.b/2*tand(tha1);  G.hae2 = ham2 + P.b/2*tand(tha2);
    G.dae1 = G.de1 + 2*G.hae1*cosd(G.d1);  G.dae2 = G.de2 + 2*G.hae2*cosd(G.d2);
    G.fa1 = G.d1 + tha1;  G.fa2 = G.d2 + tha2;
    G.xa1 = G.Re*cosd(G.d1) - G.hae1*sind(G.d1);  G.xa2 = G.Re*cosd(G.d2) - G.hae2*sind(G.d2);
    G.dv1 = G.dm1/cosd(G.d1);  G.dv2 = G.dm2/cosd(G.d2);
    G.zv1 = P.z1/cosd(G.d1);  G.zv2 = P.z2/cosd(G.d2);  G.uv = G.zv2/G.zv1;
    G.at = atand(tand(P.an)/cosd(P.bm));  G.bb = asind(sind(P.bm)*cosd(P.an));
    dva1 = G.dv1 + 2*ham1;  dva2 = G.dv2 + 2*ham2;
    dvb1 = G.dv1*cosd(G.at);  dvb2 = G.dv2*cosd(G.at);  av = (G.dv1+G.dv2)/2;
    ga = 0.5*(sqrt(dva1^2-dvb1^2) + sqrt(dva2^2-dvb2^2)) - av*sind(G.at);
    G.eva = ga/(pi*G.mmt*cosd(G.at));
    G.evb = P.b*sind(P.bm)/(pi*G.mmn);
end

function F = forces(P, G)
    T1 = P.P_kW*1000/(P.n1*2*pi/60);
    F.Ft = 2*T1*1000/G.dm1;
    if P.bm == 0, s = 0; else, s = 2*(strcmp(P.hand,'left') == strcmp(P.rot,'cw')) - 1; end
    F.s = s;
    F.Fa1 = F.Ft/cosd(P.bm)*(tand(P.an)*sind(G.d1) + s*sind(P.bm)*cosd(G.d1));
    F.Fr1 = F.Ft/cosd(P.bm)*(tand(P.an)*cosd(G.d1) - s*sind(P.bm)*sind(G.d1));
end
