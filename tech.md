# tech.md

**Версия ядра: v8**

Changelog:

- v1: первичная фиксация. Стек, схема БД, контракты очереди, общие типы, контент-конфиг, UI-примитивы, роадмап слайсов.
- v2: деплой под VPS, общий с живым VPN. Сборка в CI вместо сборки на сервере, Caddy на порту 2096 за Cloudflare, PostgreSQL в Docker на loopback, отдельный пользователь `deploy`. Разделы 1, 2, 10.
- v3: интерфейс `TelegramClient` и `TelegramError`, временный топик `demo.ping`, таблица `job_receipts` для идемпотентности хендлеров без своей таблицы-факта, исправлен ретрай `reminder.send`. Разделы 3, 4, 5, 6, 10.
- v4: UI-подписи примитивов приходят пропсами из блока `content.ui`, тип `PluralForms`, уточнены пропсы `Reveal`, `Countdown`, `Collage`, `MapCard`, `AudioToggle`, `Field` и проброс HTML-атрибутов у контролов. Разделы 6, 7, 8.
- v5: дизайн публичного сайта «конверт с открыткой» для Кыз Узату в Астрахани. Полная схема контента с форматами и дефолтами, `event.utcOffset`, блоки `envelope`, `cover`, `invitation`, `sections`, `registry: null`, парсинг контента на сервере и передача через `load`. Палитра токенов олива, бордо, крем, `--font-body` на Cormorant Garamond. Правила конверта. Роадмап стадии 1 без мудборда, галереи, тайминга, подарков и контактов на сайте. ЗАГС в БД и RSVP не меняются. Разделы 3, 7, 8, 13.
- v6: идентификация гостя. Блоки контента `entry` и `unknown`, поле `byAudience.*.label` для подсказки тёзкам. Топик `unknown.notify-admin` и схема `unknownNotifyAdminJobSchema`. Правила сессии гостя, выбора тёзки и видимости блока ЗАГСа, `guests/segment.ts`. Разделы 3, 5, 6, 7.
- v7: ответ гостя. Блоки контента `rsvp` и `thanks`. Payload `rsvp.notify-admin` получил `updatedAt`, схема `rsvpNotifyAdminJobSchema`. Правила дедлайна, ответа «не приду», трансфера, `menu.multiSelect`, `telegramUsername`, спутника и сериализации записи. Разделы 5, 6, 7.
- v8: открытая регистрация вместо сверки со списком. Гость по общей ссылке вводит имя и фамилию, система создаёт party и гостя с группой `friends` и разрешённым спутником, при совпадении имени предлагает войти в найденную карточку. Удалены форма «меня нет в списке», таблица `unknown_requests`, топик `unknown.notify-admin`, блок контента `unknown`. Блок `entry` переписан под регистрацию. Ссылку на бота гость получает на `/thanks`, страница рассылки 4.5 отменена. Админка удаляет дубли и меняет группу. Разделы 1, 3, 4, 5, 6, 7, 11, 13.

Правила изменения файла: только append-only, любое изменение контракта (схема БД, типы в `lib/types`, payload джоба, схема контента) бампает версию и добавляет строку в changelog. Сессия не правит этот файл самостоятельно: при нехватке контракта выдаёт блок `CONTRACT GAP` и ждёт решения.

---

## 1. Проект

Сайт-приглашение на свадьбу с персонализацией по гостю и Telegram-бот, который напоминает о подтверждении.

Задачи, которые решает система:

1. Показать гостю приглашение, сегментированное под его группу (родственники, друзья, коллеги).
2. Собрать RSVP: придёт или нет, ЗАГС, блюдо, напитки, аллергии, спутник.
3. Дать гостю самому заявить спутника (+1) так, чтобы спутник попал в счётчики меню и в выгрузку для площадки.
4. Напомнить о подтверждении за 30 и за 7 дней до даты через Telegram.
5. Дать организатору админку: список гостей, статусы, счётчики блюд, экспорт в xlsx, удаление дублей и смена группы.

Аудитория: около 40 до 80 гостей, преимущественно мобильный трафик, разовая нагрузка. Оптимизировать под читаемость и скорость первого экрана, не под масштаб.

### Принятые решения (не пересматривать без бампа версии)

| Решение | Выбор |
| --- | --- |
| Вход гостя | Одна общая ссылка, гость регистрируется по имени и фамилии. Заранее составленного списка нет, организатор разбирает зарегистрированных в админке |
| Спутник (+1) | Гость сам указывает спутника, если политика его группы это разрешает |
| Привязка Telegram | Гость сам открывает персональную ссылку `t.me/<bot>?start=<token>` с `/thanks`. `@username` в форме остаётся контактом для организатора. Дальше бот работает автоматически |
| Админка | Веб-админка со счётчиками, экспортом, удалением дублей и сменой группы гостя |
| Напоминания | За 30 и за 7 дней до даты свадьбы |
| Хостинг | Свой VPS (общий с VPN), Cloudflare, Caddy, systemd, автодеплой из `main` со сборкой в CI |

