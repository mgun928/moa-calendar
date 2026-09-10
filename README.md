# 모아 · moa

개인 일정과 그룹 일정을 관리하는 한국어 캘린더 웹 프로젝트입니다.

## 로컬 실행

VS Code에서 프로젝트 폴더를 열고 Live Server로 `index.html`을 실행합니다.
인증 기능은 HTTP 주소에서 테스트하세요. Supabase의 Redirect URLs에 사용하는 로컬 주소를 등록해야 합니다.

## 구성

- HTML, CSS, JavaScript
- Supabase Authentication: 회원가입, 이메일 인증, 로그인, 프로필, 탈퇴
- Supabase Postgres: 계정별 일정, 그룹 초대와 공유 일정
- 추억 사진과 기록은 현재 브라우저 IndexedDB에 저장

## 서버 설정

`supabase/migrations/`의 SQL을 파일명 순서대로 적용합니다.
그다음 `supabase/tests/`의 SQL로 데이터 접근 권한을 검사합니다.
계정 탈퇴는 `supabase/functions/delete-account/README.md`에 따라 Edge Function을 배포해야 합니다.

자세한 설정과 제한 사항:
- [계정 데이터 관리](supabase/ACCOUNT-DATA-GUIDE.md)
- [그룹 초대](supabase/GROUP-INVITATIONS-GUIDE.md)

인증 메일 SMTP 자격 증명은 Supabase 설정에만 입력합니다.
`auth.js`에는 브라우저 공개용 Supabase URL과 publishable key만 사용합니다.
앱 비밀번호나 서비스 역할 키는 저장소에 넣지 않습니다.

## 로컬 테스트

```sh
node --test tests/calendar-store.test.mjs tests/group-sharing.test.mjs
```

JavaScript 테스트와 별도로 실제 프로젝트에서 SQL 권한 검사 및 두 계정 간 송수신을 확인해야 합니다.
