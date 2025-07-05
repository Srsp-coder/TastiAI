import { useState } from "react";
import axios from "axios";
import "./App.css";
import ImageUpload from "./components/ImageUpload";
import AudioRecord from "./components/AudioRecord";
import SendIcon from "@mui/icons-material/Send";
import QueryResponse from "./components/Response";
import MealResponse from "./components/MealResponse";
function App() {
  const [text, setText] = useState("");
  const [response, setResponse] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState(""); // ✅ To retry same prompt
  const [confirmedIngredients, setConfirmedIngredients] = useState([]); // ✅ Stores approved ingredients
  async function queryResponse(promptText = text) {
    try {
      const res = await axios.post("http://localhost:3001/chat", {
        prompt: promptText,
      });
      console.log("🧾 Full Meal Plan Response:", res.data.message);
      setResponse(res.data.message);
      setOriginalPrompt(promptText);
      setText("");
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setResponse(`${err.response.data.error}`);
      } else {
        setResponse("Something went wrong. Try again.");
      }
    }
  }

  const handleTranscription = (text) => {
    if (typeof text === "string") {
      setTranscription(text);
      setText(text);
    }
  };
  const handleUserDecision = (decision, parsedIngredients) => {
    if (decision === "yes") {
      setConfirmedIngredients(parsedIngredients);
      console.log("✅ Stored Ingredients:", parsedIngredients);
    } else if (decision === "no" && originalPrompt) {
      queryResponse(originalPrompt); // 🔁 Retry with same prompt
    }
  };

  return (
    <div>
      {/* <img
        src="public/images/MealGenie.png"
        style={{ height: "80px", width: "70px" }}
      ></img> */}
      <h1
        style={{
          color: "#fff085",
          margin: "0px",
          textShadow: `
      -1px -1px 0 black,
       1px -1px 0 black,
      -1px  1px 0 black,
       1px  1px 0 black
    `,
          fontFamily: '"Space Mono", monospace',
          fontWeight: "700",
          fontStyle: "italic",
          fontSize: "60px",
          padding: "0px",
        }}
      >
        TastiAI
      </h1>
      <div className="ai-query-bot-container">
        <div className="query-input-container">
          <div className="audio-response-container">
            <div className="image-audio-container" style={{}}>
              {/*<ImageUpload onImageSelect={setImageFile} />*/}
              <AudioRecord onTranscriptionReady={handleTranscription} />
            </div>
            <div className="structured-response-container">
              <h3
                style={{
                  textAlign: "left",
                  fontFamily: "'Merienda', cursive",
                  fontOpticalSizing: "auto",
                  fontWeight: "900",
                  fontStyle: "normal",
                }}
              >
                Your Meal Plan:
              </h3>
              <hr
                style={{
                  border: "none",
                  height: "2px",
                  background: "black",
                }}
              ></hr>
              {/* <QueryResponse
          response={response}
          transcription={transcription}
          lang="en-IN"
        /> */}
              <div
                style={{
                  height: "400px",
                  overflowY: "scroll" /* 👈 Always shows vertical scrollbar */,
                  overflowX: "hidden",
                  scrollbarGutter: "stable",
                  padding: "10px",
                }}
                className="meal-response-container"
              >
                <MealResponse
                  response={response}
                  onRegenerate={() => queryResponse(originalPrompt)}
                  onConfirm={(ingredients) =>
                    handleUserDecision("yes", ingredients)
                  }
                />
              </div>
            </div>
          </div>

          <div className="input-submit-container">
            <input
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value.toString())}
              required
              className="query-input-text-containter"
            />
            <SendIcon
              onClick={() => queryResponse()}
              className="query-submit-button"
              sx={{
                fontSize: 40,
                color: "#fff085",
                textShadow: "2px 2px 5px rgba(0, 0, 0, 0.8)",
                filter: "drop-shadow(2px 3px 3px rgba(0, 0, 0, 0.8))",
              }}
              role="button"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
