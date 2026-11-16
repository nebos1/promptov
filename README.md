# Promptov

Turn a rough visual idea into a useful image-generation prompt, right from your terminal.

Describe your idea, answer clarification questions, and refine the result through conversation. Copy the finished prompt into your preferred image-generation tool. Promptov writes text prompts; it does not generate images or inspect uploaded images.

## Requirements

- Node.js 24.18.0 or later and npm.
- An internet connection and an available Promptov service.

## Install and run

```sh
npm install -g @nebos1/promptov
promptov
```

The npm package is the terminal client. It connects to the Promptov service; you do not need to run a separate server or configure an AI API key.

## Write your first prompt

Type or paste an idea. Pressing Enter adds another line. To submit, type `/send` on its own line and press Enter.

```text
A white fox standing in a snowy forest.
Watercolor style, soft morning light, no text.
/send
```

If Promptov asks questions, write your answers and finish with `/send` again. You can also request changes to the subject, colors, style, or composition after receiving a prompt.

## Commands

| Command | Action |
| --- | --- |
| `/send` | Submit your current draft. |
| `/new` | Discard the draft and clear the current conversation. |
| `/exit` | Exit Promptov. |

Use commands on their own line. An unknown command shows the supported commands and keeps your draft.

## Limits and availability

Message length, conversation size, and service capacity are limited. If a message is too long, shorten it. If the conversation is full, use `/new`. During busy periods, requests may wait in a queue.

When a request fails temporarily, the CLI keeps the current session in memory. To retry the last failed submission, enter `/send` again; you can also write a revised draft. Closing the program or using `/new` clears the session.

The service may be temporarily unavailable, and its first response after inactivity can take longer. Keep the terminal open while waiting. If a request times out, try again later. Generated prompts may contain mistakes; review the result before using it.

## Session data

The CLI keeps recent conversation history and a summary in memory. It does not write a local chat-history file. Older exchanges may be removed as the conversation grows.

Your submitted text and relevant session context are sent to the Promptov backend and its AI service to produce a response. This is an online tool, not an offline application.

## Update or uninstall

```sh
npm install -g @nebos1/promptov@latest
npm uninstall -g @nebos1/promptov
```

## Issues

Report problems at [GitHub Issues](https://github.com/nebos1/promptov/issues). Include the error message and your Node.js version. Leave out private conversation text and credentials.

## License

ISC
