# 모아 계정별 일정 저장과 관리

## 처음 한 번 설정

1. Supabase에서 moa 프로젝트 → SQL Editor → New query를 엽니다.
2. `migrations/202609080001_calendar_accounts.sql` 내용을 전체 복사해 실행합니다.
3. `tests/calendar_accounts.sql`도 새 쿼리에서 실행합니다. 오류 없이 끝나야 합니다. 테스트는 임시 계정만 만들고 마지막에 ROLLBACK하므로 실제 데이터로 남지 않습니다. 오류가 나면 다음 작업 전에 `ROLLBACK;`을 실행하고 오류를 확인하세요.
4. 모아에 로그인하고 새로고침합니다. 처음 연결할 때 현재 계정의 기존 브라우저 기록을 서버에 옮깁니다. 원본 로컬 기록은 백업으로 남겨두고, 이후에는 서버 기록을 사용합니다.
5. 일정을 만들고 상단의 ‘계정에 저장됐어요.’를 확인합니다. 새로고침 또는 같은 계정의 다른 브라우저에서 다시 로그인해 확인합니다.

SQL 실행 전에는 캘린더를 불러올 수 없다는 안내가 나옵니다. 브라우저 저장으로 몰래 대체하지 않습니다.
이 작업에는 공개 연결 키만 사용합니다. 서비스 역할 키나 데이터베이스 비밀번호를 HTML/JS에 넣지 않습니다.

## 저장되는 데이터

| 위치 | 내용 | 관리 방법 |
| --- | --- | --- |
| Authentication → Users | 계정 ID(UUID), 이메일, 인증 상태, 가입·로그인 정보 | 계정을 선택해 확인 |
| 사용자 metadata의 nickname | 닉네임 | 사용자는 모아 ‘내 정보’에서 변경 |
| Table Editor → calendar_accounts | 계정별 일정·그룹·취미 기록 | user_id로 해당 계정 검색 |
| 브라우저 IndexedDB | 추억 사진과 기록 | 아직 기기별 저장, 서버 동기화 대상 아님 |

`calendar_accounts`는 초기 버전에서 계정당 한 행을 사용합니다.
- `user_id`: Authentication의 계정 ID와 동일합니다. 닉네임이나 이메일이 바뀌어도 계정 연결은 유지됩니다.
- `data.events`: 일정 목록
- `data.groups`: 그룹 목록 및 초대 대상 주소. 실제 공동 편집·초대 메일 발송은 구현되지 않았습니다.
- `data.checks`: 취미 완료 기록
- `version`: 동시 수정 충돌을 확인하는 번호. 데이터베이스에서 자동 변경합니다.
- `updated_at`: 서버 기준 최근 수정 시각

일정마다 별도의 행을 두는 구조는 향후 공유·검색 기능 확장 때 도입할 수 있습니다. 현재는 계정의 관련 기록을 한 번에 저장해 그룹과 일정이 서로 어긋나지 않도록 합니다. 계정당 문서 크기 제한은 2MiB입니다. 사진은 이 문서에 넣지 않습니다.

## 관리자 계정 조회

Authentication → Users에서 이메일로 검색한 뒤 계정 ID를 복사하고, Table Editor의 calendar_accounts에서 user_id 필터로 조회하세요. 사이트를 방문한 일반 사용자는 RLS에 의해 자기 행만 접근할 수 있지만, 프로젝트 관리자인 본인은 대시보드에서 전체 데이터를 볼 수 있습니다.

SQL Editor에서 아래 읽기 전용 쿼리로 계정과 기록 수를 함께 확인할 수도 있습니다. 이 조회 결과를 공개 페이지나 공개 뷰로 만들지 마세요.

```sql
select u.id, u.email, u.raw_user_meta_data->>'nickname' as nickname,
       u.email_confirmed_at, u.created_at,
       coalesce(jsonb_array_length(c.data->'events'), 0) as event_count,
       c.updated_at as calendar_updated_at
from auth.users u
left join public.calendar_accounts c on c.user_id = u.id
order by u.created_at desc;
```

비밀번호 원문은 조회하거나 별도 저장하지 않습니다. 비밀번호 변경은 Supabase Auth를 통해 처리합니다. 관리 목적으로 이메일·인증 상태를 직접 SQL로 바꾸지 말고 Auth 관리 기능을 사용하세요.

## 계정 탈퇴

기존 delete-account Edge Function이 정상 배포되어 있다면 사용자 탈퇴 시 Auth 계정 삭제와 함께 해당 calendar_accounts 행도 ON DELETE CASCADE로 삭제됩니다. 이 기능의 실제 배포·동작 여부는 별도 확인이 필요합니다.
관리자가 Authentication → Users에서 계정을 영구 삭제할 때도 동일하게 적용됩니다. 캘린더만 지우려고 Auth 계정을 삭제하지 마세요.
다른 기기에 남은 과거 로컬 백업·추억 사진과 서비스 백업 보관본까지 이 SQL이 지우는 것은 아닙니다.

## 저장 상태와 확인 범위

- 다른 기기의 최신 기록은 새로고침할 때 불러옵니다. 실시간 화면 갱신은 아직 아닙니다.
- 여러 화면이 동시에 저장하면 먼저 저장된 내용은 보존하고, 뒤늦은 저장에는 충돌 안내를 표시합니다. 안내가 나오면 미저장 변경 내용을 확인한 뒤 새로고침하고 다시 수정하세요.
- 네트워크 오류는 ‘다시 저장’으로 재시도합니다. 완료 전에는 창을 닫지 마세요.
- SQL 설정·RLS 테스트 및 실제 두 계정 간 접근 차단은 Supabase에서 실행해 확인해야 합니다. 로컬의 테스트 5개는 저장 코드의 이관, 순서, 실패·재시도, 충돌, 초기 로딩 실패를 검사하며 실제 RLS 검증을 대신하지 않습니다.
- 로그인하지 않은 접근, 타 계정 읽기·쓰기, 탈퇴 후 연쇄 삭제를 SQL 테스트 파일로 확인합니다.

공식 참고: https://supabase.com/docs/guides/database/postgres/row-level-security
