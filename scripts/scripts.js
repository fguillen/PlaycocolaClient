var App = new Object();

App.shouldStop = false;
App.stopped = false;

var thoughtsFormIsReady = false;
var uploadIsFinished = false;
var playSessionUUID = null;

const videoElement = document.getElementById("video");
const linkDownload = document.getElementById("link-download");
const buttonRecord = document.getElementById("button-record");
const buttonStop = document.getElementById("button-stop");
const progressBarDiv = document.getElementById("upload-progress");
const playGatheringTitle = document.getElementById("play-gathering-title");
const playGatheringDescription = document.getElementById("play-gathering-description");
const thoughtsFormDiv = document.getElementById("sa-contact-inner");
const thoughtsForm = document.getElementById("thoughts-form");
const thanksDiv = document.getElementById("thanks-div");
const errorDiv = document.getElementById("error-div");

const recordSound = true;

buttonRecord.style.display = "none";
buttonStop.style.display = "none";
videoElement.style.display = "none";
linkDownload.style.display = "none";
progressBarDiv.style.display = "none";
thoughtsFormDiv.style.display = "none";
thanksDiv.style.display = "none";
errorDiv.style.display = "none";


function startRecord() {
  buttonRecord.disabled = true;
  buttonRecord.style.display = "none";
  buttonStop.style.display = "inline-block";
  videoElement.style.display = "inline-block";
}

function stopRecord() {
  buttonStop.style.display = "none";
  progressBarDiv.style.display = "block";
  thoughtsFormDiv.style.display = "block";
}

function uploadFinished(_playSessionUUID) {
  progressBarDiv.style.display = "none";
  thanksDiv.style.display = "block";
  uploadIsFinished = true;
  playSessionUUID = _playSessionUUID;

  if(thoughtsFormIsReady) {
    thoughtsFormSend();
  }
}

function sendingThoughtsFinished() {
  console.log("sendingThoughtsFinished()");
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
  const filename = "MyPlayTestingSession_" + Date.now();
  let videoUrl = URL.createObjectURL(blob);
  linkDownload.href = videoUrl;
  linkDownload.download = `${filename || "recording"}.webm`;
  linkDownload.style.display = "inline-block";

  videoElement.srcObject = null;
  videoElement.src = videoUrl;
  videoElement.load();
  videoElement.onloadeddata = function() {
    console.log("video.onloadeddata()");
    videoElement.controls = true;
    videoElement.stop();
  }

  uploadFile(blob);
}

// From: https://stackoverflow.com/a/43378874/316700
function getParam(param){
  return new URLSearchParams(window.location.search).get(param);
}

function getPlaySessionInfo() {
  const play_gathering_api_url = getParam("play_gathering_api_url");
  const api_token = getParam("api_token");

  axios.request({
    method: "get",
    url: play_gathering_api_url,
    headers: { "Authorization": "Playcocola " + api_token }
  }).then(function(response) {
    showPlaySessionInfo(response.data);
    buttonRecord.style.display = "inline-block";
  }).catch(function (error) {
    const errorMessage = "There was a problem trying to get the information for this Play Session.\n\nPlease try again."
    console.error("On getPlaySessionInfo()", errorMessage);
    showError(errorMessage);
  });
}

function showError(errorMessage) {
  errorDiv.querySelector("#error-message").innerHTML = marked(errorMessage);
  errorDiv.style.display = "block";
}

function closeError() {
  errorDiv.style.display = "none";
}

function makeAllLinksTargetBlank(element) {
  element.querySelectorAll("a").forEach( link => link.setAttribute('target', '_blank') );
}

function showPlaySessionInfo(info) {
  console.log("showPlaySessionInfo", info);
  playGatheringTitle.textContent = info.title;
  playGatheringDescription.innerHTML = marked(info.description);
  makeAllLinksTargetBlank(playGatheringDescription);
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
  const play_gathering_api_url = getParam("play_gathering_api_url");
  const api_token = getParam("api_token");

  let formData = new FormData();
  formData.append("play_session[video]", blob);

  try {
    console.log("Start uploading");

    let response =
      await axios.request({
        method: "post",
        url: play_gathering_api_url + "/play_sessions",
        data: formData,
        headers: { "Authorization": "Playcocola " + api_token },
        onUploadProgress: (p) => {
          console.log("progress: ", p);
          uploadProgressBarUpdate(p.loaded / p.total);
        }
      });

    console.log("HTTP response:", response);
    console.log("HTTP response code:", response.status);
    uploadFinished(response.data.uuid);
  } catch(e) {
    console.log("Huston we have problem...:", e);
  }
}

function uploadProgressBarUpdate(percentage) {
  const bar = progressBarDiv.querySelector(".progress-bar");
  bar.setAttribute("aria-valuenow", percentage * 100);
  bar.style.width = (percentage * 100) + "%";
}

function captureThoughtsFormSubmit() {
  thoughtsForm.addEventListener("submit", event => {
    event.preventDefault();
    thoughtsFormReady();
  });
}

function thoughtsFormReady() {
  thoughtsFormIsReady = true;
  thoughtsFormDiv.style.display = "none";

  if(uploadIsFinished) {
    thoughtsFormSend();
  }
}

async function thoughtsFormSend() {
  const play_gathering_api_url = getParam("play_gathering_api_url");
  const api_token = getParam("api_token");

  let formData = new FormData();
  formData.append("play_session[user_name]", thoughtsForm.querySelector('[name="name"]').value );
  formData.append("play_session[user_email]", thoughtsForm.querySelector('[name="email"]').value );
  formData.append("play_session[user_comment]", thoughtsForm.querySelector('[name="comment"]').value );

  try {
    console.log("Start sending thoughts");

    let response =
      await axios.request({
        method: "put",
        url: play_gathering_api_url + "/play_sessions/" + playSessionUUID,
        data: formData,
        headers: { "Authorization": "Playcocola " + api_token }
      });

    console.log("HTTP response:", response);
    console.log("HTTP response code:", response.status);
    sendingThoughtsFinished();
  } catch(e) {
    console.log("Huston we have problem...:", e);
  }
}

function refreshPage() {
  location.reload();
}


// Start
uploadProgressBarUpdate(0);
getPlaySessionInfo();
captureThoughtsFormSubmit();
