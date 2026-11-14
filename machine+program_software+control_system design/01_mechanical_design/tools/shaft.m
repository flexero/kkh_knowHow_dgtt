% shaft.m - MATLAB mirror of the core of shaft.py (guide M3, stepped shaft on two bearings)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of shaft.py.
% Run it once and compare with these shaft.py numbers (default input = VC20 crankshaft example):
%   reactions A: y 1342.0, z 796.2 N (resultant 1560.4); B: y 1342.0, z -159.2 N (resultant 1351.4)
%   max deflection 0.0094 mm at x = 0; slope A 0.00017 rad, B 0.00016 rad
%   critical speed (Rayleigh) 87806 rpm, Dunkerley 76564 rpm
%   DIN 743 style S_fatigue / S_static: x40 shoulder 9.52 / 14.50; x60 12.98 / 22.64; x20 keyway 11.10 / 15.17;
%     x50 pressfit 12.60 / 23.29; x160 31.20 / 78.57; x110 plain 12.81 / 16.52
%   key d25 8x7: p 66.4 MPa, S 1.36, l_min 25.7 mm; press fit U_min 18 um: p 25.6 MPa, T 69.4 N m; U_max 48: p 99.3 MPa
% Units: N, mm, MPa, N mm. All inputs are EXAMPLE values. Requires base MATLAB (R2016b+ for local functions in scripts).

clear; clc;
% ---------------------------------------------------------------- input
mat = struct('Rm',700,'Re',490,'E',210000,'G',81000,'rho',7850);      % C45+QT, d <= 16 mm
seg = [40 25 0; 20 30 0; 100 35 0; 20 30 0; 10 25 0];                % [L D di] from the left end
xb  = [50 170];                                                       % bearing centres A, B
F   = [20 0 -637; 110 -2684 0];                                       % [x Fy Fz]
Ms  = [20 3.1];                                                       % attached masses [x kg]
Tin = 20; Tout = 110; Tm = 17.6; Ta = 30.2; Tmax = 47.8; LF = 1.5; rpm = 1450;
notches = {40,'shoulder',struct('D',30,'d',25,'r',1.0,'Rz',6.3);
           60,'shoulder',struct('D',35,'d',30,'r',1.0,'Rz',6.3);
           20,'keyway',  struct('d',25,'Rz',6.3);
           50,'pressfit',struct('d',30,'Rz',3.2);
          160,'shoulder',struct('D',35,'d',30,'r',1.0,'Rz',6.3);
          110,'plain',   struct('d',35,'Rz',3.2)};
step = 0.5; Ltot = sum(seg(:,1));

% ---------------------------------------------------------------- reactions (two planes)
R = zeros(2,2);                     % rows: plane y, z ; cols: A, B
for k = 1:2
    Fs = sum(F(:,k+1)); Mb = sum(F(:,k+1).*(F(:,1)-xb(1)));
    RB = -Mb/(xb(2)-xb(1)); R(k,:) = [-Fs-RB, RB];
end
fprintf('A: y %.1f z %.1f (res %.1f) | B: y %.1f z %.1f (res %.1f)\n', R(1,1),R(2,1),hypot(R(1,1),R(2,1)), ...
        R(1,2),R(2,2),hypot(R(1,2),R(2,2)));

% ---------------------------------------------------------------- moments and deflection
x = 0:step:Ltot;
[My, Mz] = moments(x, F, xb, R);
D  = arrayfun(@(xx) dia(seg, xx), x);
I  = pi/64*D.^4;
vy = elastic_line(x, My./(mat.E*I), xb);
vz = elastic_line(x, Mz./(mat.E*I), xb);
v  = hypot(vy, vz);
th = hypot(gradient(vy, step), gradient(vz, step));
[vmax, iv] = max(v);
fprintf('v_max %.4f mm at x %.1f; slope A %.5f, B %.5f rad\n', vmax, x(iv), interp1(x,th,xb(1)), interp1(x,th,xb(2)));

