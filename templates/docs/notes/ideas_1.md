  Действительно хорошие идеи (ранжировано, механизм ≠ проза)

  Крон-джевелы (механизм есть):
  1. Единый task-file как resumable-спайн (docs/tasks/<slug>.md): все стадии пишут в именованные секции ОДНОГО файла, Status-заголовок = курсор resume (design→planning→executing→reviewing→validating→done). Это
  наш sweep-plan-file/resume, но на весь lifecycle. У нас — отдельные *_CHECKPOINT.md на скилл; у них один эволюционирующий файл-конечный-автомат.
  2. Типизированные short-ID сущности (IV/PC/AS/UK/PH/RK/IF/CK): определены раз, дальше цитируются по ID; в артефакт — ID, в разговор с юзером — разворот в English (у аудита и диалога разные правила сжатия).
  Это наш natural-key/controlled-token, обобщённый на инварианты/интерфейсы/проверки через весь цикл.
  3. Interface-graph wave-планировщик (венец): план объявляет рёбра PH2 IF1→IF3 @ path; executor выводит параллельные волны топосортом только по [blocks]-рёбрам; не-блокирующие потребители строятся параллельно
  против объявленной сигнатуры и сверяются пост-волной wiring-check'ом; плюс boundary-check (дифф каждого коммита ⊆ объявленных @-путей, попарно непересекающихся в волне) и plan-diff/consistency-sweep на
  коммит. Сложнее нашего Tier-1 (мы паралелим по разным docs/<track>/; они — по interface-контрактам + path-ownership).
  4. Goal-gated done + статус validating: у задачи есть наблюдаемый **Goal:** (исход, не «конвертировать датасет»); verified+reviewed ≠ done, пока не подтверждён реальный Goal; uverify Goal-vs-proxy gap
  (локальный smoke ≠ полная валидация — назови, что покрыл proxy и что осталось). Бьёт по «тесты прошли, но не работает».
  5. Адверсариальный uverify (CK1..N): стойка «изменение сломано, докажи»; атаки по классам happy/negative/invariant(IV)/interface(IF); доказательство — в этом же сообщении; red-flag stoplist («линтер
  прошёл»/«агент сказал done» → назад в фазу 1); anti-slacking (нельзя демотировать упавшую проверку в Future Work без scope-строки из Design). Сильнее нашего drift/debt-scan.
  6. job-guardian self-wake poll (самый hard-won артефакт): само-пробуждение через ScheduleWakeup каждые 270с — намеренно чуть меньше 5-мин prompt-cache TTL; «тишина ≠ успех» (читать прогресс —
  шаги/loss/строки, не liveness); crash-gate до долгого poll'а; антипаттерн никогда не gate'ить на grep success-токена (просыпайся по таймеру, читай хвост, решай); contract-file как гейт («нет файла — нет
  запуска»). Прямо релевантно нашей боли этой сессии (timeout не убивает crt, поллеры воюют с harness).
  7. handsoff как КОНТРАКТ (Mode:-заголовок, не флаг): «hands-off убирает вопросы, но НЕ расширяет полномочия»; no-invented-default (никогда не выдумывай значение типа timeout=30 — жёсткий путь или defer); два
  лога ### Hands-off decisions / ### Deferred (needs user input); лестница обратимости (rename-before-delete, stash-not-reset, branch never main).

  Сильные, но попроще:
  8. Модель-тиринг с само-эскалацией: explorer=haiku, researcher/reviewer/summarizer=sonnet, implementer=opus, implementer-sonnet=sonnet для тривиального → при не-тривиальной фазе сам возвращает NEEDS_CONTEXT
  лога ### Hands-off decisions / ### Deferred (needs user input); лестница обратимости (rename-before-delete, stash-not-reset, branch never main).

  Сильные, но попроще:
  8. Модель-тиринг с само-эскалацией: explorer=haiku, researcher/reviewer/summarizer=sonnet, implementer=opus, implementer-sonnet=sonnet для тривиального → при не-тривиальной фазе сам возвращает NEEDS_CONTEXT
  escalate: up:implementer.
  9. Critical-reviewer / fair-dispatcher асимметрия: ревьюеру дают дифф+план+инварианты, но НЕ rationale (независимость = смысл); conf≥80, только Critical/Important; забаненные фразы («You're absolutely
  right»); диспетчер делает restate→verify-vs-codebase→decide со списком легитимного пушбэка. «Conversation bleed» как named-failure (текст, осмысленный только при живой сессии — имена моделей, «added for X
  flow»).
  10. udebug Iron Law + 3-strikes: без root-cause нет фикса; трассировать плохое значение к источнику, чинить у источника; стоп на 3 неудачных фиксах = «это архитектура, обсуди с юзером»; anti-whack-a-mole
  (назови паттерн бага, grep по форме, чини в том же коммите).
  11. Shared includes _principles.md (GPC1–8) / _brevity.md через <required>-директивы; PC логируется ТОЛЬКО чтобы отклониться от GPC. Brevity: «omit, don't fill» (удали «none»-секцию — её отсутствие = сигнал),
  wiring-test (оставь ссылку, если незнакомец может grep-нуть референт; режь conversation-bleed).
  12. Команды-предохранители: /up:step-back (стоп ВСЕ попытки → общий root-cause последних 3-5 фейлов → принципиально другое направление → не продолжай без юзера); /up:try (1 позитивный + 1 адверсариальный
  кейс); summarizer находит свой транскрипт по фразе через jq.

  Как играют вместе

  /up:make — оркестратор (владеет роутингом, не работой). Task-file = единственное передаваемое состояние, Status = курсор resume. Size-classify пропускает стадии для Trivial/Small. udesign (типизир-ID + Goal +
  TDD-решение) → uplan (фазы + interface-graph) → uexecute (wave-dispatch имплементеров, коммит на фазу с boundary/plan-diff/consistency) → uverify (атаки; на break — назад в execute) → ureview (независимый
  reviewer ≥80) → validate Goal (done только при подтверждённом Goal) → finish (юзер выбирает merge/PR). Кросс-каттинг: udebug (на breaks, возвращает в verify), udocument (авто-триггер на doc-edit), handsoff
  (Mode-контракт поверх всех), git-worktrees (изоляция), job-guardian (параллельный само-управляемый lifecycle), TDD (3-гейтовая применимость, записанная в design). Хэндофф между стадиями = типизированные-ID
  артефакты в task-file (design пишет IV/IF → verify потребляет по ID → роутинг читает вердикт → debug возвращает в verify).

  Честные слабости

  - Doc-only: каждая гарантия — промпт, не enforced-код; boundary/wiring/plan-diff «проверки» крутятся внутри агента, билд не падает. Ценность = от послушания модели. (Наш бандл этим выгодно отличается —
  segment.js/sweep-driver.mjs реально детерминированы.)
  - «Дисциплина прозой» без механизма: генерация подходов, leanness «~1 экран на день», scope-flag-роутинг, udocument слабейший (стайл-гайд без terminal-state/роутинга).
  - Interface-graph-спека дублируется в uplan/uexecute (нарушение их же GPC8) и трудночитаема; окупается только на multi-phase.
  - plugin.json v0.3.20 недоописывает поверхность (не объявляет агентов/команды/job-guardian).

  Что стоит забрать в наш op-* (практический выхлоп, ранжировано)

  1. job-guardian → у нас прямо болит долгий мониторинг прогонов. Само-wakeup 270с/cache-TTL + «silence≠success» (читать прогресс) + crash-gate + «не gate'ить на success-grep» — готовый паттерн для harden'а
  driver-loop и долгих model-orchestration.
  2. boundary-check (diff ⊆ owned paths) → в наш sweep Tier-1: сейчас parallel-safety мы утверждаем через разные dirs; они механически проверяют дифф ⊆ объявленных путей пост-коммит. + wiring-check = наш merge.
  Дёшево добавить в sweep-driver.mjs.
  3. Goal-gated done + validating + proxy-gap → расширить наш completion-protocol: «исход-Goal не подтверждён → validating, назови proxy-gap» сильнее, чем «DONE = чекпойнт записан».
  4. handsoff no-invented-default + reversibility-ladder → дополняет наш git-boundary + --apply; ровно там, где мы ловили auto-commit-hazard на --dangerously-skip-permissions.
  5. Adversarial-verify teeth (refute-стойка, «evidence в этом сообщении», anti-demotion, reviewer без rationale) → заточить op-audit/op-drift-check.
  6. Shared _principles.md/_brevity.md → у нас op-* повторяют конвенции (Stack Profile, git-boundary, протокол); вынести в «read this first»-инклуд + brevity-правила для чекпойнтов.
  7. udebug-скилл (Iron Law + 3-strikes + pattern-grep) — у нас debug-скила нет, чистое добавление.
  8. /up:step-back — «стоп все попытки → общий root-cause → другое направление» (релевантно нашим застрявшим прогонам).
