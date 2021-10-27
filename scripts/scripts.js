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
const permissionForm = document.getElementById("permission-form");
const permissionScreenBlock = document.getElementById("permission-screen-block");
const permissionMicBlock = document.getElementById("permission-mic-block");
const permissionScreenCheck = document.getElementById("permission-screen-check");
const permissionMicCheck = document.getElementById("permission-mic-check");

var screenStream;
var micStream;
var debugSessionID;


buttonRecord.style.display = "none";
buttonStop.style.display = "none";
videoElement.style.display = "none";
linkDownload.style.display = "none";
progressBarDiv.style.display = "none";
thoughtsFormDiv.style.display = "none";
thanksDiv.style.display = "none";
errorDiv.style.display = "none";
permissionForm.style.display = "none";

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
    sendDebugEvent("buttonStop Clicked");
    App.shouldStop = true;
});

var dataSize = 0;
var lastDataSizeDebugEvent = 0;
const handleRecord = function ({stream, mimeType}) {
    sendDebugEvent("HandleRecord", "ini");
    startRecord();
    let recordedChunks = [];
    App.stopped = false;
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = function (e) {
        console.log("ondataavailable", e.data.size);

        if (e.data.size > 0) {
            recordedChunks.push(e.data);
            dataSize += e.data.size;

            if(dataSize > (lastDataSizeDebugEvent + (10*1024*1024))) { // 10MBs
              sendDebugEvent("FileDataSize", (dataSize / (1024*1024)).toFixed(2)); // MBs
              lastDataSizeDebugEvent = dataSize;
            }
        }

        if (App.shouldStop === true && App.stopped === false) {
            sendDebugEvent("StopRecording");
            mediaRecorder.stop();
            App.stopped = true;
        }
    };

    mediaRecorder.onstop = function () {
      sendDebugEvent("HandleRecord", "end");
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
  sendDebugEvent("FinalBlob", "ini");
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
    // videoElement.stop();
  }

  sendDebugEvent("FinalBlob", "end");
  uploadFile(blob);
}

// From: https://stackoverflow.com/a/43378874/316700
function getParam(param){
  return new URLSearchParams(window.location.search).get(param);
}

function getPlaySessionInfo() {
  sendDebugEvent("GetPlaySessionInfo", "ini");
  const play_gathering_api_url = getParam("play_gathering_api_url");
  const api_token = getParam("api_token");

  axios.request({
    method: "get",
    url: play_gathering_api_url,
    headers: { "Authorization": "Playcocola " + api_token }
  }).then(function(response) {
    showPlaySessionInfo(response.data);
    showPermissionForm();
    sendDebugEvent("GetPlaySessionInfo", "end");
  }).catch(function (error) {
    sendDebugEvent("GetPlaySessionInfo", "error");
    const errorMessage = "There was a problem trying to get the information for this Play Session.\n\nPlease try again."
    console.error("On getPlaySessionInfo()", errorMessage);
    showError(errorMessage);
  });
}

function showError(errorMessage) {
  errorDiv.querySelector("#error-message").innerHTML = marked(errorMessage);
  errorDiv.style.display = "block";
  sendDebugEvent("ShowError", errorMessage);
}

function closeErrorDiv() {
  errorDiv.style.display = "none";
  sendDebugEvent("CloseErrorDiv");
  return false;
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

function showPermissionForm() {
  permissionForm.style.display = "block";
}

function getSeekableBlob(inputBlob, callback) {
  sendDebugEvent("GetSeekableBlob", "ini");
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
      sendDebugEvent("GetSeekableBlob", "end");
      callback(newBlob);
  };
  fileReader.readAsArrayBuffer(inputBlob);
}

async function recordScreen() {
    sendDebugEvent("recordScreen", "ini");
    hidePermissionForm();
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

    if(screenStream.getAudioTracks().length > 0) {
      sendDebugEvent("screenStream.getAudioTracks", "system_sound");
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.1;

      const displayAudio = audioContext.createMediaStreamSource(screenStream);
      displayAudio.connect(gainNode);

      gainNode.connect(audioDestination);
    } else {
      sendDebugEvent("screenStream.getAudioTracks", "no_system_sound");
    }

    if(permissionMicCheck.checked){
      const userAudio = audioContext.createMediaStreamSource(micStream);
      userAudio.connect(audioDestination);
    }

    console.log("audioDestination.stream.getTracks():", audioDestination.stream.getTracks());

    var tracks;

    // if I don't this then the loop mediaRecorder.ondataavailable is never called when mic is not accepted (Mac)
    if(screenStream.getAudioTracks().length > 0 || permissionMicCheck.checked) {
      tracks = [...screenStream.getVideoTracks(), ...audioDestination.stream.getTracks()];
    } else {
      tracks = [...screenStream.getVideoTracks()];
    }

    const stream = new MediaStream(tracks);

    handleRecord({stream, mimeType})

    videoElement.srcObject = stream;
    sendDebugEvent("recordScreen", "end");
}

