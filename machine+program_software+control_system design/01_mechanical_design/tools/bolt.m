% bolt.m - MATLAB mirror of the core of bolt.py (guide M7, bolted joint in the style of VDI 2230)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of bolt.py.
% Run it once and compare with these bolt.py numbers (default input, python bolt.py examples):
%   M12: d2 10.863, d3 9.853, A_S 84.27, A_d3 76.25 mm2
%   delta_S 2.888e-06 mm/N, tan(phi) 0.4864, D_A,Gr 36.06 -> cone + sleeve, delta_P 7.028e-07 mm/N
%   Phi_K 0.1957, Phi_n 0.0979; F_Kerf 20000 N; f_Z 9.5 um -> F_Z 2646 N; F_Mmin 33472 N, F_Mmax 53554 N
%   F_Mzul 64902 N (mu_G 0.10), M_A 107.9 N m; sigma_red 818 MPa -> S_F 1.15; sigma_a 7.0, sigma_AS 48.9 -> S_D 7.01
%   surface pressure 902 MPa vs 630 -> S_p 0.70; F_KRmin 27092 N -> S_G 1.35
% Requires base MATLAB.

clear; clc;
d = 12; P = 1.75; dw = 16.6; dh = 13.5;                 % M12, hex head, medium hole
Rp = 940; lK = 40; ls = 25; DA = 36; ES = 205000; EP = 205000; pG = 630;
FAmax = 12000; FAmin = 0; FQ = 3000; qF = 1; muT = 0.15; n = 0.5;
aA = 1.6; muGmin = 0.10; muKmin = 0.10; muGmax = 0.16; muKmax = 0.16; nu = 0.9;
fZ = 3.0 + 2*2.5 + 1.5*1;                              % um: thread, head + nut, one interface (Rz < 10)

% R0 geometry
d2 = d - 0.649519*P;  d3 = d - 1.226869*P;  dS = (d2 + d3)/2;
AS = pi/4*dS^2;  Ad3 = pi/4*d3^2;  AN = pi/4*d^2;
fprintf('d2 %.3f, d3 %.3f, AS %.2f, Ad3 %.2f\n', d2, d3, AS, Ad3);

% R3 compliances
lGew = lK - ls;
dSb = 0.5*d/(ES*AN) + ls/(ES*AN) + lGew/(ES*Ad3) + 0.5*d/(ES*Ad3) + 0.4*d/(ES*AN);
tp = 0.362 + 0.032*log(lK/dw/2) + 0.153*log(DA/dw);    % DSV
DAGr = dw + lK*tp;
if DA >= DAGr
    dP = 2*log((dw+dh)*(dw+lK*tp-dh)/((dw-dh)*(dw+lK*tp+dh)))/(EP*pi*dh*tp);
else
    dP = (2/(dh*tp)*log((dw+dh)*(DA-dh)/((dw-dh)*(DA+dh))) + 4/(DA^2-dh^2)*(lK - (DA-dw)/tp))/(EP*pi);
end
PhiK = dP/(dSb + dP);  Phin = n*PhiK;
fprintf('deltaS %.4g, tan(phi) %.4f, DAGr %.2f, deltaP %.4g, PhiK %.4f, Phin %.4f\n', dSb, tp, DAGr, dP, PhiK, Phin);

% R2, R4, R5
FKerf = FQ/(qF*muT);  FZ = fZ/1000/(dSb + dP);
FMmin = FKerf + (1 - Phin)*FAmax + FZ;  FMmax = aA*FMmin;
% R7, R13
k = 1.5*d2/dS*(P/(pi*d2) + 1.155*muGmin);
FMzul = nu*Rp*AS/sqrt(1 + 3*k^2);
DKm = (dw + dh)/2;
MA = FMzul*(0.16*P + 0.58*d2*muGmin + DKm/2*muKmin)/1000;
FMhigh = MA*1000/(0.16*P + 0.58*d2*muGmax + DKm/2*muKmax);
fprintf('FKerf %.0f, FZ %.0f, FMmin %.0f, FMmax %.0f, FMzul %.0f N, MA %.1f N m, FM at high friction %.0f N\n', ...
        FKerf, FZ, FMmin, FMmax, FMzul, MA, FMhigh);
% R8 working stress
FSmax = FMzul + Phin*FAmax;  sz = FSmax/AS;
MG = FMzul*d2/2*(P/(pi*d2) + 1.155*muGmin);  tau = MG/(pi/16*dS^3);
sred = sqrt(sz^2 + 3*(0.5*tau)^2);
fprintf('sigma_z %.0f, tau %.0f, sigma_red %.0f MPa -> S_F %.2f\n', sz, tau, sred, Rp/sred);
% R9 fatigue (rolled before heat treatment)
sa = Phin*(FAmax - FAmin)/(2*AS);  sAS = 0.85*(150/d + 45);
fprintf('sigma_a %.1f, sigma_AS %.1f -> S_D %.2f\n', sa, sAS, sAS/sa);
% R10 surface pressure, R12 slip
Ap = pi/4*(dw^2 - dh^2);
fprintf('p working %.0f MPa -> S_p %.2f\n', FSmax/Ap, pG/(FSmax/Ap));
FKRmin = FMzul/aA - (1 - Phin)*FAmax - FZ;
fprintf('FKRmin %.0f N -> S_G %.2f\n', FKRmin, FKRmin*qF*muT/FQ);
