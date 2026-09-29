import { addDays, getWeekReadings, startOfWeek, toKstDateString } from './massService.js';

const readingsElement = document.querySelector('#readings');
const statusElement = document.querySelector('#status');
const weekLabelElement = document.querySelector('#weekLabel');
const today = toKstDateString(new Date());
let selectedWeek = startOfWeek();

function formatWeek(date) {
  const end = addDays(date, 6);
  const formatter = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });
  return `${formatter.format(date)} – ${formatter.format(end)}`;
}

function renderReadings(readings) {
  readingsElement.innerHTML = readings.map((item) => {
    const isToday = item.date === today;
    const date = new Date(`${item.date}T12:00:00`);
    const day = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(date);
    return `<a class="reading-card ${isToday ? 'is-today' : ''}" href="${item.url}" target="_blank" rel="noreferrer">
      <div class="card-top"><span class="date-badge">${day} (${item.weekday})</span>${isToday ? '<span class="today-badge">오늘</span>' : ''}</div>
      <h2>${escapeHtml(item.title)}</h2>
      ${item.special ? `<p class="special">${escapeHtml(item.special)}</p>` : ''}
      <div class="scripture-list">${item.readings.length ? item.readings.map((reading) => `<p>${escapeHtml(reading)}</p>`).join('') : '<p class="empty-reading">말씀 목록은 원문에서 확인하세요.</p>'}</div>
      <span class="open-source">원문 보기 <b>→</b></span>
    </a>`;
  }).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function loadWeek() {
  weekLabelElement.textContent = `${formatWeek(selectedWeek)} 주간`;
  statusElement.hidden = false;
  statusElement.className = 'status';
  statusElement.textContent = '공식 매일미사 자료를 불러오는 중입니다.';
  readingsElement.setAttribute('aria-busy', 'true');
  try {
    renderReadings(await getWeekReadings(selectedWeek));
    statusElement.hidden = true;
  } catch (error) {
    readingsElement.innerHTML = '';
    statusElement.className = 'status error';
    statusElement.innerHTML = `말씀을 불러오지 못했습니다. <a href="https://missa.cbck.or.kr" target="_blank" rel="noreferrer">매일미사 원문에서 확인하기 ↗</a>`;
    console.error(error);
  } finally {
    readingsElement.removeAttribute('aria-busy');
  }
}

document.querySelector('#previousWeek').addEventListener('click', () => { selectedWeek = addDays(selectedWeek, -7); loadWeek(); });
document.querySelector('#nextWeek').addEventListener('click', () => { selectedWeek = addDays(selectedWeek, 7); loadWeek(); });
document.querySelector('#todayWeek').addEventListener('click', () => { selectedWeek = startOfWeek(); loadWeek(); });

loadWeek();
