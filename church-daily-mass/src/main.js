import { addDays, getWeekReadings, startOfWeek, toKstDateString } from './massService.js';
import { getMissaDetail } from './detailService.js';

const readingsElement = document.querySelector('#readings');
const statusElement = document.querySelector('#status');
const weekLabelElement = document.querySelector('#weekLabel');
const weekLoadingElement = document.querySelector('#weekLoading');
const today = toKstDateString(new Date());
let selectedWeek = startOfWeek();
const dialog = document.querySelector('#readingDialog');
const fontSizeButtons = document.querySelectorAll('[data-font-size]');
const fontSizeStorageKey = 'church-daily-mass-font-size';
const fontSizeOptions = ['grade3', 'grade4', 'grade5', 'grade6'];
const themeToggle = document.querySelector('#themeToggle');
const themeStorageKey = 'church-daily-mass-theme';

function setFontSize(size) {
  const selectedSize = fontSizeOptions.includes(size) ? size : 'grade4';
  document.documentElement.dataset.fontSize = selectedSize;
  fontSizeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.fontSize === selectedSize));
  });
  localStorage.setItem(fontSizeStorageKey, selectedSize);
}

function setTheme(theme) {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = selectedTheme;
  const isDark = selectedTheme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
  themeToggle.title = isDark ? '라이트 모드로 전환' : '다크 모드로 전환';
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#111c2b' : '#123a63';
  localStorage.setItem(themeStorageKey, selectedTheme);
}

function formatWeek(date) {
  const end = addDays(date, 6);
  const formatter = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });
  return `${formatter.format(date)} – ${formatter.format(end)}`;
}

function setWeekLoading(isLoading) {
  weekLoadingElement.hidden = !isLoading;
}

function renderReadings(readings) {
  readingsElement.innerHTML = readings.map((item) => {
    const isToday = item.date === today;
    const date = new Date(`${item.date}T12:00:00`);
    const day = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(date);
    return `<a class="reading-card ${isToday ? 'is-today' : ''}" href="${item.url}" data-date="${item.date}">
      <div class="card-top"><span class="date-badge">${day} (${item.weekday})</span>${isToday ? '<span class="today-badge">오늘</span>' : ''}</div>
      <h2>${escapeHtml(item.title)}</h2>
      ${item.special ? `<p class="special">${escapeHtml(item.special)}</p>` : ''}
      <div class="scripture-list">${item.readings.length ? item.readings.map((reading) => `<p>${escapeHtml(reading)}</p>`).join('') : '<p class="empty-reading">말씀 목록은 원문에서 확인하세요.</p>'}</div>
      <span class="open-source">원문 보기 <b>→</b></span>
    </a>`;
  }).join('');
}

async function openDetail(date) {
  const detailStatus = document.querySelector('#detailStatus');
  const detailReadings = document.querySelector('#detailReadings');
  dialog.showModal();
  document.querySelector('#detailDate').textContent = date;
  document.querySelector('#detailTitle').textContent = '전례';
  detailReadings.innerHTML = '';
  detailStatus.hidden = false;
  detailStatus.textContent = '말씀 본문을 불러오는 중입니다.';
  try {
    const missa = await getMissaDetail(date);
    document.querySelector('#detailDate').textContent = missa.dateText || date;
    document.querySelector('#detailTitle').textContent = missa.title || '전례';
    document.querySelector('#detailSource').href = missa.sourceUrl;
    const visibleReadings = missa.readings
      .map((reading) => ({ ...reading, text: removeDuplicateSubtitle(reading.text, reading.subtitle, reading.type) }))
      .filter((reading) => reading.text);
    detailReadings.innerHTML = visibleReadings.map((reading) => `<article class="detail-reading">
      <p class="detail-type">${escapeHtml(reading.type)} ${reading.reference ? `<span>${escapeHtml(reading.reference)}</span>` : ''}</p>
      ${reading.subtitle ? `<h3>${escapeHtml(reading.subtitle)}</h3>` : ''}
      <p class="detail-text">${escapeHtml(reading.text)}</p>
    </article>`).join('');
    if (!visibleReadings.length) throw new Error('독서와 복음을 찾지 못했습니다.');
    detailStatus.hidden = true;
  } catch (error) {
    detailStatus.textContent = '본문을 불러오지 못했습니다. 아래 원문 링크에서 확인해 주세요.';
    console.error(error);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function removeDuplicateSubtitle(text, subtitle, type = '') {
  const normalizedSubtitle = normalizeText(subtitle);
  if (!normalizedSubtitle) return text;
  const duplicateTitles = new Set([
    normalizedSubtitle,
    normalizeText(`${type} ${subtitle}`),
    normalizeText(`${type}: ${subtitle}`),
    normalizeText(`${String(type).replace(/^제/, '')} ${subtitle}`),
  ]);

  return String(text)
    .split('\n')
    .filter((line) => !duplicateTitles.has(normalizeText(line)))
    .join('\n')
    .trim();
}

function normalizeText(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

async function loadWeek() {
  weekLabelElement.textContent = `${formatWeek(selectedWeek)} 주간`;
  statusElement.hidden = true;
  statusElement.className = 'status';
  setWeekLoading(true);
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
    setWeekLoading(false);
    readingsElement.removeAttribute('aria-busy');
  }
}

document.querySelector('#previousWeek').addEventListener('click', () => { selectedWeek = addDays(selectedWeek, -7); loadWeek(); });
document.querySelector('#nextWeek').addEventListener('click', () => { selectedWeek = addDays(selectedWeek, 7); loadWeek(); });
document.querySelector('#todayWeek').addEventListener('click', () => { selectedWeek = startOfWeek(); loadWeek(); });
readingsElement.addEventListener('click', (event) => {
  const card = event.target.closest('.reading-card');
  if (!card) return;
  event.preventDefault();
  openDetail(card.dataset.date);
});
document.querySelector('#closeDialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
fontSizeButtons.forEach((button) => {
  button.addEventListener('click', () => setFontSize(button.dataset.fontSize));
});
themeToggle.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

setFontSize(localStorage.getItem(fontSizeStorageKey));
setTheme(localStorage.getItem(themeStorageKey));
loadWeek();
