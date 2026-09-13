# tech.md

**Версия ядра: v1**

Changelog:

- v1: первичная фиксация. Стек, схема БД, контракты очереди, общие типы, контент-конфиг, UI-примитивы, роадмап слайсов.

Правила изменения файла: только append-only, любое изменение контракта (схема БД, типы в `lib/types`, payload джоба, схема контента) бампает версию и добавляет строку в changelog. Сессия не правит этот файл самостоятельно: при нехватке контракта выдаёт блок `CONTRACT GAP` и ждёт решения.

---

## 1. Проект

Сайт-приглашение на свадьбу с персонализацией по гостю и Telegram-бот, который напоминает о подтверждении.

Задачи, которые решает система:

1. Показать гостю приглашение, сегментированное под его группу (родственники, друзья, коллеги).
2. Собрать RSVP: придёт или нет, ЗАГС, блюдо, напитки, аллергии, спутник.
3. Дать гостю самому заявить спутника (+1) так, чтобы спутник попал в счётчики меню и в выгрузку для площадки.
4. Напомнить о подтверждении за 30 и за 7 дней до даты через Telegram.
5. Дать организатору админку: список гостей, статусы, счётчики блюд, экспорт в xlsx.

Аудитория: около 40 до 80 гостей, преимущественно мобильный трафик, разовая нагрузка. Оптимизировать под читаемость и скорость первого экрана, не под масштаб.

### Принятые решения (не пересматривать без бампа версии)

| Решение | Выбор |
| --- | --- |
| Вход гостя | Одна общая ссылка, гость вводит имя, система сопоставляет со списком |
| Спутник (+1) | Гость сам указывает спутника, если политика его группы это разрешает |
| Привязка Telegram | Гость оставляет `@username` в форме. Организатор рассылает персональную ссылку `t.me/<bot>?start=<token>` вручную. Дальше бот работает автоматически |
| Админка | Веб-админка со счётчиками и экспортом |
| Напоминания | За 30 и за 7 дней до даты свадьбы |
| Хостинг | Свой VPS, Caddy, systemd, автодеплой из `main` |

### Ограничение Telegram

Bot API не позволяет боту написать первым пользователю по `@username`. Пользователь обязан нажать Start. Поэтому привязка `chat_id` идёт через персональный deep-link с одноразовым токеном, который организатор отправляет со своего аккаунта. Все дальнейшие напоминания уходят автоматически. Не проектировать логику, которая предполагает отправку сообщения гостю без `telegram_chat_id`.

---

## 2. Стек

- SvelteKit 2, Svelte 5 (runes), TypeScript strict, adapter-node
- PostgreSQL 16, Drizzle ORM, drizzle-kit для миграций
- pg-boss для отложенных задач и напоминаний
- grammY для Telegram-бота, режим webhook
- zod для валидации на всех границах
- Tailwind CSS v4, токены дизайна в CSS-переменных
- shadcn-svelte (bits-ui) для примитивов админки, собственные примитивы для публичного сайта
- Motion One (`motion`) плюс CSS для анимаций, Intersection Observer через action `use:reveal`
- exceljs для выгрузки xlsx
- Шрифты self-hosted в `static/fonts`, без Google Fonts в рантайме
- Тесты: vitest (unit, контрактные, идемпотентность), Playwright (e2e), fast-check (property-based)
- Инфраструктура: Caddy (TLS, reverse proxy), systemd, GitHub Actions

Запрещено добавлять зависимости вне этого списка без бампа версии ядра.

---

## 3. Структура папок

