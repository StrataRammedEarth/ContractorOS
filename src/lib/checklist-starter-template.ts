// One-time, client-triggered "Load Starter Template" seed data for the Tools
// and Custom Materials cards (Brief: Tools & Custom Materials Checklist
// Sections + Starter Template Loader). Lives in app code, not the database,
// so it can be adjusted without a migration.

export const TOOLS_STARTER_TEMPLATE: {
  name: string;
  category: "hand" | "power";
  section: string;
}[] = [
  // Plumbing & Pipework
  { name: "Basin Wrench", category: "hand", section: "Plumbing & Pipework" },
  { name: "Crimping Tool / PEX Expander", category: "hand", section: "Plumbing & Pipework" },
  { name: "Drain Auger / Snake", category: "hand", section: "Plumbing & Pipework" },
  { name: "Drain Rods", category: "hand", section: "Plumbing & Pipework" },
  { name: "Pipe Cutters (Copper & PVC)", category: "hand", section: "Plumbing & Pipework" },
  { name: "Pipe Wrench / Bobbejaan Spanner", category: "hand", section: "Plumbing & Pipework" },
  { name: "Plunger", category: "hand", section: "Plumbing & Pipework" },

  // Demolition & Earthworks
  { name: "5 Pound Hammer", category: "hand", section: "Demolition & Earthworks" },
  { name: "Core Drill", category: "power", section: "Demolition & Earthworks" },
  { name: "Jackhammer", category: "power", section: "Demolition & Earthworks" },
  { name: "Masonry Chisel", category: "hand", section: "Demolition & Earthworks" },
  { name: "Pick Axe", category: "hand", section: "Demolition & Earthworks" },
  { name: "Spades", category: "hand", section: "Demolition & Earthworks" },
  { name: "Stamper", category: "hand", section: "Demolition & Earthworks" },

  // Soldering & Welding
  { name: "Blowtorch", category: "power", section: "Soldering & Welding" },
  { name: "Soldering Heat Mat", category: "hand", section: "Soldering & Welding" },

  // General & Diagnostics
  { name: "Electrical Multimeter", category: "hand", section: "General & Diagnostics" },
  { name: "Hacksaw", category: "hand", section: "General & Diagnostics" },
  { name: "Hand Toolbox Kit", category: "hand", section: "General & Diagnostics" },
  { name: "Inspection Camera / Borescope", category: "power", section: "General & Diagnostics" },
  { name: "Ladder", category: "hand", section: "General & Diagnostics" },
  { name: "Pressure Testing Pump", category: "hand", section: "General & Diagnostics" },
  { name: "Spirit Level", category: "hand", section: "General & Diagnostics" },
  { name: "Torch", category: "hand", section: "General & Diagnostics" },

  // Power & Drilling
  { name: "Angle Grinder", category: "power", section: "Power & Drilling" },
  { name: "Cordless Drill / Impact Driver", category: "power", section: "Power & Drilling" },
  { name: "SDS Drill", category: "power", section: "Power & Drilling" },
];

export const MATERIALS_STARTER_TEMPLATE: {
  name: string;
  unit: string;
  section: string;
}[] = [
  // Pipes, Fittings & Hardware — kept as individual rows per material (owner decision,
  // 2026-07-22): copper, PEX, and PVC pipe are not interchangeable on a call-out and must
  // stay distinguishable, even though they now share one section heading.
  { name: "Angle Valves", unit: "ea", section: "Pipes, Fittings & Hardware" },
  { name: "Basin Waste Replacement (Slotted)", unit: "ea", section: "Pipes, Fittings & Hardware" },
  { name: "Basin Waste Replacement (Unslotted)", unit: "ea", section: "Pipes, Fittings & Hardware" },
  { name: "Braided Flexi Connectors", unit: "ea", section: "Pipes, Fittings & Hardware" },
  { name: "Copper Pipe", unit: "m", section: "Pipes, Fittings & Hardware" },
  { name: "PEX Pipe", unit: "m", section: "Pipes, Fittings & Hardware" },
  { name: "PVC Pipe", unit: "m", section: "Pipes, Fittings & Hardware" },
  { name: "Elbows (90° / 45°)", unit: "ea", section: "Pipes, Fittings & Hardware" },
  { name: "Float Valves", unit: "ea", section: "Pipes, Fittings & Hardware" },
  { name: "Mixer/Tap Cartridge", unit: "ea", section: "Pipes, Fittings & Hardware" },
  { name: "P-Traps / Bottle Traps", unit: "ea", section: "Pipes, Fittings & Hardware" },
  { name: "Reducers / Couplings", unit: "ea", section: "Pipes, Fittings & Hardware" },
  { name: "Rubber Washers", unit: "ea", section: "Pipes, Fittings & Hardware" },
  { name: "T-Pieces", unit: "ea", section: "Pipes, Fittings & Hardware" },
  { name: "Toilet Pan Connectors", unit: "ea", section: "Pipes, Fittings & Hardware" },

  // Adhesives, Sealants & Chemicals
  // NOTE: "Thread Tape (PTFE)" and "Lube / Silicone Grease" deliberately OMITTED — owner
  // confirmed 2026-07-22 that near-equivalent items ("Thread Tape", "Lube") already exist
  // live and re-adding under a slightly different name would create an undetected near-
  // duplicate (the skip-duplicate rule only matches on exact normalised name).
  { name: "Drain Cleaner Acid", unit: "L", section: "Adhesives, Sealants & Chemicals" },
  { name: "Flux Paste", unit: "tub", section: "Adhesives, Sealants & Chemicals" },
  { name: "Plumber's Putty", unit: "tub", section: "Adhesives, Sealants & Chemicals" },
  { name: "PVC Glue", unit: "L/tube", section: "Adhesives, Sealants & Chemicals" },
  { name: "Silicone Sealant (Sanitary/Clear)", unit: "tube", section: "Adhesives, Sealants & Chemicals" },
  { name: "Solder Wire", unit: "roll", section: "Adhesives, Sealants & Chemicals" },

  // Tool Accessories & Consumables
  { name: "Core Drill Bits", unit: "ea", section: "Tool Accessories & Consumables" },
  { name: "Drying Rags", unit: "bag/ea", section: "Tool Accessories & Consumables" },
  { name: "Hacksaw Blades", unit: "ea", section: "Tool Accessories & Consumables" },
  { name: "Masonry Disc for Grinder", unit: "ea", section: "Tool Accessories & Consumables" },
  { name: "Sandpaper / Emery Cloth", unit: "roll/sheet", section: "Tool Accessories & Consumables" },
];
