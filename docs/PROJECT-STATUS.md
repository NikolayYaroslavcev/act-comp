# PROJECT STATUS — Task Manager

Snapshot date: 2026-08-30. Based on: full audit against `HEAD` `24e0ca6` on branch `main`, working tree with 113 changed files (49 modified, 64 untracked) at time of audit. This snapshot will drift as work continues — see "Важное правило актуализации" at the bottom.

## Source of Truth

- **Оригинальное ТЗ:** [`docs/middle-frontend-test-task-ru (2).md`](middle-frontend-test-task-ru%20%282%29.md) — источник требований. Все статусы ниже сверены против него.
- **Master-plan:** [`docs/plan-testovogo-zadaniya-master-v2.md`](plan-testovogo-zadaniya-master-v2.md) — дополнительный внутренний checklist/план по дням, не источник истины для требований, но полезен для сверки архитектурных решений (например, `/domain`, `useOptimisticMutation`, `notify()`-модуль).
- **Этот файл:** `docs/PROJECT-STATUS.md` — актуальный snapshot состояния реализации для AI-агентов. Обновляется по ходу работы, не переписывается с нуля.

Явно:
- Оригинальное ТЗ — источник требований.
- Master-plan — дополнительный checklist, не заменяет ТЗ при противоречии.
- PROJECT-STATUS.md — живой снимок фактической реализации, обновляемый после каждой завершённой задачи.

---

## Agent Instructions

Правила для всех следующих AI-агентов, работающих в этом репозитории:

1. Перед началом любой задачи обязательно прочитать `docs/PROJECT-STATUS.md` целиком.
2. Не реализовывать заново функциональность со статусом **DONE** без явной причины, указанной пользователем.
3. Для новой задачи сверяться с разделом **FINAL GAP** — это актуальный список того, что действительно осталось.
4. Не считать наличие файлов, экспортов или тестов доказательством **DONE** без проверки реального поведения (цепочка UI → hook → feature → API → domain → repository → persistence). Файл может существовать и быть протестирован изолированно, но не быть подключён (см. пример `ErrorBoundary` ниже).
5. После завершения задачи обновлять в этом файле **только** статусы и пункты FINAL GAP, относящиеся к выполненной задаче — не переписывать остальной документ.
6. Не начинать следующую функциональную задачу самостоятельно без запроса пользователя, даже если FINAL GAP содержит другие открытые пункты.
7. Не создавать git commit, если пользователь явно его не попросил.
8. При обнаружении расхождения между этим документом и фактическим состоянием кода — сначала явно зафиксировать расхождение (например, добавить заметку в соответствующую строку/раздел), прежде чем предпринимать любые действия по его устранению.

---

## Current State

Статусы: **DONE / PARTIAL / MISSING / BROKEN / UNKNOWN**.

### Mandatory (ТЗ, без пометки "опционально")

