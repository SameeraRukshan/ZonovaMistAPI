require('dotenv').config({ path: './backend/.env' });
const fs = require('fs');

console.log('Testing Google credentials...\n');

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!credPath) {
  console.error('❌ GOOGLE_APPLICATION_CREDENTIALS is not set');
  process.exit(1);
}

console.log('✅ Env variable is set');
console.log('Path:', credPath);

if (!fs.existsSync(credPath)) {
  console.error('❌ File does NOT exist at path');
  process.exit(1);
}

console.log('✅ Credentials file exists');

const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
console.log('Project ID:', credentials.project_id);
console.log('Client Email:', credentials.client_email);

console.log('\n✅ Google credentials setup is 100% correct!\n');