### Ограничение Telegram

Bot API не позволяет боту написать первым пользователю по `@username`. Пользователь обязан нажать Start. Поэтому привязка `chat_id` идёт через персональный deep-link с одноразовым токеном, который гость получает на странице `/thanks`. Все дальнейшие напоминания уходят автоматически. Не проектировать логику, которая предполагает отправку сообщения гостю без `telegram_chat_id`.

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
- Инфраструктура: Cloudflare (публичный TLS), Caddy (reverse proxy), systemd, Docker только для PostgreSQL, GitHub Actions

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
      content.ts             # getContent(): контент, распарсенный один раз при старте
      db/
        schema.ts            # Drizzle schema, источник истины по БД
        index.ts             # клиент
      guests/
        name-key.ts          # нормализация имени, чистая функция
        match.ts             # сопоставление имени с зарегистрированными гостями, чистая функция
        entry.ts             # вход и регистрация по имени поверх match и repo
        session.ts           # cookie-сессия гостя
        segment.ts           # что гость видит по аудитории и приглашению в ЗАГС, чистая функция
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
          demo-ping.ts         # временный топик скелета, раздел 5
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
      +layout.server.ts      # отдаёт ContentData в load
      i/                     # приглашение: конверт, открытка, секции, локальные компоненты
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

// Семья или пара. Создаётся регистрацией гостя (раздел 6), группу и политики меняет организатор в админке.
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