% ---------------------------------------------------------------- critical speed (Rayleigh) with self weight
g = 9810; xs = cumsum(seg(:,1)) - seg(:,1)/2;
m  = mat.rho*pi/4*(seg(:,2).^2 - seg(:,3).^2).*seg(:,1)*1e-9;
lump = [xs m; Ms];
Fw = [lump(:,1), -lump(:,2)*g/1000, zeros(size(lump,1),1)];
Rw = zeros(2,2); Fsw = sum(Fw(:,2)); Mbw = sum(Fw(:,2).*(Fw(:,1)-xb(1)));
Rw(1,2) = -Mbw/(xb(2)-xb(1)); Rw(1,1) = -Fsw-Rw(1,2);
[Myw, ~] = moments(x, Fw, xb, Rw);
yw = abs(elastic_line(x, Myw./(mat.E*I), xb));
yl = interp1(x, yw, lump(:,1));
w  = sqrt(g*sum(lump(:,2).*yl)/sum(lump(:,2).*yl.^2));
fprintf('n_crit (Rayleigh) %.0f rpm = %.1f x n\n', w*60/(2*pi), w*60/(2*pi)/rpm);

% ---------------------------------------------------------------- DIN 743 style safety at each notch
for k = 1:size(notches,1)
    xn = notches{k,1}; typ = notches{k,2}; p = notches{k,3}; d = p.d;
    Wb = pi*d^3/32; Wt = 2*Wb;
    k1 = 1; if d > 16, k1 = max(0.5, 1-0.26*log10(d/16)); end
    Rmd = k1*mat.Rm; Red = k1*mat.Re;
    switch typ
        case 'plain',    bs = 1; bt = 1;
        case 'shoulder'
            ktb = kt_shoulder(p.D,d,p.r,1); ktt = kt_shoulder(p.D,d,p.r,0); t = (p.D-d)/2;
            phi = 0; if t/d <= 0.25, phi = 1/(4*sqrt(t/p.r)+2); end
            nb = 1+sqrt(2.3*(1+phi)/p.r)*10^-(0.33+Red/712); nt = 1+sqrt(1.15/p.r)*10^-(0.33+Red/712);
            bs = ktb/nb; bt = ktt/nt;
        case 'keyway',   bs = 3.0*(Rmd/1000)^0.38; bt = 0.56*bs+0.1;
        case 'pressfit', bs = 2.7*(Rmd/1000)^0.43; bt = 0.65*bs;
    end
    k2 = 1; if d > 7.5, k2 = max(0.8, 1-0.2*log10(d/7.5)/log10(20)); end
    kfs = 1-0.22*log10(max(p.Rz,1))*(log10(Rmd/20)-1); kft = 0.575*kfs+0.425;
    Ks = bs/k2 + 1/kfs - 1; Kt = bt/k2 + 1/kft - 1;
    sbWK = 0.5*mat.Rm*k1/Ks; ttWK = 0.3*mat.Rm*k1/Kt;
    psis = sbWK/(2*k1*mat.Rm-sbWK); psit = ttWK/(2*k1*mat.Rm-ttWK);
    [myk, mzk] = moments(xn, F, xb, R); M = hypot(myk, mzk);
    carry = (xn >= min(Tin,Tout)) && (xn <= max(Tin,Tout));
    sba = M/Wb; tta = carry*Ta*1000/Wt; ttm = carry*Tm*1000/Wt;
    smv = sqrt(3)*ttm; tmv = smv/sqrt(3);
    sADK = sbWK; if sba > 0, sADK = sbWK/(1+psis*smv/sba); end
    tADK = ttWK; if tta > 0, tADK = ttWK/(1+psit*tmv/tta); end
    Sf = 1/sqrt((sba/sADK)^2 + (tta/tADK)^2);
    gF = 1.1; if strcmp(typ,'plain'), gF = 1.0; end
    sbFK = k1*1.2*gF*mat.Re; ttFK = sbFK/sqrt(3);
    Ss = 1/sqrt((LF*sba/sbFK)^2 + (LF*carry*Tmax*1000/Wt/ttFK)^2);
    fprintf('x %5.1f %-9s d %2d: M %6.1f N m  beta_s %.2f  K_sig %.2f  S_fat %6.2f  S_stat %6.2f\n', ...
            xn, typ, d, M/1000, bs, Ks, Sf, Ss);