```
src/
  lib/
    content/
      schema.ts              # zod-схема контента
      wedding.ts             # весь контент сайта, единственное место с текстами
    types/
      index.ts               # общие типы, шарятся между слайсами
    server/
      config.ts              # чтение и валидация env, единственный доступ к process.env
      db/
        schema.ts            # Drizzle schema, источник истины по БД
        index.ts             # клиент
      guests/
        name-key.ts          # нормализация имени, чистая функция
        match.ts             # сопоставление имени со списком, чистая функция
        session.ts           # cookie-сессия гостя
        repo.ts              # доступ к БД
      rsvp/
        service.ts
        repo.ts
      telegram/
        client.ts            # интерфейс TelegramClient
        real.ts              # grammY-реализация
        fake.ts              # фейк для dev и тестов
        templates.ts         # тексты сообщений
        bot.ts               # хендлеры команд
      admin/
        auth.ts
        stats.ts
        export.ts
      queue/
        boss.ts              # инициализация pg-boss
        jobs/
          reminder-schedule.ts
          reminder-send.ts
          rsvp-notify-admin.ts
    ui/                      # примитивы, переиспользуются всеми слайсами
    actions/
      reveal.ts              # scroll-reveal action
  routes/
    (site)/
      +layout.svelte         # музыка, фон, шрифты
      +page.svelte           # ввод имени
      i/                     # приглашение, сегментированное
      rsvp/                  # эталонный слайс
      thanks/
    (admin)/
      admin/
    api/
      telegram/+server.ts    # webhook
  hooks.server.ts            # сессии гостя и админа
scripts/
  seed.ts
tests/
  e2e/
drizzle/                     # сгенерированные миграции, руками не править
```

**Эталонный слайс: `routes/(site)/rsvp`.** Любой новый слайс повторяет его раскладку: чистая доменная логика в `lib/server/<домен>/*.ts`, доступ к БД только через `repo.ts`, `load` и actions тонкие, компоненты без бизнес-логики. Не изобретать свою структуру, сверяться с эталоном.

---

## 4. Схема БД

Источник истины: `src/lib/server/db/schema.ts`. Миграции генерируются из схемы через `drizzle-kit generate`, руками файлы в `drizzle/` не редактируются.

```ts
import {
  pgTable, pgEnum, uuid, text, boolean, timestamp, bigint, jsonb,
  index, uniqueIndex
} from 'drizzle-orm/pg-core';

export const audienceEnum = pgEnum('audience', ['family', 'friends', 'colleagues']);
export const plusOnePolicyEnum = pgEnum('plus_one_policy', ['none', 'allowed']);
export const attendStatusEnum = pgEnum('attend_status', ['yes', 'no']);
export const reminderStageEnum = pgEnum('reminder_stage', ['d30', 'd7']);
export const reminderStatusEnum = pgEnum('reminder_status', ['sent', 'skipped', 'failed']);

// Семья или пара. Гости одной party получают одно приглашение и видят друг друга в форме.
export const parties = pgTable('parties', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),                   // "Семья Ивановых", служебное, гостю не показывается
  audience: audienceEnum('audience').notNull(),
  plusOnePolicy: plusOnePolicyEnum('plus_one_policy').notNull().default('none'),
  invitedToRegistry: boolean('invited_to_registry').notNull().default(false),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const guests = pgTable('guests', {
  id: uuid('id').primaryKey().defaultRandom(),
  partyId: uuid('party_id').notNull().references(() => parties.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  displayName: text('display_name').notNull(),      // как обращаемся на сайте
  nameKey: text('name_key').notNull(),              // нормализованный ключ, см. раздел 6
  isPlusOne: boolean('is_plus_one').notNull().default(false),
  invitedByGuestId: uuid('invited_by_guest_id'),    // self-ref, заполнен только у спутника
  telegramUsername: text('telegram_username'),
  telegramChatId: bigint('telegram_chat_id', { mode: 'number' }),
  botToken: text('bot_token').notNull(),            // payload для t.me/<bot>?start=<token>
  botStartedAt: timestamp('bot_started_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  nameKeyIdx: index('guests_name_key_idx').on(t.nameKey),
  partyIdx: index('guests_party_idx').on(t.partyId),
  botTokenIdx: uniqueIndex('guests_bot_token_idx').on(t.botToken),
  chatIdIdx: uniqueIndex('guests_chat_id_idx').on(t.telegramChatId)
}));

export const rsvps = pgTable('rsvps', {
  id: uuid('id').primaryKey().defaultRandom(),
  guestId: uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  attending: attendStatusEnum('attending').notNull(),
  attendingRegistry: boolean('attending_registry').notNull().default(false),
  mainCourses: jsonb('main_courses').$type<string[]>().notNull().default([]),  // id из content.menu
  drinks: jsonb('drinks').$type<string[]>().notNull().default([]),
  allergies: text('allergies'),
  needsTransfer: boolean('needs_transfer').notNull().default(false),
  songRequest: text('song_request'),
  comment: text('comment'),
  source: text('source').notNull(),                 // 'web' | 'bot'
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  guestIdx: uniqueIndex('rsvps_guest_idx').on(t.guestId)
}));

// Факт отправки напоминания. Уникальный ключ обеспечивает идемпотентность джоба.
export const reminders = pgTable('reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  guestId: uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  stage: reminderStageEnum('stage').notNull(),
  status: reminderStatusEnum('status').notNull(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  dedupeIdx: uniqueIndex('reminders_dedupe_idx').on(t.guestId, t.stage)
}));

// Гость ввёл имя, совпадения нет. Разбирает организатор в админке.
export const unknownRequests = pgTable('unknown_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  rawName: text('raw_name').notNull(),
  contact: text('contact'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const guestSessions = pgTable('guest_sessions', {
  id: text('id').primaryKey(),                      // случайный токен из cookie
  guestId: uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
```