export const guestSessions = pgTable('guest_sessions', {
  id: text('id').primaryKey(),                      // случайный токен из cookie
  guestId: uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// Квитанция выполненного эффекта джоба. Ключ `<topic>:<singletonKey>`, см. раздел 5.
export const jobReceipts = pgTable('job_receipts', {
  key: text('key').primaryKey(),
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
- Хендлер первым делом забирает строку в `reminders` со статусом `sent`: `INSERT ... ON CONFLICT (guest_id, stage) DO UPDATE SET status = 'sent', error = null WHERE reminders.status = 'failed' RETURNING id`. Ноль строк означает, что напоминание уже отправлено или отправляется: хендлер выходит успешно, не отправляя сообщение. Строка со статусом `failed` забирается повторно, поэтому ретрай доходит до отправки.
- Текст зависит от состояния RSVP на момент отправки: нет ответа, ответ `yes`, ответ `no`. Шаблоны в `telegram/templates.ts`.
- Ошибка Telegram API пишется в `reminders.error`, статус `failed`. `TelegramError` вида `server` и `timeout` отправляет джоб в ретрай, вид `rejected` завершает джоб без ретрая.

Тест идемпотентности обязателен: прогнать хендлер дважды с одним payload, проверить ровно одну отправку в фейковом клиенте.

### `rsvp.notify-admin`

```ts
type RsvpNotifyAdminJob = { guestId: string; kind: 'created' | 'updated'; updatedAt: string };  // ISO rsvps.updated_at
```

Отправляет организатору сообщение в Telegram о новом или изменённом ответе. Ставится action формы RSVP после записи, только для гостя, не для спутника.

- `singletonKey = `${guestId}:${kind}:${updatedAt}``, `retryLimit: 3`, `retryBackoff: true`.
- Идемпотентность через квитанцию `rsvp.notify-admin:<singletonKey>`.
- Текст из `telegram/templates.ts`: имя гостя, ответ, ЗАГС, блюда и напитки подписями из `content.menu`, аллергии, трансфер, комментарий, `telegramUsername`, спутник с его блюдами и напитками. Данные берутся из БД на момент отправки.
- Гостя или его RSVP нет в БД: хендлер выходит успешно без отправки. Ошибка очереди или Telegram не отменяет записанный ответ, гость видит успех.

### Квитанции `job_receipts`

`singletonKey` в pg-boss отсекает дубль, только пока первая задача в очереди или выполняется. Хендлер без собственной таблицы-факта держит идемпотентность сам: в одной транзакции вставляет квитанцию с ключом `<topic>:<singletonKey>` через `ON CONFLICT (key) DO NOTHING` и выполняет эффект. Ноль вставленных строк: хендлер выходит успешно без эффекта. Ошибка эффекта откатывает транзакцию вместе с квитанцией, ретрай выполняет эффект заново.

### `demo.ping`

Временный топик скелета (задача 0.4). Удаляется в 5.3 вместе с хендлером и тестами.

```ts
type DemoPingJob = { pingId: string };  // uuid
```

- `singletonKey = pingId`, `retryLimit: 3`, `retryBackoff: true`.
- Отправляет в `TELEGRAM_ADMIN_CHAT_ID` текст из `telegram/templates.ts`.
- Идемпотентность через квитанцию `demo.ping:<pingId>`.

### `TelegramClient`

`lib/server/telegram/client.ts`. Все отправки в Telegram идут только через этот интерфейс.

```ts
export type SendMessageInput = { chatId: number; text: string };
export type SentMessage = { messageId: number };

export interface TelegramClient {
  sendMessage(input: SendMessageInput): Promise<SentMessage>;
}

// server: 5xx и сетевые ошибки, timeout: нет ответа, rejected: 4xx (бот заблокирован, чат не найден)
export type TelegramErrorKind = 'server' | 'timeout' | 'rejected';

export class TelegramError extends Error {
  constructor(readonly kind: TelegramErrorKind, message: string) {
    super(message);
  }
}
```

`FakeTelegramClient` (`fake.ts`) валидирует вход zod (`chatId` целое, `text` от 1 до 4096 символов) и падает на мусоре, хранит отправленные сообщения в памяти, `failNext(kind)` заставляет следующий вызов бросить `TelegramError` этого вида.

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

// Формы слова для 1, 2 и 5: «1 день», «2 дня», «5 дней».
export type PluralForms = [one: string, few: string, many: string];

export type MatchResult =
  | { kind: 'single'; guestId: string }
  | { kind: 'ambiguous'; candidates: { guestId: string; hint: string }[] }
  | { kind: 'none' };

// Payload джобов, см. раздел 5. Хендлер валидирует вход этими схемами.
export const demoPingJobSchema = z.object({ pingId: z.uuid() });
export type DemoPingJob = z.infer<typeof demoPingJobSchema>;

export const rsvpNotifyAdminJobSchema = z.object({
  guestId: z.uuid(),
  kind: z.enum(['created', 'updated']),
  updatedAt: z.iso.datetime({ offset: true })
});
export type RsvpNotifyAdminJob = z.infer<typeof rsvpNotifyAdminJobSchema>;
```

Серверные правила поверх схемы (валидировать в `rsvp/service.ts`, не в zod):

- `companion` отвергается, если `plusOnePolicy = 'none'` или `attending = 'no'`.
- `attendingRegistry` принудительно `false`, если у party нет приглашения в ЗАГС. Проверка идёт через `showsRegistry` из `guests/segment.ts`, тот же признак скрывает поле в форме.
- `mainCourses` и `drinks` проверяются против id из контент-конфига, неизвестный id отвергается.
- `menu.multiSelect = false`: больше одного id в `mainCourses` отвергается, у спутника тоже. Повтор id внутри `mainCourses` или `drinks` отвергается.
- `attending = 'no'`: `attendingRegistry` и `needsTransfer` становятся `false`, `mainCourses` и `drinks` пустыми, `allergies` равно `null`. `comment`, `songRequest` и `telegramUsername` сохраняются.
- `needsTransfer` принудительно `false`, если `content.transfer === null`. Поле трансфера в форме тогда скрыто.
- `telegramUsername`: обрезать пробелы и ведущий `@`, пустая строка становится `null`. Значение пишется в `guests.telegram_username` гостя.

### Ответ гостя

- `/rsvp` и `/thanks` без гостя перенаправляют на `/`. `/i` ведёт на `/rsvp` ссылкой `rsvp.cta`, гостя с ответом на `/thanks` ссылкой `rsvp.ctaAnswered`.
- `load` формы берёт через `rsvp/repo.ts` текущий ответ, `telegramUsername` гостя и спутника (`firstName`, `lastName`, `mainCourses`, `drinks`). `telegramChatId` в браузер не уходит, `botToken` уходит только на `/thanks` в составе ссылки на бота (задача 5.1).
- Приём ответов открыт, пока текущий момент раньше полуночи, которая завершает день `event.rsvpDeadline` по `event.utcOffset`. После дедлайна action отвергает запись, `/rsvp` показывает `rsvp.closed`, гость с ответом попадает на `/thanks`, ссылки `thanks.edit` нет.
- Успешная запись ведёт на `/thanks`: итог ответа гостя и спутника, ссылка `thanks.edit` на `/rsvp` до дедлайна. `/thanks` без ответа ведёт на `/rsvp`.

### Спутник

- `companion` при `attending = 'yes'` создаёт или обновляет единственного спутника гостя: guest в party пригласившего, `isPlusOne = true`, `invitedByGuestId`, `displayName = firstName`, `nameKey` от имени и фамилии, `botToken` из 32 случайных байт в base64url. RSVP спутника: `attending = 'yes'`, его `mainCourses` и `drinks`, остальные поля по умолчанию, `source` как у ответа гостя.
- `companion = null` или `attending = 'no'` удаляет спутника вместе с его RSVP.
- Ответ гостя, спутник и RSVP спутника пишутся в одной транзакции, которая начинается с `SELECT ... FOR UPDATE` строки гостя. Параллельные отправки одного гостя идут по очереди и не создают второго спутника.
- После записи ставится `rsvp.notify-admin`: `kind = 'created'`, если RSVP гостя вставлен этой записью, иначе `'updated'`.

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

`match.ts` сопоставляет ключ с зарегистрированными гостями: сначала точное совпадение, затем токенное с расстоянием Левенштейна не больше 2 на токен. Одно совпадение возвращает `single`, несколько возвращает `ambiguous` с подсказкой (первая буква фамилии или группа), ноль возвращает `none`.

Подпись группы в подсказке берётся из `content.byAudience[audience].label`.

### Вход гостя

- `/` форма регистрации: `firstName` и `lastName`, каждое от 1 до 60 символов после обрезки пробелов. Action выполняет `match` по `${firstName} ${lastName}` среди всех гостей, спутники включены.
- `none`: в одной транзакции создать party и гостя, начать сессию, перейти на `/i`. Party: `title` равен имени и фамилии, `audience = 'friends'`, `plusOnePolicy = 'allowed'`, `invitedToRegistry = false`, `note = null`. Гость: `firstName`, `lastName`, `displayName = firstName`, `nameKey` от имени и фамилии, `isPlusOne = false`, `botToken` из 32 случайных байт в base64url.
- `single` или `ambiguous`: молча гостя не создавать. Показать `entry.knownTitle`, кандидатов с подсказками и вариант `entry.knownNew`. Выбор кандидата отправляет имя, фамилию и `guestId`: action заново выполняет `match` и принимает `guestId`, только если он среди кандидатов для этого имени, затем начинает сессию. `entry.knownNew` создаёт нового гостя как при `none`.
- Совпадение по имени спутника открывает карточку пригласившего (инвариант 5): жена, которую муж уже указал спутником, входит в общую карточку, а не создаёт дубль.
- Принятый риск: кто знает имя гостя и ссылку, откроет его карточку и изменит ответ. Для закрытого круга гостей свадьбы это допустимо, организатор видит изменения через `rsvp.notify-admin`.
- Дубли и посторонние не фильтруются при регистрации. Организатор удаляет их в админке (4.2), вместе с гостем удаляются его спутник, RSVP и сессии.
- Сессия: строка `guest_sessions` со случайным токеном 32 байта (base64url) в `id`, cookie с тем же токеном. `httpOnly`, `sameSite=lax`, `path=/`, `secure` в production, срок 90 дней от входа, без продления. Истёкшая или неизвестная сессия равна отсутствию сессии.
- `hooks.server.ts` кладёт `GuestPublic | null` в `locals.guest`. `/i` без гостя перенаправляет на `/`, `/` с гостем перенаправляет на `/i`.

### Сегментация

`guests/segment.ts`, чистая функция от `GuestPublic` и `ContentData`:

- Обращение: `byAudience[audience].greeting` и `displayName` гостя на открытке.
- Блок ЗАГСа виден, только если `content.registry !== null`, `byAudience[audience].showRegistry` и `invitedToRegistry` у party гостя. Скрытый блок не попадает в данные `load`: ни карточки ЗАГСа, ни времени сбора и церемонии на странице. Форма RSVP (3.1) берёт тот же признак для поля ЗАГСа.
- Тайминг на сайте равен времени сбора и церемонии ЗАГСа в секции «Место» и подчиняется тому же признаку. `timeline` на сайте по-прежнему не выводится.

---

## 7. Контент-конфиг

Весь текст и все данные события лежат в `src/lib/content/wedding.ts` и валидируются `content/schema.ts` при старте приложения. В компонентах нет захардкоженных строк.

Событие: Кыз Узату Алины, проводы невесты от семьи Тулешовых. ЗАГСа в этот день нет, поэтому `registry: null`. Поля ЗАГСа в БД (раздел 4), `rsvpPayloadSchema` и `byAudience.showRegistry` не меняются: при `registry: null` блок ЗАГСа не выводится ни одной аудитории.

```ts
export const content = {
  couple: { bride: 'Алина', groom: 'TODO' },
  hosts: 'Семья Тулешовых',
  event: {
    title: 'Кыз Узату',
    date: '2026-11-28',
    time: '17:00',
    utcOffset: '+04:00',         // Астрахань
    rsvpDeadline: '2026-11-14',  // TODO
    city: 'Астрахань'
  },
  // Закрытый конверт, первый экран.
  envelope: {
    eyebrow: 'Приглашение на Кыз Узату',
    title: 'Алина',
    monogram: 'А',
    open: 'Открыть приглашение'
  },
  // Открытка, которая выезжает из конверта.
  cover: {
    eyebrow: 'Кыз Узату',
    title: 'Алина',
    text: 'С огромной радостью приглашаем вас на наш особенный день',
    photo: { src: '/images/cover.svg', alt: 'TODO' }
  },
  invitation: {
    eyebrow: 'Ждём вас в',
    title: 'Астрахани',
    dateLine: 'в субботу, 28 ноября 2026',
    timeLine: 'начало в 17:00',
    text: 'С огромной радостью приглашаем вас на наш особенный день и разделить с нами эту трогательную и важную дату.'
  },
  registry: null,                // ЗАГС: { title, address, gatherTime, ceremonyTime, mapUrl, photos } либо null
  venue: {                       // банкет
    title: 'Банкетный зал «Европейский»',
    address: 'г. Астрахань, Каспийская улица, 2Б',
    startTime: '17:00',
    endTime: 'TODO',
    mapUrl: 'https://yandex.ru/maps/?text=...',
    photos: []
  },
  timeline: [],                  // для бота (5.2), на сайте не выводится
  dressCode: {
    text: 'TODO',
    palette: [{ hex: '#6e6b3c', name: 'олива' }]  // TODO
  },
  gifts: null,                   // TODO: текст либо null, для бота
  transfer: null,                // TODO: { route, time } либо null
  contacts: [],                  // TODO: для бота
  menu: {
    multiSelect: false,          // TODO: одно блюдо или несколько
    courses: [{ id: 'todo-course', label: 'TODO' }],
    drinks: [{ id: 'todo-drink', label: 'TODO' }]
  },
  music: { enabled: true, src: '/audio/TODO.mp3' },
  // Заголовки и подписи секций страницы приглашения.
  sections: {
    location: {
      eyebrow: 'Место',
      title: 'Где праздник',
      venueStart: 'Сбор гостей в',
      registryGather: 'Сбор в',
      registryCeremony: 'Церемония в'
    },
    dressCode: { eyebrow: 'Дресс-код', title: 'Цвета вечера' },
    farewell: { eyebrow: 'С любовью' }
  },
  // Регистрация и вход по имени на `/`, см. раздел 6.
  entry: {
    eyebrow: 'Приглашение на Кыз Узату',
    title: 'Представьтесь, пожалуйста',
    text: 'Введите имя и фамилию, чтобы открыть приглашение',
    firstNameLabel: 'Имя',
    lastNameLabel: 'Фамилия',
    submit: 'Открыть приглашение',
    firstNameRequired: 'Введите имя',
    lastNameRequired: 'Введите фамилию',
    knownTitle: 'Вы уже открывали приглашение?',
    knownText: 'Нашли похожее имя. Выберите себя, чтобы вернуться к своему ответу',
    knownNew: 'Это не я, открыть новое приглашение',
    failed: 'Не получилось открыть приглашение. Попробуйте ещё раз'
  },
  // Форма ответа на `/rsvp` и ссылка на неё с `/i`, см. раздел 6.
  rsvp: {
    cta: 'Ответить на приглашение',
    ctaAnswered: 'Посмотреть ответ',
    eyebrow: 'Ответ на приглашение',
    title: 'Будете с нами?',
    deadline: 'Просим ответить до 14 ноября',   // TODO: вместе с event.rsvpDeadline
    attendingLabel: 'Ваш ответ',
    attendingYes: 'С радостью приду',
    attendingNo: 'К сожалению, не смогу',
    registryLabel: 'ЗАГС',
    registryOption: 'Буду на церемонии в ЗАГСе',
    coursesLabel: 'Горячее',
    drinksLabel: 'Напитки',
    allergiesLabel: 'Аллергии и ограничения в еде',
    allergiesPlaceholder: 'Например, не ем орехи',
    transferLabel: 'Трансфер',
    transferOption: 'Нужен трансфер',
    companionLabel: 'Спутник',
    companionOption: 'Приду со спутником',
    companionFirstName: 'Имя спутника',
    companionLastName: 'Фамилия спутника',
    companionCourses: 'Горячее для спутника',
    companionDrinks: 'Напитки для спутника',
    commentLabel: 'Комментарий',
    commentPlaceholder: 'Всё, что нам стоит знать',
    telegramLabel: 'Telegram',
    telegramPlaceholder: '@username',
    telegramHint: 'Чтобы мы могли связаться с вами',
    submit: 'Отправить ответ',
    save: 'Сохранить ответ',
    attendingRequired: 'Выберите, придёте ли вы',
    companionNameRequired: 'Укажите имя спутника',
    companionNotAttending: 'Спутника можно добавить, только если вы придёте',
    unknownOption: 'Этого варианта уже нет в меню, выберите заново',
    invalid: 'Проверьте ответ и отправьте ещё раз',
    failed: 'Не получилось сохранить ответ. Попробуйте ещё раз',
    closed: 'Приём ответов завершён. Если планы изменились, свяжитесь с нами'
  },
  // Итог ответа на `/thanks`. Подписи строк итога берутся из `rsvp`.
  thanks: {
    eyebrow: 'Ответ получен',
    titleYes: 'Спасибо, ждём вас!',
    titleNo: 'Спасибо, что ответили',
    summaryTitle: 'Ваш ответ',
    companionTitle: 'Спутник',
    empty: 'не указано',
    edit: 'Изменить ответ',
    back: 'Вернуться к приглашению'
  },
  // Подписи UI-примитивов. Слайс передаёт их примитиву пропсами, см. раздел 8.
  ui: {
    countdown: {
      days: ['день', 'дня', 'дней'],
      hours: ['час', 'часа', 'часов'],
      minutes: ['минута', 'минуты', 'минут'],
      seconds: ['секунда', 'секунды', 'секунд']
    },
    audio: { play: 'Включить музыку', pause: 'Выключить музыку' },
    map: { open: 'Открыть на карте' }
  },
  // Сегментированные тексты. Ключи совпадают с Audience. `label` подсказывает тёзкам группу.
  byAudience: {
    family:     { label: 'родные',  greeting: 'TODO', address: 'ты', showRegistry: true },
    friends:    { label: 'друзья',  greeting: 'TODO', address: 'ты', showRegistry: false },
    colleagues: { label: 'коллеги', greeting: 'TODO', address: 'вы', showRegistry: false }
  }
} satisfies Content;
```

### Схема контента

`content/schema.ts` экспортирует `contentSchema`, `type Content = z.input<typeof contentSchema>` (его проверяет `satisfies` в `wedding.ts`), `type ContentData = z.output<typeof contentSchema>` и `parseContent(raw: unknown): ContentData`. Ошибка парсинга перечисляет пути и сообщения.

- Все объекты строгие: неизвестный ключ отвергается.
- Текстовые поля: непустая строка, `'TODO'` допустим.
- `event.date`, `event.rsvpDeadline`: реальная календарная дата `YYYY-MM-DD`, дедлайн не позже даты события. `event.time`: `HH:MM`. `event.utcOffset`: `±HH:MM`. Эти поля участвуют в вычислениях, литерал `'TODO'` в них недопустим.
- Время только для показа (`registry.gatherTime`, `registry.ceremonyTime`, `venue.startTime`, `venue.endTime`, `transfer.time`): `HH:MM` или `'TODO'`.
- `mapUrl`: абсолютный `https` URL или `'TODO'`.
- Картинки `{ src, alt }`: `src` путь от корня (`/images/...`) или `https` URL, `alt` непустой.
- `dressCode.palette[]`: `{ hex: '#rrggbb'; name: string }`.
- `timeline[]`: `{ time: HH:MM | 'TODO'; title; caption; icon: 'pin' | 'rings' | 'dish' }`.
- `transfer`: `{ route: string; time: string }` либо `null`.
- `contacts[]`: `{ role; name; phone: string | null; telegram: string | null }`, хотя бы одно из `phone` и `telegram` задано. `telegram` это username без `@`.
- `menu.courses[]`, `menu.drinks[]`: `id` в формате slug `[a-z0-9-]+`, без повторов внутри списка.
- `music.src`: путь от корня.
- `ui.countdown.*`: `PluralForms`, три непустые строки.
- `byAudience`: ровно три ключа `Audience`, `address` из `'ты' | 'вы'`, `label` непустой текст.
- `entry`, `rsvp`, `thanks`: все поля непустой текст.

Дефолты, если поле не указано: `registry` → `null`, `registry.photos` и `venue.photos` → `[]`, `timeline` → `[]`, `dressCode.palette` → `[]`, `gifts` → `null`, `transfer` → `null`, `contacts` → `[]`, `menu.multiSelect` → `false`. Property-тест: снятие любого набора полей с дефолтом даёт ровно дефолт и не меняет остальное, `parseContent` идемпотентен на своём выходе.

Время начала события для обратного отсчёта и напоминаний: `${date}T${time}:00${utcOffset}`, чистая функция в `content/event.ts`.

### Доставка контента

`lib/server/content.ts` экспортирует `getContent()`: парсит `wedding.ts` один раз и кэширует. `hooks.server.ts` вызывает его в `init`, битый контент роняет старт. Роуты `(site)` получают `ContentData` через `load` из `(site)/+layout.server.ts`. Компоненты импортируют из `content/schema.ts` только типы, zod в клиентский бандл не попадает.

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
| `Reveal` | `delay?: number` (мс), `y?: number` (px), обёртка над `use:reveal` |
| `Heading` | `level: 1..3`, `script?: boolean` (каллиграфия) |
| `Divider` | `orientation: 'vertical' \| 'horizontal'` |
| `Countdown` | `target: string` (ISO), `labels: { days, hours, minutes, seconds: PluralForms }` |
| `Collage` | `images: { src: string; alt: string; span: 1 \| 2 }[]` |
| `TimelineItem` | `time: string`, `title: string`, `caption: string`, `icon: 'pin' \| 'rings' \| 'dish'` |
| `MapCard` | `title`, `address`, `mapUrl`, `photos: { src: string; alt: string }[]`, `linkLabel: string` |
| `AudioToggle` | `src: string`, `labels: { play: string; pause: string }` |
| `Button` | `variant: 'solid' \| 'ghost'`, `loading?: boolean`, `type` |
| `Field` | `label`, `error?`, `required?`, `children: Snippet<[id: string]>` (контрол получает id для связи с label) |
| `TextInput`, `TextArea` | `value`, `placeholder`, `maxlength` |
| `RadioGroup` | `options: { id, label }[]`, `value` |
| `CheckboxGroup` | `options: { id, label }[]`, `values`, `max?: number` |
| `Toast` | `kind: 'ok' \| 'error'`, `text` |

Примитивы не содержат строк с текстом. Подписи (`labels`, `linkLabel`, тексты кнопок и полей) передаёт вызывающий слайс из `content.ui` и остального контент-конфига. `Button`, `TextInput`, `TextArea`, `RadioGroup`, `CheckboxGroup` пробрасывают стандартные HTML-атрибуты (`name`, `id`, `required`, `disabled`, `aria-*`), чтобы работать в form actions SvelteKit без JS.

Админка берёт `Table`, `Badge`, `Dialog`, `Select`, `Tabs` из shadcn-svelte. Не смешивать: shadcn-компоненты на публичном сайте не использовать, стиль другой.

Токены дизайна в CSS-переменных, `app.css`:

```
--c-ink: #2f2a22; --c-paper: #f4efe4; --c-ivory: #fbf8f0; --c-muted: #7d7662;
--c-olive: #6e6b3c; --c-olive-deep: #4c4a28; --c-wine: #7a1e2c;
--font-display, --font-script, --font-body
--space-section, --radius, --dur-fast, --dur-slow, --ease-out
```

Шрифты: `--font-display` и `--font-body` Cormorant Garamond, `--font-script` Great Vibes. Manrope не используется. Один визуальный мир «бумага и бархат», тёмной темы нет.

### Конверт

Локальный компонент слайса `(site)/i`, не примитив.

- Закрытый конверт на весь экран поверх открытки: оливковый бархат, клапан с кружевным краем, сургучная печать с `envelope.monogram`, тексты из `envelope`. Геометрия на CSS и inline SVG, без растровых картинок, чтобы не ухудшать LCP.
- Открывается по нажатию на печать или кнопку `envelope.open`, с клавиатуры тоже: печать исчезает, клапан откидывается, открытка выезжает, конверт растворяется. Анимация через `motion` и токены `--dur-*`, `--ease-out`.
- Показывается один раз за сессию вкладки (`sessionStorage`). Класс на `<html>` ставит inline-скрипт в `app.html` до отрисовки, повторный заход не мигает конвертом.
- Без JS и при `prefers-reduced-motion: reduce` конверт не показывается, страница начинается с открытки.
- Звук по умолчанию выключен, открытие конверта музыку не включает.

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

При `USE_FAKE_TELEGRAM=true` переменные `TELEGRAM_*` необязательны. Вне `NODE_ENV=production` `SESSION_SECRET` генерируется случайно при старте, `ADMIN_PASSWORD` необязателен. В production оба обязательны.

- **Фейки.** Все внешние клиенты за интерфейсами. `USE_FAKE_TELEGRAM=true` подставляет `FakeTelegramClient`, который пишет отправленные сообщения в память и отдаёт их на `/kitchen-sink/telegram`. Разработка идёт без реального токена с первого дня.
- **CI-гейт на PR:** `svelte-check`, `eslint`, `prettier --check`, `vitest run`, `playwright test`, `vite build`, миграции на эфемерном Postgres. Деплоя нет.
- **Деплой на мёрдж в main:** GitHub Actions выполняет `pnpm build` на раннере и rsync'ом по SSH от пользователя `deploy` отправляет `build/`, `package.json`, `pnpm-lock.yaml`, `drizzle/`, `drizzle.config.ts` в `/srv/wedding/releases/<sha>`. На VPS: `pnpm i --frozen-lockfile`, `drizzle-kit migrate`, переключение симлинка `/srv/wedding/current`, `sudo systemctl restart wedding`, проверка ответа приложения с откатом на предыдущий релиз. Сборки на VPS нет.
- **Сервер общий с VPN.** Порты 80 и 443 заняты VPN и не трогаются. Публичный трафик: Cloudflare (SSL Full) → Origin Rule на порт 2096 → Caddy на хосте с `tls internal` → приложение на `127.0.0.1:3000`. Порт 2096 открыт только диапазонам Cloudflare. PostgreSQL 16 в Docker, опубликован только на `127.0.0.1:5432`. Unit `wedding` ограничен по памяти. Файлы: `deploy/`.
- **Секреты деплоя** в GitHub environment `production`: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`. Прикладные секреты живут только в `/srv/wedding/shared/.env` на сервере.
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
- Секреты не логируются. `telegramChatId` не покидает сервер. `botToken` уходит в браузер только самому гостю в ссылке на бота на `/thanks`.
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

- **1.1** Контент-схема из раздела 7, `wedding.ts` с данными и плейсхолдерами, `getContent()`, валидация при старте.
  Тесты: схема отвергает битый конфиг, property-тест на дефолты.
- **1.2** Открытка на `(site)/i`: палитра токенов, фото в овальной рамке, имя, плашка с датой, текст приглашения, `Countdown`, `AudioToggle`.
  Приёмка: LCP первого экрана меньше 2.5 с на мобиле, звук по умолчанию выключен.
- **1.3** Конверт по разделу 8 и scroll-reveal секций.
  Приёмка: открывается кликом и с клавиатуры, повторный заход в той же вкладке без конверта, без JS и при reduced motion контент виден сразу, LCP по-прежнему меньше 2.5 с.
- **1.4** Место: `MapCard` площадки со ссылкой на карты, `MapCard` ЗАГСа только при `registry !== null`.
- **1.5** Дресс-код с палитрой, подвал с подписью семьи и монограммой.

### Стадия 2. Идентификация гостя

- **2.1** `name-key.ts` и `match.ts`, чистые функции.
  Тесты: property-based на инварианты раздела 6, кейсы `single`, `ambiguous`, `none` на сид-данных.
- **2.2** Роут ввода имени, дизамбигуатор, `guest_sessions`, cookie на 90 дней.
  Приёмка: тёзка получает выбор, а не чужое приглашение. Cookie переживает перезагрузку.
- **2.3** Форма «меня нет в списке», запись в `unknown_requests`, уведомление организатору. Отменена в v8, код удаляет 2.6.
- **2.4** Сегментация: `byAudience` управляет обращением, блоком ЗАГСа и таймингом.
  Приёмка: гость без приглашения в ЗАГС не видит блок ЗАГСа ни на странице, ни в форме.
  Тесты: e2e на три аудитории.
- **2.5** Регистрация на `/` по правилам раздела 6: форма имени и фамилии, создание party и гостя, выбор «это я» или `entry.knownNew` при совпадении, блок контента `entry` v8.
  Приёмка: новый гость попадает на `/i` и отвечает на приглашение. Повторный ввод своего имени предлагает войти в свою карточку и не создаёт дубль. `entry.knownNew` создаёт отдельного гостя. Имя спутника открывает карточку пригласившего.
  Тесты: база на создание party и гостя с дефолтами и откат при ошибке, отказ на `guestId` вне кандидатов, e2e на регистрацию, повторный вход и тёзку.
- **2.6** Удалить «меня нет в списке»: форма, блок контента `unknown`, таблица `unknown_requests` миграцией, топик `unknown.notify-admin` с хендлером и тестами.
  Приёмка: миграции проходят с нуля и поверх v7, приложение стартует без удалённого топика.

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
- **4.2** Таблица гостей: статус, аудитория, спутник, Telegram, фильтры. Удаление гостя (дубли, посторонние), смена группы, политики спутника и приглашения в ЗАГС у party.
- **4.3** Счётчики: придут, не ответили, разбивка по блюдам и напиткам, ЗАГС, трансфер, аллергии списком.
  Тесты: property-based на агрегацию, спутники учтены.
- **4.4** Экспорт xlsx для площадки.
- **4.5** Страница рассылки ссылок на бота. Отменена в v8: ссылку гость получает сам на `/thanks` (5.1).

### Стадия 5. Telegram-бот

- **5.1** Webhook-роут с проверкой секрета, grammY, `/start <token>` привязывает `chat_id`. На `/thanks` кнопка с персональной ссылкой `t.me/<TELEGRAM_BOT_USERNAME>?start=<botToken>`, скрыта у гостя с привязанным `telegramChatId` и без `TELEGRAM_BOT_USERNAME`.
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