end

% ---------------------------------------------------------------- key and press fit
d = 25; b = 8; h = 7; t1 = 4; l = 32; T = 47.8e3*1.25; pa = 90; ltr = l-b;
pk = 2*T/(d*(h-t1)*ltr);
fprintf('key: p %.1f MPa, S %.2f, l_min %.1f mm\n', pk, pa/pk, 2*T/(d*(h-t1)*pa)+b);
d = 30; DA = 55; lf = 16; E = 210000; nu = 0.3; mu = 0.12; QA = d/DA;
for U = [18 48]
    Ue = max(0, U - 0.8*(3.2+6.3))/1000;
    pf = (Ue/d)/(((1+QA^2)/(1-QA^2)+nu)/E + (1-nu)/E);
    fprintf('press fit U %d um: p %.1f MPa, T %.1f N m, hub sv %.1f MPa\n', U, pf, pi/2*d^2*lf*pf*mu/1000, 2*pf/(1-QA^2));
end

% ---------------------------------------------------------------- plots
figure; subplot(2,1,1); plot(x, hypot(My,Mz)/1000); grid on; ylabel('M [N m]'); title('Resultant bending moment');
subplot(2,1,2); plot(x, v*1000); grid on; xlabel('x [mm]'); ylabel('deflection [\mum]');

% ================================================================ local functions
function D = dia(seg, x)
    s = 0;
    for i = 1:size(seg,1)
        if x <= s + seg(i,1) + 1e-9, D = seg(i,2); return; end
        s = s + seg(i,1);
    end
    D = seg(end,2);
end

function [My, Mz] = moments(x, F, xb, R)
    loads = [xb(1) R(1,1) R(2,1); xb(2) R(1,2) R(2,2); F];
    My = zeros(size(x)); Mz = zeros(size(x));
    for j = 1:size(loads,1)
        on = x > loads(j,1);
        My = My + on.*loads(j,2).*(x - loads(j,1));
        Mz = Mz + on.*loads(j,3).*(x - loads(j,1));
    end
end

function v = elastic_line(x, kappa, xb)
    th = cumtrapz(x, kappa);
    v  = cumtrapz(x, th);
    va = interp1(x, v, xb(1)); vb = interp1(x, v, xb(2));
    C1 = -(vb - va)/(xb(2) - xb(1)); C0 = -va - C1*xb(1);
    v  = v + C1*x + C0;
end

function kt = kt_shoulder(D, d, r, bending)
    % Peterson curve fits Kt = A (r/d)^b (Norton), linear interpolation in D/d
    if bending
        tab = [1.01 0.91938 -0.17032; 1.02 0.96048 -0.17711; 1.03 0.98061 -0.18381; 1.05 0.98137 -0.19653;
               1.07 0.97527 -0.20958; 1.10 0.95120 -0.23757; 1.20 0.97098 -0.21796; 1.50 0.93836 -0.25759;
               2.00 0.90879 -0.28598; 3.00 0.89334 -0.30860; 6.00 0.87868 -0.33243];
    else
        tab = [1.09 0.90337 -0.12692; 1.20 0.83425 -0.21649; 1.33 0.84897 -0.23161; 2.00 0.86331 -0.23865];
    end
    q = min(max(D/d, tab(1,1)), tab(end,1));
    A = interp1(tab(:,1), tab(:,2), q); b = interp1(tab(:,1), tab(:,3), q);
    kt = max(1, A*(r/d)^b);
end
