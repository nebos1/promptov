# Promptov

Turn a rough visual idea into a clear prompt for an AI image generator, right from your terminal.

## Why I made it

Sometimes you know what you want to create, but describing it is the hard part. I made Promptov to help turn those ideas into useful image prompts.

## What it does

- Takes your idea and asks questions when something needs clarification.
- Uses Google's Gemini API to write a complete image prompt.
- Lets you start another idea when the prompt is finished.

Promptov writes prompts—it does not generate images.

## Requirements

- Node.js 24.18.0 or newer
- npm
- An internet connection

Promptov is free to install and use. Google's API limits and any usage charges are separate.

## Limitations

- Text only: Promptov cannot inspect images or open reference links.
- Each message and generated reply is limited to 2,000 text units.
- Each idea allows up to 10 clarification rounds.
- Conversation history sent to Gemini is limited to 30,000 text units. Exceeding the conversation or clarification limit starts a new idea.
- Google's usage limits or high demand may temporarily prevent a response.
- Generated prompts may need adjustments before use.

Length limits use JavaScript's string length. Some symbols count as more than one unit.

## Install

```bash
npm install -g promptov
```

## Set your API key

You can get your own free Google API key from [Google AI Studio](https://aistudio.google.com/apikey).

In PowerShell:

```powershell
$env:API_KEY = "your-api-key"
```

On macOS or Linux:

```bash
export API_KEY="your-api-key"
```

This sets the key for your current terminal session. Run Promptov in the same terminal. You do not need a `.env` file.

## Run

```bash
promptov
```

## Write and send your idea

Type or paste your description. You can use multiple lines.

**Enter adds a new line. To submit, type `/send` on its own line and press Enter.**

Example:

```text
A small wooden cabin beside a lake.
Watercolor style, soft morning light, no people.
/send
```

Wait for Promptov's response.

If it asks a question, write your answer and finish with `/send` again:

```text
Use warm autumn colors.
/send
```

When the final prompt appears, copy it into your image generator. Promptov will then ask for a new idea.

To exit, enter `0` as the first line of a new idea or reply and press Enter. You do not need `/send` to exit this way.

## License

ISC