async function uploadFile(blob) {
  sendDebugEvent("UploadFile", "ini");
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
    sendDebugEvent("UploadFile", "end");
    uploadFinished(response.data.uuid);
  } catch(e) {
    console.log("Huston we have problem...:", e);
  }
}

var lastUploadPercentageDebugEvent = 0;
function uploadProgressBarUpdate(percentage) {
  if(percentage > lastUploadPercentageDebugEvent + 0.1) {
    sendDebugEvent("UploadProgressBarUpdate", (percentage * 100).toFixed(2));
    lastUploadPercentageDebugEvent = percentage;
  }

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
  sendDebugEvent("ThoughtsFormSend", "ini");
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
    sendDebugEvent("ThoughtsFormSend", "end");
    sendingThoughtsFinished();
  } catch(e) {
    console.log("Huston we have problem...:", e);
  }
}

async function captureScreenStream() {
  sendDebugEvent("CaptureScreenStream", "ini");
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({video: {cursor: "motion"}, audio: {"echoCancellation": true}});
    permissionScreenBlock.style.display = "none";
    sendDebugEvent("CaptureScreenStream", "end");
    checkScreenPermissionsAccepted();
    checkAllPermissionsAccepted();
  } catch (error) {
    sendDebugEvent("CaptureScreenStream", "error");
    permissionScreenCheck.checked = false;
    const errorMessage = "There was a problem trying to get permissions to record your screen.\n\nPlease try again.\n\nMaybe the permissions are block in the browser settings."
    console.error("On captureScreenStream()", error);
    showError(errorMessage);
  }
}

async function captureMicStream() {
  sendDebugEvent("CaptureMicStream", "ini");
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: {"echoCancellation": true}, video: false });
    permissionMicBlock.style.display = "none";
    sendDebugEvent("CaptureMicStream", "end");
    checkScreenPermissionsAccepted();
    checkAllPermissionsAccepted();
  } catch (error) {
    sendDebugEvent("CaptureMicStream", "error");
    permissionMicCheck.checked = false;
    const errorMessage = "There was a problem trying to get permissions to record your mic.\n\nPlease try again.\n\nMaybe the permissions are block in the browser settings."
    console.error("On captureMicStream()", error);
    showError(errorMessage);
  }
}

function checkScreenPermissionsAccepted() {
  if(permissionScreenCheck.checked) {
    sendDebugEvent("ScreenPermissionsAccepted");
    showButtonRecord();
  }
}

function checkAllPermissionsAccepted() {
  if(permissionScreenCheck.checked && permissionMicCheck.checked) {
    sendDebugEvent("AllPermissionsAccepted");
    hidePermissionForm();
  }
}

function hidePermissionForm () {
  permissionForm.style.display = "none";
}

function showButtonRecord() {
  buttonRecord.style.display = "inline-block";
}

function clickOnPermissionScreenCheck() {
  if(permissionScreenCheck.checked) {
    captureScreenStream();
  }
}

function clickOnPermissionMicCheck() {
  if(permissionMicCheck.checked) {
    captureMicStream();
  }
}

function refreshPage() {
  sendDebugEvent("RefreshPage");
  location.reload();
}

function sendDebugEvent(name, value = null) {
  console.log("sendDebugEvent()", name, value);
  const debug_session_api_url = getParam("debug_session_api_url");
  const api_token = getParam("api_token");
  const front_user_id = getParam("front_user_id");

  let formData = new FormData();
  formData.append("front_user_id", front_user_id);
  formData.append("name", name);
  formData.append("value", value);

  axios.request({
    method: "post",
    url: debug_session_api_url.replace("DEBUG_SESSION_UUID", debugSessionID),
    data: formData,
    headers: { "Authorization": "Playcocola " + api_token }
  }).catch(function (error) {
    console.error("On getPlaySessionInfo()", error);
  });
}

function initDebugSessionId() {
  debugSessionID = uuidv4();
}

// From: https://stackoverflow.com/a/2117523/316700
function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function captureWindowErrors() {
  window.addEventListener("error", function (error) {
    console.log("error", error);
    showError("We have detected an error:\n\n(" + error.lineno + ") " + error.message);
  });
}


// Start
captureWindowErrors();
uploadProgressBarUpdate(0);
getPlaySessionInfo();
captureThoughtsFormSubmit();
initDebugSessionId();
sendDebugEvent("PageLoaded");
