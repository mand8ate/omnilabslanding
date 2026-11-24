'use strict';
(() => {
  const isJapanese = document.documentElement.lang === 'ja';
  const languageSelect = document.getElementById('language-select');
  languageSelect?.addEventListener('change', () => {
    const path = languageSelect.value === 'ja' ? '/ja/' : '/';
    window.location.assign(path + window.location.hash);
  });
  // Back/forward cache must reflect the language of the displayed HTML.
  window.addEventListener('pageshow', () => {
    if (languageSelect) languageSelect.value = isJapanese ? 'ja' : 'en';
  });
  const startedField = document.getElementById('form-started');
  if (startedField) startedField.value = String(Date.now());
  const status = document.getElementById('form-status');
  const result = new URLSearchParams(window.location.search).get('contact');
  const messages = isJapanese ? {
    sent: 'お問い合わせを受け付けました。メッセージは送信処理に進みました。',
    invalid: 'お名前、正しいメールアドレス、お問い合わせ内容（5,000文字以内）をご入力ください。',
    unavailable: '送信できませんでした。malte@omnilabs.digital までメールでお問い合わせください。',
    verification: 'ページを再読み込みし、数秒待ってからもう一度送信してください。',
    limited: '送信回数が上限に達しました。15分ほど待つか、メールでお問い合わせください。'
  } : {
    sent: 'Thank you. Your message has been accepted for delivery.',
    invalid: 'Please enter a valid name, email address and message (up to 5,000 characters).',
    unavailable: 'Your message could not be sent. Please email malte@omnilabs.digital.',
    verification: 'Please reload the page, wait a few seconds and try again.',
    limited: 'Too many submissions. Please wait 15 minutes or contact us by email.'
  };
  if (status && messages[result]) status.textContent = messages[result];
})();
