// src/pages/api/recuperar.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apiKey = import.meta.env.TRIPO3D_API_KEY || process.env.TRIPO3D_API_KEY;

    if (!supabaseUrl || !serviceKey || !apiKey) {
      return new Response('Error: Faltan variables de entorno', { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const taskId = '2782f06d-9829-48ab-9f38-05e64be3460a';

    // Endpoint v3 actualizado en plural (/v3/tasks/)
    const response = await fetch(`https://openapi.tripo3d.ai/v3/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    const data = await response.json();
    if (data.code !== 0) return new Response(`Error Tripo: ${data.message}`, { status: 500 });
    if (data.data.status !== 'success') return new Response(`Estado de la tarea: ${data.data.status}`);

    // Propiedad correcta según la documentación de la v3 (output.model_url)
    const glbUrl = data.data.output?.model_url;

    if (!glbUrl) {
      return new Response('Error: La tarea es exitosa pero no devolvió model_url', { status: 500 });
    }

    const { data: product, error: productErr } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('task_id', taskId)
      .single();

    if (productErr || !product) {
      return new Response('Error: Producto no encontrado. Verificá que el task_id esté en Supabase.', { status: 404 });
    }

    const glbBuffer = await fetch(glbUrl).then(res => res.arrayBuffer());
    const fileName = `${product.id}.glb`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('models-3d')
      .upload(fileName, glbBuffer, { contentType: 'model/gltf-binary', upsert: true });

    if (uploadError) return new Response(`Error al subir a Storage: ${uploadError.message}`, { status: 500 });

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('models-3d')
      .getPublicUrl(fileName);

    const finalGlbUrl = publicUrlData.publicUrl;

    await supabaseAdmin
      .from('products')
      .update({ model_3d_url: finalGlbUrl, status: 'completed' })
      .eq('id', product.id);

    return new Response(`¡Éxito! Modelo 3D recuperado y guardado: ${finalGlbUrl}`);

  } catch (error: any) {
    return new Response(`Error general: ${error.message}`, { status: 500 });
  }
};