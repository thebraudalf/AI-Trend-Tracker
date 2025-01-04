// Note: Replace **<YOUR_APPLICATION_TOKEN>** with your actual Application token

require("dotenv").config();
const fs = require("fs");

class LangflowClient {
    constructor(baseURL, applicationToken) {
        this.baseURL = baseURL;
        this.applicationToken = applicationToken;
    }
    async post(endpoint, body, headers = {"Content-Type": "application/json"}) {
        headers["Authorization"] = `Bearer ${this.applicationToken}`;
        headers["Content-Type"] = "application/json";
        const url = `${this.baseURL}${endpoint}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });

            const responseMessage = await response.json();
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText} - ${JSON.stringify(responseMessage)}`);
            }
            return responseMessage;
        } catch (error) {
            console.error('Request Error:', error.message);
            throw error;
        }
    }

    async initiateSession(flowId, langflowId, inputValue, inputType = 'chat', outputType = 'chat', stream = false, tweaks = {}) {
        const endpoint = `/lf/${langflowId}/api/v1/run/${flowId}?stream=${stream}`;
        return this.post(endpoint, { input_value: inputValue, input_type: inputType, output_type: outputType, tweaks: tweaks });
    }

    handleStream(streamUrl, onUpdate, onClose, onError) {
        const eventSource = new EventSource(streamUrl);

        eventSource.onmessage = event => {
            const data = JSON.parse(event.data);
            onUpdate(data);
        };

        eventSource.onerror = event => {
            console.error('Stream Error:', event);
            onError(event);
            eventSource.close();
        };

        eventSource.addEventListener("close", () => {
            onClose('Stream closed');
            eventSource.close();
        });

        return eventSource;
    }

    async runFlow(flowIdOrName, langflowId, inputValue, inputType = 'chat', outputType = 'chat', tweaks = {}, stream = false, onUpdate, onClose, onError) {
        try {
            const initResponse = await this.initiateSession(flowIdOrName, langflowId, inputValue, inputType, outputType, stream, tweaks);
            console.log('Init Response:', initResponse);
            if (stream && initResponse && initResponse.outputs && initResponse.outputs[0].outputs[0].artifacts.stream_url) {
                const streamUrl = initResponse.outputs[0].outputs[0].artifacts.stream_url;
                console.log(`Streaming from: ${streamUrl}`);
                this.handleStream(streamUrl, onUpdate, onClose, onError);
            }
            return initResponse;
        } catch (error) {
            console.error('Error running flow:', error);
            onError('Error initiating session');
        }
    }
}

async function main(inputValue, inputType = 'chat', outputType = 'chat', stream = false) {
    const flowIdOrName = 'da1a232a-c8bc-428f-9545-6c7816e73abe';
    const langflowId = 'd0968e29-4ecc-447d-8780-343e720f1cde';
    const applicationToken = process.env.YOUR_APPLICATION_TOKEN;
    const langflowClient = new LangflowClient('https://api.langflow.astra.datastax.com',
        applicationToken);

    try {
      const tweaks = {
  "ChatInput-XPaM0": {},
  "ChatOutput-7pejO": {},
  "Prompt-K3ADF": {},
  "AstraDB-u07rO": {},
  "GroqModel-4BsNY": {},
  "ParseData-aRS5h": {},
  "GroqModel-PlJiS": {},
  "Prompt-2tEnI": {},
  "File-ZKfzo": {},
  "SplitText-8e5H4": {},
  "AstraDB-AC7xt": {},
  "HuggingFaceInferenceAPIEmbeddings-5txe1": {},
  "HuggingFaceInferenceAPIEmbeddings-hfaHZ": {}
};
      response = await langflowClient.runFlow(
          flowIdOrName,
          langflowId,
          inputValue,
          inputType,
          outputType,
          tweaks,
          stream,
          (data) => fs.appendFileSync("output.md", `Received: ${data.chunk}\n`), // onUpdate
          (message) => fs.appendFileSync("output.md", `Stream Closed: ${message}\n`), // onClose
          (error) => fs.appendFileSync("output.md", `Stream Error: ${error}\n`) // onError
      );
      if (!stream && response && response.outputs) {
          const flowOutputs = response.outputs[0];
          const firstComponentOutputs = flowOutputs.outputs[0];
          const output = firstComponentOutputs.outputs.message;

          fs.writeFileSync("output.md", `Final Output: ${output.message.text}\n`);
      }
    } catch (error) {
      fs.writeFileSync("output.md", `Main Error: ${error.message}\n`);
    }
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Please run the file with the message as an argument: node <YOUR_FILE_NAME>.js "user_message"');
}
main(
  args[0], // inputValue
  args[1], // inputType
  args[2], // outputType
  args[3] === 'true' // stream
);