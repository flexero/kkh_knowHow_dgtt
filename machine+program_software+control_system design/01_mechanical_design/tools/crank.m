% crank.m - MATLAB mirror of the core of crank.py (guide M2, crank mechanism of a V90 two-cylinder compressor)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of crank.py.
% Run it once and compare with the crank.py report numbers below (default input, step 0.5 deg).
% Expected (python crank.py examples):
%   displacement 26.56 m3/h, lambda_V 0.714, lambda total 0.624, FAD 16.58 m3/h
%   indicated power 1581 W = mean torque 10.41 N m * w
%   drive torque max 47.77 N m, min -12.64 N m, dE 37.56 J, J needed 0.0815 kg m2, flywheel to add 0.0590 kg m2
%   torque orders 1: 15.41, 2: 0.00, 3: 10.35, 4: 10.55, 5: 4.15, 6: 0.00 N m
%   m_osc 0.3833 kg, F1 per cylinder 203.3 N, F2 51.9 N, residual shaking with counterweight 74.7 N (theory 73.5 N)
%   rod bearing max 2664 N, main bearings total max 2824 N, side force max 419 N
% Requires base MATLAB only (R2017b or newer: local functions in scripts + vecnorm).

clear; clc;
P = defaults();
G = geometry(P);
M = masses(P);
step = P.step_deg;
th = (0:step:360-step) * pi/180;            % crank angle from vertical [rad]
n  = numel(th);
Mdrive = zeros(1,n); shake = zeros(2,n); shakeOsc = zeros(2,n);
Fpin = zeros(2,n); Fmain = zeros(2,n); S1 = zeros(1,n); N1 = zeros(1,n); p1 = zeros(1,n);
mrot = M.m_rot_cyl*numel(P.cyl_angles_deg) + P.m_crank_unbal_kg;
mcw  = P.cw_balance_share*(mrot + M.m_osc);            % V90: counterweight for rotating + one m_osc
for k = 1:n
    t = th(k);
    Ppin = G.r*[sin(t); cos(t)];  dP = G.r*[cos(t); -sin(t)];
    for i = 1:numel(P.cyl_angles_deg)
        gam = P.cyl_angles_deg(i)*pi/180;
        u = [sin(gam); cos(gam)];
        phi = t - gam;
        K = kin(phi, G.r, G.l, G.w);
        p = gas_pressure(phi, P, G);
        Fg = (p - P.p_crankcase_MPa*1e6)*G.A;            % towards crank
        Fax = Fg + M.m_osc*K.a;                         % axial force rod -> piston
        S = Fax/cos(K.beta);                            % rod force, compression +
        Q = K.s*u;  e = (Q - Ppin)/G.l;                 % unit vector pin -> piston pin
        Fp = -S*e;                                      % rod force on crank pin
        Fpin(:,k) = Fpin(:,k) + Fp;
        Mdrive(k) = Mdrive(k) + Fax*K.ds;               % virtual work: M = sum Fax ds/dphi
        shakeOsc(:,k) = shakeOsc(:,k) - M.m_osc*K.a*u;
        if i == 1, S1(k) = S; N1(k) = Fax*tan(K.beta); p1(k) = p; end
    end
    cen = [sin(t); cos(t)];
    shake(:,k) = shakeOsc(:,k) + (mrot - mcw)*G.r*G.w^2*cen;
    Fmain(:,k) = Fpin(:,k) + (M.m_rot_cyl*2 + P.m_crank_unbal_kg - mcw)*G.r*G.w^2*cen;
end

% ---- torque, flywheel (chapter 7)
dth = 2*pi/n;  Mm = mean(Mdrive);
E = cumsum((Mdrive - Mm)*dth);  E = [0 E];
dE = max(E) - min(E);
Jneed = dE/(P.speed_fluct_coeff*G.w^2);
Jmot  = P.J_motor_kgm2*P.belt_ratio^2;
Jfly  = max(0, Jneed - Jmot);
orders = zeros(1,8);
for h = 1:8
    a = sum(Mdrive.*cos(h*2*pi*(0:n-1)/n))*2/n;  b = sum(Mdrive.*sin(h*2*pi*(0:n-1)/n))*2/n;
    orders(h) = hypot(a,b);
end
% ---- cycle (chapter 4)
C = cycle(P, G);
% ---- balancing (chapter 8)
F1 = M.m_osc*G.r*G.w^2;  F2 = G.lam*F1;
fprintf('displacement %.2f m3/h, lambda_V %.3f, lambda total %.3f, FAD %.2f m3/h\n', C.disp, C.lamV, C.lamTot, C.fad);
fprintf('indicated power %.0f W, mean torque %.2f N m -> %.0f W\n', C.Pind, Mm, Mm*G.w);
fprintf('M max %.2f, min %.2f N m, dE %.2f J, J need %.4f, flywheel add %.4f kg m2\n', max(Mdrive), min(Mdrive), dE, Jneed, Jfly);
fprintf('orders 1..6: %s\n', sprintf('%.2f ', orders(1:6)));
fprintf('m_osc %.4f kg, F1 %.1f N, F2 %.1f N, residual shaking %.1f N (theory %.1f)\n', ...
        M.m_osc, F1, F2, max(vecnorm(shake)), sqrt(2)*F2);