Инварианты, которые держит код (покрыть тестами):

1. Спутник всегда лежит в той же `party`, что и пригласивший, имеет `isPlusOne = true` и `invitedByGuestId`.
2. У гостя не больше одного спутника. Повторная отправка формы со спутником обновляет существующего, не создаёт второго.
3. Ответ `attending = 'no'` удаляет спутника и его RSVP.
4. `attendingRegistry = true` допустим, только если `parties.invitedToRegistry = true`.
5. Спутник не имеет собственного доступа к сайту: `botToken` генерируется, но вход по имени спутника возвращает карточку пригласившего.

---

## 5. Контракты очереди

pg-boss, схема `pgboss` в той же БД. Все payload валидируются zod-схемами из `lib/types` на входе в хендлер. Хендлер, получивший невалидный payload, падает без ретрая.

### `reminder.schedule`

Cron `0 7 * * *` (10:00 MSK). Singleton по дате.

```ts
type ReminderScheduleJob = { runDate: string };  // ISO date, для теста и для дедупликации
```

Логика: вычислить, сколько дней до `content.event.date`. Если ровно 30 или ровно 7, поставить `reminder.send` каждому гостю, у которого `telegramChatId is not null` и `isPlusOne = false`. Спутникам бот не пишет.

Идемпотентность: `singletonKey = 'reminder.schedule:' + runDate`.

### `reminder.send`

```ts
type ReminderSendJob = { guestId: string; stage: 'd30' | 'd7' };
```

Правила:

- `singletonKey = `${guestId}:${stage}``, `retryLimit: 3`, `retryBackoff: true`.
- Хендлер первым делом вставляет строку в `reminders` с `ON CONFLICT (guest_id, stage) DO NOTHING`. Ноль затронутых строк означает, что напоминание уже отправлено: хендлер выходит успешно, не отправляя сообщение.
- Текст зависит от состояния RSVP на момент отправки: нет ответа, ответ `yes`, ответ `no`. Шаблоны в `telegram/templates.ts`.
- Ошибка Telegram API пишется в `reminders.error`, статус `failed`, джоб уходит в ретрай.

Тест идемпотентности обязателен: прогнать хендлер дважды с одним payload, проверить ровно одну отправку в фейковом клиенте.

### `rsvp.notify-admin`

```ts
type RsvpNotifyAdminJob = { guestId: string; kind: 'created' | 'updated' };
```

Отправляет организатору сообщение в Telegram о новом или изменённом ответе. `singletonKey = `${guestId}:${kind}:${updatedAtIso}``, `retryLimit: 3`.

---

## 6. Общие типы

`src/lib/types/index.ts`. Слайсы импортируют отсюда и не объявляют дубликаты.

