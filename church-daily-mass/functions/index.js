const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

const CBCK_ORIGIN = 'https://missa.cbck.or.kr';

/**
 * GET /api/missa/20261004
 * CBCK 상세 HTML을 서버에서만 요청·파싱하여 필요한 독서와 복음만 JSON으로 반환합니다.
 */
exports.missaApi = onRequest({ region: 'northamerica-northeast1', timeoutSeconds: 20 }, async (request, response) => {
  if (request.method !== 'GET') return response.status(405).json({ error: 'GET 요청만 허용됩니다.' });

  // Hosting rewrite 뒤에도 query string은 보존되므로 목록 요청은 이 방식이 가장 안전합니다.
  if (request.query.start !== undefined || request.query.end !== undefined) {
    return proxyMissaList(request, response);
  }

  const date = String(request.originalUrl || request.url || '').match(/(20\d{6})(?:[/?#]|$)/)?.[1];
  if (!date || !isValidDate(date)) return response.status(400).json({ error: 'YYYYMMDD 형식의 유효한 날짜가 필요합니다.' });

  try {
    const upstream = await fetch(`${CBCK_ORIGIN}/DailyMissa/${date}`, {
      headers: { 'User-Agent': 'ParishHub weekly-mass reader (official-source link preserved)' },
    });
    if (!upstream.ok) throw new Error(`CBCK ${upstream.status}`);

    const missa = parseMissaHtml(await upstream.text(), date);
    if (!missa.readings.length) throw new Error('독서·복음 영역을 찾지 못했습니다.');
    response.set('Cache-Control', 'public, max-age=3600, s-maxage=21600');
    return response.json(missa);
  } catch (error) {
    logger.error('CBCK missa proxy failed', { date, error: error.message });
    return response.status(502).json({ error: '공식 매일미사 자료를 불러오지 못했습니다.' });
  }
});

async function proxyMissaList(request, response) {
  const start = String(request.query.start || '');
  const end = String(request.query.end || '');
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(start) || !/^20\d{2}-\d{2}-\d{2}$/.test(end)) {
    return response.status(400).json({ error: 'start와 end는 YYYY-MM-DD 형식이어야 합니다.' });
  }
  try {
    const params = new URLSearchParams({ start, end });
    const upstream = await fetch(`${CBCK_ORIGIN}/MissaLoad?${params}`, { headers: { 'User-Agent': 'ParishHub weekly-mass reader' } });
    if (!upstream.ok) throw new Error(`CBCK ${upstream.status}`);
    const data = await upstream.json();
    response.set('Cache-Control', 'public, max-age=3600, s-maxage=21600');
    return response.json(data);
  } catch (error) {
    logger.error('CBCK missa list proxy failed', { start, end, error: error.message });
    return response.status(502).json({ error: '공식 매일미사 목록을 불러오지 못했습니다.' });
  }
}

function parseMissaHtml(html, date) {
  const dateText = textOf(html.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1] || '');
  const title = textOf(html.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] || '');
  const readings = [];
  const blockPattern = /<div class="bottompadding-sm">([\s\S]*?)(?=<div class="bottompadding-sm">|<\/section>)/gi;

  for (const match of html.matchAll(blockPattern)) {
    const block = match[1];
    const headingHtml = block.match(/<h4>([\s\S]*?)<\/h4>/i)?.[1] || '';
    const type = textOf(headingHtml).replace(/\s+/g, ' ').trim();
    if (!['제1독서', '제2독서', '복음'].includes(type)) continue;

    const subtitle = textOf(block.match(/<h4>[\s\S]*?<\/h4>\s*<span>([\s\S]*?)<\/span>/i)?.[1] || '');
    const reference = textOf(block.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1] || '');
    const content = textOf(block.replace(/<div class="row bottompadding-sm">[\s\S]*?<\/div>\s*<\/div>/i, ''));
    readings.push({ type, subtitle, reference, text: content });
  }

  return { date, dateText, title, readings, sourceUrl: `${CBCK_ORIGIN}/DailyMissa/${date}` };
}

function textOf(fragment) {
  return decodeEntities(String(fragment)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|p|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n\s*\n+/g, '\n')
    .trim());
}

function decodeEntities(value) {
  return value.replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”').replace(/&lsquo;/gi, '‘').replace(/&rsquo;/gi, '’').replace(/&amp;/gi, '&');
}

function isValidDate(value) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day;
}
