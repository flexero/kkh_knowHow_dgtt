% ncgear.m - MATLAB mirror of the core of ncgear.py (guide M5e: non-circular gear pair)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - translation of pitch_pair(), the closure condition,
% kinematics() and simulate() of ncgear.py (tooth generation and CAD export stay in Python: python ncgear.py run).
% Compare with these ncgear.py numbers (default input, python ncgear.py examples):
%   ellipse e 0.3, scaled A 59.359 mm -> centre distance 118.718 mm, perimeter 364.425 mm = 29 pi 4
%   ratio w1/w2 0.538 ... 1.857; gear 2 32.3 ... 111.4 rpm at 60 rpm input; input torque 3.0 ... 45.4 N m (mean 20.5)
%   motor simulation (J1 1.5 kg m2): input speed 54.90 ... 62.42 rpm, fluctuation 0.128
% Requires base MATLAB (integral, fzero, ode45).

function ncgear
    e = 0.3; m = 4; z1 = 29; nin = 60; J1 = 1.5; J2 = 0.08; T0 = 5; Tw = 40; win = [110 250];
    r1 = @(A, t) A*(1 - e^2)./(1 - e*cos(t));
    perim = @(A) integral(@(t) sqrt(r1(A,t).^2 + (A*(1 - e^2)*e*sin(t)./(1 - e*cos(t)).^2).^2), 0, 2*pi);
    A = fzero(@(A) perim(A) - z1*pi*m, 60);                 % size for a whole number of teeth
    clos = @(a) integral(@(t) r1(A,t)./(a - r1(A,t)), 0, 2*pi) - 2*pi;
    a = fzero(clos, [max(r1(A, 0))*1.0001, 5*A]);          % closure -> centre distance (= 2A for identical ellipses)
    fprintf('A %.3f mm, a %.3f mm, perimeter %.3f mm\n', A, a, perim(A));
    ph = linspace(0, 2*pi, 721);
    g = r1(A, ph)./(a - r1(A, ph));                         % w2 / w1
    phi2 = cumtrapz(ph, g);
    w1 = nin*2*pi/60;
    gp = gradient(g, ph);
    TL = T0 + Tw*(mod(rad2deg(phi2), 360) >= win(1) & mod(rad2deg(phi2), 360) <= win(2));
    T1 = (TL + J2*w1^2*gp).*g;
    fprintf('ratio %.3f ... %.3f, n2 %.1f ... %.1f rpm, T1 %.1f ... %.1f N m (mean %.2f)\n', min(1./g), max(1./g), ...
            min(g)*nin, max(g)*nin, min(T1), max(T1), mean(T1(1:end-1)));
    % time simulation with the motor (linear slip line 63 -> 57 rpm at 30 N m)
    w0 = 63*pi/30; wN = 57*pi/30; TN = 30;
    gf = @(q) interp1(ph, g, mod(q, 2*pi));  gpf = @(q) interp1(ph, gp, mod(q, 2*pi));  p2f = @(q) interp1(ph, phi2, mod(q, 2*pi)) + floor(q/(2*pi))*2*pi;
    TLf = @(q) T0 + Tw*(mod(rad2deg(p2f(q)), 360) >= win(1) & mod(rad2deg(p2f(q)), 360) <= win(2));
    f = @(t, y) [y(2); (TN*(w0 - y(2))/(w0 - wN) - TLf(y(1))*gf(y(1)) - J2*gf(y(1))*gpf(y(1))*y(2)^2)/(J1 + J2*gf(y(1))^2)];
    [~, Y] = ode45(f, [0 4], [0; wN], odeset('MaxStep', 1e-3));
    last = Y(:,1) > Y(end,1) - 2*pi;
    w = Y(last, 2);
    fprintf('input speed %.2f ... %.2f rpm, fluctuation %.3f\n', min(w)*30/pi, max(w)*30/pi, (max(w) - min(w))/mean(w));
end
