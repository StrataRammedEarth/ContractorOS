// Groups by checklist_section for the Tools/Custom Materials cards, with an
// "Other" bucket (ungrouped items) always sorted last regardless of alphabetical
// position, since it's a fallback rather than a named category.
export function groupByChecklistSection<T extends { checklist_section: string | null }>(
  items: T[],
): { section: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = item.checklist_section?.trim() || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const sections = [...map.keys()].filter((s) => s !== "Other").sort();
  if (map.has("Other")) sections.push("Other");
  return sections.map((section) => ({ section, items: map.get(section)! }));
}
