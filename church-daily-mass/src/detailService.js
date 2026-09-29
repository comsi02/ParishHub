const defaultEndpoint = '/api/missa';

export async function getMissaDetail(date) {
  const endpoint = (import.meta.env.VITE_MASS_DETAIL_API_URL || defaultEndpoint).replace(/\/$/, '');
  const response = await fetch(`${endpoint}/${date.replaceAll('-', '')}`, { headers: { Accept: 'application/json, text/html' } });
  if (!response.ok) throw new Error(`미사 본문 요청 실패 (${response.status})`);
  const body = await response.text();
  return response.headers.get('content-type')?.includes('application/json') ? JSON.parse(body) : parseDevHtml(body, date);
}

// Vite 개발 프록시는 원본 HTML을 반환합니다. 운영에서는 Firebase Function이 같은 결과를 JSON으로 반환합니다.
function parseDevHtml(html, date) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const readings = [...document.querySelectorAll('#missa-print .bottompadding-sm')]
    .map((block) => {
      const type = block.querySelector('h4')?.childNodes[0]?.textContent?.trim();
      if (!['제1독서', '제2독서', '복음'].includes(type)) return null;
      return {
        type,
        subtitle: block.querySelector('.title-block > span')?.textContent?.trim() || '',
        reference: block.querySelector('h5')?.textContent?.trim() || '',
        text: block.querySelector('.row.tjustify')?.textContent?.replace(/\n\s*\n/g, '\n').trim() || '',
      };
    }).filter(Boolean);
  return {
    date,
    dateText: document.querySelector('#missa-default h2')?.textContent?.trim() || '',
    title: document.querySelector('#missa-default h3')?.textContent?.trim() || '',
    readings,
    sourceUrl: `https://missa.cbck.or.kr/DailyMissa/${date.replaceAll('-', '')}`,
  };
}
