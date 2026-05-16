import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = 're_YourActualResendKeyHere' // Get this from resend.com

serve(async (req) => {
  try {
    const { item_name, current_stock } = await req.json()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Don Chike Elite <alerts@resend.dev>', // Use resend.dev for testing
        to: ['your-email@gmail.com'], // YOUR EMAIL HERE
        subject: `🚨 RESTOCK ALERT: ${item_name}`,
        html: `<h3>CEO Alert</h3><p><strong>${item_name}</strong> is running low! Current stock: <strong>${current_stock}</strong>.</p>`,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})