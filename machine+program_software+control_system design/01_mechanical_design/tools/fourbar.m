% fourbar.m - MATLAB mirror of the core of fourbar.py (guide M2b, four-bar linkage)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of fourbar.py.
% Run it once and compare with these fourbar.py numbers (default input, step 1 deg, branch +1):
%   theta2 = 90 deg: theta3 29.319 deg, theta4 99.214 deg, w3 -0.643, w4 4.375 rad/s, alpha3 33.64, alpha4 24.42 rad/s2,
%                    mu 69.89 deg, T12 2.973 N m, |F12| 114.03 N
%   rocker swing 47.74 deg (88.21 ... 135.95 deg), transmission angle 44.0 ... 91.8 deg
%   input torque mean 0.910, max 3.359, min -0.657 N m, mean power 11.44 W, energy fluctuation 3.975 J
%   pin forces max: O2 114.1, A 114.0, B 113.4, O4 113.2 N; shaking force max 3.3 N
% Requires base MATLAB only (R2016b or newer: local functions in scripts).

clear; clc;
P = defaults();
a = P.a/1000; b = P.b/1000; c = P.c/1000; d = P.d/1000;      % m
w2 = P.rpm*2*pi/60;  al2 = P.alpha2;
th2 = (0:P.step_deg:360-P.step_deg)*pi/180;
n = numel(th2);
T3 = nan(1,n); T4 = T3; W3 = T3; W4 = T3; A3 = T3; A4 = T3; MU = T3; T12 = T3;
F = nan(4,n); SH = T3; Px = T3; Py = T3;
for k = 1:n
    t2 = th2(k);
    [ok, t3, t4, A, B, O4] = position(t2, a, b, c, d, P.branch);
    if ~ok, continue; end
    [w3, w4] = velocity(t2, t3, t4, w2, a, b, c);
    [al3, al4] = acceleration(t2, t3, t4, w2, w3, w4, al2, a, b, c);
    D = dynamics(t2, t3, t4, w3, w4, al3, al4, A, B, O4, w2, al2, P);
    T3(k) = t3; T4(k) = t4; W3(k) = w3; W4(k) = w4; A3(k) = al3; A4(k) = al4;
    MU(k) = transmission_angle(t2, a, b, c, d);
    T12(k) = D.T12; F(:,k) = [abs(D.F12); abs(D.F32); abs(D.F43); abs(D.F14)];
    SH(k) = abs(D.shake); Px(k) = real(D.P)*1000; Py(k) = imag(D.P)*1000;
end
okk = ~isnan(T4);
Tm = mean(T12(okk));
E = cumsum((T12(okk) - Tm)*2*pi/sum(okk));
fprintf('rocker %.2f ... %.2f deg, swing %.2f deg\n', min(T4(okk))*180/pi, max(T4(okk))*180/pi, (max(T4(okk))-min(T4(okk)))*180/pi);
fprintf('mu %.1f ... %.1f deg\n', min(MU(okk)), max(MU(okk)));
fprintf('T12 mean %.3f max %.3f min %.3f N m, P %.2f W, dE %.3f J\n', Tm, max(T12), min(T12), Tm*w2, max([0 E]) - min([0 E]));
fprintf('pins max O2 %.1f A %.1f B %.1f O4 %.1f N, shake max %.1f N\n', max(F,[],2), max(SH));
k90 = round(90/P.step_deg) + 1;
fprintf('theta2 90: t3 %.3f t4 %.3f w3 %.3f w4 %.3f al3 %.2f al4 %.2f mu %.2f T12 %.3f\n', T3(k90)*180/pi, ...
        T4(k90)*180/pi, W3(k90), W4(k90), A3(k90), A4(k90), MU(k90), T12(k90));
deg = th2*180/pi;
figure; plot(deg, T4*180/pi, deg, MU); grid on; xlabel('\theta_2 [deg]'); ylabel('deg'); legend('\theta_4','\mu');
figure; plot(deg, T12); grid on; xlabel('\theta_2 [deg]'); ylabel('T_{12} [N m]');
figure; plot(deg, F); grid on; xlabel('\theta_2 [deg]'); ylabel('|F| [N]'); legend('F12','F32','F43','F14');
figure; plot(Px, Py); axis equal; grid on; xlabel('x [mm]'); ylabel('y [mm]'); title('coupler curve');

% ------------------------------------------------------------------ local functions
function P = defaults()
    P.a = 30; P.b = 100; P.c = 80; P.d = 100; P.branch = 1;          % mm
    P.p = 50; P.delta = 30;                                             % coupler point mm, deg
    P.rpm = 120; P.alpha2 = 0;
    P.m2 = 0.08; P.rg2 = 15; P.J2 = 1.0e-5;
    P.m3 = 0.30; P.rg3 = 50; P.dg3 = 0; P.J3 = 3.0e-4;
    P.m4 = 0.25; P.rg4 = 40; P.J4 = 1.5e-4;
    P.T4 = -5.0; P.c4 = 0.8; P.FP = [0; 0]; P.g = 0;
    P.step_deg = 1;
