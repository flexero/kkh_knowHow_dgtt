% spring.m - MATLAB mirror of the core of spring.py (guide M8, helical compression spring, EN 13906-1 style)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of spring.py.
% Run it once and compare with these spring.py numbers (default input, python spring.py examples):
%   Rm_min 1978 MPa, tau_zul 989 MPa; R 2.9228 N/mm; F1 55.5 N, F2 114.0 N, at solid 139.6 N
%   w 10.00, k 1.1351; Lc 26.25, Sa 7.97 -> Ln_min 34.22 mm; mass 31.8 g
%   tau at L2 464 MPa (S 2.13); fatigue tau_kU 257, tau_kO 527, stroke 270, allowed 556 MPa -> S 2.06
%   no buckling (nu 0.5); natural frequency 169 Hz
% Requires base MATLAB.

clear; clc;
d = 2.5; D = 25; n = 8.5; L0 = 74; L1 = 55; L2 = 35;
A = 2080; m = 0.055; G = 79500; E = 206000; rho = 7.85e-6; fD0 = 0.38;   % VDSiCr shot peened
nu_seat = 0.5; dynamic = true;

Rm = A*d^(-m);  tz = 0.5*Rm;
R = G*d^4/(8*D^3*n);
nt = n + 2;  Lc = nt*d;
Sa = (0.0015*D^2/d + 0.1*d)*n;  if dynamic, Sa = 1.5*Sa; end
w = D/d;  k = (w + 0.5)/(w - 0.75);
F1 = R*(L0 - L1);  F2 = R*(L0 - L2);  Fc = R*(L0 - Lc);
tau = @(F) 8*F*D/(pi*d^3);
mass = rho*pi^2*d^2*D*nt/4;
fprintf('Rm %.0f, tau_zul %.0f, R %.4f, F1 %.1f, F2 %.1f, Fc %.1f N\n', Rm, tz, R, F1, F2, Fc);
fprintf('w %.2f, k %.4f, Lc %.2f, Sa %.2f, Ln_min %.2f, mass %.1f g\n', w, k, Lc, Sa, Lc + Sa, mass*1000);
fprintf('tau(F2) %.0f MPa -> S %.2f; tau(Fc) %.0f MPa\n', tau(F2), tz/tau(F2), tau(Fc));

% fatigue: Goodman-type Haigh line in corrected stresses
tk1 = k*tau(F1);  tk2 = k*tau(F2);  tD0 = fD0*Rm;  tst = 0.5*Rm;
tkOlim = tD0 + (1 - tD0/tst)*tk1;
fprintf('tau_kU %.0f, tau_kO %.0f, stroke %.0f, allowed stroke %.0f -> S %.2f\n', tk1, tk2, tk2 - tk1, tkOlim - tk1, (tkOlim - tk1)/(tk2 - tk1));

% buckling
ge = G/E;
arg = 1 - (1 - ge)/(0.5 + ge)*(pi*D/(nu_seat*L0))^2;
if arg < 0, fprintf('no buckling\n'); else, fprintf('s_K %.1f mm\n', L0*0.5/(1 - ge)*(1 - sqrt(arg))); end

% natural frequency (SI)
fe = (d/1000)/(2*pi*n*(D/1000)^2)*sqrt(G*1e6/(2*rho*1e9));
fprintf('natural frequency %.0f Hz\n', fe);
