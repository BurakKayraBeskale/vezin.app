export function getOpenAI() {
  const { OpenAI } = require("openai");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
