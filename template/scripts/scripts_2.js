var App = new Object();

App.shouldStop = false;
App.stopped = false;

const videoElement = document.getElementById("video");
const linkDownload = document.getElementById("link-download");
const buttonRecord = document.getElementById("button-record");
const buttonStop = document.getElementById("button-stop");
const recordSound = true;

var recorder;

buttonStop.style.display = "none";
videoElement.style.display = "none";
linkDownload.style.display = "none";

function startRecord() {
  buttonRecord.disabled = true;
  buttonRecord.style.display = "none";
  buttonStop.style.display = "inline-block";
  videoElement.style.display = "inline-block";
}


const audioRecordConstraints = {
    echoCancellation: true
}

buttonRecord.addEventListener("click", function () {
  recordScreen();
});

buttonStop.addEventListener("click", function () {
    stopRecording();
});

async function stopRecording() {
  buttonStop.style.display = "none";

  await recorder.stopRecording();
  let blob = await recorder.getBlob();

  const filename = "MySuperGame_testrecording_" + Date.now();
  let videoUrl = URL.createObjectURL(blob);
  linkDownload.href = videoUrl;
  linkDownload.download = `${filename || "recording"}.webm`;

  linkDownload.style.display = "inline-block";

  reproduceVideo(videoUrl);


  // Stop tracks, remove the red icon
  recorder.mediaRecorder.getTracks().forEach( track => track.stop() );
}

function reproduceVideo(videoUrl) {
  videoElement.srcObject = null;
  videoElement.src = videoUrl;
  videoElement.load();
  videoElement.onloadeddata = function() {
    console.log("video.onloadeddata()");
    videoElement.controls = true;
    videoElement.play();
  }
}

const handleRecord = function ({stream, mimeType}) {
    startRecord();

    recorder =
      new RecordRTCPromisesHandler(stream, {
        type: 'video',
        mimeType: mimeType
      });

    recorder.startRecording();
};

async function recordScreen() {
  App.shouldStop = false;

  const mimeType = "video/webm;codecs=vp9";
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
