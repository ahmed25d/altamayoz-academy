const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: 'Method Not Allowed' }) 
        };
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return { 
                statusCode: 500, 
                body: JSON.stringify({ error: 'مفتاح GEMINI_API_KEY غير معرف في إعدادات Netlify' }) 
            };
        }

        const body = JSON.parse(event.body || '{}');
        const promptText = body.prompt || '';
        const rawText = body.rawText || '';
        const counts = body.counts || { MCQ: 2, TF: 1, SHORT: 0, ESSAY: 0, MATCHING: 0 };

        const genAI = new GoogleGenerativeAI(apiKey);
        // استخدام نموذج gemini-1.5-flash المدعوم رسمياً لتفادي خطأ v1beta
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        let systemInstruction = '';

        if (rawText) {
            systemInstruction = `
أنت مساعد تعليمي ذكي ومحلل نصوص. قم بتحليل النص التالي المستخرج من مستند أو PDF وقم بتحويله إلى مصفوفة أسئلة JSON فقط بدون أي نصوص أو علامات markdown إضافية خارج الكود.
النص:
"${rawText}"

الهيكل المطلوب:
[
  {
    "type": "MCQ",
    "textAr": "نص السؤال",
    "optionsAr": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
    "correctOptionIndex": 0
  }
]
`;
        } else {
            systemInstruction = `
أنت معلم محترف ومساعد ذكي لإنشاء الأسئلة التعليمية.
بناءً على الموضوع أو البرومبت التالي:
"${promptText}"

قم بتوليد الأسئلة أوتوماتيكياً وفق الأعداد التالية:
- اختيار من متعدد (MCQ): ${counts.MCQ || 0}
- صح أو خطأ (TF): ${counts.TF || 0}

يجب أن يعيد الناتج مصفوفة JSON صالحة فقط بدون أي نصوص شارحة أو علامات Markdown خارج الكود، بالهيكل التالي:
[
  {
    "type": "MCQ",
    "textAr": "نص السؤال",
    "optionsAr": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
    "correctOptionIndex": 0
  },
  {
    "type": "TF",
    "textAr": "نص العبارة",
    "trueFalseAnswer": true
  }
]
`;
        }

        const result = await model.generateContent(systemInstruction);
        const responseText = await result.response.text();
        
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('لم يتم استرجاع صيغة JSON سليمة من الذكاء الاصطناعي');
        }

        const questions = JSON.parse(jsonMatch[0]);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions })
        };

    } catch (error) {
        console.error('Gemini Function Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message || 'حدث خطأ في معالجة الطلب عبر الخادم' })
        };
    }
};
