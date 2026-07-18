export const config = {
    runtime: 'edge',
};

interface AnalysisResult {
    score: number;
    rejectionReasons: string[];
    fixes: string[];
    summary: string;
    isNotCV?: boolean;
    documentType?: string;
}

const MAX_CHARS = 24000;

export default async function handler(request: Request) {
    // Handle CORS and Method checks
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { textContent, forceAnalyze } = await request.json() as any;

        if (!textContent || typeof textContent !== "string") {
            return new Response(JSON.stringify({ error: "CV text content is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const originalLength = textContent.length;
        const safeText = originalLength > MAX_CHARS ? textContent.slice(0, MAX_CHARS) : textContent;
        const wasTruncated = originalLength > MAX_CHARS;

        const AI_API_KEY = process.env.AI_API_KEY;
        if (!AI_API_KEY) {
            console.error("Missing AI_API_KEY in environment variables.");
            return new Response(JSON.stringify({ error: "Server configuration error: AI API key is missing." }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        const AI_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

        const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3, baseDelay = 1000) => {
            let lastError;

            for (let i = 0; i < maxRetries; i++) {
                try {
                    const response = await fetch(url, options);

                    if (response.ok) {
                        return response;
                    }

                    // Don't retry for certain client errors (except 429)
                    if (response.status !== 429 && response.status >= 400 && response.status < 500) {
                        return response;
                    }

                    // specific handling for 429 to look for retry-after header
                    let delay = baseDelay * Math.pow(2, i);
                    if (response.status === 429) {
                        const retryAfter = response.headers.get("Retry-After");
                        if (retryAfter) {
                            const retryDelay = parseInt(retryAfter, 10);
                            if (!isNaN(retryDelay)) {
                                delay = retryDelay * 1000; // Retry-After is usually in seconds
                            }
                        }
                        console.log(`Rate limited. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
                    } else {
                        console.log(`Request failed with status ${response.status}. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
                    }

                    await new Promise(resolve => setTimeout(resolve, delay));
                } catch (e) {
                    console.error(`Fetch attempt ${i + 1} failed:`, e);
                    lastError = e;
                    const delay = baseDelay * Math.pow(2, i);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            throw lastError || new Error("Failed after max retries");
        };

        if (!forceAnalyze) {
            try {
                const classifySystemPrompt = `
          You are a helper that identifies CVs, Resumes, and Portfolios.
          GOAL: flexible and lenient detection.

          ACCEPT if:
          - It looks like a Resume, CV, Bio, or Portfolio.
          - Contains professional info (skills, experience, projects, education) even if unstructured.
          - It is a partial resume or user profile.

          REJECT ONLY if:
          - It is CLEARLY irrelevant (e.g., invoice, receipt, code block, news article, empty text).
          - It is just a list of random words.

          OUTPUT INSTRUCTION:
          Respond with valid JSON only:
          {
            "isCV": boolean,
            "documentType": string
          }
        `;

                const classifyResponse = await fetchWithRetry(AI_ENDPOINT, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${AI_API_KEY}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://cv-scanner.app", // Optional. Site URL for rankings on openrouter.ai.
                        "X-Title": "CV Scanner", // Optional. Site title for rankings on openrouter.ai.
                    },
                    body: JSON.stringify({
                        model: "meta-llama/llama-3.3-70b-instruct:free",
                        messages: [
                            {
                                role: "user",
                                content: `${classifySystemPrompt}\n\nDocument Text:\n${safeText.slice(0, 5000)}`
                            },
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.1,
                        max_tokens: 200,
                    }),
                });

                if (classifyResponse.ok) {
                    const classifyData = await classifyResponse.json() as any;
                    const content = classifyData.choices?.[0]?.message?.content;
                    if (content) {
                        try {
                            const args = JSON.parse(content);
                            if (!args.isCV) {
                                return new Response(
                                    JSON.stringify({
                                        isNotCV: true,
                                        documentType: args.documentType || "document",
                                        error: `This document appears to be a ${args.documentType || "document"}, not a CV/Resume.`,
                                    }),
                                    { headers: { "Content-Type": "application/json" } }
                                );
                            }
                        } catch (e) {
                            console.error("Failed to parse classification JSON:", content);
                        }
                    }
                }
            } catch (e) {
                console.error("Classification check failed:", e);
            }
        }

        const analysisSystemPrompt = `
      You are an expert ATS analyzer. Score the CV (0-100) and provide concrete rejection reasons and fixes.
      
      CRITICAL OUTPUT FORMATTING:
      - For "rejectionReasons" and "fixes", strictly use this format: "Topic: Detailed explanation". 
      - Example: "Quantifiable Metrics: You should add numbers to describe your impact."
      - Do NOT use bullet points in the strings, just the text.

      Respond with valid JSON only using this schema:
      {
        "score": number,
        "isNotCV": boolean,
        "rejectionReasons": string[],
        "fixes": string[],
        "summary": string
      }
    `;

        const analysisResponse = await fetchWithRetry(AI_ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${AI_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://cv-scanner.app", // Optional. Site URL for rankings on openrouter.ai.
                "X-Title": "CV Scanner", // Optional. Site title for rankings on openrouter.ai.
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.3-70b-instruct:free",
                messages: [
                    {
                        role: "user",
                        content: `${analysisSystemPrompt}\n\nDocument Text:\n${safeText}`
                    },
                ],
                response_format: { type: "json_object" },
                temperature: 0.3,
                max_tokens: 1000,
            }),
        });

        if (!analysisResponse.ok) {
            const errorText = await analysisResponse.text();
            console.error("OpenAI Analysis Error:", analysisResponse.status, errorText);
            return new Response(JSON.stringify({ error: `AI analysis service error (${analysisResponse.status}): ${errorText}` }), {
                status: 502,
                headers: { "Content-Type": "application/json" },
            });
        }

        const data = await analysisResponse.json() as any;
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            console.error("Invalid AI response (no content):", JSON.stringify(data));
            return new Response(JSON.stringify({ error: "AI response format invalid. Please retry." }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        let args: any;
        try {
            // Clean up markdown formatting if present
            const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
            args = JSON.parse(cleanContent);
        } catch (e) {
            console.error("Failed to parse analysis JSON:", content);
            return new Response(JSON.stringify({ error: "Failed to parse AI response. Please retry." }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        const result: AnalysisResult = {
            score: Math.max(0, Math.min(100, Number(args.score) || 0)),
            isNotCV: !!args.isNotCV,
            rejectionReasons: Array.isArray(args.rejectionReasons) ? args.rejectionReasons : [],
            fixes: Array.isArray(args.fixes) ? args.fixes : [],
            summary: String(args.summary || "Analysis complete."),
            documentType: args.isNotCV ? "Invalid Document" : undefined
        };

        if (wasTruncated) {
            result.summary += " (Note: Document was truncated due to size limits.)";
        }

        return new Response(JSON.stringify(result), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (err: any) {
        console.error("Detailed Server Error:", err);
        return new Response(JSON.stringify({ error: `Server Error: ${err.message || "Unknown error"}` }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