```ts
export type Audience = 'family' | 'friends' | 'colleagues';
export type AttendStatus = 'yes' | 'no';
export type ReminderStage = 'd30' | 'd7';
export type PlusOnePolicy = 'none' | 'allowed';

// То, что сервер отдаёт в браузер. Никогда не содержит botToken, telegramChatId, note.
export type GuestPublic = {
  id: string;
  displayName: string;
  firstName: string;
  audience: Audience;
  invitedToRegistry: boolean;
  plusOnePolicy: PlusOnePolicy;
  isPlusOne: boolean;
  partyMembers: { id: string; displayName: string; isPlusOne: boolean }[];
  rsvp: RsvpPublic | null;
};

export type RsvpPublic = {
  attending: AttendStatus;
  attendingRegistry: boolean;
  mainCourses: string[];
  drinks: string[];
  allergies: string | null;
  needsTransfer: boolean;
  songRequest: string | null;
  comment: string | null;
  updatedAt: string;
};

// Единая схема для веб-формы и для бота. Другого пути записи RSVP нет.
export const rsvpPayloadSchema = z.object({
  attending: z.enum(['yes', 'no']),
  attendingRegistry: z.boolean().default(false),
  mainCourses: z.array(z.string()).default([]),
  drinks: z.array(z.string()).default([]),
  allergies: z.string().max(300).nullable().default(null),
  needsTransfer: z.boolean().default(false),
  songRequest: z.string().max(200).nullable().default(null),
  comment: z.string().max(1000).nullable().default(null),
  telegramUsername: z.string().max(64).nullable().default(null),
  companion: z.object({
    firstName: z.string().min(1).max(60),
    lastName: z.string().max(60).default(''),
    mainCourses: z.array(z.string()).default([]),
    drinks: z.array(z.string()).default([])
  }).nullable().default(null)
});
export type RsvpPayload = z.infer<typeof rsvpPayloadSchema>;

export type MatchResult =
  | { kind: 'single'; guestId: string }
  | { kind: 'ambiguous'; candidates: { guestId: string; hint: string }[] }
  | { kind: 'none' };
```

Серверные правила поверх схемы (валидировать в `rsvp/service.ts`, не в zod):

- `companion` отвергается, если `plusOnePolicy = 'none'` или `attending = 'no'`.
- `attendingRegistry` принудительно `false`, если у party нет приглашения в ЗАГС.
- `mainCourses` и `drinks` проверяются против id из контент-конфига, неизвестный id отвергается.

### Нормализация имени

`name-key.ts`, чистая функция, без БД:

1. lower-case, `ё` в `е`
2. убрать всё кроме букв и пробелов
3. схлопнуть пробелы
4. разбить на токены, отсортировать лексикографически, склеить через пробел

Сортировка токенов делает ключ независимым от порядка: `Иван Петров` и `Петров Иван` дают один ключ.

Property-инварианты для fast-check:

- `nameKey(s) === nameKey(nameKey(s))` (идемпотентность)
- перестановка токенов входа не меняет ключ
- изменение регистра и лишние пробелы не меняют ключ

`match.ts` сопоставляет ключ со списком: сначала точное совпадение, затем токенное с расстоянием Левенштейна не больше 2 на токен. Одно совпадение возвращает `single`, несколько возвращает `ambiguous` с подсказкой (первая буква фамилии или группа), ноль возвращает `none`.

---

## 7. Контент-конфиг

Весь текст и все данные события лежат в `src/lib/content/wedding.ts` и валидируются `content/schema.ts` при старте приложения. В компонентах нет захардкоженных строк.