| Требование | Статус | Где реализовано | Доказательство | Что осталось |
|---|---|---|---|---|
| Экран приветствия (анимация, кнопка входа, session-check redirect, статистика системы) | **DONE** (2026-08-31) | `app/page.tsx`, `widgets/welcome/public-welcome.tsx`, `widgets/welcome/system-stats-summary.tsx`, `features/dashboard/system-stats.ts`; `proxy.ts` matcher исключает `/` | Анонимный `/`: h1 «Добро пожаловать» (fade-in + reduced-motion), CTA `/login`, агрегаты users/tasks без маркетингового подзаголовка. Авторизованный — SSR `redirect("/dashboard")`. Счётчик users = все записи seed (`data.json` включает u3 `guest@example.com`, не только 2 демо-логина из ТЗ). Dashboard greeting — compact stats | — |
| Auth: email/password + realtime-валидация + loading | DONE | `features/auth/login-form.tsx` | `mode: "onTouched"` + zodResolver, `isPending` состояние | — |
| История входов (IP/device/время) | DONE | `widgets/settings/sessions-section.tsx`, `entities/session/*` | список сессий с device/ip/time, loading/empty/error states | — |
| Force logout всех сессий | DONE | `features/auth/logout-all.ts`, `widgets/settings/sessions-section.tsx` | confirm-диалог + API | — |
| "Запомнить меня" | DONE | `login-form.tsx:98-114`, `entities/session/schema.ts` | rememberMe передаётся в createSession | — |
| Dashboard: счётчики по статусам, прогресс-бар, последняя активность, цвет срочности | DONE | `widgets/dashboard/list-card.tsx`, `entities/task/model.ts:countTasksByStatus`, `entities/list/model.ts:calculateListProgress` | — | — |
| Авто-сортировка списков по приоритету (просрочка поднимает приоритет) | DONE | `entities/list/model.ts:calculateListPriority` (+10 при overdue) | — | — |
| Умная архивация 30+ дней | DONE | `entities/list/model.ts:isListArchiveCandidate`, `features/dashboard/archive-candidates.ts` | — | — |
| Фильтр/поиск списков с сохранением настроек | DONE | `entities/saved-filter/*`, scope `lists` | — | — |
| Дедлайн списка + напоминания 5/10/15 мин | DONE | `entities/notification/model.ts` (`deadlineNotifications` для `TaskList`) | подтверждено отдельным аудитом | — |
| CRUD списков (create+шаблон, edit+история, delete+confirm+soft delete/restore 30д, duplicate) | DONE | `features/list/*`, `widgets/dashboard/*-list-dialog.tsx` | — | — |
| Export списка PDF/CSV | DONE | `widgets/list/export-actions.tsx`, `app/api/lists/[id]/export/pdf` | CSV — клиентский (без API, обоснованно), PDF — серверный | — |
| Sharing (read-only/edit) | **BROKEN** | Backend: `features/list/share-list.ts`, `app/api/lists/[id]/share/route.ts` — корректно, owner-only, PATCH проверяет `canEditList` независимо от UI | UI: **нет диалога "поделиться"** ни в одном виджете (grep по `widgets/` не находит вызовов share API); `list-detail.tsx:32-37` только показывает бейдж текущего уровня доступа | Реализовать UI-диалог добавления пользователя + выбора access, иначе фича недоступна конечному пользователю |
| List-view + Kanban с drag&drop | DONE | `widgets/kanban/kanban-board.tsx`, `features/task/use-kanban-board.ts` | drop идёт через тот же `updateTask`, что и обычный PATCH → cascade считается | — |
| Авто-приоритизация (Smart Priority) | DONE | `entities/task/model.ts:calculatePriority` | дедлайн+зависимости+юзер-приоритет+история — все 4 фактора | — |
| Зависимости A→B (топосорт, каскад) | DONE | `entities/task/model.ts: topoSort/detectCycle/getCascadeUpdates` | cycle-check при PATCH (`repository.ts:186-191`), cascade при смене статуса (везде через один и тот же путь) | — |
| Подзадачи + автопересчёт прогресса родителя | DONE | `entities/task/model.ts:calculateParentProgress/computeParentSyncUpdates` | — | — |
| Автогенерация TEST-N с заполнением дыр | DONE | `entities/task/repository.ts:nextTaskCode` | явно ищет наименьший свободный номер | — |
| CRUD задач (rich fields, история, delete+restore, смена статуса) | DONE | `entities/task/*`, `app/api/tasks/*` | — | — |
| Клонирование задачи с модификацией | DONE | `features/task/clone-task.ts`, `use-clone-task.ts` | — | — |
| Комментарии/заметки | DONE | `features/comment/*` | требует edit-доступ к листу | — |
| Поиск по всем полям с highlighting | DONE | `shared/ui/highlighted-text.tsx`, `widgets/list/task-row.tsx` | `<mark>` реально используется | — |
| Сохранённые фильтры — 5 последних | DONE | `entities/saved-filter/repository.ts` (`RECENT_LIMIT = 5`) | + `usedAt` touch-on-apply | — |
| Диапазоны дат/времени/приоритета | DONE | `entities/task/model.ts:TaskFilters/filterTasks` | — | — |
| Таймер: счётчик от создания, персист при перезагрузке | DONE | `entities/task/model.ts` (`applyTimerAction`, calendar-aware), `.local-state/db.json` персистит `timerStartedAt/timerPausedAt` | — | — |
| Расчёт времени с учётом рабочих часов + каскадный пересчёт при смене workDayHours + уведомление | **DONE** (2026-08-31) | Расчёт: `entities/task/working-elapsed.ts`, чистая функция от `workDayHours` — пересчёт всех списков/подзадач происходит сам собой при каждом рендере/запросе, кеша нет. Уведомление: реальное серверное событие через существующую notification-архитектуру — `updateUserSettings` (`entities/user/repository.ts`) при фактическом изменении `workDayHours` пишет `activityLog`-запись (`entityType: "user"`, `action: "work_day_hours_changed"`, `entityId = userId`, `metadata.old/new`); `evaluateNotifications`/`listDueNotificationsForUser` превращают неподтверждённые записи в `DueNotification` (`kind: "work_day_hours_changed"`), gated чекбоксом `workHoursRecalculation`; доставка/ack — тот же polling + `NotificationInbox` + `/api/notifications`, без второго notification-стора | No-op save не создаёт запись (сравнение old/new внутри `updateUserSettings`); reload не создаёт дубликат (ack-ключ = id activity-записи, персистится в `notificationAcks`); другой пользователь не видит чужое изменение (`entityId`/`listActivityForUser` скоуплены по userId, actor всегда из сессии на сервере); toggle off — событие не всплывает. TDD: `entities/user/repository.test.ts`, `entities/notification/model.test.ts`, `entities/notification/schema.test.ts`, `features/notification/list-due-notifications.test.ts`, `app/api/notifications/route.test.ts` (полный path save→GET→ack). Живой browser-smoke: login → Settings → 8→6→7 → toast "Рабочий день изменён" в тёмной теме и на 390px, ack по клику, reload без дубликата — подтверждено | — |
| Notifications 75/90/100% | DONE | `entities/notification/model.ts` (реально считает `elapsedMinutes` из calendar-aware движка), доставка через polling + inbox UI | Integration-тест на уровне API есть (`app/api/notifications/route.test.ts`) | — |
| Продление времени через `%1h%`/`%30m%` в комментарии | **DONE** (2026-08-30), combined `%5h 10m%` **DONE** | `parseTimeExtension` + `applyTaskExtension` + `create-task-comment.ts` | `%Nh%`/`%Nm%` и `%5h 10m%` (310 мин, одна extension-запись); earliest marker; malformed/zero → комментарий без extension | — |
| Аналитика: среднее время похожих задач | DONE | `entities/task/model.ts:createSimilarTaskHistoryProvider`, реально подключена в `task-detail.tsx` (не только в тестах) | — | — |
| Предсказание завершения | DONE | `entities/task/completion-prediction.ts` | использует тот же calendar-aware движок и historyProvider | — |
| Inline editing + автосохранение + realtime-валидация | DONE | `features/task/use-inline-task-edit.ts` | debounce (ручной, 400ms) + optimistic apply + rollback на ошибке | — |
| Версионность с откатом | DONE | `entities/task/model.ts` (`reconstructUpdatableStateBeforeHistoryIndex`, `previewTaskRollback`), `app/api/tasks/[id]/rollback` | permission-проверка есть (`canEditList`) | — |
| Уведомление других пользователей об изменениях | **DONE** (2026-08-31) | `features/task/get-task-change-status.ts`, `app/api/tasks/[id]/changes/route.ts`, `features/task/use-task-change-watch.ts`, `widgets/task/task-detail.tsx` | Реализовано поверх уже существующего Activity Log (не отдельный event-стор): `GET /api/tasks/:id/changes?since=` возвращает `changed`/`actorEmail`/`summary`/`changedFields`, отфильтровав записи по `byUserId !== requester` и permission-модели `getVisibleTask` (owner/shared-read/shared-edit видят, unrelated/revoked/deleted — 404, идентично `GET .../activity`). Открытый Task Detail поллит эндпоинт (RTK Query, 15s, только пока диалог открыт и включена настройка) и показывает баннер с готовым summary (`describeTaskActivity`, переиспользован как есть) + кнопкой «Обновить». `otherUserChanges` — ранее мёртвый тумблер настроек — теперь реально управляет включением поллинга (передаётся `ListDetailPage → ListDetail → TaskList → TaskDetail`). Слияние внешнего снимка (`useInlineTaskEdit.applyExternalTask`) обновляет только поля без несохранённого драфта/незавершённого autosave; кнопка «Обновить» скрыта в режиме полной формы (`TaskEditForm` сбрасывает форму по смене `task` prop — обновление там могло бы затереть ввод). Живой browser-smoke (два реальных логина, admin/user, общий TEST-1) подтвердил: `admin@example.com изменил приоритет: N → M` появляется у user@example.com в течение одного poll-цикла, черновик в другом поле не затирается, баннер читаем на 390px. **Уточнение сталой записи аудита:** предыдущая пометка «grep `BroadcastChannel` — 0 совпадений» была уже неактуальна на момент этой задачи — `BroadcastChannel` используется в `features/notification/use-notifications.ts` для sync вкладок одного браузера (не для межпользовательских уведомлений); эта задача сознательно **не** использует `BroadcastChannel` для межпользовательского случая (он in-browser-only и не помог бы) — транспорт: file-backed Activity Log + polling, permissions: `getVisibleTask`, UI: `Button`/inline-баннер на существующих primitives | — |
| Комментарии, activity log, export задачи PDF/Excel/CSV в модалке | DONE | `widgets/task/task-activity.tsx`, `task-export-actions.tsx`, `app/api/tasks/[id]/export/{pdf,xlsx}` | Права проверены (`getVisibleTask`/`canEditList`), IDOR-защита есть | — |
| Настройки (темы/уведомления/дефолты/раб.день) | DONE | `widgets/settings/*`, `entities/user/schema.ts` | 2 чекбокса в notifications-section — мёртвые (см. выше) | — |
| Clean Architecture, TS strict, error boundaries | **PARTIAL** | `tsc --noEmit` чист. Слои соблюдены (entities/features/widgets), хотя выделенной папки `/domain` из master-plan нет — логика живёт в `entities/*/model.ts` (архитектурно эквивалентно, но не 1:1 с планом) | `ErrorBoundary` компонент существует и покрыт тестом (`shared/ui/ErrorBoundary.tsx`), но **нигде не подключён** — 0 использований в `app/`/`widgets/` | Обернуть хотя бы top-level роуты и Kanban/TaskModal |
| Optimistic updates + rollback | DONE (нестандартно) | Реализовано вручную в каждой фиче (`use-kanban-board.ts`, `use-inline-task-edit.ts`) | Но: `shared/hooks/useOptimisticMutation.ts` и `useDebounce.ts` — **полностью неиспользуемые файлы** (подтверждено `knip`) — задуманный на день 1 общий примитив не прижился, логика задублирована | Либо удалить неиспользуемый generic-хук, либо мигрировать фичи на него |
| Loading states везде | PARTIAL | Большинство виджетов имеют loading/empty/error | Kanban-доска — без loading/empty/error веток; нет `app/**/loading.tsx`/`error.tsx` route-файлов Next.js | Добавить состояния в Kanban, рассмотреть route-level loading/error |
| Responsive | DONE | `sm:`/`md:`/`flex-col` повсеместно; Kanban отдельно продуман под мобильные (`overflow-x-auto` до `md`, фиксированная ширина колонки) | — | — |
| Debounce search/autosave | DONE | Search: `TASK_SEARCH_DEBOUNCE_MS` 350ms в `use-task-filters.ts` (structured filters — Apply). Autosave: `use-inline-task-edit` 400ms | — |
| Lazy loading компонентов | **DONE** (2026-08-30) | `next/dynamic`: KanbanBoard, TaskRollback, TaskExportActions | Comments/activity/attachments/timer/DatePicker не lazy — нужны сразу в открытом UI | — |
| Мемоизация тяжёлых вычислений | **DONE** (2026-08-30) | `useMemo` на filter query, kanban grouping, task-detail priority/prediction; `React.memo(TaskRow)` | Pure domain functions в entities не обёрнуты в React memo | — |

