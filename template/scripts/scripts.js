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
      stopRecord();
      recordedChunks = [];

      getSeekableBlob(blob, finalBlob)
      // Stop tracks, remove the red icon
      stream.getTracks().forEach( track => track.stop() );
    };

    mediaRecorder.start(200);
};

function finalBlob(blob) {
  const filename = "MySuperGame_testrecording_" + Date.now();
  let videoUrl = URL.createObjectURL(blob);
  linkDownload.href = videoUrl;
  linkDownload.download = `${filename || "recording"}.webm`;

  videoElement.srcObject = null;
  videoElement.src = videoUrl;
  videoElement.load();
  videoElement.onloadeddata = function() {
    console.log("video.onloadeddata()");
    videoElement.controls = true;
    videoElement.play();
  }

  uploadFile(blob);
}

function getSeekableBlob(inputBlob, callback) {
  // EBML.js copyrights goes to: https://github.com/legokichi/ts-ebml
  if (typeof EBML === 'undefined') {
      throw new Error('Please link: https://cdn.webrtc-experiment.com/EBML.js');
  }
  var reader = new EBML.Reader();
  var decoder = new EBML.Decoder();
  var tools = EBML.tools;
  var fileReader = new FileReader();
  fileReader.onload = function(e) {
      var ebmlElms = decoder.decode(this.result);
      ebmlElms.forEach(function(element) {
          reader.read(element);
      });
      reader.stop();
      var refinedMetadataBuf = tools.makeMetadataSeekable(reader.metadatas, reader.duration, reader.cues);
      var body = this.result.slice(reader.metadataSize);
      var newBlob = new Blob([refinedMetadataBuf, body], {
          type: 'video/webm'
      });
      callback(newBlob);
  };
  fileReader.readAsArrayBuffer(inputBlob);
}

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

async function uploadFile(blob) {
  let test_session = { comment: "SUPER GOOD COMMENT", time_in_minutes: 23, video: blob };
  let formData = new FormData();
  formData.append("test_session", test_session);

  try {
    console.log("Start uploading");

    let response =
      await fetch(
        'http://localhost:3000/front/test_sessions',
        {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "multipart/form-data"
          },
          body: formData
        }
      );

    console.log("HTTP response:", response);
    console.log("HTTP response code:", response.status);
  } catch(e) {
    console.log("Huston we have problem...:", e);
  }
}
