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
  const status = document.getElementById('form-status');
  const result = new URLSearchParams(window.location.search).get('contact');
  const messages = isJapanese ? {
    sent: 'お問い合わせを受け付けました。メッセージは送信処理に進みました。',
    invalid: 'お名前、正しいメールアドレス、お問い合わせ内容（5,000文字以内）をご入力ください。',
    unavailable: '送信できませんでした。malte@omnilabs.digital までメールでお問い合わせください。',
    verification: '迷惑送信の確認を完了してから、もう一度送信してください。'
  } : {
    sent: 'Thank you. Your message has been accepted for delivery.',
    invalid: 'Please enter a valid name, email address and message (up to 5,000 characters).',
    unavailable: 'Your message could not be sent. Please email malte@omnilabs.digital.',
    verification: 'Please complete the spam verification and submit your message again.'
  };
  if (status && messages[result]) status.textContent = messages[result];
})();