### Technical Requirements (раздел ТЗ "Технологии для использования")

| Требование | Статус | Доказательство |
|---|---|---|
| Next.js 14+ App Router | DONE (фактически Next 16.3.3, App Router) | `package.json`; см. `AGENTS.md` предупреждение "это не тот Next.js, который вы знаете" |
| TypeScript strict | DONE | `tsc --noEmit` — 0 ошибок |
| **Zustand или Redux Toolkit** | **DONE** (2026-08-30) | `zustand` удалён из `package.json` (подтверждено неиспользуемым). Внедрён Redux Toolkit + RTK Query: `shared/store/*`, `shared/api/base-api.ts`, подключено в `app/layout.tsx` через `StoreProvider`. Server-state для Notifications/Comments/Task-update mutation (via `useUpdateTask`) переведён на RTK Query. `tasksApi.getTask` и optimistic cache-patch **удалены 2026-08-30** — query не имел production subscriber, UI Task Detail остаётся prop-driven. Остальной стейт остаётся локальным React state (сознательно, см. FINAL GAP #11 — закрыт) | — |
| Zod | DONE | Повсеместно | — |
| Tailwind + shadcn/ui | DONE | `shared/ui/*` | — |
| Vitest, 30 тестов минимум | DONE, кратно превышено | 2025 тестов | — |
| Next.js API routes | DONE | 29 route-файлов под `app/api/*` | — |

### Submission Requirements (README/deploy/сдача)

| Требование | Статус | Доказательство |
|---|---|---|
| GitHub-репозиторий с детальным README | **CRITICAL MISSING** | `README.md` — это **нетронутый шаблон `create-next-app`**, ноль слов о проекте, тестовых аккаунтах, ограничениях (data.json+Vercel, setTimeout-напоминания только при открытой вкладке, mock IP) |
| Live demo на Vercel/Netlify | UNKNOWN | Не проверяемо изнутри репозитория; ни `vercel.json`, ни ссылки нигде не найдено |
| Seed data (data.json, normalized) | DONE | Подтверждено отдельным аудитом: полностью соответствует Zod-схемам, ни одного отсутствующего поля |
| 30+ unit-тестов | DONE, с большим запасом | 2025 тестов |

### Optional (явно помечено в ТЗ словом "опционально"/"плюс")

**OPTIONAL — уже сделано:**
- Напоминания по дедлайну списка 5/10/15 мин — DONE
- Optimistic updates + rollback — DONE (нестандартно, см. выше)
- Responsive design — DONE

**OPTIONAL — ещё отсутствует:**
- Комбинирование `%5h 10m%` в продлении времени — не может быть сделано, т.к. базовый парсинг вообще не реализован (см. MISSING выше)
- Авто-пауза таймера при неактивности — не подтверждено ни одним агентом как реализованное; нужна точечная проверка `use-task-timer.ts` на idle-detection (не проверялось напрямую)
- Уведомление о превышении запланированного времени — частично покрывается 100%-порогом notifications, отдельного "превышения" не выявлено отдельно от threshold-модели

### Bonus (сформулировано в ТЗ как отдельный опциональный бонус)

**BONUS — уже сделано:**
- Export задачи в PDF/Excel/CSV — DONE, все три формата с проверкой прав

**BONUS — ещё отсутствует:**
- Ничего специфически бонусного, кроме вышеуказанного, не заявлено в ТЗ отдельно от export

---

## Security Audit

Проверено целенаправленно по зонам повышенного риска (параллельная разработка attachments/activity/export/rollback):

| Проверка | Результат |
|---|---|
| IDOR на task/list (GET/PATCH/DELETE) | **Чисто.** Везде `getVisibleTask`/`getVisibleList` → `canViewList`/`canEditList`, единая точка входа |
| attachment ↔ taskId связка (fileId подмена) | **Чисто.** `download-task-attachment.ts:23` и `delete-task-attachment.ts:28` явно проверяют `attachment.taskId === taskId` — нельзя скачать чужой файл, подставив валидный fileId к произвольному taskId |
| Activity/Rollback/Export permissions | **Чисто.** Все проходят через `canViewList`/`canEditList`, включая новые роуты `activity`, `export/pdf`, `export/xlsx`, `rollback` |
| Session revocation consistency (proxy vs API) | **Чисто.** И `proxy.ts`, и `requireAuth.ts` используют одну и ту же `getCurrentSession`, проверяющую `revokedAt` |
| Path traversal в attachments | **Чисто.** Файлы хранятся по `taskId/attachmentId` (server-generated), оригинальное имя файла — только метаданные, не участвует в пути |
| Client-side-only permission (share access) | **Чисто там, где есть API**, но сама share-функциональность недостижима из UI (см. Mandatory → Sharing) |
| userId от клиента / spoofing | Не найдено мест, где `userId` берётся из тела запроса вместо сессии (`requireAuth` везде источник `auth.user.id`) |
| data.json / .local-state secrets | Пароли — хэши, тестовые IP помечены `"(demo)"`. Секретов не найдено |

Существенных находок нет — это одна из самых качественно реализованных частей проекта.

---

## Regression Audit

Фактический запуск на момент аудита (`HEAD` `24e0ca6`):

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | **Чисто**, 0 ошибок |
| `npx next build` | **Успешно**, все 29 API-роутов + 4 страницы скомпилированы, TypeScript-проверка билда прошла |
| `npx vitest run` | **2306/2306 passed** (прогон 2026-08-31, после закрытия FINAL GAP #6). Ранее отмеченный flaky-тест `create-list-dialog.test.tsx` в этом прогоне не проявился — см. FINAL GAP #16, остаётся открытым как известный риск, а не подтверждённый баг этого прогона |
| `npx eslint .` | **Чисто, 0 ошибок** (прогон 2026-08-31) — ранее отмеченные `.local-state/smoke-notifications.{cjs,mjs}` в дереве во время этого прогона отсутствовали |

**Известная проблема (flaky test):** `widgets/dashboard/create-list-dialog.test.tsx` → `"blocks submit for a title over 200 characters"`. Падает только при полном прогоне `npx vitest run`, стабильно проходит в изоляции. Не блокер, но требует внимания перед финальной сдачей — см. FINAL GAP #16.

---

## Data / Persistence Audit

Подтверждено отдельным углублённым разбором:
- `entities/database/schema.ts` валидирует `data.json`/`.local-state/db.json` через `.parse()` (падает при рассинхроне схемы, не пропускает молча) — это осознанный defensive-дизайн.
- Все 13 задач, 5 списков, 3 пользователя в `data.json` содержат полный набор полей текущей схемы — рассинхрона "новое поле добавили, сид не обновили" **не найдено**.
- `.local-state/db.json` — живой, актуальный снэпшот (содержит `attachments`, `notificationAcks` и т.д.), не устаревший артефакт.
- Soft-delete/restore: 30 дней, идентичная логика для задач и списков (`entities/task/model.ts:canRestoreTask`, `entities/list/model.ts:canRestoreList`).
- Сессии: `proxy.ts` и `requireAuth.ts` используют одну и ту же `getCurrentSession`, проверка `revokedAt` консистентна.
- Attachment storage: реальное дисковое хранилище под `.local-state/attachments/<taskId>/<attachmentId>` (переживает рестарт), путь строится по server-generated id, не по имени файла — path traversal risk отсутствует.
- TODO/FIXME/HACK — не найдено ни одного в исходниках.

---

## UI Audit

| Область | Статус | Комментарий |
|---|---|---|
| Диалоги (create/edit/delete list) | DONE | Escape через base-ui, Cancel без побочных эффектов, double-submit guard `disabled={isPending}` везде |
| Kanban: blocked-бейдж | DONE | Визуально отображается (`isTaskBlocked`) |
| Kanban: заблокированную задачу всё ещё можно перетащить | **BROKEN** | `kanban-card.tsx:50-53` проверяет только `canEdit`/`deletedAt`, не `blocked` |
| Kanban: loading/empty/error | **MISSING** | Ни одной из трёх веток нет |
| ErrorBoundary | **MISSING (не подключён)** | Компонент готов и протестирован, но 0 использований в реальном дереве (`app/`, `widgets/`) |
| Route-level loading.tsx/error.tsx | MISSING | Ни одного файла под `app/` |
| Accessibility (aria, highlight, alerts) | DONE | `role="alert"`, `aria-invalid`, `aria-describedby` последовательно применяются |
| Responsive/mobile | DONE | Kanban специально продуман под 390px (horizontal scroll + фиксированная ширина колонки) |

---

## TDD / Test Audit

2025 тестов, из них подтверждено: домен (priority/dependency/timer/rollback) покрыт плотно юнит-тестами; API-роуты — интеграционные тесты через реальные route-хендлеры + fixture DB; UI — RTL.

Отдельно зафиксировано: **`features/notification/use-notifications.test.ts` и `widgets/notification/notification-inbox.test.tsx` мокают `fetch`/хук — это RTL/unit, не сквозной smoke.** Реальный сквозной прогон порогового расчёта существует только на уровне `app/api/notifications/route.test.ts`. Ни один агент/файл не заявлял "real smoke" там, где это не так — явных ложных заявлений о smoke-тестировании не найдено на момент аудита.

---

## Production Readiness

- **README** — критическая проблема, см. Submission Requirements.
- **`login.json`** (0 байт, в корне, untracked, не в `.gitignore`) — похоже на случайный debug-артефакт, не часть функциональности.
- **`.local-state/`** — gitignored корректно, содержит smoke-скрипты/скриншоты/куки от ручного тестирования; не протекает в git, но триггерит `eslint .` (4 ошибки, см. Regression Audit).
- **`docs/`** — было полностью gitignored (осознанно, "internal task docs, not part of the shipped project"); теперь `.gitignore` изменён так, что `docs/PROJECT-STATUS.md` отслеживается, а остальное содержимое `docs/` остаётся ignored.
- Секретов/хардкод-креденшлов в отслеживаемых файлах не найдено.
- Untracked-файлы (64 шт. на момент аудита) — почти все являются реальными новыми фичами (attachments, activity, list CRUD hooks и т.д.), не мусором; единственный подозрительный — `login.json`.

---

## Critical / High / Medium / Low

### CRITICAL
1. **README не написан** (шаблон create-next-app) — нарушает явное требование ТЗ "GitHub-репозиторий с детальным README". — **M**
2. **Sharing UI отсутствует** — бэкенд для read-only/edit доступа готов и защищён, но пользователь физически не может им воспользоваться. — **M**
3. **Live demo** — не подтверждена (нет способа проверить снаружи репо, нет `vercel.json`/ссылки). — **S–M** (зависит от того, был ли деплой вообще произведён)

### HIGH
4. ~~Продление времени через `%Nh Nm%` в комментарии~~ — **ЗАКРЫТО 2026-08-30**: базовая функциональность (`%1h%`/`%30m%`) реализована через TDD, см. FINAL GAP #3. — **~~M~~**
5. ~~Экран приветствия как отдельный pre-auth экран~~ — **ЗАКРЫТО 2026-08-30**
6. `ErrorBoundary` — реализован и покрыт тестом, но нигде не подключён — прямое нарушение технического требования "Error boundaries". — **S**
7. ~~"Уведомление других пользователей об изменениях"~~ — **ЗАКРЫТО 2026-08-31**, см. FINAL GAP #7. ~~Уведомление при смене `workDayHours`~~ — **ЗАКРЫТО 2026-08-31**, см. FINAL GAP #6. — ~~**M**~~ ~~**+ S**~~

### MEDIUM
8. ~~Zustand — заявлен в стеке, физически не используется~~ — **ЗАКРЫТО 2026-08-30**: удалён, заменён на Redux Toolkit + RTK Query (foundation + Notifications/Comments/Task-update). См. FINAL GAP #11.
9. Заблокированную (dependsOn) задачу можно перетащить в Kanban — должна быть недоступна для drag. — **S**
10. Kanban без loading/empty/error состояний. — **S**
11. `eslint .` не проходит из-за debug-скриптов в `.local-state` (не влияет на прод, но `npm run lint` красный). — **S** (добавить eslint ignore для `.local-state`)
12. `shared/hooks/useOptimisticMutation.ts` и `useDebounce.ts` — полностью мёртвый код, каждая фича реализует свой паттерн заново, вопреки замыслу master-plan. — **M** (унификация) или **S** (удалить)
13. Флейковый тест `create-list-dialog.test.tsx` под полным прогоном (проходит в изоляции). — **S**

### LOW
14. `login.json` — пустой файл-артефакт в корне репозитория, не в `.gitignore`. — **S**
15. Lazy loading / мемоизация тяжёлых вычислений — не подтверждены целенаправленной проверкой, статус UNKNOWN, не обязательно проблема, но требует явной проверки перед заявлением "готово". — **S** на саму проверку

---

## DONE

Полный список уже закрытых функциональных блоков (проверено по цепочке UI → hook → feature → API → domain → repository → persistence, не только по наличию файлов):

- Auth: login/logout, sessions, logout-all, remember-me, история входов (IP/device/время)
- List CRUD: create (с шаблоном), edit (с историей), delete (soft delete + confirm), restore (30 дней), duplicate
- Task CRUD: rich fields, история, delete+restore, смена статуса, автогенерация TEST-N с заполнением дыр
- Filters/Search: полнотекстовый поиск с highlighting, структурные фильтры (статус/категория/теги/приоритет/даты)
- Saved/Recent filters: лимит 5, `usedAt` touch-on-apply
- Kanban board: drag&drop идёт через тот же путь обновления, что и обычный PATCH → cascade считается корректно; blocked-бейдж отображается
- Timer: start/pause/resume/stop, персистентность через `.local-state/db.json`, calendar-aware (учёт рабочих часов) расчёт elapsed
- Work-hours calendar-aware elapsed расчёт (сам расчёт, без уведомления при смене настройки — см. PARTIAL)
- Notifications: 75/90/100% порог по времени (реально считает calendar-aware elapsed), дедлайн-напоминания списка 15/10/5
- Settings: темы, дефолты новых задач, рабочий день (кроме двух мёртвых тумблеров уведомлений)
- List export: CSV (клиентский), PDF (серверный)
- Task export: CSV, PDF, Excel — все три с проверкой прав
- Version rollback: реконструкция состояния по history, permission-проверка
- Smart Priority Algorithm: все 4 фактора (дедлайны, зависимости, пользовательский приоритет, история похожих задач), живой historyProvider подключён в реальном UI
- Dependency Resolution: topoSort, detectCycle, getCascadeUpdates — единая точка вызова для Kanban и обычного PATCH
- Completion Prediction: использует тот же calendar-aware движок и historyProvider
- Inline edit + autosave: debounce (ручной) + optimistic update + rollback на ошибке
- Activity Log: с permission-проверкой
- Files/Attachments: upload/download/delete с полной IDOR-защитой (attachment↔taskId проверка)
- Comments: требуют edit-доступ к листу
- Soft delete/restore: списки и задачи, идентичное окно 30 дней
- History: diff-лог полей, отделён от activityLog

**Безопасность:** весь вышеперечисленный функционал проверен на IDOR и permission bypass — находок нет (см. Security Audit).

---

## OPTIONAL

**Уже сделано:**
- Напоминания по дедлайну списка 5/10/15 мин
- Optimistic updates + rollback (реализовано нестандартно — вручную в каждой фиче, а не через общий хук)
- Responsive design

**Осталось:**
- Уведомление о превышении запланированного времени как отдельная от threshold-модели сущность

**Закрыто 2026-08-30:**
- Комбинирование `%5h 10m%`
- Авто-пауза таймера при неактивности (`visibilitychange` hidden + idle 5 мин; не blur)

---

## BONUS

**Уже сделано:**
- Export задачи в PDF/Excel/CSV — все три формата, с проверкой прав

**Осталось:**
- Не выявлено отдельных незакрытых бонусов сверх уже сделанного

---

## FINAL GAP

Конкретный список оставшихся задач. Порядок и нумерация зафиксированы аудитом — не переставлять и не удалять пункты при частичном прогрессе, только помечать что сделано.

| # | Задача | Сложность |
|---|---|---|
| 1 | **README** — написать полноценный README (стек, тестовые аккаунты, как гонять тесты, ограничения data.json/Vercel, setTimeout-напоминания, mock IP) | M |
| 2 | **Sharing UI** — реализовать UI-диалог "Поделиться списком" (add user + read-only/edit) — backend уже готов | M |
| 3 | ~~**`%Nh Nm%` в комментариях**~~ — **ЗАКРЫТО 2026-08-30**: `%Nh%`/`%Nm%` и combined `%5h 10m%` (2026-08-30). `parseTimeExtension` (pure, `entities/task/model.ts`) распознаёт `%Nh%`/`%Nm%` (case-insensitive на букве юнита, первое совпадение в тексте; `%5h 10m%` — один маркер на 310 мин). `applyTaskExtension` (`entities/task/repository.ts`) в одной операции обновляет `estimatedMin`, добавляет запись в `extensions` (`{commentId, addedMin}`), пишет history-запись формата, идентичного `updateTask`, и активность `updated`/`field:estimatedMin` — используется тот же `recordTaskFieldActivity`, что и generic `updateTask`. Интеграция — `features/comment/create-task-comment.ts`: комментарий создаётся всегда (malformed/plain текст не блокируется), extension применяется только при валидном совпадении, только для юзера, уже прошедшего `canEditList` (без новой permission-модели). 39 новых/изменённых тестов (RED→GREEN) в `entities/task/model.test.ts`, `entities/task/repository.test.ts`, `entities/task/activity-recording.test.ts`, `features/comment/create-task-comment.test.ts`. Полный прогон: `vitest run` 2137/2137, `tsc --noEmit` чисто, `eslint` на изменённых файлах чисто, `next build` успешно. `data.json`/`.local-state` не тронуты. | ~~M~~ |
| 4 | **ErrorBoundary** — подключить к top-level роутам и Kanban/TaskModal | S |
| 5 | ~~**Pre-auth welcome screen**~~ — **ЗАКРЫТО 2026-08-30**: `app/page.tsx` + `PublicWelcome`; proxy matcher не матчит `/` | ~~S–M~~ |
| 6 | ~~**workDayHours notification**~~ — **ЗАКРЫТО 2026-08-31**: см. таблицу выше ("Расчёт времени с учётом рабочих часов..."). Реализовано через существующую Activity Log + notification-архитектуру, не отдельный стор. | ~~S~~ |
| 7 | ~~**Уведомления других пользователей об изменениях**~~ — **ЗАКРЫТО 2026-08-31**: реализовано поверх существующего Activity Log (не отдельный event-стор, не `BroadcastChannel` — тот остаётся same-browser-tab-only транспортом для inbox уведомлений). Сервер: `getTaskChangeStatusForUser` (`features/task/get-task-change-status.ts`) + `GET /api/tasks/[id]/changes?since=` — фильтрует Activity Log по `byUserId !== requester` и `at > since`, permission — тот же `getVisibleTask`, что и у `GET .../activity` (owner/shared-read/shared-edit видят; unrelated user/revoked access/deleted task/unknown task — единообразный 404, `userId` только из сессии). Клиент: `useTaskChangeWatch` (RTK Query, 15s poll, включается только пока Task Detail открыт **и** включена настройка `otherUserChanges` — ранее мёртвый тумблер, теперь реально прокинут `ListDetailPage → ListDetail → TaskList → TaskDetail`). UI: баннер в `TaskDetail` с summary от `describeTaskActivity` (переиспользован, не задублирован) + кнопка «Обновить»; кнопка скрыта в режиме полной формы редактирования (`TaskEditForm` ресетится по смене `task` prop — обновление там могло бы стереть незавершённый ввод). Слияние внешнего снимка — новый `useInlineTaskEdit.applyExternalTask`: поля с несохранённым драфтом/незавершённым autosave не трогает, остальные (включая non-inline поля типа `timeSpentMin`/`subtaskIds`) подтягивает. Новые тесты (RED→GREEN): `features/task/get-task-change-status.test.ts` (11, включая owner/shared-read/shared-edit/unrelated/revoked/deleted/actor-исключение/сжатие нескольких изменений в одно), `app/api/tasks/[id]/changes/route.test.ts` (9, auth/permissions/spoofed userId), `features/task/use-task-change-watch.test.ts` (5, поллинг/no-loop/acknowledge), `features/task/use-inline-task-edit.test.ts` (+4, draft/inflight/non-inline-field preservation), `widgets/task/task-detail.test.tsx` (+5, баннер/merge/edit-mode-safety). Полный прогон: `vitest run` 2292/2292, `tsc --noEmit` чисто, `eslint .` чисто, `next build` успешно (новый роут `/api/tasks/[id]/changes` в списке). Live browser-smoke (admin@example.com + user@example.com, общая задача TEST-1, реальный dev-сервер): `admin@example.com изменил приоритет: N → M` появился у второго пользователя в пределах одного poll-цикла, «Обновить» смержил состояние без потери активно вводимого поля, баннер читаем на 390px, ошибок в консоли нет. | ~~M~~ |
| 8 | **Kanban blocked drag** — запретить drag заблокированной (dependsOn) карточки в Kanban | S |
| 9 | **Kanban loading/empty/error** — добавить состояния в Kanban | S |
| 10 | **eslint `.local-state`** — исключить `.local-state/` из `eslint` (`eslint.config.mjs` ignores) | S |
| 11 | ~~**Zustand / documented deviation**~~ — **ЗАКРЫТО 2026-08-30**: Zustand удалён (подтверждено неиспользуемым перед удалением), внедрён Redux Toolkit + RTK Query как единый server-state слой (`shared/store/*`, `shared/api/base-api.ts`, подключён в `app/layout.tsx`). Переведены: Notifications (`features/notification/notifications-api.ts`), Comments (`features/comment/comments-api.ts`), Task update mutation (`features/task/tasks-api.ts` → `useUpdateTask`). **2026-08-30 follow-up:** orphan `getTask` query и `updateTask.onQueryStarted` cache-patch удалены — ни один production consumer не подписывался на `getTask`, UI остаётся на props/`onTaskUpdated`. Публичные интерфейсы `useNotifications`/`useTaskComments`/`useUpdateTask` сохранены без изменений. `resetApiState()` вызывается в `useLogoutAll` для очистки cache между пользователями. Kanban/Inline Edit/Timer/Settings/Export/Rollback/Smart Priority/Completion Prediction/Attachments/Activity Log/Lists-Tasks-CRUD **не тронуты** (сознательно, см. spec `docs/superpowers/specs/2026-08-30-redux-toolkit-rtk-query-foundation-design.md`). Реальный smoke-прогон в браузере (login → open list → open task → add comment → edit+save via TaskEditForm → reload → confirm persisted → logout → login as second user → confirm shared data visible, no cross-user cache leak) — пройден, 0 console errors. Полный `npx vitest run` (2047/2047), `tsc --noEmit` (чисто), `next build` (чисто), `eslint .` (только те же 4 pre-existing ошибки в `.local-state`), `knip` (идентичен baseline) — все зелёные. | ~~S–L~~ |
| 12 | **dead `useOptimisticMutation` / `useDebounce`** — удалить или интегрировать мёртвые хуки | S |
| 13 | **`login.json`** — убрать из корня, проверить причину его появления | S |
| 14 | **deploy** — подтвердить/выполнить деплой на Vercel/Netlify и получить рабочую live-ссылку | S–M |
| 15 | ~~**lazy loading / memoization verification**~~ — **ЗАКРЫТО 2026-08-30**: dynamic Kanban + TaskRollback/TaskExportActions; memo на filter/kanban/task-detail/TaskRow | ~~S~~ |
| 16 | **flaky `create-list-dialog.test.tsx`** — разобраться с флейковым тестом при полном прогоне | S |

---

## Time Estimate

1. **Обязательная разработка, оставшаяся:** пункты 1–9 — реальная функциональная работа ≈ **1.5–2.5 дня** (12–20 часов)
2. **Optional, оставшийся:** комбинирование `%Nh Nm%` покрывается пунктом 3; авто-пауза таймера — отдельная проверка/доработка ≈ **2–4 часа**
3. **Bonus, оставшийся:** не выявлено дополнительного объёма сверх уже сделанного
4. **Часов до "можно сдавать"** (закрыть CRITICAL + HIGH, т.е. пункты 1–7, 14): примерно **14–20 часов**
5. **Часов до "закрыто всё, включая optional+bonus"** (все 16 пунктов FINAL GAP + доп. проверки): примерно **20–28 часов**

---

> Этот файл является живым статусом проекта.
> После завершения каждой задачи агент обязан проверить, какие пункты аудита изменились, и обновить соответствующие статусы/FINAL GAP.
> Агент не должен переписывать историю без необходимости и не должен удалять незакрытые пункты только потому, что они не относятся к текущей задаче.

---

## Update 2026-08-31 (session: HIGH/MEDIUM/SECURITY punch-list closure)

Отдельный внешний аудит (не пронумерованный по FINAL GAP выше, а по собственному списку HIGH/MEDIUM/SECURITY) выявил 12 пунктов, часть из которых противоречила статусам в этом файле — расхождение зафиксировано и проверено по факту (цепочка UI→API→domain), прежде чем действовать, как того требует правило 8 выше.

**Закрыто в этой сессии (TDD, RED→GREEN, тесты добавлены):**
- **#31 dependency blocking** — `updateTask` теперь реально отклоняет переход в `done`, если есть незавершённый блокер (`isTaskBlocked`, уже существовавший, был посчитан, но не проверен). Новый статус `"blocked"` → HTTP 422. `entities/task/repository.ts`, `app/api/tasks/[id]/route.ts`, `.../rollback/route.ts`, клиентские хуки.
- **#64 taskDefaults** — `createTask` игнорировал `user.settings.taskDefaults`; схема `createTaskInputSchema` подставляла хардкод-дефолты (priority 3/category null/estimatedMin 0) до того, как feature-слой успевал их увидеть. Убраны `.default()` на этих трёх полях, `entities/task/repository.ts:createTask` резолвит из `db.users[byUserId].settings.taskDefaults`. **UI create-задачи в приложении не существует вовсе** (только clone) — это не входило в scope тикета, помечено UNVERIFIED для "UI create".
- **#19 urgency цвет** + **#16 overdue count** — новая `calculateListUrgency` (entities/list/model.ts, переиспользует `isTaskOverdue`/`isListDeadlineOverdue`), новое поле `DashboardListSummary.overdueCount`/`urgency`, Badge на `ListCard`. Новый design token `--warning`/`--color-warning` (globals.css, light+dark).
- **#27 duplicate list UI** — backend уже был готов (`canViewList`-only, тестово подтверждено намеренным поведением — shared-read тоже может дублировать; аудит ошибочно предполагал обратное, оставлено как есть). Добавлен `DuplicateListDialog` + `useDuplicateList`.
- **#22 поиск/фильтр списков** — реально отсутствовал (GET `/api/saved-filters?scope=lists` возвращал 400). Добавлены `entities/saved-filter/list-query-schema.ts`, generic dispatch в `entities/saved-filter/repository.ts` по scope, `useListFilters`, `ListFilters`/`ListSavedFiltersPanel` на дашборде.
- **#21 Smart Archive UI** — `isListArchiveCandidate`/`getArchiveCandidates` существовали, но нигде не вызывались. `DashboardListSummary.isArchiveCandidate` + `ArchiveSuggestionBanner` (переиспользует `useDeleteList`, никакой автоматической архивации).
- **#25 list history UI** — `TaskList.history` уже писался (`updateList`/`deleteList`/`restoreList`), но не отображался. `features/list/list-history.ts` + `ListHistoryDialog`.
- **#45 cascade updates** — **решение: persistence не нужна, не добавлена.** `getCascadeUpdates`/`isTaskBlocked`/`calculatePriority` — чистая derived-state логика, уже осознанно не пишущая `recalculatedPriority`/`isBlocked` обратно в БД (см. комментарий в `widgets/task/task-detail.tsx:236`). Добавлен regression-тест, фиксирующий это как контракт.
- **#46 time since creation** — новая `elapsedSinceCreatedMs` (entities/task/model.ts, источник — только `createdAt`) + `TaskAgeCounter` виджет, независим от Timer.
- **#47 timer countdown** — `remainingMs`/`getTimerCountdownTier` (entities/task/model.ts), переиспользуют существующие пороги `TIME_THRESHOLDS=[75,90,100]` (перенесены из `entities/notification/model.ts` во избежание циклического импорта, там же ре-экспортированы). `TaskTimer` показывает countdown вместо count-up при наличии оценки; overrun — не отрицательное число, а отдельная пометка «Просрочено». Заодно закрыт скрытый баг: `TaskTimer` не получал `workDayHours` от `TaskDetail` — теперь прокинут.
- **SECURITY #15** — `GET /api/auth/sessions` возвращал настоящий `session.id` (bearer-credential для cookie `session_id`). Заменён на `deriveSessionDisplayId` (SHA-256, entities/session/dto.ts). `revokeSession`/`POST .../revoke` резолвят display-id → real id, скоуплено на `getSessionsByUserId(userId)` (владелец не может отозвать чужую сессию по чужому display-id). UI не менялся (в проде нет per-session revoke-кнопки — только logout-all, который остался нетронут).

**Полный прогон после изменений:** `vitest run` 2470/2470, `tsc --noEmit` чисто, `eslint .` чисто, `next build` успешно, `knip` — 2 ранее существовавших unused export (`taskChangesApi`, `TASK_CHANGE_POLL_MS`, не относятся к этой сессии), 0 новых.

**Не сделано / вне scope этой сессии:** README, live-деплой, `login.json`, dead `useOptimisticMutation`/`useDebounce`, flaky `create-list-dialog.test.tsx` — см. FINAL GAP выше, эти пункты не входили в переданный список HIGH/MEDIUM/SECURITY.
