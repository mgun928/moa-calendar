// Public browser connection details. Never put a secret/service_role key here.
export const authReady = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
  .then(({ createClient }) => createClient(
    'https://flxiaqsyhyixfhejgvkf.supabase.co',
    'sb_publishable_HRW3Z_WOhNtEX5l5YH1tfw_j9Qxn5TX',
    { auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } }
  ));

export function authMessage(error) {
  const messages = {
    invalid_credentials: '이메일 또는 비밀번호를 확인해 주세요.',
    email_not_confirmed: '받은 메일의 인증 링크를 먼저 눌러 주세요.',
    user_already_exists: '이미 가입된 계정이에요. 로그인해 주세요.',
    weak_password: '비밀번호는 8자 이상으로 설정해 주세요.',
    over_email_send_rate_limit: '메일 발송 횟수를 초과했어요. 잠시 후 다시 시도해 주세요.',
    over_request_rate_limit: '요청이 많아요. 잠시 후 다시 시도해 주세요.',
    email_address_not_authorized: '현재 테스트용 메일은 Supabase 프로젝트 팀원의 이메일로만 보낼 수 있어요.',
    email_address_invalid: '올바른 이메일 주소를 입력해 주세요.',
  };
  return messages[error?.code] || '요청을 완료하지 못했어요. 인터넷 연결과 인증 서비스 설정을 확인하고 다시 시도해 주세요.';
}