```ts
export const content = {
  couple: { bride: 'TODO', groom: 'TODO' },
  event: {
    date: '2026-08-28',          // TODO
    time: '15:00',               // TODO
    rsvpDeadline: '2026-08-14',  // TODO
    city: 'TODO'
  },
  registry: {                    // ЗАГС
    title: 'TODO',
    address: 'TODO',
    gatherTime: 'TODO',
    ceremonyTime: 'TODO',
    mapUrl: 'TODO'
  },
  venue: {                       // банкет
    title: 'TODO',
    address: 'TODO',
    startTime: 'TODO',
    endTime: 'TODO',
    mapUrl: 'TODO',
    photos: []
  },
  timeline: [
    { time: 'TODO', title: 'TODO', caption: 'TODO' }
  ],
  dressCode: { palette: [], text: 'TODO' },
  gifts: 'TODO',
  transfer: null,                // TODO: маршрут и время, либо null
  contacts: [{ role: 'TODO', name: 'TODO', phone: 'TODO', telegram: 'TODO' }],
  menu: {
    multiSelect: false,          // TODO: одно блюдо или несколько
    courses: [{ id: 'TODO', label: 'TODO' }],
    drinks: [{ id: 'TODO', label: 'TODO' }]
  },
  music: { enabled: true, src: '/audio/TODO.mp3' },
  gallery: [],
  // Сегментированные тексты. Ключи совпадают с Audience.
  byAudience: {
    family:     { greeting: 'TODO', address: 'ты', showRegistry: true },
    friends:    { greeting: 'TODO', address: 'ты', showRegistry: false },
    colleagues: { greeting: 'TODO', address: 'вы', showRegistry: false }
  }
} satisfies Content;
```

Плейсхолдеры `TODO` допустимы в разработке. Стадия 7 не считается закрытой, пока в файле остаётся хотя бы один `TODO`. Тест `content.test.ts` на стадии 7 падает при наличии `TODO`.

### Открытые вопросы по контенту

Заполняются в `wedding.ts` без изменения кода. На архитектуру не влияют, разработку не блокируют.

1. Имена, дата, время, город.
2. ЗАГС: адрес, время сбора и церемонии.
3. Площадка: название, адрес, время начала и окончания.
4. Полный тайминг дня.
5. Дедлайн RSVP.
6. Дресс-код и палитра.
7. Формулировка про подарки.
8. Контакты для вопросов.
9. Трансфер и парковка.
10. Точные списки блюд и напитков, одно блюдо или несколько.
11. Фото для обложки и галереи.
12. Трек для фоновой музыки.
13. Приглашены ли дети, нужно ли детское меню.
14. Домен.

---

## 8. UI-примитивы

Собираются в скелете до начала фич и рендерятся на роуте `/kitchen-sink` (закрыт в проде). Свои компоненты вместо примитивов в слайсах не писать.

Публичный сайт, `lib/ui`:

| Компонент | Пропсы |
| --- | --- |
| `Section` | `variant: 'light' \| 'dark'`, `padded?: boolean` |
| `Reveal` | `delay?: number`, `y?: number`, обёртка над `use:reveal` |
| `Heading` | `level: 1..3`, `script?: boolean` (каллиграфия) |
| `Divider` | `orientation: 'vertical' \| 'horizontal'` |
| `Countdown` | `target: string` (ISO) |
| `Collage` | `images: { src, alt, span }[]` |
| `TimelineItem` | `time: string`, `title: string`, `caption: string`, `icon: 'pin' \| 'rings' \| 'dish'` |
| `MapCard` | `title`, `address`, `mapUrl`, `photos` |
| `AudioToggle` | `src: string` |
| `Button` | `variant: 'solid' \| 'ghost'`, `loading?: boolean`, `type` |
| `Field` | `label`, `error?`, `required?`, слот под контрол |
| `TextInput`, `TextArea` | `value`, `placeholder`, `maxlength` |
| `RadioGroup` | `options: { id, label }[]`, `value` |
| `CheckboxGroup` | `options: { id, label }[]`, `values`, `max?: number` |
| `Toast` | `kind: 'ok' \| 'error'`, `text` |

Админка берёт `Table`, `Badge`, `Dialog`, `Select`, `Tabs` из shadcn-svelte. Не смешивать: shadcn-компоненты на публичном сайте не использовать, стиль другой.

Токены дизайна в CSS-переменных, `app.css`:

```
--c-ink: #1b1b1b; --c-paper: #f7f7f5; --c-forest: #12352c; --c-muted: #8a8a85;
--font-display, --font-script, --font-body
--space-section, --radius, --dur-fast, --dur-slow, --ease-out
```

