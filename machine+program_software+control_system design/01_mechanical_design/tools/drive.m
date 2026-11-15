% drive.m - MATLAB mirror of the core of drive.py (guide M9: V-belt, synchronous belt, roller chain, elastic coupling)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of drive.py.
% Run it once and compare with these drive.py numbers (default input, python drive.py examples):
%   c2 1.30, P_B 3.90 kW; SPZ d1 150 / d2 300, Ld 1600, a 440.2 mm, wrap 160.4 deg, v 23.01 m/s
%   P_N 5.89 kW, c1 0.952, c3 1.000 -> 5.61 kW per belt -> z = 1; F_e 169 N, Fc 39.2 N, T0 177 N
%   shaft load 272 N running / 349 N standstill; span frequency 56 Hz; test force 11.3 N at 6.9 mm
%   chain 08A z 19: link plate 12.11 kW, roller-bushing 3.80 kW; polygon 1.36 %
%   coupling J28 (92 Sh A): f_e 173 Hz, start torque 94.7 N m; order 4: eta 0.56, V 1.43
% Requires base MATLAB.

clear; clc;
P = 3.0; Pload = 1.58; n1 = 2930; n2 = 1450; c2 = 1.3; a0 = 400; slip = 0.01;
% ---- narrow V-belt SPZ (typical data, check)
A = 57; m = 0.074; h = 8; Lref = 1600; sig_ref = 9.3; mu = 0.512; Eb = 50; fref = 20; mw = 10;
d1 = 150; d2 = 300;                                  % nearest standard to n1*d1*(1-slip)/n2
PB = P*c2;
Lth = 2*a0 + pi/2*(d1 + d2) + (d2 - d1)^2/(4*a0);
Ld = 1600;                                           % nearest standard datum length
k = Ld - pi/2*(d1 + d2);  a = 0.25*(k + sqrt(k^2 - 2*(d2 - d1)^2));
gam = asin((d2 - d1)/(2*a));  beta1 = pi - 2*gam;  span = a*cos(gam);
v = pi*d1*n1/60000;
fB = 2*v/(Lref/1000);  sp = sig_ref*(fref/fB)^(1/mw);  sb = Eb*h/d1;
F1max = A*(sp - sb);  Fc = m*v^2;
PN = (F1max - Fc)*(1 - exp(-mu*pi))*v/1000;
c1 = (1 - exp(-mu*beta1))/(1 - exp(-mu*pi));  c3 = (Ld/Lref)^(1/mw);
z = ceil(PB/(PN*c1*c3));
e = exp(mu*beta1);  FeB = PB*1000/(z*v);
T0 = FeB*(e + 1)/(2*(e - 1)) + Fc;
Fsh = 2*(T0 - Fc)*z*sin(beta1/2);  Fsh0 = 2*T0*z*sin(beta1/2);
fspan = 1/(2*span/1000)*sqrt(T0/m);  Ftest = 4*T0*0.016;
fprintf('Lth %.0f, a %.1f, wrap %.1f deg, v %.2f m/s\n', Lth, a, rad2deg(beta1), v);
fprintf('P_N %.2f kW, c1 %.3f, c3 %.3f, z %d, T0 %.0f N, shaft %.0f / %.0f N, span f %.0f Hz, test %.1f N\n', PN, c1, c3, z, T0, Fsh, Fsh0, fspan, Ftest);

% ---- roller chain 08A (ANSI 40), ACA formulas (hp, inch)
p = 12.7/25.4; z1 = 19; Kr = 17;
H1 = 0.004*z1^1.08*n1^0.9*p^(3 - 0.07*p);
H2 = 1000*Kr*z1^1.5*p^0.8/n1^1.5;
fprintf('chain: link plate %.2f kW, roller-bushing %.2f kW, polygon %.2f %%\n', H1*0.7457, H2*0.7457, 100*(1 - cos(pi/z1)));

% ---- elastic jaw coupling J28, 92 Sh A, direct drive with 4-pole motor 1445 rpm
C = 10300; psi = 0.8; JA = 0.0095 + 0.0003; JL = 0.075 + 0.0003; n = 1445;
fe = sqrt(C*(JA + JL)/(JA*JL))/(2*pi);
TN = 9550*P/n;  St = 1.2;  MA = JL/(JA + JL);  ML = JA/(JA + JL);
TS = 2.5*TN*MA*1.8*1.0*St;
d = psi/(2*pi);  harm = [1 15.41; 3 10.35; 4 10.55; 5 4.15];
fprintf('coupling: f_e %.0f Hz, start torque %.1f N m\n', fe, TS);
for i = 1:size(harm, 1)
    f = harm(i, 1)*n/60;  eta = f/fe;
    V = sqrt(1 + d^2)/sqrt((1 - eta^2)^2 + d^2);
    fprintf('  order %d: %.1f Hz, eta %.2f, V %.2f, coupling torque %.2f N m\n', harm(i, 1), f, eta, V, harm(i, 2)*ML*V);
end
