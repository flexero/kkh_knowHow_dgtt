% tol.m - MATLAB mirror of the core of tol.py (guide M10: ISO 286 fits, interference fit, stack-up, position)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of tol.py.
% Run it once and compare with these tol.py numbers (default input, python tol.py examples):
%   H7/g6 at 25: hole 0/+21, shaft -20/-7 -> clearance +7 ... +41 um
%   H7/k6 at 25: clearance -15 ... +19 um, P(interference) 31.4 %
%   press fit H7/s6 d 30: U 14 ... 48 um, effective 6.4 ... 40.4 um, p 15.7 ... 99.3 MPa, T 42.7 ... 269.6 N m, hub 248 MPa (S 2.41)
%   TDC gap: nominal 0.600, WC +/-0.200, RSS +/-0.087 mm, Cpk 2.87
% Only the table rows needed for the examples are typed in here; tol.py holds the full ISO 286 tables.
% Requires base MATLAB.

clear; clc;
% ---- ISO 286 at D = 25 (step 18...30): IT6 13, IT7 21; g: es -7; k: ei +2
IT6 = 13; IT7 = 21;
H7 = [0, IT7];  g6 = [-7 - IT6, -7];  k6 = [2, 2 + IT6];
fitc = @(h, s) [h(1) - s(2), h(2) - s(1)];             % [C_min, C_max]
C1 = fitc(H7, g6);  C2 = fitc(H7, k6);
mu = mean(H7) - mean(k6);  sd = sqrt((diff(H7)/6)^2 + (diff(k6)/6)^2);
Pint = 0.5*erfc(mu/(sd*sqrt(2)));
fprintf('H7/g6: C %+g ... %+g um;  H7/k6: C %+g ... %+g um, P(interference) %.1f %%\n', C1, C2, 100*Pint);

% ---- interference fit H7/s6 at d 30 (step 24...30: s +35, IT6 13; H7 0/+21)
d = 30; Dh = 55; di = 0; l = 16; Rzs = 3.2; Rzh = 6.3; E = 210000; nu = 0.3; mu_f = 0.12; Re = 600;
U = [35 - 21, 35 + 13 - 0];                            % U_min, U_max um
Qh = d/Dh; Qs = di/d;
K = (1/E)*((1 + Qh^2)/(1 - Qh^2) + nu) + (1/E)*((1 + Qs^2)/(1 - Qs^2) - nu);
Uw = max(0, U - 0.8*(Rzs + Rzh));
p = Uw/1000./(d*K);
T = p*pi*d*l*mu_f*d/2/1000;
sv = p(2)*sqrt(3 + Qh^4)/(1 - Qh^2);          % exact von Mises at the hub bore
fprintf('U %g ... %g, Uw %.1f ... %.1f um, p %.1f ... %.1f MPa, T %.1f ... %.1f N m, hub %.0f MPa (S %.2f)\n', U, Uw, p, T, sv, Re/sv);

% ---- stack-up TDC gap (sign, nominal, +/- tol)
it = [1 139.20 0.05; 1 0.80 0.05; -1 23.00 0.02; -1 90.00 0.03; -1 26.40 0.03; -1 0.00 0.02];
G = sum(it(:,1).*it(:,2));  wc = sum(it(:,3));  rss = sqrt(sum(it(:,3).^2));
Cpk = min(0.90 - G, G - 0.35)/(rss);                   % 3 sigma = rss
fprintf('gap %.3f, WC +/-%.3f, RSS +/-%.3f, Cpk %.2f\n', G, wc, rss, Cpk);
N = 1e5; rng(1);
X = it(:,2)' + randn(N, 6).*(it(:,3)'/3);
g = X*it(:,1);
fprintf('Monte Carlo sd %.4f mm (RSS/3 = %.4f)\n', std(g), rss/3);

% ---- position: floating / fixed fastener
F = 8.0; H = 9.0;
fprintf('floating T = %.2f mm, fixed T = %.2f mm per part\n', H - F, (H - F)/2);
