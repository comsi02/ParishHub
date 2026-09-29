import { defineConfig } from 'vite';

/**
 * CBCK 서버는 브라우저 CORS 헤더를 제공하지 않습니다.
 * 개발 중에는 이 프록시를 통해 실제 매일미사 데이터를 그대로 조회합니다.
 * 운영 배포에서는 README의 동일 경로 프록시를 배포한 뒤 VITE_MASS_API_URL을 설정하세요.
 */
export default defineConfig({
  server: {
    port: 5175,
    proxy: {
      '/api/cbck': {
        target: 'https://missa.cbck.or.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cbck/, ''),
      },
      // Firebase Function과 같은 URL을 개발 시에는 CBCK 상세 HTML로 전달합니다.
      // 브라우저의 detailService가 이 HTML을 JSON과 같은 형태로 임시 파싱합니다.
      '/api/missa': {
        target: 'https://missa.cbck.or.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/missa/, '/DailyMissa'),
      },
    },
  },
});
