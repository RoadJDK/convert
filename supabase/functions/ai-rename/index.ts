import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const ALLOWED_ORIGINS = [
  "https://maibach-convert.lovable.app",
  "https://convert.maibach-systems.ch",
  "http://localhost:5173", // Development
  "http://localhost:8080", // Development alternative
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};

// Input validation schema
const RequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.enum(["image", "video"]),
  imageData: z.string().optional().refine(
    (data) => !data || data.length < 5_000_000, // ~5MB base64 limit
    { message: "Image data too large" }
  ),
});

// Rate limiting configuration: 150 renames per hour per IP
const RATE_LIMIT_RENAMES_PER_HOUR = 150;
const ONE_HOUR_MS = 60 * 60 * 1000;
const rateLimitMap = new Map<string, { timestamps: number[] }>();

function getClientIP(req: Request): string {
  // Try various headers that might contain the real client IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  // Fallback to a generic identifier if no IP headers are available
  return "unknown-client";
}

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const oneHourAgo = now - ONE_HOUR_MS;

  let clientData = rateLimitMap.get(clientIP);

  if (!clientData) {
    clientData = { timestamps: [] };
    rateLimitMap.set(clientIP, clientData);
  }

  // Clean old timestamps (older than 1 hour)
  clientData.timestamps = clientData.timestamps.filter(t => t > oneHourAgo);

  const remaining = RATE_LIMIT_RENAMES_PER_HOUR - clientData.timestamps.length;

  // Calculate when the oldest request will expire
  let resetIn = 0;
  if (clientData.timestamps.length > 0) {
    const oldestTimestamp = Math.min(...clientData.timestamps);
    resetIn = Math.ceil(((oldestTimestamp + ONE_HOUR_MS) - now) / 1000);
    resetIn = Math.max(0, resetIn);
  }

  if (clientData.timestamps.length >= RATE_LIMIT_RENAMES_PER_HOUR) {
    return { allowed: false, remaining: 0, resetIn };
  }

  // Record this request
  clientData.timestamps.push(now);
  return { allowed: true, remaining: remaining - 1, resetIn };
}

// Clean up old rate limit entries periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  const oneHourAgo = now - ONE_HOUR_MS;

  for (const [key, value] of rateLimitMap.entries()) {
    // Filter out old timestamps
    value.timestamps = value.timestamps.filter(t => t > oneHourAgo);
    // Remove entry if no recent timestamps
    if (value.timestamps.length === 0) {
      rateLimitMap.delete(key);
    }
  }
}, 10 * 60 * 1000); // Clean every 10 minutes

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check origin
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(
      JSON.stringify({ error: "Forbidden - invalid origin" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(req);

    // Check rate limit (150 renames per hour per IP)
    const renameLimit = checkRateLimit(clientIP);
    if (!renameLimit.allowed) {
      const waitMinutes = Math.ceil(renameLimit.resetIn / 60);
      return new Response(
        JSON.stringify({
          error: `Rate limit überschritten. Bitte warte ${waitMinutes} Minute${waitMinutes > 1 ? 'n' : ''}.`,
          resetIn: renameLimit.resetIn
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(renameLimit.resetIn),
            "X-RateLimit-Limit": String(RATE_LIMIT_RENAMES_PER_HOUR)
          }
        }
      );
    }

    // Parse and validate input
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validationResult = RequestSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input format", details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { fileName, fileType, imageData } = validationResult.data;

    // Sanitize fileName before using in prompt to prevent prompt injection
    const sanitizedFileName = fileName
      .trim()
      .slice(0, 100)
      .replace(/[^\w\s.\-()]/g, "");

    const GROQ_API_KEY = Deno.env.get("CROQ_CLOUD_KEY");
    if (!GROQ_API_KEY) {
      throw new Error("CROQ_CLOUD_KEY is not configured");
    }

    // Build messages array based on whether we have image data
    const messages: any[] = [
      {
        role: "system",
        content: `You are a filename assistant. Generate a short, descriptive, SEO-friendly filename based on the image/video content.

Rules:
- Use only lowercase letters
- Use hyphens instead of spaces (maximum 2 hyphens total)
- No special characters except hyphens
- Do NOT add file extension
- Maximum 25 characters
- Use 1 to 3 words ONLY
- If ONE word perfectly describes the main subject, use just one word (e.g., "tree", "sunset", "cat")
- The name should be descriptive and in ENGLISH
- Focus on the main subject/object in the image

Examples of good filenames:
- tree
- sunset-beach
- golden-retriever
- mountain-lake
- red-car

Reply ONLY with the new filename, nothing else.`
      }
    ];

    // Groq vision model for image analysis
    let model = "llama-3.3-70b-versatile"; // Default text model

    if (imageData && fileType === 'image') {
      // Use Groq's vision model with image
      model = "meta-llama/llama-4-scout-17b-16e-instruct";
      messages.push({
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: imageData
            }
          },
          {
            type: "text",
            text: `Analyze this image and suggest a filename (1-3 words, max 2 hyphens). If one word fits perfectly, use just one word.`
          }
        ]
      });
    } else {
      // Fallback for videos or when no image data
      messages.push({
        role: "user",
        content: `Original filename: "${sanitizedFileName}" (Type: ${fileType}). Suggest a clean filename (1-3 words, max 2 hyphens).`
      });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 50,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit überschritten. Bitte versuche es später erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Guthaben erschöpft. Bitte lade dein Konto auf." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      throw new Error("Groq API error");
    }

    const data = await response.json();
    let suggestedName = data.choices?.[0]?.message?.content?.trim() || sanitizedFileName;

    // Clean up the suggested name
    suggestedName = suggestedName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);

    return new Response(JSON.stringify({ suggestedName }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": String(renameLimit.remaining),
        "X-RateLimit-Limit": String(RATE_LIMIT_RENAMES_PER_HOUR)
      },
    });
  } catch (error) {
    console.error("ai-rename error:", error);
    return new Response(JSON.stringify({ error: "Die Datei konnte nicht umbenannt werden. Bitte versuchen Sie es erneut." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
