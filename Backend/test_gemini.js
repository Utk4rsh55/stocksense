const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyFakeKey...");
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

model.generateContent("test").then(console.log).catch(console.error);
