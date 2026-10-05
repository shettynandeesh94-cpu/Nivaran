const { GoogleGenAI } = require('@google/genai');

const PRIMARY_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-flash-latest'
];

async function analyzeCivicImage(imageBase64, mimeType = 'image/jpeg') {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
        console.error('[VisionEngine] GEMINI_API_KEY is not set in .env');
        throw new Error('GEMINI_API_KEY is missing in server environment.');
    }

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const prompt = `
You are an expert civic infrastructure inspection AI for a municipality complaint system called "Nivaran".
Analyze this photo of a civic issue carefully and inspect what is specifically shown in the picture.

Civic issue examples to look for:
- Damaged / broken streetlight, dark luminaire, fallen electric pole -> Category: "Streetlights"
- Pothole, damaged asphalt, cracked road, crater -> Category: "Roads"
- Water pipeline leak, pipe burst, tap leaking, waterlogging -> Category: "Water Supply"
- Garbage dump, plastic waste, drainage blockage, open sewage -> Category: "Sanitation"
- Broken footpath, public park damage, crop damage, public health hazard -> Category: "General" / "Health" / "Agriculture"

Provide a structured JSON output with these exact fields:
1. "title": A precise 4-8 word title accurately describing the specific object/damage in the photo (e.g. "Damaged Streetlight Fixture on Pole", "Deep Pothole Hazard on Road", "Garbage Dump Accumulation", "Water Supply Pipeline Burst").
2. "description": A clear, objective 2-3 sentence description of the visible damage, its severity, and the hazard it causes to public safety.
3. "category": Must strictly be one of: ["Streetlights", "Roads", "Water Supply", "Sanitation", "Health", "NREGA/MGNREGA", "Agriculture", "General"].
4. "priority": "HIGH" (severe hazard, live electrical wire, deep crash-prone pothole, flooding pipe), "MEDIUM" (broken fixture, garbage pile, blocked drain), or "LOW" (minor cosmetic issue).
5. "estimatedCost": Estimated repair cost in INR (e.g. 900 for streetlight bulb/pole wiring, 1500 for asphalt pothole patch, 2200 for pipe joint repair).
6. "detectedTags": Array of 3-5 concise tags describing the objects seen (e.g. ["streetlight pole", "broken bulb", "dark road"]).
7. "confidenceScore": Integer between 80 and 99.
8. "isCivicIssue": Boolean (true if a public civic/infrastructure issue, false if personal selfie/animal/random object).

Respond ONLY with valid JSON.
`;

    let lastError = null;

    for (const modelName of PRIMARY_MODELS) {
        try {
            console.log(`[VisionEngine] Analyzing photo with ${modelName}...`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    data: cleanBase64,
                                    mimeType: mimeType || 'image/jpeg'
                                }
                            }
                        ]
                    }
                ],
                config: {
                    responseMimeType: 'application/json'
                }
            });

            const text = response.text ? response.text.trim() : '';
            const cleanedText = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
            const parsed = JSON.parse(cleanedText);

            console.log(`[VisionEngine] ✅ Visual Detection Successful [${modelName}]: "${parsed.title}" | Category: ${parsed.category} | Priority: ${parsed.priority}`);

            return {
                ...parsed,
                source: 'GEMINI_VISION_AI'
            };
        } catch (err) {
            console.warn(`[VisionEngine] Model ${modelName} encountered error:`, err.message);
            lastError = err;
        }
    }

    throw new Error(`Vision AI inspection failed: ${lastError ? lastError.message : 'Unknown error'}`);
}

module.exports = { analyzeCivicImage };
