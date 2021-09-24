var App = new Object();

App.shouldStop = false;
App.stopped = false;

const videoElement = document.getElementById("video");
const linkDownload = document.getElementById("link-download");
const buttonRecord = document.getElementById("button-record");
const buttonStop = document.getElementById("button-stop");
const recordSound = true;

buttonStop.style.display = "none";
videoElement.style.display = "none";
linkDownload.style.display = "none";

function startRecord() {
  buttonRecord.disabled = true;
  buttonRecord.style.display = "none";
  buttonStop.style.display = "inline-block";
  videoElement.style.display = "inline-block";
}

function stopRecord() {
  buttonStop.style.display = "none";
  linkDownload.style.display = "inline-block";
}

const audioRecordConstraints = {
    echoCancellation: true
}

buttonRecord.addEventListener("click", function () {
  recordScreen();
});

buttonStop.addEventListener("click", function () {
    App.shouldStop = true;
});

const handleRecord = function ({stream, mimeType}) {
    startRecord()
    let recordedChunks = [];
    App.stopped = false;
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = function (e) {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
        }

        if (App.shouldStop === true && App.stopped === false) {
            mediaRecorder.stop();
            App.stopped = true;
        }
    };

    mediaRecorder.onstop = function () {
      const blob = new Blob(recordedChunks, {
          type: mimeType
      });
      recordedChunks = [];
      const filename = "MySuperGame_testrecording_" + Date.now();
      let videoUrl = URL.createObjectURL(blob);
      linkDownload.href = videoUrl;
      linkDownload.download = `${filename || "recording"}.webm`;
      stopRecord();

      videoElement.srcObject = null;
      videoElement.src = videoUrl;
      videoElement.load();
      videoElement.onloadeddata = function() {
        console.log("video.onloadeddata()");
        videoElement.controls = true;
        videoElement.play();
      }
    };

    mediaRecorder.start(200);
};

async function recordScreen() {
    shouldStop = false;

    const mimeType = "video/webm";
    const constraints = {
      video: {
        cursor: "motion"
      }
    };

    if(!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) {
      return window.alert("Screen Record not supported!")
    }

    const audioContext = new AudioContext();
    const audioDestination = audioContext.createMediaStreamDestination();

    const displayStream = await navigator.mediaDevices.getDisplayMedia({video: {cursor: "motion"}, audio: {"echoCancellation": true}});
    if(displayStream.getAudioTracks().length > 0) {
      const displayAudio = audioContext.createMediaStreamSource(displayStream);
      displayAudio.connect(audioDestination);
    } else {
      console.error("displayStream.getAudioTracks().length is 0");
    }

    if(recordSound){
      const voiceStream = await navigator.mediaDevices.getUserMedia({ audio: {"echoCancellation": true}, video: false });
      const userAudio = audioContext.createMediaStreamSource(voiceStream);
      userAudio.connect(audioDestination);
    }

    const tracks = [...displayStream.getVideoTracks(), ...audioDestination.stream.getTracks()]
    const stream = new MediaStream(tracks);

    handleRecord({stream, mimeType})

    videoElement.srcObject = stream;
}
