### 6.4. Validation of the loss model across event rates

Campaign E2 could not test the loss formulas, because an 8-entry ring never overflowed at the mix-model rate. Campaign
E3 therefore drove 50 emulated devices with Poisson state changes at $\lambda$ = 4 and 16 s⁻¹ and chose $P$ so that the
mean number of changes per poll interval $\lambda P$ ranged from 1 to 16 (Table 9, Figure 6). In total 475 230 changes
were generated. For every interval the change counter gave the exact number of changes $N_\Delta$; its empirical
dispersion index (variance/mean) was 0.95–1.04, as expected for Poisson counts, and the measured mean $\hat\mu$ was
within 1.5 % of the nominal $\lambda P$ in 15 of 16 runs (12.21 instead of 12 in one run).

Three results stand out. First, the reconstruction was exact: the number of events lost according to the identity check
equalled $\sum (N_\Delta - R)^+$ from the counter in every run (77 080 lost events in total, zero mismatches), i.e. the
gateway lost precisely the events that did not fit into the ring and *reported* every such loss. Second, the share of
lost events agreed with the Poisson partial expectation, Eq. (11), evaluated at $\hat\mu$, within 0.0033 in absolute
terms over the whole range – from 1 lost event in 11 915 at $\hat\mu$ = 2 to half of all events at $\hat\mu$ = 16 – and
the share of overflowing intervals agreed with Eq. (10) within 0.01. The same curves held for both event rates, so the
loss depends on $\lambda P$ only, as the model states. Third, the share of changes reported by state-only polling agreed
with the new closed form, Eq. (9), within 0.011 over the whole range; already at $\lambda P$ = 1, state-only polling
reported only 55–56 % of the changes, whereas the event block captured all of them.

For design this means that Eqs. (10)–(12) can be trusted to choose the ring depth: with $R$ = 8 the model loss is about
10⁻⁶ at $\lambda P$ = 1, 1.5 × 10⁻⁴ at 2 and 0.8 % at 4 [calculated], and every lost event is flagged.

**Table 9.** Validation of the loss model (E3): 50 devices, Poisson changes, ring $R$ = 8, parallel polling, 60 s per
run [measured; model values calculated with Eqs. (9)–(11) at the measured $\hat\mu$].

| λ [s⁻¹] | P [s] | μ̂ (dispersion) | Intervals | Changes | Lost: identity / counter | Loss share: measured / Eq. (11) | Overflow share: measured / Eq. (10) | State-only reported: measured / Eq. (9) |
|---|---|---|---|---|---|---|---|---|
| 4 | 0.25 | 1.00 (0.99) | 11 950 | 11 928 | 0 / 0 | 0 / 0.0000 | 0 / 0.0000 | 0.564 / 0.553 |
| 4 | 0.5 | 2.00 (0.97) | 5 950 | 11 915 | 1 / 1 | 0.0001 / 0.0001 | 0.0002 / 0.0002 | 0.354 / 0.349 |
| 4 | 1 | 3.94 (1.03) | 2 950 | 11 624 | 90 / 90 | 0.0077 / 0.0078 | 0.019 / 0.020 | 0.190 / 0.189 |
| 4 | 1.5 | 6.04 (0.97) | 1 950 | 11 773 | 592 / 592 | 0.050 / 0.054 | 0.152 / 0.157 | 0.127 / 0.124 |
| 4 | 2 | 7.97 (0.97) | 1 450 | 11 557 | 1 574 / 1 574 | 0.136 / 0.138 | 0.402 / 0.403 | 0.095 / 0.094 |
| 4 | 2.5 | 9.99 (0.98) | 1 150 | 11 491 | 2 826 / 2 826 | 0.246 / 0.246 | 0.670 / 0.666 | 0.074 / 0.075 |
| 4 | 3 | 12.21 (0.95) | 950 | 11 598 | 4 133 / 4 133 | 0.356 / 0.357 | 0.848 / 0.858 | 0.059 / 0.061 |
| 4 | 4 | 16.16 (0.96) | 700 | 11 312 | 5 720 / 5 720 | 0.506 / 0.506 | 0.976 / 0.980 | 0.047 / 0.046 |
| 16 | 0.0625 | 1.01 (1.00) | 47 400 | 47 743 | 0 / 0 | 0 / 0.0000 | 0 / 0.0000 | 0.554 / 0.550 |
| 16 | 0.125 | 2.01 (1.01) | 23 850 | 47 872 | 7 / 7 | 0.0001 / 0.0002 | 0.0003 / 0.0002 | 0.349 / 0.348 |
| 16 | 0.25 | 4.01 (0.99) | 11 950 | 47 923 | 401 / 401 | 0.0084 / 0.0085 | 0.021 / 0.022 | 0.186 / 0.186 |
| 16 | 0.375 | 6.02 (0.98) | 7 950 | 47 833 | 2 427 / 2 427 | 0.051 / 0.053 | 0.155 / 0.155 | 0.124 / 0.125 |
| 16 | 0.5 | 8.04 (1.00) | 5 950 | 47 826 | 6 779 / 6 779 | 0.142 / 0.142 | 0.416 / 0.413 | 0.093 / 0.093 |
| 16 | 0.625 | 10.05 (1.04) | 4 750 | 47 753 | 11 965 / 11 965 | 0.251 / 0.249 | 0.670 / 0.673 | 0.075 / 0.075 |
| 16 | 0.75 | 12.08 (0.99) | 3 950 | 47 698 | 16 750 / 16 750 | 0.351 / 0.351 | 0.850 / 0.850 | 0.063 / 0.062 |
| 16 | 1 | 16.06 (0.96) | 2 950 | 47 384 | 23 815 / 23 815 | 0.503 / 0.503 | 0.983 / 0.979 | 0.047 / 0.047 |

![Figure 6](figures/fig6_loss_model.svg)

**Figure 6.** Validation of the loss model (E3). (a) Share of events lost by the event block (squares/circles) and share
of intervals with more than $R$ = 8 changes (crosses) versus the mean number of changes per poll interval, with
Eqs. (11) and (10). (b) Share of changes captured by state-only polling (squares/circles) with Eq. (9), and by the event
block (diamonds) with $1 - \eta$. Points for $\lambda$ = 4 and 16 s⁻¹ largely coincide [measured / calculated].
