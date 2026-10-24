const https = require('https');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not configured in Netlify.' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const promptText = body.prompt;
        const rawText = body.rawText;

        let userInstruction = '';
        if (rawText) {
            userInstruction = `أنت معلم خبير. قم بتحليل النص المستخرج من ملف PDF التالي واستخرج منه جميع الأسئلة الموجودة أو حول محتواه إلى أسئلة اختبار دقيقة:
"""
${rawText}
"""
أرجئ النتيجة حصرياً بصيغة مصفوفة JSON صالحة (JSON Array) بدون أي نص إضافي أو علامات markdown للشرح. كل عنصر يجب أن يحتوي على:
- "type": "MCQ" أو "TF" أو "SHORT"
- "textAr": نص السؤال
- إذا كان MCQ: أضف "optionsAr" (مصفوفة من 4 خيارات) و "correctOptionIndex" (0 إلى 3)
- إذا كان TF: أضف "trueFalseAnswer" (true أو false)`;
        } else if (promptText) {
            userInstruction = `قم بتوليد أسئلة اختبار باللغة العربية بناءً على الطلب التالي: "${promptText}".
أرجئ النتيجة حصرياً بصيغة مصفوفة JSON صالحة (JSON Array) تحتوي على كائنات بالحقول: "type" (MCQ أو TF), "textAr", "optionsAr" (إذا كان MCQ), "correctOptionIndex", "trueFalseAnswer" (إذا كان TF).`;
        } else {
            return { statusCode: 400, body: JSON.stringify({ error: 'No prompt or rawText provided.' }) };
        }

        const dataToSend = JSON.stringify({
            contents: [{ parts: [{ text: userInstruction }] }]
        });

        const apiResponse = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(dataToSend)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
            });
            req.on('error', error => reject(error));
            req.write(dataToSend);
            req.end();
        });

        if (apiResponse.statusCode !== 200) {
            return { statusCode: apiResponse.statusCode, body: JSON.stringify({ error: 'Gemini API Error: ' + apiResponse.body }) };
        }

        const geminiJson = JSON.parse(apiResponse.body);
        const rawTextContent = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

        let questions = [];
        const startIdx = rawTextContent.indexOf('[');
        const endIdx = rawTextContent.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
            questions = JSON.parse(rawTextContent.substring(startIdx, endIdx + 1));
        } else {
            questions = [{ type: 'MCQ', textAr: 'سؤال مستورد', optionsAr: ['خيار أ', 'خيار ب', 'خيار ج', 'خيار د'], correctOptionIndex: 0 }];
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
