import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, fileType } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Du bist ein Dateinamen-Assistent. Deine Aufgabe ist es, einen beschreibenden, SEO-freundlichen Dateinamen zu generieren basierend auf dem originalen Dateinamen. 
            
Regeln:
- Verwende nur Kleinbuchstaben
- Verwende Bindestriche statt Leerzeichen
- Keine Sonderzeichen außer Bindestriche
- Keine Dateiendung hinzufügen
- Maximal 50 Zeichen
- Der Name sollte beschreibend und verständlich sein
- Wenn der Name bereits gut ist, gib ihn nur formatiert zurück

Antworte NUR mit dem neuen Dateinamen, nichts anderes.`
          },
          {
            role: "user",
            content: `Original Dateiname: "${fileName}" (Typ: ${fileType})`
          }
        ],
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
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const suggestedName = data.choices?.[0]?.message?.content?.trim() || fileName;

    return new Response(JSON.stringify({ suggestedName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-rename error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});