% worm.m - MATLAB mirror of the core of worm.py (guide M5c, cylindrical worm gears)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of worm.py.
% Run it once and compare with these worm.py numbers (default input, python worm.py examples):
%   lead angle 12.529 deg, axial pressure angle 20.448 deg, x2 0, da1 44, df1 26.4, da2 172, df2 154.4, dae2 176 mm
%   vg 2.800 m/s, mu_0T 0.0367, mu_z 0.0347, rho 2.117 deg, eta worm 0.8503, eta wheel 0.8269
%   T1 19.76 N m, T2 344.4 N m, Ft1 1098 N, Ft2 4200 N, Fr 1579 N
%   P_V 529 W, total efficiency 0.8237, oil sump 61.9 deg C, thermal power limit 5.23 kW
%   p*_m 0.863, sigma_Hm 269 MPa, sigma_HG 446 MPa -> S_H 1.66; wear 0.575 mm -> S_W 2.04
%   tau_F 21.1 (worn 22.5) MPa -> S_F 4.74 (worn 4.45); worm deflection 0.0328 mm -> S_delta 1.22; M over wires 45.048 mm
% Requires base MATLAB (R2016b or newer: local functions in scripts).

clear; clc;
P = struct('a',100,'z1',2,'z2',41,'mx',4,'d1',36,'an',20,'haP',1.0,'cP',0.2,'b2',28, ...
           'P1_kW',3.0,'n1',1450,'KA',1.0,'Lh',25000,'Ra1',0.4,'mu_static',0.12,'mineral',true, ...
           'E2',98100,'nu2',0.35,'sHlim',520,'tFlim',100,'YW',1.0,'WML',1.0,'JW',1.0e-9, ...
           'l1',160,'ds1',28,'ds2',45,'PV0',40,'fan',true,'th0',20,'thlim',90,'jt_um',120);

G = geom(P);
E = effic(P, G);
F = forces(P, G, E);
L = losses(P, G, E);
fprintf('gamma %.3f deg, alpha_x %.3f deg, x2 %+.4f, da1 %.3f, df1 %.3f, da2 %.3f, df2 %.3f\n', ...
        rad2deg(G.gam), rad2deg(G.ax), G.x2, G.da1, G.df1, G.da2, G.df2);
fprintf('vg %.3f m/s, mu_0T %.4f, mu_z %.4f, rho %.3f deg, eta %.4f / %.4f\n', G.vg, E.m0, E.mu, rad2deg(E.rho), E.eta, E.eta_rev);
fprintf('T1 %.2f, T2 %.1f N m, Ft1 %.0f, Ft2 %.0f, Fr %.0f N\n', F.T1, F.T2, F.Ft1, F.Ft2, F.Fr);
fprintf('P_V %.0f W, eta total %.4f, oil %.1f deg C\n', L.PV, L.eta_tot, L.theta);

% thermal power limit (bisection)
lo = 0.01; hi = 200;
for k = 1:60
    mid = (lo+hi)/2; Q = P; Q.P1_kW = mid; Lq = losses(Q, G, effic(Q, G));
    if Lq.theta > P.thlim, hi = mid; else, lo = mid; end
end
fprintf('thermal power limit %.2f kW\n', lo);

