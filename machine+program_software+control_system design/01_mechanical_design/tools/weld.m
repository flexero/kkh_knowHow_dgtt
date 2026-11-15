% weld.m - MATLAB mirror of the cores of weld.py and vessel.py (guide M11: weld group, fatigue, air receiver)
%
% NOT EXECUTED IN THIS ENVIRONMENT (no MATLAB on the build PC) - line-by-line translation of weld.py / vessel.py.
% Run it once and compare with these numbers (default input, python weld.py examples / python vessel.py examples):
%   weld group box 80 x 80: length 320 mm, I_x = I_y = 341333 mm3, I_p 682667 mm3
%   worst point (80, 0): f_n -21.9, f_t 2.4, f_l 4.5 N/mm -> sigma_eq 10.7 MPa, utilisation 0.024
%   S-N FAT 80: N(50 MPa) = 1.14e7, cut-off 0.405 x 80 = 32.4 MPa
%   receiver: V_req 140 L -> 150 L; f 160.7 MPa; shell e 1.62 mm; Kloepper e 2.11 mm (M 1.541); test 15.73 bar
%   safety valve C 2.703, A 7.68 mm2
% Requires base MATLAB.

clear; clc;
% ---------------- weld group, line method (unit throat)
lines = [0 0 80 0; 80 0 80 80; 80 80 0 80; 0 80 0 0];
L = hypot(lines(:,3) - lines(:,1), lines(:,4) - lines(:,2));
A = sum(L);
xc = sum(L.*(lines(:,1) + lines(:,3))/2)/A;  yc = sum(L.*(lines(:,2) + lines(:,4))/2)/A;
a1 = lines(:,1) - xc; a2 = lines(:,3) - xc; b1 = lines(:,2) - yc; b2 = lines(:,4) - yc;
Iy = sum(L.*(a1.^2 + a1.*a2 + a2.^2)/3);  Ix = sum(L.*(b1.^2 + b1.*b2 + b2.^2)/3);  Ip = Ix + Iy;
fprintf('length %.0f, Ix %.0f, Iy %.0f, Ip %.0f\n', A, Ix, Iy, Ip);
N = -612; Vx = 681; Vy = 0; Mx = 0; My = 170.3e3; T = 40.9e3; a = 3.0;   % N, N mm
fu = 510; bw = 0.9; gM2 = 1.25;
lim = fu/(bw*gM2);  umax = 0;
for k = 1:4
    ux = (lines(k,3) - lines(k,1))/L(k); uy = (lines(k,4) - lines(k,2))/L(k);
    for s = linspace(0, 1, 11)
        x = lines(k,1) + s*(lines(k,3) - lines(k,1)) - xc;  y = lines(k,2) + s*(lines(k,4) - lines(k,2)) - yc;
        fn = N/A + Mx*y/Ix - My*x/Iy;  fx = Vx/A - T*y/Ip;  fy = Vy/A + T*x/Ip;
        fl = fx*ux + fy*uy;  ft = -fx*uy + fy*ux;
        sp = hypot(fn, ft)/(a*sqrt(2));  tl = fl/a;
        u = max(sqrt(sp^2 + 3*(sp^2 + tl^2))/lim, abs(sp)/(0.9*fu/gM2));
        umax = max(umax, u);
    end
end
fprintf('directional utilisation %.3f\n', umax);

% ---------------- S-N curve (normal stress, slopes 3 / 5, cut-off)
fat = 80; dD = fat*(2/5)^(1/3); dL = dD*(5e6/1e8)^(1/5);
sn = @(d) (d >= dD).*2e6.*(fat./d).^3 + (d < dD & d > dL).*5e6.*(dD./d).^5 + (d <= dL).*Inf;
fprintf('FAT 80: N(50) = %.3g, cut-off %.1f MPa\n', sn(50), dL);

% ---------------- air receiver
Q = 16.6*1000/3600; fmax = 15/3600; dp = 2; p1 = 1.013;
Vreq = 0.25*Q*p1/(fmax*dp);
P = 1.1; Di = 400; f = min(241/1.5, 410/2.4); z = 0.85;
es = P*Di/(2*f*z - P);
M = 0.25*(3 + sqrt(10));  eh = P*Di*M/(2*f*1.0 - 0.2*P);
Pt = max(1.25*11*min(265/1.5, 410/2.4)/f, 1.43*11);
k = 1.4; C = 3.948*sqrt(k*(2/(k + 1))^((k + 1)/(k - 1)));
p0 = 11*1.1 + 1.013; Mm = 28.96; Tk = 293.15;
Qm = 16.6*1.013e5*Mm/(8314.46*Tk);
Asv = Qm/(0.2883*C*0.81*p0*sqrt(Mm/Tk));
fprintf('V_req %.0f L, f %.1f MPa, shell e %.2f mm, Kloepper e %.2f mm, test %.2f bar, C %.3f, A_sv %.2f mm2\n', Vreq, f, es, eh, Pt, C, Asv);