fprintf('rod force max %.0f N, main bearing total max %.0f N, side force max %.0f N\n', ...
        max(S1), max(vecnorm(Fmain)), max(abs(N1)));

% ---- plots
deg = th*180/pi;
figure(1); plot(C.V*1e6, C.p/1e5); grid on; xlabel('V [cm^3]'); ylabel('p abs [bar]'); title('p-V (one cylinder)');
figure(2); plot(deg, Mdrive, deg, Mm*ones(size(deg))); grid on; xlabel('\theta [deg]'); ylabel('M_{drive} [N m]');
figure(3); plot(Fpin(1,:), Fpin(2,:)); axis equal; grid on; xlabel('F_x [N]'); ylabel('F_y [N]'); title('crank-pin load');
figure(4); plot(shakeOsc(1,:), shakeOsc(2,:), shake(1,:), shake(2,:)); axis equal; grid on;
legend('oscillating only','with counterweight'); title('shaking force');

% ======================================================================= local functions
function P = defaults()
P.bore_mm = 65; P.stroke_mm = 46; P.rod_mm = 90; P.cyl_angles_deg = [-45 45]; P.n_cyl = 2;
P.rpm = 1450; P.p_amb_MPa = 0.1013; P.p_dis_gauge_MPa = 0.8; P.p_crankcase_MPa = 0.1013;
P.dp_suction_rel = 0.05; P.dp_discharge_rel = 0.05; P.clearance_ratio = 0.05;
P.n_compression = 1.30; P.n_expansion = 1.20; P.lambda_T = 0.92;
P.m_piston_kg = 0.30; P.m_rod_kg = 0.25; P.rod_cg_from_bigend_mm = 30; P.J_rod_cg_kgm2 = 3.6e-4;
P.m_crank_unbal_kg = 0.40; P.cw_balance_share = 1.0;
P.speed_fluct_coeff = 0.02; P.belt_ratio = 2.02; P.J_motor_kgm2 = 0.0055; P.step_deg = 0.5;
end

function G = geometry(P)
G.r = P.stroke_mm/2000; G.l = P.rod_mm/1000; G.lam = G.r/G.l;
G.A = pi/4*(P.bore_mm/1000)^2; G.Vs = G.A*2*G.r; G.Vc = P.clearance_ratio*G.Vs; G.w = P.rpm*2*pi/60;
end

function K = kin(phi, r, l, w)
sp = sin(phi); cp = cos(phi); root = sqrt(l^2 - (r*sp)^2);
K.s = r*cp + root; K.x = r + l - K.s;
K.ds = -r*sp - r^2*sp*cp/root;
K.d2s = -r*cp - r^2*cos(2*phi)/root - r^4*sp^2*cp^2/root^3;
K.v = K.ds*w; K.a = K.d2s*w^2; K.beta = asin(r*sp/l);
end

function p = gas_pressure(phi, P, G)
ps = P.p_amb_MPa*1e6*(1 - P.dp_suction_rel);
pd = (P.p_amb_MPa + P.p_dis_gauge_MPa)*1e6*(1 + P.dp_discharge_rel);
ph = mod(phi, 2*pi);
K = kin(ph, G.r, G.l, 1);  V = G.Vc + G.A*K.x;
if ph <= pi
    p = max(pd*(G.Vc/V)^P.n_expansion, ps);              % expansion, then suction
else
    p = min(ps*((G.Vc + G.Vs)/V)^P.n_compression, pd);    % compression, then discharge
end
end

function M = masses(P)
l = P.rod_mm/1000; a = P.rod_cg_from_bigend_mm/1000; b = l - a; m = P.m_rod_kg;
M.m_rot_cyl = m*b/l; M.m_small = m*a/l; M.m_osc = P.m_piston_kg + M.m_small;
M.J_2mass = M.m_rot_cyl*a^2 + M.m_small*b^2;
end

function C = cycle(P, G)
N = 2880; C.V = zeros(1,N+1); C.p = zeros(1,N+1); W = 0;
for k = 0:N
    ph = 2*pi*k/N; K = kin(ph, G.r, G.l, 1);
    C.V(k+1) = G.Vc + G.A*K.x; C.p(k+1) = gas_pressure(ph, P, G);
    if k > 0, W = W + 0.5*(C.p(k+1) + C.p(k))*(C.V(k) - C.V(k+1)); end
end
ps = P.p_amb_MPa*1e6*(1 - P.dp_suction_rel);
pd = (P.p_amb_MPa + P.p_dis_gauge_MPa)*1e6*(1 + P.dp_discharge_rel);
V1 = G.Vc*(pd/ps)^(1/P.n_expansion);
C.lamV = (G.Vc + G.Vs - V1)/G.Vs; C.lamTot = C.lamV*(1 - P.dp_suction_rel)*P.lambda_T;
C.disp = G.Vs*P.n_cyl*P.rpm*60; C.fad = C.lamTot*C.disp; C.Pind = W*P.rpm/60*P.n_cyl;
end
