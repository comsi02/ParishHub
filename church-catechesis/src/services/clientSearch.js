// 사용자 검색용 클라이언트 측 LIKE 검색 유틸리티.
// 공백·하이픈 표기 차이와 무관하게 어느 위치에서든 검색어를 찾는다.
export function normalizeClientSearchText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s-]/g, '');
}

/** SQL의 `%검색어%`와 같은 포함 검색 */
export function includesClientLike(query, ...values) {
  const needle = normalizeClientSearchText(query);
  if (!needle) return true;
  return values.some(value => normalizeClientSearchText(value).includes(needle));
}
