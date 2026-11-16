// EACH TERMINAL RUN STARTS WITH EMPTY CONTEXT
export function emptyContext() {
    return { language: null, country: null, ip: null, summary: '' };
}

// STORE THIS SESSION IN MEMORY, NEVER IN A FILE
export function createHistory({ maximumUnits = 18000, maximumExchanges = 6 } = {}) {
    let messages = [];
    let interruptions = [];
    let rejectedMessages = [];
    let context = emptyContext();
    let trimmed = 0;

    function needsTrimming() {
        let size = JSON.stringify(context).length;
        let exchanges = 0;
        for (const message of messages) {
            for (const part of message.parts) {
                size += part.text.length;
            }
            if (message.role === 'model') {
                exchanges++;
            }
        }
        return size > maximumUnits || exchanges > maximumExchanges;
    }

    function findNextUserMessage() {
        for (let index = 1; index < messages.length; index++) {
            if (messages[index].role === 'user') {
                return index;
            }
        }
        return -1;
    }

    function removeOldFacts() {
        let userText = '';
        for (const message of messages) {
            if (message.role === 'user') {
                userText += message.parts[0].text + '\n';
            }
        }
        for (const name of ['country', 'ip']) {
            const fact = context[name];
            if (fact && !userText.includes(fact.evidence)) {
                context[name] = null;
            }
        }
    }

    // REMOVE OLDEST WHOLE EXCHANGES WHEN HISTORY GETS TOO LARGE
    function trimOldMessages() {
        while (messages.length > 1 && needsTrimming()) {
            const nextUser = findNextUserMessage();
            if (nextUser < 0) {
                break;
            }
            messages.splice(0, nextUser);
            trimmed += nextUser;
        }
        removeOldFacts();
    }

    function addUser(text) {
        messages.push({ role: 'user', parts: [{ text }] });
        trimOldMessages();
    }

    function addModel(response) {
        const text = JSON.stringify(response);
        messages.push({ role: 'model', parts: [{ text }] });
        context = structuredClone(response.context);
        interruptions = [];
        rejectedMessages = [];
        trimOldMessages();
    }

    function addInterrupted(entry) {
        const copy = structuredClone(entry);
        copy.text = copy.text.slice(0, 2000);
        interruptions.push(copy);
        if (interruptions.length > 2) {
            interruptions.shift();
        }
    }

    function clearInterruptions() {
        interruptions = [];
    }

    function snapshot() {
        return structuredClone({ history: messages, interruptions, context, rejectedMessages });
    }

    function takeTrimmedCount() {
        const count = trimmed;
        trimmed = 0;
        return count;
    }

    // A FAILED SUBMISSION MUST NOT BECOME A COMPLETED HISTORY TURN
    function rejectLastUser() {
        const lastMessage = messages.at(-1);
        if (lastMessage && lastMessage.role === 'user') {
            rejectedMessages = [messages.pop()];
        }
    }

    function clear() {
        messages = [];
        interruptions = [];
        rejectedMessages = [];
        context = emptyContext();
        trimmed = 0;
    }

    return {
        addUser,
        addModel,
        addInterrupted,
        clearInterruptions,
        rejectLastUser,
        snapshot,
        takeTrimmedCount,
        clear
    };
}
