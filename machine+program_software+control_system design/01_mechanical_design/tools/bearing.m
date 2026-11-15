% bearing.m - MATLAB mirror of the core of bearing.py (guide M4, rolling bearings)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of bearing.py.
% Run it once and compare with these bearing.py numbers (python bearing.py examples / ch711):
%   6206, Fr 1500 N: Fa 500 N -> e 0.253, X 0.56, Y 1.76, P 1721 N ; Fa 1000 N -> e 0.293, Y 1.49, P 2327 N
%   L10: C 20.3 kN, P 2030 N, 1000 rpm -> 1000 Mrev = 16667 h ; a1(99 %) = 0.25
%   ISO VG 100: nu(80 C) = 19.5 mm2/s ; nu1(1450 rpm, dm 46) = 17.4 mm2/s -> kappa 1.12
%   a_ISO (ball): kappa 1, ecCu/P 0.1 -> 2.43 ; kappa 2 -> 4.20 ; kappa 0.5 -> 0.53
%   6206 with the M2/M3 load cycle: cubic-mean load A 1211 N -> L10h 54179 h, a_ISO 5.14, L_nm 278273 h
%   operating clearance 6206 C3, k5 (+2...+13 um), dT 10 K -> -1.7 ... 21.3 um ; with C4 -> 8.3 ... 34.3 um
% Requires base MATLAB only (R2016b or newer: local functions in scripts).

clear; clc;
b = struct('type','ball','d',30,'D',62,'B',16,'C',20.3,'C0',11.2,'Cu',0.475,'f0',14.0);   % 6206 (typical, check)

% --- equivalent dynamic load with axial force
for Fa = [0 200 500 1000]
    [P, X, Y, e] = equivalent_dynamic(b, 1500, Fa);
    fprintf('Fa %4d N: e %.3f X %.2f Y %.2f -> P %.0f N\n', Fa, e, X, Y, P);
end

% --- basic life, reliability
[L10, L10h] = basic_life(20.3, 2030, 3, 1000);
fprintf('L10 %.0f Mrev = %.0f h ; a1(99) = %.3f\n', L10, L10h, a1(99));

% --- lubrication and a_ISO
nu  = nu_from_VG(100, 80);
nu1 = nu1_rated(1450, (b.d + b.D)/2);
fprintf('nu %.1f, nu1 %.1f, kappa %.2f\n', nu, nu1, nu/nu1);
for k = [0.5 1 2]
    fprintf('a_ISO(kappa %.1f, ecCu/P 0.1) = %.2f\n', k, a_iso(k, 0.1, 'ball'));
end

% --- modified life for a load that varies over one revolution (vector F, e.g. from crank.py/shaft.py CSV)
% F = readmatrix('bearing.csv'); F = F(:,2);          % Fr_A column written by 'python bearing.py run'
F   = 1211 * ones(180,1);                              % placeholder: constant equivalent load
Pm  = (mean(F.^3))^(1/3);                              % cubic mean (ball, p = 3)
[~, Lh] = basic_life(b.C, Pm, 3, 1450);
aI  = a_iso(nu/nu1, 0.40 * b.Cu*1000 / Pm, 'ball');   % e_c 0.40 = slight contamination (typical)
fprintf('Pm %.0f N, L10h %.0f h, a_ISO %.2f, L_nm %.0f h\n', Pm, Lh, aI, a1(90)*aI*Lh);

% --- operating clearance
[cmin, cmax] = operating_clearance([13 28], [2 13], 10, (b.d + b.D)/2);
fprintf('operating clearance C3: %.1f ... %.1f um\n', cmin, cmax);

% ================================================================ local functions
function [P, X, Y, e] = equivalent_dynamic(b, Fr, Fa)
    tab = [0.172 0.19 2.30; 0.345 0.22 1.99; 0.689 0.26 1.71; 1.03 0.28 1.55; 1.38 0.30 1.45;
           2.07 0.34 1.31; 3.45 0.38 1.15; 5.17 0.42 1.04; 6.89 0.44 1.00];   % f0 Fa/C0 -> e, Y
    if Fa <= 0
        P = Fr; X = 1; Y = 0; e = NaN; return
    end
    q = b.f0 * Fa / (b.C0 * 1000);
    q = min(max(q, tab(1,1)), tab(end,1));
    e = interp1(tab(:,1), tab(:,2), q);
    Yt = interp1(tab(:,1), tab(:,3), q);
    if Fa / Fr <= e
        P = Fr; X = 1; Y = 0;
    else
        X = 0.56; Y = Yt; P = X*Fr + Y*Fa;
    end
end

function [L10, L10h] = basic_life(C_kN, P_N, p, rpm)
    L10 = (C_kN*1000 / P_N)^p;            % million revolutions
    L10h = L10 * 1e6 / (60 * rpm);
end

function a = a1(rel)
    t = [90 1.0; 95 0.64; 96 0.55; 97 0.47; 98 0.37; 99 0.25; 99.2 0.22; 99.4 0.19; 99.6 0.16;
         99.8 0.12; 99.9 0.093; 99.92 0.087; 99.94 0.080; 99.95 0.077];
    if rel <= 90, a = 1; return, end
    a = interp1(t(:,1), t(:,2), min(rel, 99.95));
end

function nu = nu_from_VG(VG, T)
    VGs = [32 46 68 100 150 220 320 460]; n100 = [5.4 6.8 8.7 11.1 14.5 18.9 23.9 30.5];
    nu100 = n100(VGs == VG);
    W  = @(v) log10(log10(v + 0.7));
    T1 = log10(313.15); T2 = log10(373.15);
    B  = (W(VG) - W(nu100)) / (T2 - T1);
    A  = W(VG) + B*T1;
    nu = 10^(10^(A - B*log10(T + 273.15))) - 0.7;
end

function nu1 = nu1_rated(rpm, dm)
    if rpm < 1000
        nu1 = 45000 * rpm^-0.83 * dm^-0.5;
    else
        nu1 = 4500 * rpm^-0.5 * dm^-0.5;
    end
end

function a = a_iso(kappa, x, kind)
    k = min(max(kappa, 0.1), 4);
    if strcmp(kind, 'ball')
        if k < 0.4, k1 = 2.2649; e1 = 0.054381; elseif k < 1, k1 = 1.9987; e1 = 0.19087; else, k1 = 1.9987; e1 = 0.071739; end
        inner = max(0, 2.5671 - k1/k^e1)^0.83 * x^(1/3);  expo = -9.3;
    else
        if k < 0.4, k1 = 1.3993; e1 = 0.054381; elseif k < 1, k1 = 1.2348; e1 = 0.19087; else, k1 = 1.2348; e1 = 0.071739; end
        inner = max(0, 1.5859 - k1/k^e1) * x^0.4;  expo = -9.185;
    end
    if inner >= 1, a = 50; return, end
    a = min(50, 0.1 * (1 - inner)^expo);
end

function [cmin, cmax] = operating_clearance(initial, fit_um, dT, dm)
    fit = 0.8 * 0.9 * fit_um;             % inner-ring expansion ~ 0.8 x effective interference (0.9 x measured)
    th  = 11.5e-6 * dT * dm * 1000;       % thermal reduction, um
    cmin = initial(1) - fit(2) - th;
    cmax = initial(2) - fit(1) - th;
end
