/**
 * Small seed dictionary of common Nigerian given names and surnames.
 * Recall is deliberately modest; Gemini Nano (Phase 2) covers the long tail.
 */
const YORUBA = [
  "Adebayo", "Ogunleye", "Funmilayo", "Oluwaseun", "Adewale", "Babatunde", "Folake", "Yetunde",
  "Bolanle", "Olumide", "Ayodele", "Temitope", "Adeyemi", "Adeola", "Ogunbiyi", "Olawale",
  "Bamidele", "Adekunle", "Afolabi", "Oyelaran",
];
const IGBO = [
  "Chukwuemeka", "Nwosu", "Ngozi", "Okafor", "Emeka", "Eze", "Chinedu", "Obinna", "Adaeze",
  "Chiamaka", "Nnamdi", "Okonkwo", "Ifeanyi", "Uchenna", "Nwachukwu", "Okeke", "Obi", "Amaka",
  "Chidi", "Onyeka",
];
const HAUSA = [
  "Aisha", "Bello", "Halima", "Abubakar", "Musa", "Ibrahim", "Fatima", "Usman", "Abdullahi",
  "Garba", "Zainab", "Sani", "Yusuf", "Suleiman", "Hauwa", "Aliyu", "Danjuma", "Lawal", "Hadiza",
];
const IJAW = [
  "Tamunosiki", "Briggs", "Ebiere", "Alagoa", "Preye", "Timipre", "Ebikabowei", "Tonye",
  "Ayebatari", "Seiyefa", "Oyinkuro", "Perekebina", "Dagogo", "Erebi", "Diepreye", "Inemotimi",
];

const NAMES: ReadonlySet<string> = new Set([...YORUBA, ...IGBO, ...HAUSA, ...IJAW].map((n) => n.toLowerCase()));

export function isKnownName(word: string): boolean {
  return NAMES.has(word.toLowerCase());
}
