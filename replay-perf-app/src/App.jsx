import "./App.css";
import { useState, useEffect } from "react";
import { record } from "rrweb";

let events = [];

// this function will send events to the backend and reset the events array
function save() {
  console.log("saving events: ", events.length);
  const body = JSON.stringify({ events });
  events = [];
}

// save events every 10 seconds
setInterval(save, 10 * 1000);

const INCREMENT = 1000;

function App() {
  const [clicked, setClicked] = useState(false);
  const [items, setItems] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const replayParam = params.get("replay");
  const listSizeParam = params.get("listSize");
  const listSizeNum = parseInt(listSizeParam, 10) || 0;

  useEffect(() => {
    console.log("recording is:", replayParam);
    if (replayParam !== "on") {
      return;
    }
    let stop = record({
      emit(event) {
        events.push(event);
      },
    });
    return () => {
      console.log("unmounting recorder.")
      stop();
    }
  }, [replayParam, listSizeParam])


  useEffect(() => {
    setItems([...Array(listSizeNum).keys()].map((i) => i.toString()));
  }, [listSizeNum, setItems])

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        backgroundColor: "red",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <p style={{color: "white"}}>
        Replay: {replayParam}
      </p>
      <p style={{color: "white"}}>
        List Size: {listSizeNum}
      </p>
      <button id="list-button" style={{ width: 100 }} onClick={() => setClicked((t) => !t)}>
        {"List"}
      </button>
      {clicked && (
        <div
          style={{
            height: "200px",
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
            backgroundColor: "black",
            gap: 10,
          }}
        >
          {items.map((i) => (
            <div style={{ height: 100, backgroundColor: "blue" }} key={i}>
              {i}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
