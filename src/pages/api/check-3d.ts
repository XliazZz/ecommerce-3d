// src/pages/api/check-3d.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apiKey = import.meta.env.TRIPO3D_API_KEY || process.env.TRIPO3D_API_KEY;

    if (!supabaseUrl || !serviceRoleKey || !apiKey) {
      throw new Error('Faltan variables de entorno');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { taskId, productId } = await request.json();

    // 1. Endpoint corregido en plural (/v3/tasks/)
    const response = await fetch(`https://openapi.tripo3d.ai/v3/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    const data = await response.json();
    if (data.code !== 0) throw new Error(data.message);

    const taskStatus = data.data.status; // 'queued', 'running', 'success', 'failed', 'cancelled'

    if (taskStatus === 'queued' || taskStatus === 'running') {
      return new Response(JSON.stringify({ status: 'processing' }), { status: 200 });
    }

    if (taskStatus === 'failed' || taskStatus === 'cancelled') {
      await supabaseAdmin.from('products').update({ status: 'failed' }).eq('id', productId);
      return new Response(JSON.stringify({ status: 'failed' }), { status: 200 });
    }

    if (taskStatus === 'success') {
      // 2. Propiedad correcta según la documentación (output.model_url)
      const glbUrl = data.data.output?.model_url; 

      if (!glbUrl) {
         throw new Error('La tarea terminó con éxito pero no se encontró model_url en la respuesta.');
      }

      const glbBuffer = await fetch(glbUrl).then(res => res.arrayBuffer());
      const fileName = `${productId}.glb`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('models-3d')
        .upload(fileName, glbBuffer, { contentType: 'model/gltf-binary', upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseAdmin.storage
        .from('models-3d')
        .getPublicUrl(fileName);

      const finalGlbUrl = publicUrlData.publicUrl;

      await supabaseAdmin
        .from('products')
        .update({ model_3d_url: finalGlbUrl, status: 'completed' })
        .eq('id', productId);

      return new Response(JSON.stringify({ status: 'completed', modelUrl: finalGlbUrl }), { status: 200 });
    }

    return new Response(JSON.stringify({ status: taskStatus }), { status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};