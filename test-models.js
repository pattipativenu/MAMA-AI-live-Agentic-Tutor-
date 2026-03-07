import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("No VITE_GEMINI_API_KEY found in .env.local");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testModel(modelName) {
  console.log(`\n--- Testing Model: ${modelName} ---`);
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: 'A simple red apple on a white background',
    });
    console.log(`✅ SUCCESS! ${modelName} is available.`);
  } catch (err) {
    console.error(`❌ FAILED: ${modelName} - ${err.message}`);
  }
}

async function testModels() {
  await testModel('gemini-3.1-flash-image-preview'); // Baseline
  await testModel('nano-banana-pro');
  await testModel('nano-banana-pro-2');
  await testModel('banana-pro-2');
  await testModel('veo-2');
  await testModel('veo');
}

testModels();