Анимации: все `Reveal` уважают `prefers-reduced-motion: reduce` и тогда рендерят контент без трансформаций. Ни одна анимация не блокирует контент: если JS не загрузился, содержимое видно.

---

## 9. Тесты

Тесты выводятся из критериев приёмки задачи, не из реализации. Тест кодирует контракт. Запрещено писать тест после кода так, что он подтверждает поведение кода вместе с багами.

Обязательные типы на слайс:

1. **Контрактные на стыках.** Payload джоба валидируется схемой из `lib/types`. Фейковый `TelegramClient` валидирует вход и падает, если слайс шлёт мусор.
2. **Идемпотентность джобов.** На каждый хендлер pg-boss тест: два прогона с одним payload дают ровно один эффект. Без этого гость получает дубли напоминаний.
3. **Путь ошибки.** Фейковый клиент умеет возвращать 500 и таймаут. Проверить ретрай и запись `reminders.status = 'failed'`.
4. **Property-based (fast-check).** На чистой логике: нормализация имени, сопоставление, подсчёт меню.

Уровни:

- unit и контрактные: vitest, БД поднимается как эфемерный Postgres в CI
- e2e: Playwright, сценарии «ввёл имя, попал на приглашение, отправил RSVP со спутником», «ответил нет», «изменил ответ»

Гейт красный без тестов на слайс.

---

## 10. Владение инфраструктурой

- **Миграции.** Генерируются из `db/schema.ts` через `drizzle-kit generate`, применяются шагом деплоя. Файлы в `drizzle/` не редактируются руками. В PR-гейте миграции прогоняются на эфемерном Postgres с нуля.
- **Сид.** `scripts/seed.ts` создаёт parties и guests всех трёх аудиторий, пару в одной party, гостя с `plusOnePolicy = 'allowed'`, гостя-тёзку для проверки `ambiguous`, гостя с привязанным `telegramChatId`. Фейковые клиенты работают на этих же данных.
- **Конфиг.** `lib/server/config.ts`, единственное место чтения `process.env`, валидация zod при старте. `.env.example` содержит все ключи:

```
DATABASE_URL=
PUBLIC_SITE_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_ADMIN_CHAT_ID=
ADMIN_PASSWORD=
SESSION_SECRET=
USE_FAKE_TELEGRAM=true
```

- **Фейки.** Все внешние клиенты за интерфейсами. `USE_FAKE_TELEGRAM=true` подставляет `FakeTelegramClient`, который пишет отправленные сообщения в память и отдаёт их на `/kitchen-sink/telegram`. Разработка идёт без реального токена с первого дня.
- **CI-гейт на PR:** `svelte-check`, `eslint`, `prettier --check`, `vitest run`, `playwright test`, `vite build`, миграции на эфемерном Postgres. Деплоя нет.
- **Деплой на мёрдж в main:** SSH на VPS, pull, `pnpm i --frozen-lockfile`, `pnpm build`, `drizzle-kit migrate`, `systemctl restart wedding`. Caddy терминирует TLS и проксирует на порт приложения.
- **Branch protection** на `main`: только через PR, мёрдж при зелёном CI.

---

## 11. Правила кода

- TypeScript strict, `any` запрещён, `unknown` с последующей валидацией допустим.
- Серверный код только в `lib/server`. Импорт `lib/server` из компонента запрещён.
- Доступ к БД только через `repo.ts` домена. Drizzle-запросы в `+page.server.ts` запрещены.
- Чистая доменная логика отделена от БД и тестируется напрямую, без моков.
- Валидация входа zod на каждой границе: form action, `+server.ts`, хендлер джоба, webhook.
- Svelte 5 runes (`$state`, `$derived`, `$props`). Старый синтаксис сторов в новых компонентах не использовать.
- Никаких строк с текстом в компонентах, всё из контент-конфига.
- Секреты не логируются. `botToken` и `telegramChatId` не покидают сервер.
- Ошибки пользователю: человеческий текст, без стектрейсов.

### Конвенция коммитов, PR и комментариев

