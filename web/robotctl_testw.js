/* Web worker wrapper for the self-checks (&rctest): the main page stays responsive, results come back line by line. */
import { runTests } from "./robotctl_test.js";
self.onmessage = (e) => {
  try { runTests((s) => self.postMessage(s), e.data.quick); } catch (err) { self.postMessage("RCTEST failed " + err.stack); }
  self.postMessage("RCTEST DONE");
};
