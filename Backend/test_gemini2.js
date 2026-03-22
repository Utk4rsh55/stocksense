require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

model.generateContent("hello").then(r => console.log(r.response.text())).catch(err => console.log("ERROR IS: " + err.message));
