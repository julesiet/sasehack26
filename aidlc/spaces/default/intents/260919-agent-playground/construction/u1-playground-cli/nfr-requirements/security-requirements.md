# Security Requirements — U1: PlaygroundCli

No new security surface. The CLI runs locally, talks only to the
already-running local API over HTTP, and introduces no new
authentication/authorization model — it reuses the existing seeded demo
actor and the existing, unchanged policy engine. No secrets are introduced
(the CLI needs no API keys of its own; the existing API's env-based config
is unchanged). Existing project Forbidden rule applies unchanged: never let
a tool execute without going through `evaluateToolCall`; this unit doesn't
touch tool execution at all, only formats requests/responses around it.
