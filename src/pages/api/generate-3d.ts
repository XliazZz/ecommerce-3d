// src/pages/api/generate-3d.ts
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { imageUrl, productId } = await request.json();

    if (!imageUrl || !productId) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros' }), { status: 400 });
    }

    // Asegurarse de leer la key
    const apiKey = import.meta.env.TRIPO3D_API_KEY || process.env.TRIPO3D_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No se encontró TRIPO3D_API_KEY' }), { status: 500 });
    }

    // Llamada a la API v3 de Tripo3D según documentación
    const response = await fetch('https://openapi.tripo3d.ai/v3/generation/image-to-model', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: imageUrl,
        model: "tripo-v3.1",
        texture: true,
        pbr: true,
        texture_quality: "standard"
      })
    });

    const rawText = await response.text();
    console.log('Respuesta raw de Tripo3D v3:', rawText);

    if (!rawText) {
      throw new Error(`Tripo3D devolvió una respuesta vacía. Status: ${response.status}`);
    }

    const data = JSON.parse(rawText);

    if (data.code !== 0) {
      throw new Error(data.message || `Error Tripo3D (code ${data.code})`);
    }

    return new Response(
      JSON.stringify({ success: true, taskId: data.data.task_id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error en generate-3d:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};