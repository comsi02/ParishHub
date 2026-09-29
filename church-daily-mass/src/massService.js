const CBCK_ORIGIN = 'https://missa.cbck.or.kr';
const endpoint = import.meta.env.VITE_MASS_API_URL || '/api/cbck/MissaLoad';

export function toKstDateString(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function startOfWeek(date = new Date()) {
  // 날짜만 다루므로 로컬 정오로 생성합니다. KST 오프셋을 붙이면 북미에서
  // 전날로 변환되어 주 시작일이 하루 밀릴 수 있습니다.
  const result = new Date(`${toKstDateString(date)}T12:00:00`);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

export function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export async function getWeekReadings(weekStart) {
  const start = formatDate(weekStart);
  // FullCalendar가 쓰는 end 값은 다음 달 첫날까지 포함할 수 있어 여유 있게 요청합니다.
  const end = formatDate(addDays(weekStart, 7));
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set('start', start);
  url.searchParams.set('end', end);

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`매일미사 서버 응답 오류 (${response.status})`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('매일미사 데이터 형식이 올바르지 않습니다.');

  const dates = Array.from({ length: 7 }, (_, index) => formatDate(addDays(weekStart, index)));
  return dates.map((date) => normalizeReading(data.find((entry) => entry.start === date), date));
}

function normalizeReading(entry, date) {
  const readings = (entry?.goodnews || '')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    date,
    weekday: entry?.weekday || ['일', '월', '화', '수', '목', '금', '토'][new Date(`${date}T12:00:00`).getDay()],
    title: stripHtml(entry?.title_html || entry?.title || '전례 정보를 준비 중입니다.'),
    special: entry?.special || '',
    readings,
    url: entry?.url ? `${CBCK_ORIGIN}${entry.url}` : `${CBCK_ORIGIN}/DailyMissa/${date.replaceAll('-', '')}`,
  };
}

function stripHtml(value) {
  return String(value).replace(/<br\s*\/?>(\s*)/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
