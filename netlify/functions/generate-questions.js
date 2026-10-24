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
                body: JSON.stringify({ error: 'مفتاح GEMINI_API_KEY غير معرف في Netlify' }) 
            };
        }

        const body = JSON.parse(event.body || '{}');
        const promptText = body.prompt || '';
        const counts = body.counts || { mcq: 2, tf: 2, fill: 2, essay: 1, match: 1 };

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const systemInstruction = `
أنت معلم محترف ومساعد ذكي لإنشاء الأسئلة التعليمية.
بناءً على النص أو الموضوع التالي:
"${promptText}"

قم بتوليد الأسئلة أوتوماتيكياً وفق الأعداد المطلوبة التالية:
- اختيار من متعدد (mcq): ${counts.mcq || 0} أسئلة
- صح أم خطأ (tf): ${counts.tf || 0} أسئلة
- أكمل الفراغ (fill): ${counts.fill || 0} أسئلة
- سؤال مقالي (essay): ${counts.essay || 0} أسئلة
- توصيل / مزاوجة (match): ${counts.match || 0} أسئلة

يجب أن يعيد الناتج مصفوفة JSON فقط بدون أي نصوص شارحة أو علامات Markdown خارج الكود، بالهيكل التالي:
[
  {
    "type": "mcq",
    "question": "نص السؤال هنا",
    "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
    "answer": 0,
    "points": 1
  },
  {
    "type": "tf",
    "question": "نص الجملة هنا",
    "answer": true,
    "points": 1
  },
  {
    "type": "fill",
    "question": "نص السؤال مع مكان ناقص",
    "answer": "الكلمة الصحيحة",
    "points": 1
  },
  {
    "type": "essay",
    "question": "السؤال المقالي",
    "answer": "الإجابة النموذجية",
    "points": 2
  },
  {
    "type": "match",
    "question": "صل بين العمودين فيما يلي:",
    "pairs": [
      {"left": "عنصر أ", "right": "مقابل أ"},
      {"left": "عنصر ب", "right": "مقابل ب"}
    ],
    "points": 2
  }
]
`;

        const result = await model.generateContent(systemInstruction);
        const responseText = await result.response.text();
        
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('لم يتم استرجاع صيغة أسئلة سليمة من الذكاء الاصطناعي');
        }

        const questions = JSON.parse(jsonMatch[0]);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message || 'حدث خطأ في معالجة الأسئلة' })
        };
    }
};

