import type { Analysis } from '../domain';
/** Trust boundary for separately deployed specialist inference. Never accepts a user-provided URL. */
export async function inferWithProvider(base: Analysis): Promise<Analysis> {
  const { env } = await import('cloudflare:workers');
  const config = env as unknown as {
    INFERENCE_URL?: string;
    MODEL_API_KEY?: string;
  };
  if (!config.INFERENCE_URL || !config.MODEL_API_KEY) return base;
  // Invalid compatibility and unsupported questions remain abstained, regardless of provider.
  if (!base.answer.startsWith('The imagery has been inspected')) return base;
  try {
    const response = await fetch(new URL('/infer', config.INFERENCE_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.MODEL_API_KEY}`,
      },
      body: JSON.stringify({
        query: base.query,
        mode: base.mode,
        images: base.images,
        threshold: base.parameters.threshold,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw Error('Specialist inference unavailable');
    const result = (await response.json()) as any;
    if (
      typeof result.answer !== 'string' ||
      !Number.isInteger(result.confidence) ||
      result.confidence < base.parameters.threshold * 100 ||
      result.confidence > 100 ||
      !Array.isArray(result.evidence) ||
      !result.evidence.length
    )
      throw Error(
        'Provider returned insufficient confidence or no spatial evidence',
      );
    for (const e of result.evidence) {
      if (
        typeof e.id !== 'string' ||
        typeof e.label !== 'string' ||
        !['built', 'water', 'vegetation', 'change'].includes(e.kind) ||
        !Array.isArray(e.points) ||
        e.points.length < 3 ||
        e.points.some(
          (p: any) =>
            !Array.isArray(p) ||
            p.length !== 2 ||
            p.some(
              (n: any) =>
                typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1,
            ),
        ) ||
        !Number.isFinite(e.area) ||
        e.area < 0
      )
        throw Error('Provider returned invalid spatial evidence');
    }
    if (
      !Array.isArray(result.metrics) ||
      result.metrics.some(
        (m: any) => typeof m.label !== 'string' || typeof m.value !== 'string',
      ) ||
      !Array.isArray(result.limitations) ||
      result.limitations.some((l: any) => typeof l !== 'string')
    )
      throw Error('Provider returned an invalid result contract');
    return {
      ...base,
      answer: result.answer,
      confidence: result.confidence,
      evidence: result.evidence,
      metrics: Array.isArray(result.metrics) ? result.metrics : [],
      limitations: Array.isArray(result.limitations) ? result.limitations : [],
      steps: [
        ...base.steps.slice(0, -3),
        'Specialist provider executed',
        'Spatial evidence validated',
        'Provider answer integrated',
      ],
      breakdown: [],
      status: 'complete',
    };
  } catch {
    return {
      ...base,
      answer:
        'The specialist service could not provide valid, sufficiently confident spatial evidence. No analytical conclusion is available. Please retry or review the model integration.',
      limitations: [
        ...base.limitations,
        'The configured specialist gateway was unavailable or returned an invalid result.',
      ],
    };
  }
}