- Язык всего технического текста: английский. Коммиты, заголовки и тела PR, комментарии в коде.
- Формат коммита всегда Conventional Commits: `type(scope): summary`. `type` из набора `feat|fix|test|refactor|chore|docs`. `summary` в императиве, со строчной буквы, без точки в конце, до 50 символов. Тело только если нужно объяснить почему, не что.
- Сессия коммитит сама по ходу работы, маленькими логическими коммитами после каждого осмысленного шага. Не сваливать всё одним коммитом в конце. Каждый коммит по возможности проходит тайпчек.
- PR: краткий заголовок, в теле что делает слайс, какие контракты и типы затрагивает, чем покрыт тестами.
- Комментарии в коде кратко и по делу, объясняют почему. Не пересказывать очевидный код. Закомментированный код в PR не оставлять.
- Проза без филлеров: активный залог, императив, конкретика, без em-dash.

### Definition of Done

Задача закрыта, когда: `eslint` чист, `svelte-check` чист, `vite build` проходит, тесты по доктрине раздела 9 написаны и зелёные, миграции применяются с нуля, слайс задеплоен на тестовый домен и открыт вручную с телефона.

---

## 12. Чек-лист «скелет готов»

Фичи не начинать, пока каждый пункт не выполнен:

- [ ] CI зелёный на тривиальном PR
- [ ] `layout` публичного сайта и админки в `main`, гард админской зоны работает
- [ ] UI-примитивы из раздела 8 отрендерены на `/kitchen-sink`
- [ ] токены дизайна и шрифты подключены
- [ ] pg-boss запускается и гоняет демо-джоб
- [ ] `FakeTelegramClient` отдаёт сид-данные, приложение стартует без `TELEGRAM_BOT_TOKEN`
- [ ] миграции проходят на эфемерном Postgres в CI с нуля
- [ ] `scripts/seed.ts` наполняет БД всеми кейсами из раздела 10
- [ ] контент-конфиг валидируется при старте, плейсхолдеры на месте
- [ ] эталонная вертикаль `routes/(site)/rsvp` в `main` и задеплоена

---

## 13. Дорожная карта

Каждая задача равна одному вертикальному слайсу и одному PR. Одна задача за раз, сфокусированный дифф, не вываливать всё приложение сразу.

### Стадия 0. Скелет

- **0.1** Репозиторий, SvelteKit, TS strict, eslint, prettier, Tailwind v4, токены, шрифты.
  Приёмка: `pnpm build` проходит, токены применяются, `/kitchen-sink` открывается.
- **0.2** CI-гейт на PR, branch protection, деплой-workflow на VPS, Caddy, systemd.
  Приёмка: тривиальный PR зелёный, мёрдж в `main` выкатывает изменение на домен.
- **0.3** Drizzle-схема из раздела 4, первая миграция, клиент, `scripts/seed.ts`.
  Приёмка: миграции с нуля на эфемерном Postgres, сид создаёт все кейсы.
  Тесты: контрактный на форму сида, инварианты 1 и 2 из раздела 4.
- **0.4** `config.ts`, `.env.example`, pg-boss, интерфейс `TelegramClient` и фейк.
  Приёмка: приложение стартует без реальных секретов, демо-джоб выполняется.
  Тесты: идемпотентность демо-джоба.
- **0.5** UI-примитивы раздела 8, `use:reveal`, `/kitchen-sink`.
  Приёмка: все примитивы отрендерены, `prefers-reduced-motion` отключает анимацию.

### Стадия 1. Публичный сайт

- **1.1** Контент-схема и `wedding.ts` с плейсхолдерами, валидация при старте.
  Тесты: схема отвергает битый конфиг, property-тест на дефолты.
- **1.2** Обложка: фото, имена, дата, `Countdown`, `AudioToggle`.
  Приёмка: LCP первого экрана меньше 2.5 с на мобиле, звук по умолчанию выключен.
- **1.3** Секции мудборда и галереи, scroll-reveal.
- **1.4** Локация: `MapCard` для ЗАГСа и площадки, ссылки на карты.
- **1.5** Тайминг дня из конфига, дресс-код, подарки, контакты.

