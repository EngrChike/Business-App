import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''

serve(async (req: Request) => {
  try {
    const { item_name, current_stock } = await req.json()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'AMALUCHA GLOBAL <onboarding@resend.dev>', 
        to: ['your-email@gmail.com'], 
        subject: `🚨 RESTOCK ALERT: ${item_name}`,
        html: `<h3>CEO Alert</h3><p><strong>${item_name}</strong> is running low! Current stock: <strong>${current_stock}</strong>.</p>`,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 })
  }
})