% pitting
Er = 2/((1-0.3^2)/210000 + (1-P.nu2^2)/P.E2);
pm = 1.03*(0.4 + G.x2/G.u + 0.01*P.z2 - 0.083*P.b2/P.mx + sqrt(G.q)/6.9 + (G.q + 50*(G.u+1)/G.u)/(15.9 + 37.5*G.q));
T2 = F.T2*P.KA;
sHm = 4/pi*sqrt(pm*T2*1000*Er/P.a^3);
ZN = min((25000/P.Lh)^(1/6), 1.6); Zv = sqrt(5/(4+G.vg)); ZS = sqrt(3000/(2900+P.a)); Zoil = 1.0;
sHG = P.sHlim*ZN*Zv*ZS*Zoil;
fprintf('p*_m %.3f, sigma_Hm %.0f, sigma_HG %.0f MPa -> S_H %.2f\n', pm, sHm, sHG, sHG/sHm);
% wear
NL = G.n2*60*P.Lh; ss = 0.78 + 0.21*G.u + 5.6/tan(G.gam);
sWm = sHm*P.a*NL*ss/Er; dW = P.JW*P.WML*sWm; dWlim = 0.3*P.mx*cos(G.gam);
fprintf('wear %.3f mm (limit %.3f) -> S_W %.2f\n', dW, dWlim, dWlim/dW);
% tooth root
hf2 = (P.haP + P.cP - G.x2)*P.mx;
s2 = P.mx*(pi/2 + 2*G.x2*tan(G.ax)) - P.jt_um/1000;
sft2 = s2 + 2*hf2*tan(G.ax); sft2w = sft2 - dW/cos(G.gam);
b2R = G.da1*asin(min(P.b2/G.da1, 1));
tF  = F.Ft2*P.KA/(b2R*P.mx)*0.5*(2.9*P.mx/sft2)/cos(G.gam);
tFw = F.Ft2*P.KA/(b2R*P.mx)*0.5*(2.9*P.mx/sft2w)/cos(G.gam);
fprintf('tau_F %.1f (worn %.1f) MPa -> S_F %.2f (worn %.2f)\n', tF, tFw, P.tFlim/tF, P.tFlim/tFw);
% worm deflection
I = pi*G.df1^4/64; dm = P.l1^3*hypot(F.Ft1, F.Fr)/(48*210000*I);
fprintf('worm deflection %.4f mm (limit %.3f) -> S_delta %.2f\n', dm, 0.01*P.mx, 0.01*P.mx/dm);
% over three wires (rack approximation)
sx1 = G.px/2; DM = sx1/cos(G.ax);
M = P.d1 - (G.px - sx1)/tan(G.ax) + DM*(1 + 1/sin(G.ax));
fprintf('over wires D_M %.4f -> M %.3f mm\n', DM, M);

% ---------------------------------------------------------------- local functions
function G = geom(P)
    G.u = P.z2/P.z1; G.q = P.d1/P.mx;
    G.gam = atan(P.z1*P.mx/P.d1);
    an = deg2rad(P.an); G.an = an;
    G.ax = atan(tan(an)/cos(G.gam));
    G.px = pi*P.mx; G.pz = P.z1*G.px;
    G.d2 = P.z2*P.mx;
    G.x2 = (2*P.a - P.d1 - G.d2)/(2*P.mx);
    G.da1 = P.d1 + 2*P.haP*P.mx; G.df1 = P.d1 - 2*(P.haP + P.cP)*P.mx;
    G.da2 = G.d2 + 2*P.mx*(P.haP + G.x2); G.df2 = G.d2 - 2*P.mx*(P.haP + P.cP - G.x2);
    G.vg = pi*P.d1*P.n1/60000/cos(G.gam);
    G.n2 = P.n1/G.u;
end

function E = effic(P, G)
    E.m0 = 0.028 + 0.026/(G.vg + 0.18);
    if ~P.mineral, E.m0 = 0.8*E.m0; end
    E.mu = E.m0*sqrt(100/P.a)*(P.Ra1/0.5)^0.25*P.YW;
    E.rho = atan(E.mu/cos(G.an));
    E.eta = tan(G.gam)/tan(G.gam + E.rho);
    if G.gam > E.rho, E.eta_rev = tan(G.gam - E.rho)/tan(G.gam); else, E.eta_rev = 0; end
end

function F = forces(P, G, E)
    F.T1 = P.P1_kW*1000/(2*pi*P.n1/60);
    F.T2 = F.T1*G.u*E.eta;
    F.Ft2 = 2000*F.T2/G.d2;
    F.Ft1 = F.Ft2*tan(G.gam + E.rho);
    F.Fr = F.Ft2*tan(G.an)*cos(E.rho)/cos(G.gam + E.rho);
end

function L = losses(P, G, E)
    P1 = P.P1_kW*1000;
    L.PV = P1*(1 - E.eta) + 0.01*P1 + 7.69e-6*(P.ds1^2*P.n1 + P.ds2^2*G.n2) + P.PV0;
    L.eta_tot = (P1 - L.PV)/P1;
    A = 9e-5*P.a^1.85;
    if P.fan, k = 28; else, k = 14; end
    L.theta = P.th0 + L.PV/(k*A);
end
