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
var fullStream;

var play_gathering_api_url;
var play_session_api_url;
var api_token;

var mimeType;
var mediaRecorder;
var recordedChunks;

var videoPartsMilliseconds = 60_000; // 1 minute
var sessionFinalized = false;
var uploadFinished = true;
var thoughtsSent = false;


buttonRecord.style.display = "none";
buttonStop.style.display = "none";
videoElement.style.display = "none";
linkDownload.style.display = "none";
progressBarDiv.style.display = "none";
thoughtsFormDiv.style.display = "none";
thanksDiv.style.display = "none";
errorDiv.style.display = "none";
permissionForm.style.display = "none";

function setMimeType(){
  if(MediaRecorder.isTypeSupported("video/webm;codecs=vp9")){
    mimeType = "video/webm;codecs=vp9";
  } else {
    mimeType = "video/webm";
  }

  console.log("Using mimeType: " + mimeType);
}

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
  videoElement.style.display = "none";
}

// function uploadFinished() {
//   progressBarDiv.style.display = "none";
//   thanksDiv.style.display = "block";
//   uploadIsFinished = true;

//   if(thoughtsFormIsReady) {
//     thoughtsFormSend();
//   }
// }

function sendingThoughtsFinished() {
  console.log("sendingThoughtsFinished()");
  thoughtsSent = true;
  if(uploadFinished)
    thanksDiv.style.display = "block";
}

buttonRecord.addEventListener("click", function () {
  recordScreen();
});

buttonStop.addEventListener("click", function () {
    sendDebugEvent("buttonStop Clicked");
    stopRecord();
    App.shouldStop = true;
    App.stopped = true;
    sessionFinalized = true;
    if(mediaRecorder.state == "recording")
      mediaRecorder.stop();
});


