% optflow.m - MATLAB mirror of the core of optflow.py (guide M12: virtual CAE of the base frame + surrogate optimisation)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - translation of frame_fe() / responses() of optflow.py,
% with the optimisation done by MATLAB's own surrogateopt (Global Optimization Toolbox) instead of the Python EGO loop.
% Compare with these optflow.py numbers (default input):
%   current design h 100, a 300, k 120: mass 47.73 kg, frequencies 6.66 / 9.87 / 76.42 / 215.05 Hz, sag 5.37 mm
%   optflow.py optimum: h 79.2, a 230.5, k 104.7 -> 41.20 kg, f_rigid 9.99 Hz, f_bend 60.3 Hz, sag 6.00 mm
% surrogateopt is stochastic: expect an optimum close to (not identical with) the Python one.

function optflow
    P = struct('L', 2500, 'b', 60, 't', 4, 'E', 210000, 'rho', 7.85e-9, 'nel', 16, ...
               'masses', [600 0.120; 1250 0.030; 2050 0.065]);
    R = responses(P, [100 300 120]);
    fprintf('current: mass %.2f kg, f %.2f %.2f %.2f %.2f Hz, sag %.2f mm\n', R.mass, R.f(1:4), R.sag);
    lb = [60 50 20]; ub = [160 600 400];
    obj = @(x) objcon(P, x);
    opts = optimoptions('surrogateopt', 'MaxFunctionEvaluations', 60, 'Display', 'iter');
    [x, fval] = surrogateopt(obj, lb, ub, opts);
    R = responses(P, x);
    fprintf('optimum h %.1f a %.1f k %.1f: mass %.2f kg, f_rigid %.2f, f_bend %.1f Hz, sag %.2f mm\n', x, R.mass, R.f(2), R.f(3), R.sag);
end

function s = objcon(P, x)
    R = responses(P, x);
    s.Fval = R.mass;
    s.Ineq = [R.f(2)/10 - 1, 1 - R.f(3)/60.3, R.sag/6 - 1];
end

function R = responses(P, x)
    h = x(1); a = x(2); k = x(3);
    A = P.b*h - (P.b - 2*P.t)*(h - 2*P.t);  I = (P.b*h^3 - (P.b - 2*P.t)*(h - 2*P.t)^3)/12;
    EI = 2*P.E*I; rA = 2*P.rho*A;
    xs = unique([linspace(0, P.L, P.nel + 1), a, P.L - a, P.masses(:,1)']);
    n = 2*numel(xs); K = zeros(n); M = zeros(n);
    for e = 1:numel(xs) - 1
        l = xs(e + 1) - xs(e); d = 2*e - 1:2*e + 2;
        K(d,d) = K(d,d) + EI/l^3*[12 6*l -12 6*l; 6*l 4*l^2 -6*l 2*l^2; -12 -6*l 12 -6*l; 6*l 2*l^2 -6*l 4*l^2];
        M(d,d) = M(d,d) + rA*l/420*[156 22*l 54 -13*l; 22*l 4*l^2 13*l -3*l^2; 54 13*l 156 -22*l; -13*l -3*l^2 -22*l 4*l^2];
    end
    node = @(xp) 2*find(abs(xs - xp) < 1e-6, 1) - 1;
    for s = [a, P.L - a], K(node(s), node(s)) = K(node(s), node(s)) + 2*k; end
    for i = 1:size(P.masses, 1), M(node(P.masses(i,1)), node(P.masses(i,1))) = M(node(P.masses(i,1)), node(P.masses(i,1))) + P.masses(i,2); end
    lam = sort(eig(K, M));
    R.f = sqrt(max(lam, 0))/(2*pi);
    Fg = zeros(n, 1);
    for e = 1:numel(xs) - 1, l = xs(e + 1) - xs(e); Fg([2*e - 1, 2*e + 1]) = Fg([2*e - 1, 2*e + 1]) - rA*9810*l/2; end
    for i = 1:size(P.masses, 1), Fg(node(P.masses(i,1))) = Fg(node(P.masses(i,1))) - P.masses(i,2)*9810; end
    u = K\Fg;
    R.sag = -0.5*(u(node(a)) + u(node(P.L - a)));
    R.mass = rA*P.L*1000;
end
