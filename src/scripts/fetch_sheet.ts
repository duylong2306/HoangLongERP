import fs from 'fs';

async function fetchSheet() {
  const url = 'https://docs.google.com/spreadsheets/d/186viMcJJNRmWRNnIJfuYmKZCWF4q2CE-2u09hiIYRKs/export?format=csv';
  console.log(`Fetching ${url}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const text = await res.text();
    console.log(`Fetched ${text.length} characters successfully!`);
    fs.writeFileSync('./sheet_data.csv', text, 'utf-8');
    console.log('Saved data to ./sheet_data.csv');
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

fetchSheet();
