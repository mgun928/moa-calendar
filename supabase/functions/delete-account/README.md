# 계정 탈퇴 서버 함수 설치

Supabase Dashboard → Edge Functions에서 `delete-account` 함수를 생성하고
같은 폴더의 index.ts 내용을 붙여넣어 배포합니다.
게이트웨이의 JWT verification은 기본값을 유지합니다. 이 함수 자체에서도
Authorization 토큰을 getUser로 검증하며 현재 비밀번호도 다시 확인합니다.
CLI 사용 시: supabase functions deploy delete-account

SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY는 호스팅된
Supabase Edge Functions의 기본 환경변수입니다. 웹 코드에 복사하지 마세요.

현재 삭제 대상은 Auth 계정입니다. 일정/사진은 로컬 저장이므로 현재 브라우저만
정리합니다. 서버에 일정 테이블/Storage를 추가할 때 사용자별 cascade와 파일
삭제 처리를 함께 구현해야 합니다.

배포 후 폐기용 계정으로 확인: 미로그인 요청 거부, 잘못된 비밀번호 거부,
취소 시 계정 유지, 정상 탈퇴 후 재로그인 실패. 실제 계정은 테스트에 사용하지 마세요.
