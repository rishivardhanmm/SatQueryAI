import { analyze } from '@/lib/services/agent-controller';
import { models } from '@/lib/services/model-registry';
import { validateImages } from '@/lib/services/validation';
import { inspectRaster } from '@/lib/services/input-service';
import { bindings, getRecord, saveRecord } from '@/lib/services/storage';
import { demoImages } from '@/lib/services/fixtures';
import type { Mode, ImageInput } from '@/lib/domain';
const json = (data: unknown, status = 200) => Response.json(data, { status });
async function resolveImages(body: any): Promise<ImageInput[]> {
  if (body.demo) {
    if (!['single', 'change', 'fusion'].includes(body.demo))
      throw Error('Invalid demo mode');
    return demoImages(body.demo);
  }
  if (!Array.isArray(body.imageIds) || body.imageIds.length > 2)
    throw Error('Provide up to two image IDs');
  const result = [];
  for (const id of body.imageIds) {
    const image = await getRecord('images', id);
    if (!image) throw Error('Image not found');
    if (
      body.modalities?.[id] &&
      ['Optical', 'Multispectral', 'SAR', 'Unknown'].includes(
        body.modalities[id],
      )
    )
      image.modality = body.modalities[id];
    result.push(image);
  }
  return result;
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      parts = url.pathname.split('/').filter(Boolean),
      resource = parts[1],
      id = parts[2];
    if (resource === 'models')
      return json({
        models: models.map((m) => ({
          ...m,
          status: 'Active',
          provider: 'Demo adapter',
          inferenceConnected: false,
          checkedAt: new Date().toISOString(),
        })),
      });
    if (resource === 'history') {
      const { DB } = await bindings();
      const rows = await DB.prepare(
        'SELECT data FROM analyses ORDER BY created_at DESC LIMIT 200',
      ).all<{ data: string }>();
      return json(rows.results.map((r) => JSON.parse(r.data)));
    }
    if (resource === 'analysis' && id) {
      const a = await getRecord('analyses', id);
      return a ? json(a) : json({ error: 'Analysis not found' }, 404);
    }
    if (resource === 'images' && id) {
      const { IMAGES } = await bindings();
      const obj = await IMAGES.get(id);
      return obj
        ? new Response(obj.body, {
            headers: {
              'Content-Type':
                obj.httpMetadata?.contentType || 'application/octet-stream',
              'Cache-Control': 'private, max-age=3600',
              'X-Content-Type-Options': 'nosniff',
            },
          })
        : json({ error: 'Image not found' }, 404);
    }
    if (resource === 'reports' && id) {
      const a = await getRecord('analyses', id);
      if (!a) return json({ error: 'Analysis not found' }, 404);
      if (url.searchParams.get('format') === 'pdf') {
        const { createReport } = await import('@/lib/services/report-service');
        let ref: string | undefined;
        if (a.images[0]?.preview) {
          const res = await fetch(new URL(a.images[0].preview, request.url));
          if (res.ok) {
            const bytes = new Uint8Array(await res.arrayBuffer());
            let raw = '';
            for (let i = 0; i < bytes.length; i += 8192)
              raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
            ref = 'data:image/jpeg;base64,' + btoa(raw);
          }
        }
        return new Response(await createReport(a, ref), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="satquery-${id}.pdf"`,
          },
        });
      }
      return new Response(JSON.stringify(a, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="satquery-${id}.json"`,
        },
      });
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: 'Unable to load data. Please retry.' }, 500);
  }
}
export async function POST(request: Request) {
  try {
    const resource = new URL(request.url).pathname.split('/')[2];
    if (resource === 'images') {
      if (Number(request.headers.get('content-length') || 0) > 30 * 1024 * 1024)
        return json({ error: 'Upload exceeds request size limit' }, 413);
      const form = await request.formData(),
        file = form.get('file');
      if (!(file instanceof File))
        return json({ error: 'File is required' }, 400);
      const image = await inspectRaster(file);
      const { IMAGES } = await bindings();
      await IMAGES.put(image.id, await file.arrayBuffer(), {
        httpMetadata: {
          contentType:
            image.format === 'PNG'
              ? 'image/png'
              : image.format === 'JPEG'
                ? 'image/jpeg'
                : 'image/tiff',
        },
      });
      const preview = form.get('preview');
      if (preview instanceof File && preview.size < 2000000) {
        await IMAGES.put(image.id + '-preview', await preview.arrayBuffer(), {
          httpMetadata: { contentType: 'image/jpeg' },
        });
        image.preview = '/api/images/' + image.id + '-preview';
      } else
        image.preview = ['JPEG', 'PNG'].includes(image.format)
          ? '/api/images/' + image.id
          : '';
      await saveRecord('images', image.id, image);
      return json(image, 201);
    }
    const body = (await request.json()) as any;
    const mode: Mode = ['auto', 'single', 'change', 'fusion'].includes(
      body.mode,
    )
      ? body.mode
      : 'auto';
    if (resource === 'validate') {
      return json(validateImages(await resolveImages(body), mode));
    }
    if (resource === 'query') {
      if (
        typeof body.query !== 'string' ||
        !body.query.trim() ||
        body.query.length > 2000
      )
        return json({ error: 'Enter a question of 1–2000 characters.' }, 400);
      const images = await resolveImages(body);
      const threshold = Number(body.threshold ?? 0.7);
      if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 0.99)
        return json(
          { error: 'Confidence threshold must be between 0.50 and 0.99.' },
          400,
        );
      let a = analyze(body.query.trim(), images, mode, threshold);
      if (!a.demo) {
        const { inferWithProvider } =
          await import('@/lib/services/inference-service');
        a = await inferWithProvider(a, new URL(request.url).origin);
      }
      await saveRecord('analyses', a.id, a);
      return json(a, 201);
    }
    if (resource === 'analysis' && body.id) {
      const a = await getRecord('analyses', body.id);
      if (!a) return json({ error: 'Analysis not found' }, 404);
      const copy = {
        ...a,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      await saveRecord('analyses', copy.id, copy);
      return json(copy, 201);
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Request failed' },
      400,
    );
  }
}
export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).pathname.split('/')[3];
    if (!id) return json({ error: 'Analysis ID required' }, 400);
    const { DB } = await bindings();
    await DB.prepare('DELETE FROM analyses WHERE id=?').bind(id).run();
    return json({ deleted: true });
  } catch {
    return json({ error: 'Delete failed' }, 500);
  }
}
