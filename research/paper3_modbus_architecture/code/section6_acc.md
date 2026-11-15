### 6.7. Acceptance tests

The four acceptance-test programs of the control software (Table 6) were re-run for this paper without modification,
with the virtual-plant and HTTP ports remapped to 18900–18999 by a small wrapper script; all 61 checks passed
(20 + 15 + 11 + 15). These tests exercise the complete control functions – dispatching, recovery after a controller
restart, the *unknown* state after a lost job result, tool checks and logistics – on the same register interface whose
timing and fault behaviour were measured above.
