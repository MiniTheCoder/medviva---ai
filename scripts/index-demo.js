const fs = require('fs');

async function uploadFile(topic) {
  const formData = new FormData();
  const fileBuffer = fs.readFileSync('./public/demo-assets/High-Yield-Pathology-Demo.pdf');
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  formData.append('file', blob, 'High-Yield-Pathology-Demo.pdf');
  formData.append('topic', topic);

  console.log(`Uploading for topic: ${topic}...`);
  try {
    const res = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    console.log(`Upload response for ${topic}:`, data);
  } catch (err) {
    console.error(`Error uploading for ${topic}:`, err);
  }
}

async function run() {
  await uploadFile('Pathology');
  await uploadFile('Pharmacology');
}

run();
