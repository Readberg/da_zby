/** All interface texts. Components never hard-code user-facing strings. */
export const ru = {
  site: {
    name: "Да забей",
    tagline: "Блог белорусского спорта",
    description:
      "«Да забей» — блог о белорусском спорте: свежие видео канала и турнир прогнозистов.",
    logoAlt: "Логотип «Да забей»",
    homeLink: "«Да забей» — на главную",
  },
  nav: {
    label: "Основная навигация",
    home: "Главная",
  },
  footer: {
    socialLabel: "Мы в соцсетях",
    copyright: "© «Да забей»",
    social: {
      youtube: "YouTube",
      telegram: "Telegram",
      instagram: "Instagram",
      tiktok: "TikTok",
      threads: "Threads",
    },
  },
  home: {
    videosTitle: "Свежие видео",
    play: "Смотреть видео",
    playerTitle: "Видеоплеер YouTube",
    watchOnYoutube: "Смотреть на YouTube",
    moreVideos: "Предыдущие выпуски",
    allVideos: "Все видео на канале",
    unavailableTitle: "Видео сейчас не загрузились",
    unavailableText: "YouTube не ответил. Свежие выпуски всегда есть на нашем канале.",
    toChannel: "Перейти на канал",
  },
  auth: {
    loginTitle: "Вход",
    loginIntro: "Введите почту — пришлём ссылку для входа. Пароль не нужен.",
    emailLabel: "Почта",
    emailPlaceholder: "name@example.com",
    send: "Получить ссылку",
    sending: "Отправляем…",
    sentTitle: "Проверьте почту",
    sentText: "Мы отправили ссылку для входа на {email}. Откройте письмо на этом устройстве.",
    sentSpam: "Письма нет? Загляните в «Спам» или запросите ссылку ещё раз.",
    again: "Указать другую почту",
    login: "Войти",
    logout: "Выйти",
    profile: "Профиль",
    onboarding: "Выбрать ник",
    userMenu: "Меню пользователя",
    google: "Войти через Google",
    errors: {
      link: "Ссылка недействительна или устарела. Запросите новую.",
      emailInvalid: "Введите корректную почту.",
      rateLimit: "Слишком много запросов. Подождите минуту и попробуйте снова.",
      generic: "Не удалось отправить письмо. Попробуйте позже.",
    },
  },
  notFound: {
    title: "Страница не найдена",
    text: "Такой страницы нет. Возможно, ссылка устарела или в адресе опечатка.",
    home: "На главную",
  },
  error: {
    title: "Что-то пошло не так",
    text: "Мы уже знаем о проблеме. Попробуйте обновить страницу чуть позже.",
    retry: "Попробовать снова",
    home: "На главную",
  },
  common: {
    loading: "Загрузка…",
    opensInNewTab: "(откроется в новой вкладке)",
  },
  result: {
    exact: "Точный счёт",
    outcome: "Исход",
    miss: "Мимо",
  },
} as const;

export type Messages = typeof ru;
