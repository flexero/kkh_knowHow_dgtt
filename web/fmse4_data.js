/* FMS engineering – item 4 data: capacity, layout, simulation.  Guide: docs/FMS system design/64_capacity_layout_simulation.md.
 * All numbers are examples. */

/* 4A OEE example: one machine, one week (minutes) */
export const OEE0 = { cal: 10080, plan: 4500, down: 270, setup: 360, minor: 150, ideal: 2.0, total: 1650, good: 1610 };

/* 4D layout types: [type, how it looks, flow, flexibility, best for, watch out] */
export const LAYOUTS = [
  ["Process (functional) layout", "Same machines grouped: all lathes together, all mills together", "Long, crossing routes, big WIP", "Very high – any part", "Job shop, many different parts, low volume", "Transport effort, long lead time, hard to plan"],
  ["Product (line) layout", "Machines in the order of the routing", "Short, straight, one direction", "Low – one family", "High volume, few variants", "One breakdown stops the line; balancing"],
  ["Cellular layout (group technology)", "One cell per part family (item 2A), often U-shaped", "Short inside the cell", "Medium–high inside the family", "Medium volume / variety – the classic step before an FMS", "Exceptional parts between cells"],
  ["FMS – linear (spine)", "Machines on one or both sides of a pallet pool / rail", "Any route via the transport line", "High", "FMS with 2–8 machines, expandable at the end", "Transport line is a single point of failure"],
  ["FMS – loop", "Conveyor or AGV loop past all stations", "One direction, any station", "High", "Assembly systems, carriers, many stations", "Loop length = carriers + time; blocking"],
  ["U-shape / cell", "Line bent into a U, entry and exit side by side", "Short walking, one operator serves several stations", "Medium", "Manual / semi-automatic cells, assembly", "Space for material supply inside the U"],
  ["Fixed-position layout", "Product stays, people and tools come to it", "No part transport", "Very high", "Very large products (machines, ships), final assembly of big units", "Logistics of tools and material to the site"],
];

/* 4D from-to example: 8 departments, flows in loads per day (from → to) */
export const DEPTS = ["Receiving", "Saw / prep", "Turning", "Milling", "Heat treat", "Grinding", "Assembly", "Shipping"];
export const FLOW = [
  // Rec Saw Turn Mill Heat Grind Asm Ship
  [0, 30, 0, 20, 0, 0, 0, 0],
  [0, 0, 25, 5, 0, 0, 0, 0],
  [0, 0, 0, 0, 15, 10, 5, 0],
  [0, 0, 0, 0, 5, 5, 15, 0],
  [0, 0, 0, 0, 0, 20, 0, 0],
  [0, 0, 0, 0, 0, 0, 30, 0],
  [0, 0, 0, 0, 0, 0, 0, 50],
  [0, 0, 0, 0, 0, 0, 0, 0],
];
// grid of 4 × 2 slots, 20 m pitch; start layout = a poor arrangement (department index per slot)
export const SLOTS = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]];
export const START = [6, 0, 5, 1, 7, 4, 2, 3];
export const PITCH = 20;

/* 4E generic FMS simulation defaults */
export const SIM0 = {
  m: 3, N: 10, L: 1, V: 1,
  load: 12, loadCv: 0.3, move: 1.5,
  mttf: 1200, mttr: 60, rule: "FIFO", days: 14, seed: 7,
  parts: [["Crankcase A (4 per tombstone)", 40, 56, 0.15], ["Crankcase B (4 per tombstone)", 35, 72, 0.15], ["Cylinder C (6 per pallet)", 25, 40, 0.15]],
};
