import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "0.0.0.0",
      port: 8080,
    },
    plugins: [
      react(),
      {
        name: "local-api-middleware",
        configureServer(server) {
          server.middlewares.use("/api/analyze-cv", async (req, res, next) => {
            if (req.method !== "POST") {
              // If not POST, continue to other middlewares or 404/405
              // Ideally return 405 if we want to be strict, but next() is safer if overlapping
              if (req.method === 'OPTIONS') {
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
                res.end();
                return;
              }
              next();
              return;
            }

            try {
              // Parse body
              let body = "";
              for await (const chunk of req) {
                body += chunk;
              }
              const { textContent, forceAnalyze } = JSON.parse(body);

              // ---------------------------------------------------------
              // Logic ported from api/analyze-cv.ts for Local Dev
              // ---------------------------------------------------------
              const MAX_CHARS = 24000;

              if (!textContent || typeof textContent !== "string") {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "CV text content is required" }));
                return;
              }

              const safeText = textContent.length > MAX_CHARS ? textContent.slice(0, MAX_CHARS) : textContent;
              const wasTruncated = textContent.length > MAX_CHARS;


              const AI_API_KEY = env.AI_API_KEY; // Loaded from .env
              if (!AI_API_KEY) {
                console.error("Missing AI_API_KEY in .env");
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Local Server Error: AI_API_KEY is missing in .env file." }));
                return;
              }

              const AI_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

              // Simple retry for local dev (simplified compared to Edge version for brevity, but functional)
              const fetchWithRetry = async (url, options, maxRetries = 3) => {
                for (let i = 0; i < maxRetries; i++) {
                  try {
                    const r = await fetch(url, options);
                    if (r.status === 429) {
                      const delay = 3000 * Math.pow(2, i);
                      console.log(`Groq rate limit. Retrying in ${delay}ms...`);
                      await new Promise(res => setTimeout(res, delay));
                      continue;
                    }
                    return r;
                  } catch (e) {
                    console.error("Fetch error:", e);
                    await new Promise(res => setTimeout(res, 2000));
                  }
                }
                throw new Error("Failed after retries");
              };

              // 1. Classify
              if (!forceAnalyze) {
                const classifySystemPrompt = `You are a strict document classifier. Respond with JSON: { "isCV": boolean, "documentType": string }`;
                // Using a shorter prompt for local dev to save tokens/latency? No, use full strictly if needed.
                // Copying full prompt from logic...
                const fullClassify = `You are a helper that identifies CVs, Resumes, and Portfolios.
GOAL: flexible and lenient detection.

ACCEPT if:
- It looks like a Resume, CV, Bio, or Portfolio.
- Contains professional info (skills, experience, projects, education) even if unstructured.
- It is a partial resume or user profile.

REJECT ONLY if:
- It is CLEARLY irrelevant (e.g., invoice, receipt, code block, news article, empty text).
- It is just a list of random words.

OUTPUT JSON: { "isCV": boolean, "documentType": string }`;

                const classifyResp = await fetchWithRetry(AI_ENDPOINT, {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${AI_API_KEY}`,
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: `${fullClassify}\n\nDocument Text:\n${safeText.slice(0, 5000)}` }],
                    response_format: { type: "json_object" }
                  })
                });

                if (classifyResp.ok) {
                  const cData = await classifyResp.json();
                  const cContent = cData.choices?.[0]?.message?.content;
                  if (cContent) {
                    try {
                      const cArgs = JSON.parse(cContent);
                      if (!cArgs.isCV) {
                        res.statusCode = 200;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({
                          isNotCV: true,
                          documentType: cArgs.documentType || "document",
                          error: `This document appears to be a ${cArgs.documentType}, not a CV.`
                        }));
                        return;
                      }
                    } catch (e) { }
                  } else {
                    console.error("Local Middleware: No content returned for classification");
                  }
                }
              }

              // 2. Analyze
              const analysisSystemPrompt = `You are an expert ATS analyzer. Score the CV (0-100) and provide concrete rejection reasons and fixes.
Format rejectionReasons/fixes as "Topic: Explanation".
Output JSON schema: { "score": number, "isNotCV": boolean, "rejectionReasons": string[], "fixes": string[], "summary": string }`;

              const analyzeResp = await fetchWithRetry(AI_ENDPOINT, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${AI_API_KEY}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  model: "llama-3.3-70b-versatile",
                  messages: [{ role: "user", content: `${analysisSystemPrompt}\n\nDocument Text:\n${safeText}` }],
                  response_format: { type: "json_object" },
                  temperature: 0.3
                })
              });

              if (!analyzeResp.ok) {
                const errTxt = await analyzeResp.text();
                res.statusCode = 502;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: `AI Error (${analyzeResp.status}): ${errTxt}` }));
                return;
              }

              const aData = await analyzeResp.json();
              const aContent = aData.choices?.[0]?.message?.content;
              
              if (!aContent) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "AI response format invalid (no content). Please retry." }));
                return;
              }

              const cleanContent = aContent.replace(/```json\n?|\n?```/g, "").trim();
              const args = JSON.parse(cleanContent);

              const result = {
                score: Math.max(0, Math.min(100, Number(args.score) || 0)),
                isNotCV: !!args.isNotCV,
                rejectionReasons: args.rejectionReasons || [],
                fixes: args.fixes || [],
                summary: args.summary || "Analysis complete.",
                documentType: args.isNotCV ? "Invalid Document" : undefined
              };

              if (wasTruncated) result.summary += " (Truncated)";

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(result));

            } catch (err) {
              console.error("Local Middleware Error:", err);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: `Server Error: ${err.message}` }));
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});