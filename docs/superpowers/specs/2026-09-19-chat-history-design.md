# Chat history with topic-label titles (#45)

Chat tab is a history list on the same iOS `default` session. Titles are short topic labels a senior can scan. The current thread is first. Threads only split when Maria starts a new chat. Seeded past chats also fill Tasks and caretaker activity.

## Decisions

| Topic | Choice |
|---|---|
| Page shape | List + thread. Chat tab is the list; tap a row to open the thread with the same title as the header |
| Sort | Newest / current first |
| Split rule | Explicit **New chat** only |
| Title | Topic label from intent: **Doctor ride**, **Ride**, **Medication reminder**, **Hospital visit**, **New chat** |
| Seeds | Hospital visit, Lisinopril reminder, doctor ride — same session as caretaker Overview and Tasks |
| Store | `conversation.chats` + `activeChatId`; `turns` is the active chat. No second transcript store |

## Architecture

```text
GET /sessions/default
        ↓
conversation.chats (hospital, reminder, ride)
        ↓
  ┌─────┴──────┐
  Chat list    Tasks + caretaker activity
  (newest first)
        ↓
  tap row / New chat
        ↓
  SeniorChatScreen + POST /conversation/turn?chatId=
```

## Helpers

`packages/shared/src/conversation.ts`: `chatTitleForIntent`, `chatsNewestFirst`, `startNewChat`, `ensureActiveChat`, `selectChat`, `allConversationTurns`.

`POST /conversation/chats` starts or selects a thread. `POST /conversation/turn` optional `chatId` selects before recording.

## Seed

Oldest first in the array; list sorts by last turn:

1. Hospital visit — St. Mary's, Thursday at 10:00 AM → Tasks
2. Medication reminder — Lisinopril every 4 days → Tasks
3. Doctor ride — wheelchair Uber `UBER-WAV-SEED` → current chat
