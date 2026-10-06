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

/**
 * Autonomous AI Before-vs-After Resolution Verifier
 * Compares the original grievance photo with the repair completion photo to verify if the issue is resolved.
 */
async function verifyResolutionImages(beforeImageBase64, afterImageBase64, complaintContext = {}) {
    const cleanAfter = afterImageBase64 ? afterImageBase64.replace(/^data:image\/\w+;base64,/, '') : null;
    const cleanBefore = beforeImageBase64 ? beforeImageBase64.replace(/^data:image\/\w+;base64,/, '') : null;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
        console.error('[VisionEngine] GEMINI_API_KEY is not set in .env');
        throw new Error('GEMINI_API_KEY is missing in server environment.');
    }

    if (!cleanAfter) {
        throw new Error('Resolution (After) image is required for AI verification.');
    }

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const { title = 'Civic issue', category = 'General', description = '' } = complaintContext;

    const parts = [];

    if (cleanBefore) {
        promptText = `
You are an autonomous civic quality inspection AI for the "Nivaran" municipal grievance platform.
You are provided with TWO images:
- IMAGE 1: The BEFORE photo (Original citizen complaint regarding: "${title}", Category: "${category}", Details: "${description}").
- IMAGE 2: The AFTER photo (Submitted by the field technician / contractor claiming the issue has been resolved).

Conduct a rigorous visual forensic inspection:
1. Compare both photos. Verify if IMAGE 2 shows that the problem seen in IMAGE 1 (e.g. pothole filled, garbage cleared, streetlight fixed/illuminated, pipe leak repaired, broken drain fixed) has actually been resolved.
2. Check if the repair looks authentic, clean, and complete.
3. Determine if the ticket can be autonomously closed without human supervisor intervention.

Return STRICTLY a JSON object with these exact keys:
{
  "isResolved": boolean (true if genuine repair/resolution is verified, false if defect is still visible or photo is irrelevant/fake),
  "confidenceScore": integer between 60 and 99,
  "summary": "1-2 sentence concise explanation of the verified work (e.g. 'Pothole has been filled with asphalt and compacted evenly.')",
  "beforeAfterComparison": "2 sentences describing what was visible before vs what is achieved after.",
  "status": "VERIFIED_RESOLVED" or "REJECTED_UNRESOLVED"
}

Respond ONLY with valid JSON.
`;
        parts.push({ text: promptText });
        parts.push({
            inlineData: {
                data: cleanBefore,
                mimeType: 'image/jpeg'
            }
        });
        parts.push({
            inlineData: {
                data: cleanAfter,
                mimeType: 'image/jpeg'
            }
        });
    } else {
        promptText = `
You are an autonomous civic quality inspection AI for the "Nivaran" municipal grievance platform.
You are inspecting a single RESOLUTION (AFTER) photo submitted for complaint: "${title}", Category: "${category}", Details: "${description}".

Check if the photo proves the civic issue has been resolved in good order (e.g., clear road, working light, clean area, repaired pipe).

Return STRICTLY a JSON object with these exact keys:
{
  "isResolved": boolean (true if area looks resolved, false if issue is clearly still broken/dirty),
  "confidenceScore": integer between 60 and 99,
  "summary": "Concise explanation of the state seen in the resolution photo.",
  "beforeAfterComparison": "Single photo inspection: verified healthy infrastructure state.",
  "status": "VERIFIED_RESOLVED" or "REJECTED_UNRESOLVED"
}

Respond ONLY with valid JSON.
`;
        parts.push({ text: promptText });
        parts.push({
            inlineData: {
                data: cleanAfter,
                mimeType: 'image/jpeg'
            }
        });
    }

    let lastError = null;

    for (const modelName of PRIMARY_MODELS) {
        try {
            console.log(`[VisionEngine] Running Before/After Resolution Verification with ${modelName}...`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                    {
                        role: 'user',
                        parts: parts
                    }
                ],
                config: {
                    responseMimeType: 'application/json'
                }
            });

            const text = response.text ? response.text.trim() : '';
            const cleanedText = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
            const parsed = JSON.parse(cleanedText);

            console.log(`[VisionEngine] ✅ AI Resolution Verification Verdict [${modelName}]: isResolved=${parsed.isResolved} (${parsed.status}) - ${parsed.summary}`);

            return {
                ...parsed,
                source: 'GEMINI_BEFORE_AFTER_VERIFIER'
            };
        } catch (err) {
            console.warn(`[VisionEngine] Verification model ${modelName} encountered error:`, err.message);
            lastError = err;
        }
    }

    throw new Error(`AI Resolution Verification failed: ${lastError ? lastError.message : 'Unknown error'}`);
}

/**
 * AI Duplicate Visual Defect Checker
 * Checks if two images depict the EXACT same physical defect (e.g. same pothole, same broken pipe),
 * or if they are clearly two distinct different defects on different roads/spots.
 */
async function checkImageVisualMatch(imageABase64, imageBBase64) {
    if (!imageABase64 || !imageBBase64) return false;
    const cleanA = imageABase64.replace(/^data:image\/\w+;base64,/, '');
    const cleanB = imageBBase64.replace(/^data:image\/\w+;base64,/, '');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim() === '') return false;

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const prompt = `
You are a computer vision defect comparator for municipal infrastructure.
Compare IMAGE 1 and IMAGE 2.
Determine if they show the EXACT SAME physical defect (e.g., the exact same pothole with identical surrounding road markings, or exact same garbage heap) photographed from another angle, OR if they are clearly DIFFERENT defects/roads/scenes.

Return STRICTLY a JSON object:
{
  "isSameDefect": boolean (true ONLY if it is unmistakably the exact same physical spot/defect, false if it is a different road/pothole/scene),
  "reason": "Brief reason"
}
Respond ONLY with valid JSON.
`;

    for (const modelName of PRIMARY_MODELS) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            { inlineData: { data: cleanA, mimeType: 'image/jpeg' } },
                            { inlineData: { data: cleanB, mimeType: 'image/jpeg' } }
                        ]
                    }
                ],
                config: { responseMimeType: 'application/json' }
            });

            const text = response.text ? response.text.trim() : '';
            const cleanedText = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
            const parsed = JSON.parse(cleanedText);
            console.log(`[VisionEngine] 🔍 Visual Duplicate Check: isSameDefect = ${parsed.isSameDefect} (${parsed.reason})`);
            return parsed.isSameDefect === true;
        } catch (err) {
            console.warn(`[VisionEngine] Visual duplicate check error with ${modelName}:`, err.message);
        }
    }
    return false;
}

module.exports = { analyzeCivicImage, verifyResolutionImages, checkImageVisualMatch };


