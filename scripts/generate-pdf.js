const fs = require('fs');
const PDFDocument = require('pdfkit');

// Create the directory if it doesn't exist
const dir = './public/demo-assets';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream(`${dir}/High-Yield-Pathology-Demo.pdf`));

// Page 1: Pathology - CML
doc.fontSize(24).text('High-Yield Pathology & Pharmacology', { align: 'center' });
doc.moveDown();
doc.fontSize(18).text('Chapter 1: Hematopathology - Chronic Myeloid Leukemia (CML)');
doc.moveDown();
doc.fontSize(12).text(
  'Chronic Myeloid Leukemia (CML) is a myeloproliferative neoplasm characterized by the dysregulated production and uncontrolled proliferation of mature and maturing granulocytes with fairly normal differentiation. ' +
  'The hallmark of CML is the Philadelphia chromosome, a reciprocal translocation between chromosomes 9 and 22, designated as t(9;22)(q34;q11). ' +
  'This translocation fuses the BCR gene on chromosome 22 with the ABL1 gene on chromosome 9, creating the BCR-ABL1 fusion gene, which encodes a constitutively active tyrosine kinase.'
);
doc.moveDown();
doc.text(
  'Clinical Presentation: Patients often present with fatigue, weight loss, night sweats, and massive splenomegaly due to extramedullary hematopoiesis. ' +
  'The peripheral blood smear shows a striking leukocytosis with a full spectrum of myeloid precursors (myelocytes, metamyelocytes, bands). ' +
  'Unlike leukemoid reactions, leukocyte alkaline phosphatase (LAP) score is characteristically low in CML.'
);
doc.moveDown();
doc.text(
  'Treatment: The advent of targeted therapy has revolutionized the treatment of CML. Tyrosine kinase inhibitors (TKIs), such as Imatinib, specifically inhibit the BCR-ABL1 kinase activity and induce deep molecular remissions.'
);

doc.addPage();

// Page 2: Pharmacology - Cardiovascular
doc.fontSize(18).text('Chapter 2: Cardiovascular Pharmacology - Heart Failure');
doc.moveDown();
doc.fontSize(12).text(
  'The management of systolic heart failure (Heart Failure with Reduced Ejection Fraction, HFrEF) relies heavily on neurohormonal blockade to prevent adverse cardiac remodeling and improve survival. ' +
  'Angiotensin-Converting Enzyme (ACE) Inhibitors are considered first-line agents. They inhibit the conversion of Angiotensin I to Angiotensin II, leading to vasodilation, decreased sympathetic activity, and reduced aldosterone secretion.'
);
doc.moveDown();
doc.text(
  'Important Contraindications and Adverse Effects: While ACE inhibitors are life-saving, they have strict contraindications. ' +
  'They are absolutely contraindicated in patients with Bilateral Renal Artery Stenosis. In these patients, GFR is highly dependent on Angiotensin II-mediated efferent arteriolar vasoconstriction. Initiating an ACE inhibitor removes this compensatory mechanism, causing an acute and profound fall in GFR and acute kidney injury.'
);
doc.moveDown();
doc.text(
  'Another major contraindication is a history of ACE-inhibitor-induced Angioedema. ACE is also responsible for the breakdown of bradykinin. Inhibition of ACE leads to bradykinin accumulation, which can cause life-threatening airway edema. ' +
  'If a patient develops angioedema on an ACE inhibitor, they must be switched to an Angiotensin Receptor Blocker (ARB) with caution, or a completely different class.'
);
doc.moveDown();
doc.text('Other contraindications include pregnancy (teratogenic effects) and severe hyperkalemia.');

doc.end();
console.log('PDF generated successfully!');