function startRecording() {
    sendDebugEvent("HandleRecord :: ini");
    startRecord();
    mediaRecorder = new MediaRecorder(fullStream, { mimeType: mimeType });
    App.stopped = false;

    recordedChunks = [];

    mediaRecorder.ondataavailable = function (e) {
      console.log("ondataavailable", e.data.size);
      recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = function () {
      sendDebugEvent("recordVideoChunk :: end");
      actualChunks = recordedChunks.splice(0, recordedChunks.length);
      const blob = new Blob(actualChunks, { type: mimeType });
      // getSeekableBlob(blob, uploadVideoPart);
      uploadVideoPart(blob);

      if(App.stopped){
        if(fullStream != null)
          fullStream.getTracks().forEach( track => track.stop() );

        if(micStream != null)
          micStream.getTracks().forEach( track => track.stop() );

        if(screenStream != null)
          screenStream.getTracks().forEach( track => track.stop() );
      }
    };

    recordVideoChunk();
};

function recordVideoChunk() {
  sendDebugEvent("recordVideoChunk :: start");
  mediaRecorder.start();

  setTimeout(function() {
    if(mediaRecorder.state == "recording")
      mediaRecorder.stop();

    if(!App.stopped)
      recordVideoChunk();
  }, videoPartsMilliseconds);
}

// function finalBlob(blob) {
//   sendDebugEvent("FinalBlob :: ini");
//   const filename = "MyPlayTestingSession_" + Date.now();
//   let videoUrl = URL.createObjectURL(blob);
//   linkDownload.href = videoUrl;
//   linkDownload.download = `${filename || "recording"}.webm`;
//   linkDownload.style.display = "inline-block";

//   videoElement.srcObject = null;
//   videoElement.src = videoUrl;
//   videoElement.load();
//   videoElement.onloadeddata = function() {
//     console.log("video.onloadeddata()");
//     videoElement.controls = true;
//   }

//   sendDebugEvent("FinalBlob :: end");
//   uploadFile(blob);
// }

// From: https://stackoverflow.com/a/43378874/316700
function getParam(param){
  return new URLSearchParams(window.location.search).get(param);
}

function getPlaySessionInfo() {
  // sendDebugEvent("GetPlaySessionInfo :: ini");

  axios.request({
    method: "get",
    url: play_gathering_api_url,
    headers: { "Authorization": "Playcocola " + api_token }
  }).then(function(response) {
    iniPlaySessionAPIUrl(response.data.play_session_api_url);
    showPlaySessionInfo(response.data.play_gathering);
    showPermissionForm();
    sendDebugEvent("GetPlaySessionInfo :: end");
  }).catch(function (error) {
    sendDebugEvent("GetPlaySessionInfo :: error");
    const errorMessage = "There was a problem trying to get the information for this Play Session.\n\nPlease try again."
    console.error("On getPlaySessionInfo()", errorMessage);
    showError(errorMessage);
  });
}

function showError(errorMessage) {
  errorDiv.querySelector("#error-message").innerHTML = marked(errorMessage);
  errorDiv.style.display = "block";
  sendDebugEvent("ShowError: " + errorMessage);
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

// function getSeekableBlob(inputBlob, callback) {
//   sendDebugEvent("GetSeekableBlob : ini");
//   // EBML.js copyrights goes to: https://github.com/legokichi/ts-ebml
//   if (typeof EBML === 'undefined') {
//       throw new Error('Please link: https://cdn.webrtc-experiment.com/EBML.js');
//   }
//   var reader = new EBML.Reader();
//   var decoder = new EBML.Decoder();
//   var tools = EBML.tools;
//   var fileReader = new FileReader();
//   fileReader.onload = function(e) {
//       var ebmlElms = decoder.decode(this.result);
//       ebmlElms.forEach(function(element) {
//           reader.read(element);
//       });
//       reader.stop();
//       var refinedMetadataBuf = tools.makeMetadataSeekable(reader.metadatas, reader.duration, reader.cues);
//       var body = this.result.slice(reader.metadataSize);
//       var newBlob = new Blob([refinedMetadataBuf, body], {
//           type: 'video/webm'
//       });
//       sendDebugEvent("GetSeekableBlob :: end");
//       callback(newBlob);
//   };
//   fileReader.readAsArrayBuffer(inputBlob);
// }

async function recordScreen() {
    sendDebugEvent("recordScreen :: ini");
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
      sendDebugEvent("screenStream.getAudioTracks :: system_sound");
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.1;

      const displayAudio = audioContext.createMediaStreamSource(screenStream);
      displayAudio.connect(gainNode);

      gainNode.connect(audioDestination);
    } else {
      sendDebugEvent("screenStream.getAudioTracks :: no_system_sound");
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

    fullStream = new MediaStream(tracks);

    startRecording()

    videoElement.srcObject = fullStream;
    sendDebugEvent("recordScreen :: end");
}

async function uploadVideoPart(blob) {
  sendDebugEvent("uploadVideoPart :: ini");
  progressBarDiv.style.display = "block";
  uploadFinished = false;

  let formData = new FormData();
  formData.append("video_part", blob);

  try {
    let response =
      await axios.request({
        method: "post",
        url: play_session_api_url + "/video_part",
        data: formData,
        headers: { "Authorization": "Playcocola " + api_token },
        onUploadProgress: (p) => {
          console.log("progress: ", p);
          uploadProgressBarUpdate(p.loaded / p.total);
        }
      });
  } catch(error) {
    sendDebugEvent("uploadVideoPart :: error");
    console.error("On uploadVideoPart()", error);
  } finally {
    progressBarDiv.style.display = "none";
    uploadFinished = true;

    if(sessionFinalized) {
      sendSignalSessionFinalized();
      if(thoughtsSent)
        thanksDiv.style.display = "block";
    }

    sendDebugEvent("uploadVideoPart :: end");
  }
}

// async function uploadFile(blob) {
//   sendDebugEvent("UploadFile :: ini");

//   let formData = new FormData();
//   formData.append("video", blob);

//   try {
//     console.log("Start uploading");

//     let response =
//       await axios.request({
//         method: "post",
//         url: play_session_api_url + "/video",
//         data: formData,
//         headers: { "Authorization": "Playcocola " + api_token },
//         onUploadProgress: (p) => {
//           console.log("progress: ", p);
//           uploadProgressBarUpdate(p.loaded / p.total);
//         }
//       });

//     console.log("HTTP response:", response);
//     console.log("HTTP response code:", response.status);
//     sendDebugEvent("UploadFile :: end");
//     uploadFinished(response.data.uuid);
//   } catch(e) {
//     console.log("Error on uploadFile...:", e);
//   }
// }

var lastUploadPercentageDebugEvent = 0;
function uploadProgressBarUpdate(percentage) {
  if(percentage > lastUploadPercentageDebugEvent + 0.1) {
    sendDebugEvent("UploadProgressBarUpdate: " + (percentage * 100).toFixed(2));
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
  thoughtsFormDiv.style.display = "none";
  thoughtsFormSend();
}

async function thoughtsFormSend() {
  sendDebugEvent("ThoughtsFormSend :: ini");

  let formData = new FormData();
  formData.append("user_name", thoughtsForm.querySelector('[name="name"]').value );
  formData.append("user_email", thoughtsForm.querySelector('[name="email"]').value );
  formData.append("user_comment", thoughtsForm.querySelector('[name="comment"]').value );

  try {
    let response =
      await axios.request({
        method: "post",
        url: play_session_api_url + "/comment",
        data: formData,
        headers: { "Authorization": "Playcocola " + api_token }
      });

    sendDebugEvent("ThoughtsFormSend :: end");
    sendingThoughtsFinished();
  } catch(error) {
    sendDebugEvent("ThoughtsFormSend :: error");
    console.error("On ThoughtsFormSend()", error);
  }
}

async function sendSignalSessionFinalized() {
  sendDebugEvent("sendSignalSessionFinalized :: ini");

  try {
    let response =
      await axios.request({
        method: "post",
        url: play_session_api_url + "/session_finalized",
        headers: { "Authorization": "Playcocola " + api_token }
      });

    sendDebugEvent("sendSignalSessionFinalized :: end");
  } catch(error) {
    sendDebugEvent("sendSignalSessionFinalized :: error");
    console.error("On sendSignalSessionFinalized()", error);
  }
}

async function captureScreenStream() {
  sendDebugEvent("CaptureScreenStream :: ini");
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({video: {cursor: "motion"}, audio: {"echoCancellation": false}});
    permissionScreenBlock.style.display = "none";
    sendDebugEvent("CaptureScreenStream :: end");
    checkScreenPermissionsAccepted();
    checkAllPermissionsAccepted();
  } catch (error) {
    sendDebugEvent("CaptureScreenStream :: error");
    permissionScreenCheck.checked = false;
    const errorMessage = "There was a problem trying to get permissions to record your screen.\n\nPlease try again.\n\nMaybe the permissions are block in the browser settings."
    console.error("On captureScreenStream()", error);
    showError(errorMessage);
  }
}

async function captureMicStream() {
  sendDebugEvent("CaptureMicStream :: ini");
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: {"echoCancellation": true}, video: false });
    permissionMicBlock.style.display = "none";
    sendDebugEvent("CaptureMicStream :: end");
    checkScreenPermissionsAccepted();
    checkAllPermissionsAccepted();
  } catch (error) {
    sendDebugEvent("CaptureMicStream :: error");
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

function sendDebugEvent(value) {
  console.log("sendDebugEvent()", value);

  let formData = new FormData();
  formData.append("tag", "client-action");
  formData.append("value", value);

  axios.request({
    method: "post",
    url: play_session_api_url + "/event",
    data: formData,
    headers: { "Authorization": "Playcocola " + api_token }
  }).catch(function (error) {
    console.error("On sendDebugEvent()", error);
  });
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

function iniAPIUrlsAndToken() {
  play_gathering_api_url = getParam("play_gathering_api_url");
  api_token = getParam("api_token");
}

function iniPlaySessionAPIUrl(url) {
  play_session_api_url = url;
}


// Start
setMimeType();
captureWindowErrors();
uploadProgressBarUpdate(0);
iniAPIUrlsAndToken();
getPlaySessionInfo();
captureThoughtsFormSubmit();
// sendDebugEvent("PageLoaded");
