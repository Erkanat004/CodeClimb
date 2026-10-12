# CODE CLIMB Judge

Отдельный серверный проверяющий сервис для режима соревнования. Он нужен только для `/compete`; тренировка Python/C++ продолжает работать в браузере без Docker.

## Модель запуска

API CODE CLIMB не выполняет код игрока сам. Оно отправляет решение в judge по `JUDGE_URL` с Bearer-токеном `JUDGE_TOKEN`. Judge создаёт одноразовый контейнер без сети и сравнивает вывод с серверными тестами.

Требования к машине judge:

- Linux-сервер, Docker Engine, поддержка memory/pids/cpu limits.
- `runsc` runtime из gVisor, зарегистрированный в Docker как `runsc`.
- Judge доступен только из приватной сети API, не из интернета. Для удалённого подключения API требует HTTPS с проверяемым сертификатом; альтернатива — локальный туннель на `127.0.0.1`.
- `JUDGE_TOKEN` и `JUDGE_CASE_SECRET` не короче 32 символов.

## Образ

```sh
docker build -f judge/Dockerfile -t code-climb-judge-runner:1 .
docker image inspect code-climb-judge-runner:1 --format '{{.Id}}'
```

В `JUDGE_IMAGE` указывай immutable digest вида `sha256:...`, а не плавающий tag.

## Запуск сервиса

```sh
JUDGE_TOKEN=случайная_строка_32+
JUDGE_CASE_SECRET=другая_случайная_строка_32+
JUDGE_IMAGE=sha256:...
JUDGE_PORT=3100
node judge/index.mjs
```

Перед публичным запуском проверь `/health` через приватный доступ, затем укажи в API:

```dotenv
JUDGE_URL=https://judge-private.example.com
JUDGE_TOKEN=тот_же_секрет
```

Если judge не подключён или health-check не проходит, создание и вход в дуэль будут недоступны. Это намеренно: соревнование не должно откатываться на клиентскую проверку.