### Стадия 2. Идентификация гостя

- **2.1** `name-key.ts` и `match.ts`, чистые функции.
  Тесты: property-based на инварианты раздела 6, кейсы `single`, `ambiguous`, `none` на сид-данных.
- **2.2** Роут ввода имени, дизамбигуатор, `guest_sessions`, cookie на 90 дней.
  Приёмка: тёзка получает выбор, а не чужое приглашение. Cookie переживает перезагрузку.
- **2.3** Форма «меня нет в списке», запись в `unknown_requests`, уведомление организатору.
- **2.4** Сегментация: `byAudience` управляет обращением, блоком ЗАГСа и таймингом.
  Приёмка: гость без приглашения в ЗАГС не видит блок ЗАГСа ни на странице, ни в форме.
  Тесты: e2e на три аудитории.

### Стадия 3. RSVP

- **3.1** Форма: приду/не приду, ЗАГС, блюда, напитки, аллергии, трансфер, комментарий, `@username`.
  Тесты: серверные правила из раздела 6, отказ на неизвестный id блюда.
- **3.2** Спутник: блок появляется при `plusOnePolicy = 'allowed'`, создаёт guest-строку и свой RSVP.
  Приёмка: спутник виден в счётчиках меню. Повторная отправка не плодит дублей. Ответ «не приду» удаляет спутника.
  Тесты: инварианты 1 до 3 раздела 4, e2e на пару.
- **3.3** Редактирование ответа до дедлайна, страница благодарности с итогом.
- **3.4** Джоб `rsvp.notify-admin`.
  Тесты: идемпотентность, путь ошибки через фейк.

### Стадия 4. Админка

- **4.1** Пароль из env, подписанная cookie, гард `(admin)`.
- **4.2** Таблица гостей: статус, аудитория, спутник, Telegram, фильтры.
- **4.3** Счётчики: придут, не ответили, разбивка по блюдам и напиткам, ЗАГС, трансфер, аллергии списком.
  Тесты: property-based на агрегацию, спутники учтены.
- **4.4** Экспорт xlsx для площадки, разбор `unknown_requests`.
- **4.5** Страница рассылки: список гостей с готовой ссылкой `t.me/<bot>?start=<token>` и кнопкой копирования.

### Стадия 5. Telegram-бот

- **5.1** Webhook-роут с проверкой секрета, grammY, `/start <token>` привязывает `chat_id`.
  Приёмка: повторный `/start` не создаёт второй привязки. Битый или чужой токен отклоняется.
  Тесты: идемпотентность привязки, контрактный на апдейт.
- **5.2** Команды бота: адрес, тайминг, дресс-код, контакты, «изменить ответ».
- **5.3** Джобы `reminder.schedule` и `reminder.send`, шаблоны под три состояния RSVP.
  Тесты: идемпотентность обоих хендлеров, путь ошибки, проверка что спутникам не пишет.
- **5.4** Подтверждение и смена ответа прямо в боте через ту же `rsvpPayloadSchema`.

### Стадия 6. Прод

- **6.1** Заполнить `wedding.ts` реальными данными, убрать все `TODO`, включить тест на отсутствие плейсхолдеров.
- **6.2** Реальный бот-токен, webhook на проде, `USE_FAKE_TELEGRAM=false`, боевая проверка на себе.
- **6.3** Полировка: мобильные брейкпоинты, Lighthouse, `prefers-reduced-motion`, OG-превью для мессенджеров.
- **6.4** Резервное копирование БД по cron, проверка восстановления.

---

## 14. CONTRACT GAP

Нужного контракта, типа или поля нет в этом файле: СТОП. Не писать код с выдуманным типом. Выдать блок:

```
CONTRACT GAP
Нужно: <что именно>
Зачем: <какая задача блокируется>
Предлагаемая форма: <тип, поле, payload>
Затрагивает: <файлы и слайсы>
```

Дальше работать на локальной заглушке и ждать апдейта `tech.md` с бампом версии. Не редактировать `tech.md` из сессии слайса.
