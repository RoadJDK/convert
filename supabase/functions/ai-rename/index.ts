import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

// Rate limiting configuration
const RATE_LIMIT_RENAMES_PER_MINUTE = 100;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  
  let userLimit = rateLimitMap.get(userId);
  
  // Reset if window expired
  if (!userLimit || now > userLimit.resetTime) {
    userLimit = { count: 0, resetTime: now + windowMs };
    rateLimitMap.set(userId, userLimit);
  }
  
  const remaining = RATE_LIMIT_RENAMES_PER_MINUTE - userLimit.count;
  const resetIn = Math.ceil((userLimit.resetTime - now) / 1000);
  
  if (userLimit.count >= RATE_LIMIT_RENAMES_PER_MINUTE) {
    return { allowed: false, remaining: 0, resetIn };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: remaining - 1, resetIn };
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Clean every minute

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
    // Verify authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - no auth header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Check rate limit for AI renames (100/min)
    const renameLimit = checkRateLimit(`rename:${userId}`);
    if (!renameLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: `Rate limit überschritten. Bitte warte ${renameLimit.resetIn} Sekunden.`,
          resetIn: renameLimit.resetIn
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(renameLimit.resetIn)
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
