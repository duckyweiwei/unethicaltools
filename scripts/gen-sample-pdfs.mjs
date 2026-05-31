// Generates representative MCQ practice-test PDFs to develop/prove the parser
// against. Covers the v1 formats: standard, asterisk-marked, inline options,
// separate answer-key page, and a two-column layout.
//
//   node scripts/gen-sample-pdfs.mjs   ->   samples/*.pdf
import { PDFDocument, StandardFonts } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "samples");
mkdirSync(OUT, { recursive: true });

const SIZE = 12;
const LH = 18;

async function newDoc() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  return { pdf, font };
}

function drawLines(page, font, lines, x, startY) {
  let y = startY;
  for (const line of lines) {
    if (line) page.drawText(line, { x, y, size: SIZE, font });
    y -= LH;
  }
  return y;
}

async function save(pdf, name) {
  writeFileSync(join(OUT, name), await pdf.save());
  console.log("wrote", name);
}

// 1) Standard — one option per line, "Answer:" tag, an explanation, a wrapped stem.
{
  const { pdf, font } = await newDoc();
  const page = pdf.addPage([612, 792]);
  drawLines(page, font, [
    "Biology Practice Test 1",
    "",
    "1. What is the powerhouse of the cell?",
    "A. Nucleus",
    "B. Mitochondria",
    "C. Ribosome",
    "D. Golgi apparatus",
    "Answer: B",
    "Explanation: Mitochondria produce ATP through cellular respiration.",
    "",
    "2. Which gas do plants absorb for photosynthesis?",
    "A. Oxygen",
    "B. Nitrogen",
    "C. Carbon dioxide",
    "D. Hydrogen",
    "Answer: C",
    "",
    "3. The process by which a cell divides to produce gametes",
    "with half the chromosome number is called:",
    "A. Mitosis",
    "B. Meiosis",
    "C. Binary fission",
    "D. Budding",
    "Answer: B",
  ], 50, 740);
  await save(pdf, "standard.pdf");
}

// 2) Asterisk — correct option marked with a trailing "*", no tag lines.
{
  const { pdf, font } = await newDoc();
  const page = pdf.addPage([612, 792]);
  drawLines(page, font, [
    "Chemistry Quick Quiz",
    "",
    "1. What is the chemical formula for water?",
    "A. CO2",
    "B. H2O*",
    "C. O2",
    "D. NaCl",
    "",
    "2. Which element has atomic number 1?",
    "A. Hydrogen*",
    "B. Helium",
    "C. Lithium",
    "D. Carbon",
    "",
    "3. What kind of bond involves sharing electrons?",
    "A. Ionic",
    "B. Metallic",
    "C. Covalent*",
    "D. Disulfide",
  ], 50, 740);
  await save(pdf, "asterisk.pdf");
}

// 3) Inline — all options on one line, "Ans:" tag.
{
  const { pdf, font } = await newDoc();
  const page = pdf.addPage([612, 792]);
  drawLines(page, font, [
    "Geography Inline Test",
    "",
    "1. What is the capital of France?",
    "A) Berlin   B) Madrid   C) Paris   D) Rome",
    "Ans: C",
    "",
    "2. The longest river in the world is the:",
    "A) Amazon   B) Nile   C) Yangtze   D) Mississippi",
    "Ans: B",
    "",
    "3. Mount Everest sits in which mountain range?",
    "A) Andes   B) Alps   C) Rockies   D) Himalayas",
    "Ans: D",
  ], 50, 740);
  await save(pdf, "inline.pdf");
}

// 4) Answer key — questions have NO inline answer; a separate key page reconciles.
{
  const { pdf, font } = await newDoc();
  const page = pdf.addPage([612, 792]);
  drawLines(page, font, [
    "History Exam",
    "",
    "1. In which year did World War II end?",
    "A. 1918",
    "B. 1945",
    "C. 1939",
    "D. 1963",
    "",
    "2. Who was the first president of the United States?",
    "A. Thomas Jefferson",
    "B. Abraham Lincoln",
    "C. John Adams",
    "D. George Washington",
    "",
    "3. The Great Wall is located in which country?",
    "A. China",
    "B. India",
    "C. Japan",
    "D. Mongolia",
    "",
    "",
    "Answer Key",
    "1. B    2. D    3. A",
  ], 50, 740);
  await save(pdf, "answerkey.pdf");
}

// 5) Two-column — Q1/Q2 in the left column, Q3/Q4 in the right column.
{
  const { pdf, font } = await newDoc();
  const page = pdf.addPage([612, 792]);
  drawLines(page, font, [
    "Physics Two-Column",
    "",
    "1. What is the SI unit of force?",
    "A. Watt",
    "B. Newton",
    "C. Joule",
    "D. Pascal",
    "Ans: B",
    "",
    "2. Acceleration due to gravity is about:",
    "A. 9.8 m/s2",
    "B. 1.6 m/s2",
    "C. 3.7 m/s2",
    "D. 0 m/s2",
    "Ans: A",
  ], 50, 740);
  drawLines(page, font, [
    "3. Light travels fastest in a:",
    "A. Vacuum",
    "B. Glass",
    "C. Water",
    "D. Diamond",
    "Ans: A",
    "",
    "4. Which quantity is a vector?",
    "A. Mass",
    "B. Temperature",
    "C. Velocity",
    "D. Energy",
    "Ans: C",
  ], 330, 740);
  await save(pdf, "twocolumn.pdf");
}

console.log("done");
