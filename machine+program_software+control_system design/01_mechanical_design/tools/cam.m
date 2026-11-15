% cam.m - MATLAB mirror of the core of cam.py (guide M6, disc cam with translating roller follower)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - translation of cam.py using closed-form laws
% (cycloidal and modified sine via numerical integration of the acceleration shape, as in cam.py).
% Run it once and compare with these cam.py numbers (default input, python cam.py examples):
%   modsine C_v 1.760, C_a 5.528; cycloidal C_v 2.000, C_a 6.283
%   rise v_max 0.528 m/s, a_max 24.9 m/s^2; return v_max 0.600 m/s, a_max 28.3 m/s^2
%   pressure angle +15.84 deg (at 244 deg) / -17.85 deg; smallest convex pitch radius 47.77 mm (profile 37.77)
%   contact force min 13.1 N at 213 deg; normal force max 196 N; camshaft torque -1.56 .. 2.78 N m
%   Hertz stress max 260 MPa; roller speed max 1800 rpm
% Requires base MATLAB (R2016b or newer).

clear; clc;
h = 20; R0 = 40; rr = 10; e = 0; n = 300; m = 2.5; k = 3; F0 = 30; Fext = 100;
b = 12; E = 210000; nu = 0.3;
seg = {'rise','modsine',120; 'dwell','',60; 'return','cycloidal',120; 'dwell','',60};
w = 2*pi*n/60;  Rp = R0 + rr;  s0 = sqrt(Rp^2 - e^2);

% normalised law tables (trapezoid integration of the acceleration shape, normalised to y(1) = 1)
N = 4000; x = linspace(0,1,N+1);
L.modsine   = law(@(t) (t<=1/8).*sin(4*pi*t) + (t>1/8 & t<=7/8).*cos(4*pi/3*(t-1/8)) - (t>7/8).*cos(4*pi*(t-7/8)), x);
L.cycloidal = law(@(t) sin(2*pi*t), x);
fprintf('modsine Cv %.3f Ca %.3f | cycloidal Cv %.3f Ca %.3f\n', max(abs(L.modsine.v)), max(abs(L.modsine.a)), ...
        max(abs(L.cycloidal.v)), max(abs(L.cycloidal.a)));

th = 0:0.5:359.5;  S = zeros(size(th)); S1 = S; S2 = S; Fe = S;
for i = 1:numel(th)
    [S(i), S1(i), S2(i), kind] = motion(th(i), seg, h, L, x);
    if strcmp(kind,'rise'), Fe(i) = Fext; end
end
r   = s0 + S;
phi = atan2(S1 - e, r);
u1 = r;  u2 = S1 - e;  w1 = 2*S1 - e;  w2 = S2 - r;
rho = -(u1.^2 + u2.^2).^1.5 ./ (u1.*w2 - u2.*w1);
fprintf('pressure angle %+.2f / %+.2f deg, min convex pitch radius %.2f mm\n', max(rad2deg(phi)), min(rad2deg(phi)), min(rho(rho>0)));

a  = S2*w^2/1000;  Fc = m*a + F0 + k*S + Fe;  Fn = Fc./cos(phi);  T = Fc.*S1/1000;
fprintf('Fc min %.1f N, Fn max %.0f N, torque %.2f .. %.2f N m\n', min(Fc), max(Fn), min(T), max(T));
rc = rho - rr;
p  = sqrt(max(Fn,0).*(1/rr + 1./rc)./(pi*b*2*(1-nu^2)/E));
fprintf('Hertz max %.0f MPa\n', max(p(rho>0)));

function T = law(af, x)
    N = numel(x) - 1;  A = af(x);
    V = [0 cumsum(0.5*(A(1:end-1)+A(2:end))/N)];
    Y = [0 cumsum(0.5*(V(1:end-1)+V(2:end))/N)];
    c = 1/Y(end);  T.y = Y*c;  T.v = V*c;  T.a = A*c;
end

function [s, s1, s2, kind] = motion(thd, seg, h, L, x)
    a0 = 0; lift = 0; s = 0; s1 = 0; s2 = 0; kind = 'dwell';
    for j = 1:size(seg,1)
        bta = seg{j,3};
        if thd < a0 + bta
            kind = seg{j,1};
            if strcmp(kind,'dwell'), s = lift; return; end
            T = L.(seg{j,2});  xx = (thd - a0)/bta;  br = deg2rad(bta);
            y = interp1(x, T.y, xx); v = interp1(x, T.v, xx); ac = interp1(x, T.a, xx);
            if strcmp(kind,'rise'), sg = 1; base = 0; else, sg = -1; base = h; end
            s = base + sg*h*y;  s1 = sg*h*v/br;  s2 = sg*h*ac/br^2;  return;
        end
        if strcmp(seg{j,1},'rise'), lift = h; elseif strcmp(seg{j,1},'return'), lift = 0; end
        a0 = a0 + bta;
    end
end