end

function [ok, t3, t4, A, B, O4] = position(t2, a, b, c, d, br)
    % circle intersection (same as fourbar.py position())
    A = a*exp(1i*t2); O4 = d; v = O4 - A; e = abs(v);
    ok = ~(e > b + c || e < abs(b - c) || e == 0);
    t3 = NaN; t4 = NaN; B = NaN;
    if ~ok, return; end
    x = (b^2 - c^2 + e^2)/(2*e);
    h = sqrt(max(0, b^2 - x^2));
    u = v/e;
    B = A + x*u + br*h*(-imag(u) + 1i*real(u));
    t3 = angle(B - A); t4 = angle(B - O4);
end

function [w3, w4] = velocity(t2, t3, t4, w2, a, b, c)
    w3 = a*w2*sin(t4 - t2)/(b*sin(t3 - t4));
    w4 = a*w2*sin(t2 - t3)/(c*sin(t4 - t3));
end

function [al3, al4] = acceleration(t2, t3, t4, w2, w3, w4, al2, a, b, c)
    r1 = a*al2*sin(t2) + a*w2^2*cos(t2) + b*w3^2*cos(t3) - c*w4^2*cos(t4);
    r2 = -a*al2*cos(t2) + a*w2^2*sin(t2) + b*w3^2*sin(t3) - c*w4^2*sin(t4);
    x = [-b*sin(t3), c*sin(t4); b*cos(t3), -c*cos(t4)] \ [r1; r2];
    al3 = x(1); al4 = x(2);
end

function mu = transmission_angle(t2, a, b, c, d)
    cm = (b^2 + c^2 - a^2 - d^2 + 2*a*d*cos(t2))/(2*b*c);
    mu = acosd(max(-1, min(1, cm)));
end

function D = dynamics(t2, t3, t4, w3, w4, al3, al4, A, B, O4, w2, al2, P)
    % Newton-Euler, unknowns x = [F12x F12y F32x F32y F43x F43y F14x F14y T12]  (Fij = force of link i on link j)
    cr = @(r, F) real(r)*imag(F) - imag(r)*real(F);
    g2 = P.rg2/1000*exp(1i*t2);               ag2 = (1i*al2 - w2^2)*g2;
    e3 = exp(1i*(t3 + P.dg3*pi/180));         g3 = A + P.rg3/1000*e3;
    aA = (1i*al2 - w2^2)*A;                   ag3 = aA + (1i*al3 - w3^2)*P.rg3/1000*e3;
    g4 = O4 + P.rg4/1000*exp(1i*t4);          ag4 = (1i*al4 - w4^2)*P.rg4/1000*exp(1i*t4);
    gv = -P.g;
    Pp = A + P.p/1000*exp(1i*(t3 + P.delta*pi/180));
    FP = P.FP(1) + 1i*P.FP(2);
    T4 = P.T4 - P.c4*w4;
    R12 = -g2; R32 = A - g2; R23 = A - g3; R43 = B - g3; RP = Pp - g3; R34 = B - g4; R14 = O4 - g4;
    M = [1 0 1 0 0 0 0 0 0;
         0 1 0 1 0 0 0 0 0;
         -imag(R12) real(R12) -imag(R32) real(R32) 0 0 0 0 1;
         0 0 -1 0 1 0 0 0 0;
         0 0 0 -1 0 1 0 0 0;
         0 0 imag(R23) -real(R23) -imag(R43) real(R43) 0 0 0;
         0 0 0 0 -1 0 1 0 0;
         0 0 0 0 0 -1 0 1 0;
         0 0 0 0 imag(R34) -real(R34) -imag(R14) real(R14) 0];
    rhs = [P.m2*real(ag2); P.m2*imag(ag2) - P.m2*gv; P.J2*al2;
           P.m3*real(ag3) - real(FP); P.m3*imag(ag3) - imag(FP) - P.m3*gv; P.J3*al3 - cr(RP, FP);
           P.m4*real(ag4); P.m4*imag(ag4) - P.m4*gv; P.J4*al4 - T4];
    x = M \ rhs;
    D.F12 = x(1) + 1i*x(2); D.F32 = x(3) + 1i*x(4); D.F43 = x(5) + 1i*x(6); D.F14 = x(7) + 1i*x(8);
    D.T12 = x(9); D.shake = -(D.F12 + D.F14); D.P = Pp;
end
